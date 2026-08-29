import jsQR from 'jsqr';

/*
 * The fallback decoder, off the main thread.
 *
 * Used only where BarcodeDetector is missing. jsQR on a phone-sized
 * frame is tens of milliseconds, and tens of milliseconds on the main
 * thread is dropped video frames and a preview that looks frozen at the
 * exact moment a volunteer is holding a queue up.
 *
 * The caller sends an already-cropped, already-downscaled frame. Doing
 * that work here would mean shipping the full frame across the thread
 * boundary every time, which costs more than the decode.
 */

interface DecodeRequest {
	/* Correlates the answer with the frame, so a slow decode landing
	   after a newer one can be dropped rather than acted on. */
	id: number;
	width: number;
	height: number;
	buffer: ArrayBuffer;
}

interface DecodeResult {
	id: number;
	text: string | null;
}

self.onmessage = (event: MessageEvent<DecodeRequest>) => {
	const { id, width, height, buffer } = event.data;

	let text: string | null = null;

	try {
		const code = jsQR(new Uint8ClampedArray(buffer), width, height, {
			/*
			 * Only invert on a second pass would be ideal, but jsQR does
			 * not expose that. attemptBoth doubles the worst case and
			 * these are dark-on-light passes, so it is off: a printed
			 * pass is never inverted, and paying for that possibility on
			 * every frame is the wrong trade in a queue.
			 */
			inversionAttempts: 'dontInvert',
		});

		text = code?.data ?? null;
	} catch {
		/* A malformed frame is not worth reporting: the next one is
		   already on its way. */
		text = null;
	}

	const result: DecodeResult = { id, text };

	self.postMessage(result);
};

export {};
