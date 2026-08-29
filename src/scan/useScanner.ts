import {
  useCallback,
  useEffect,
  useRef,
  useState,
} from 'react';

/*
 * The door camera.
 *
 * One stream, held open for the whole shift, decoded on the device.
 * No frame ever leaves the phone: uploading images would be slower than
 * decoding locally, would need bandwidth the venue wifi does not have,
 * and would put a few hundred students' faces on a server for no reason.
 * Only the decoded token is sent, and it is thirty-two characters.
 *
 * The shape that matters, in order of how much it matters:
 *
 *  1. Acquire the camera once. Starting a stream is several hundred
 *     milliseconds and doing it per person is most of a queue's time.
 *  2. Drive off requestVideoFrameCallback, which fires once per new
 *     frame. A timer or rAF re-decodes frames the sensor has not
 *     replaced yet, which is pure heat.
 *  3. BarcodeDetector when it is really there, jsQR in a worker when it
 *     is not. Native is hardware backed and roughly an order of
 *     magnitude faster.
 *  4. Never decode two frames at once, and never while a claim is in
 *     flight.
 */

interface FrameMetadata {
  presentationTime: number;
}

type FrameCallback = (now: number, metadata: FrameMetadata) => void;

/*
 * The DOM lib declares requestVideoFrameCallback as always present, and
 * it is not: Firefox has never shipped it and older WebKit does not
 * have it either. Narrowing the element to a shape where both are
 * optional is what lets the runtime check below be honest instead of
 * being compiled away as always-true.
 */
type FrameApi = {
  requestVideoFrameCallback?: (cb: FrameCallback) => number;
  cancelVideoFrameCallback?: (handle: number) => void;
};

const frameApi = (video: HTMLVideoElement): FrameApi =>
  video as unknown as FrameApi;

interface DetectedBarcode {
  rawValue: string;
}

interface BarcodeDetectorLike {
  detect: (source: CanvasImageSource) => Promise<DetectedBarcode[]>;
}

interface BarcodeDetectorCtor {
  new (options?: { formats?: string[] }): BarcodeDetectorLike;
  getSupportedFormats?: () => Promise<string[]>;
}

/* Torch lives on the track's capabilities, which TS does not model. */
interface TorchCapabilities extends MediaTrackCapabilities {
  torch?: boolean;
}

export type ScanEngine = 'native' | 'fallback' | 'starting';

export type ScanStatus =
  | 'starting'
  | 'running'
  | 'restarting'
  | 'denied'
  | 'unavailable'
  | 'failed';

/*
 * How long a frame may be missing before the stream is treated as dead.
 *
 * A phone that backgrounds, sleeps, or has its camera taken by another
 * app stops delivering frames without firing an error. Without this the
 * preview freezes on its last frame and the volunteer keeps presenting
 * passes to a picture.
 */
const FRAME_TIMEOUT_MS = 1800;

/*
 * A floor between decode attempts. At 30fps a native detect on every
 * frame is wasted work: nobody presents a pass faster than this, and
 * the gap is what keeps the preview smooth.
 */
const DECODE_INTERVAL_MS = 80;

/* What the fallback decodes. Cost is linear in pixels and a QR needs
   only a few pixels per module, so this is plenty and is several times
   cheaper than the full frame. */
const FALLBACK_EDGE = 420;

export interface UseScannerOptions {
  /** Called once per newly seen token. */
  onToken: (token: string) => void;

  /** While true, frames are still drawn but nothing is decoded. */
  paused: boolean;
}

export function useScanner({ onToken, paused }: UseScannerOptions) {
  const videoRef = useRef<HTMLVideoElement | null>(null);

  const [status, setStatus] = useState<ScanStatus>('starting');
  const [engine, setEngine] = useState<ScanEngine>('starting');
  const [torchOn, setTorchOn] = useState(false);
  const [torchAvailable, setTorchAvailable] = useState(false);

  const streamRef = useRef<MediaStream | null>(null);
  const detectorRef = useRef<BarcodeDetectorLike | null>(null);
  const workerRef = useRef<Worker | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  /* One decode at a time, always. */
  const busyRef = useRef(false);
  const lastAttemptRef = useRef(0);
  const lastFrameRef = useRef(0);
  const frameHandleRef = useRef<number | null>(null);
  const attemptRef = useRef(0);

  /*
   * The token currently on screen.
   *
   * A pass held in front of the lens decodes on every single frame, so
   * without this one person fires a claim thirty times a second. It is
   * a state rule rather than a timer: the same token is ignored until a
   * different one is seen, which means a volunteer can rescan the same
   * pass deliberately by showing another one in between, and a slow
   * queue never silently re-arms.
   */
  const heldTokenRef = useRef<string | null>(null);

  /* Kept in a ref so the frame loop never has to be rebuilt when they
     change, which would tear down and re-arm the callback. */
  const pausedRef = useRef(paused);
  const onTokenRef = useRef(onToken);

  useEffect(() => {
    pausedRef.current = paused;
  }, [paused]);

  useEffect(() => {
    onTokenRef.current = onToken;
  }, [onToken]);

  /** Lets the same pass be scanned again, once the verdict is cleared. */
  const release = useCallback(() => {
    heldTokenRef.current = null;
  }, []);

  const handleText = useCallback((text: string | null) => {
    if (!text) return;

    /*
     * The pass URL is /e/<token>, but a volunteer may also be handed a
     * bare token, and some readers hand back the URL with a trailing
     * slash. Take the last non-empty path segment either way.
     */
    const token = text.trim().split(/[/?#]/).filter(Boolean).pop() ?? '';

    if (!/^[a-f0-9]{16,64}$/i.test(token)) return;

    if (heldTokenRef.current === token) return;

    heldTokenRef.current = token;

    onTokenRef.current(token);
  }, []);

  /* ---------------------------------------------------------------- */
  /* The frame loop                                                    */
  /* ---------------------------------------------------------------- */

  const decodeFrame = useCallback(async () => {
    const video = videoRef.current;

    if (!video || video.readyState < 2) return;

    const detector = detectorRef.current;

    if (detector) {
      /*
       * The whole frame, not a crop. Native detection is cheap enough
       * that cropping buys nothing, and a crop would lose a pass held
       * off to one side, which is exactly what a person does when they
       * are also holding a phone and a bag.
       */
      const found = await detector.detect(video);

      if (found.length > 1) {
        /* Two passes in shot. Picking one would admit whichever the
           decoder happened to order first, which is a coin toss with
           somebody's entry on it. */
        return;
      }

      handleText(found[0]?.rawValue ?? null);
      return;
    }

    const worker = workerRef.current;
    const canvas = canvasRef.current;

    if (!worker || !canvas) return;

    const context = canvas.getContext('2d', { willReadFrequently: true });

    if (!context) return;

    /* The centre square, downscaled. */
    const side = Math.min(video.videoWidth, video.videoHeight);

    if (!side) return;

    context.drawImage(
      video,
      (video.videoWidth - side) / 2,
      (video.videoHeight - side) / 2,
      side,
      side,
      0,
      0,
      FALLBACK_EDGE,
      FALLBACK_EDGE,
    );

    const frame = context.getImageData(0, 0, FALLBACK_EDGE, FALLBACK_EDGE);

    attemptRef.current += 1;

    /* Transferred, not copied: the buffer is several hundred kilobytes
       and structured-cloning it every frame would cost more than the
       decode saved by moving off the main thread. */
    worker.postMessage(
      {
        id: attemptRef.current,
        width: FALLBACK_EDGE,
        height: FALLBACK_EDGE,
        buffer: frame.data.buffer,
      },
      [frame.data.buffer],
    );
  }, [handleText]);

  const onFrame = useCallback<FrameCallback>(
    (now) => {
      lastFrameRef.current = now;

      const video = videoRef.current;

      if (video) {
        frameHandleRef.current =
          frameApi(video).requestVideoFrameCallback?.(onFrame) ?? null;
      }

      if (pausedRef.current || busyRef.current) return;

      if (now - lastAttemptRef.current < DECODE_INTERVAL_MS) return;

      lastAttemptRef.current = now;

      const detector = detectorRef.current;

      if (!detector) {
        /* The worker answers asynchronously and clears the flag there. */
        busyRef.current = true;
        void decodeFrame();
        return;
      }

      busyRef.current = true;

      void decodeFrame().finally(() => {
        busyRef.current = false;
      });
    },
    [decodeFrame],
  );

  /* ---------------------------------------------------------------- */
  /* Acquire                                                           */
  /* ---------------------------------------------------------------- */

  const start = useCallback(async () => {
    if (!navigator.mediaDevices?.getUserMedia) {
      setStatus('unavailable');
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: { ideal: 'environment' },
          width: { ideal: 1280 },
          height: { ideal: 720 },
          frameRate: { ideal: 30 },
        },
        audio: false,
      });

      streamRef.current = stream;

      const video = videoRef.current;

      if (!video) return;

      video.srcObject = stream;

      await video.play();

      const track = stream.getVideoTracks()[0];

      setTorchAvailable(
        Boolean((track?.getCapabilities?.() as TorchCapabilities | undefined)?.torch),
      );

      /* A track ending is the camera being taken by another app, or the
         phone deciding it is done. Either way, restart. */
      if (track) {
        track.onended = () => setStatus('restarting');
      }

      lastFrameRef.current = performance.now();

      setStatus('running');

      const api = frameApi(video);

      if (api.requestVideoFrameCallback) {
        frameHandleRef.current = api.requestVideoFrameCallback(onFrame);
      } else {
        /* Nothing to drive the loop. Better to say so than to sit on a
           live preview that never decodes anything. */
        setStatus('unavailable');
      }
    } catch (error) {
      const name = (error as DOMException | undefined)?.name;

      setStatus(name === 'NotAllowedError' || name === 'SecurityError' ? 'denied' : 'failed');
    }
  }, [onFrame]);

  const stop = useCallback(() => {
    const video = videoRef.current;

    if (video && frameHandleRef.current !== null) {
      frameApi(video).cancelVideoFrameCallback?.(frameHandleRef.current);
    }

    frameHandleRef.current = null;

    streamRef.current?.getTracks().forEach((track) => {
      track.onended = null;
      track.stop();
    });

    streamRef.current = null;
  }, []);

  const restart = useCallback(() => {
    stop();
    setStatus('starting');
    void start();
  }, [start, stop]);

  /* Pick the decoder once, then hold the stream for the shift. */
  useEffect(() => {
    let live = true;

    const setup = async () => {
      const Ctor = (window as unknown as { BarcodeDetector?: BarcodeDetectorCtor })
        .BarcodeDetector;

      /*
       * Existing is not the same as working. Some builds expose the
       * constructor and support no formats at all, so the format list
       * is checked rather than the constructor.
       */
      let usable = false;

      if (Ctor?.getSupportedFormats) {
        try {
          usable = (await Ctor.getSupportedFormats()).includes('qr_code');
        } catch {
          usable = false;
        }
      }

      if (!live) return;

      if (usable && Ctor) {
        detectorRef.current = new Ctor({ formats: ['qr_code'] });
        setEngine('native');
      } else {
        const worker = new Worker(new URL('./decoder.worker.ts', import.meta.url), {
          type: 'module',
        });

        worker.onmessage = (event: MessageEvent<{ id: number; text: string | null }>) => {
          busyRef.current = false;

          /* An answer for a frame newer than this one has already been
             acted on; this one is stale. */
          if (event.data.id === attemptRef.current) {
            handleText(event.data.text);
          }
        };

        workerRef.current = worker;

        const canvas = document.createElement('canvas');
        canvas.width = FALLBACK_EDGE;
        canvas.height = FALLBACK_EDGE;
        canvasRef.current = canvas;

        setEngine('fallback');
      }

      await start();
    };

    void setup();

    return () => {
      live = false;
      stop();
      workerRef.current?.terminate();
      workerRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /*
   * The watchdog.
   *
   * A stream can stop delivering frames without erroring, and the
   * preview simply freezes. Nothing else notices, so this does.
   */
  useEffect(() => {
    if (status !== 'running') return;

    const timer = window.setInterval(() => {
      if (document.visibilityState !== 'visible') return;

      if (performance.now() - lastFrameRef.current > FRAME_TIMEOUT_MS) {
        setStatus('restarting');
      }
    }, 1000);

    return () => window.clearInterval(timer);
  }, [status]);

  useEffect(() => {
    if (status !== 'restarting') return;

    const timer = window.setTimeout(restart, 400);

    return () => window.clearTimeout(timer);
  }, [status, restart]);

  /* Coming back from the lock screen or another app. */
  useEffect(() => {
    const onVisible = () => {
      if (document.visibilityState !== 'visible') return;

      const track = streamRef.current?.getVideoTracks()[0];

      if (!track || track.readyState !== 'live') setStatus('restarting');
    };

    document.addEventListener('visibilitychange', onVisible);

    return () => document.removeEventListener('visibilitychange', onVisible);
  }, []);

  const toggleTorch = useCallback(async () => {
    const track = streamRef.current?.getVideoTracks()[0];

    if (!track) return;

    const next = !torchOn;

    try {
      await track.applyConstraints({
        advanced: [{ torch: next } as MediaTrackConstraintSet],
      });

      setTorchOn(next);
    } catch {
      setTorchAvailable(false);
    }
  }, [torchOn]);

  return {
    videoRef,
    status,
    engine,
    torchAvailable,
    torchOn,
    toggleTorch,
    restart,
    release,
  };
}
