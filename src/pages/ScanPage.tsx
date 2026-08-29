import {
  useCallback,
  useEffect,
  useRef,
  useState,
} from 'react';
import { useScanner } from '../scan/useScanner';
import { haptic, primeHaptics } from '../scan/haptics';

/*
 * The door.
 *
 * One screen, held by a volunteer, pointed at a queue. Everything on it
 * is sized to be read at arm's length by someone who is also talking to
 * a person, so there is exactly one thing to look at: the verdict.
 *
 * Fail closed, by decision. If the claim does not reach the Worker
 * nobody is admitted and the card says so, because admitting on a guess
 * and reconciling later is how a room ends up over capacity with no way
 * to tell which entries were real.
 */

const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL || 'https://events.oscvitap.com';

type Verdict =
  | 'admitted'
  | 'already-in'
  | 'full'
  | 'unknown'
  | 'revoked'
  | 'closed'
  | 'not-configured'
  | 'error';

interface ClaimResult {
  verdict: Verdict;
  kind?: 'reserved' | 'registered';
  name?: string | null;
  seat_id?: string | null;
  /* Reserved passes only. A seat is assigned to one named person, so
     the volunteer taking them to it has to be able to check. */
  college_registration_number?: string | null;
  first_device?: string;
  first_scanned_at?: string;
}

interface GateState {
  configured: boolean;
  is_open?: boolean;
  capacity?: number;
  inside?: number;
  general_remaining?: number;
  reserved_issued?: number;
}

/* Green means go, amber means stop and talk, red means do not admit. */
const LOOK: Record<Verdict, { bg: string; label: string }> = {
  admitted: { bg: 'bg-emerald-500', label: 'Let them in' },
  'already-in': { bg: 'bg-amber-500', label: 'Already inside' },
  full: { bg: 'bg-red-600', label: 'Auditorium full' },
  unknown: { bg: 'bg-red-600', label: 'Pass not recognised' },
  revoked: { bg: 'bg-red-600', label: 'Pass cancelled' },
  closed: { bg: 'bg-red-600', label: 'Entry closed' },
  'not-configured': { bg: 'bg-red-600', label: 'Door not set up' },
  error: { bg: 'bg-red-600', label: 'No connection' },
};

const ScanPage = () => {
  const [device, setDevice] = useState<{ id: string; label: string } | null>(null);
  const [signingIn, setSigningIn] = useState(false);
  const [signInError, setSignInError] = useState('');
  const [deviceToken, setDeviceToken] = useState('');

  const [result, setResult] = useState<ClaimResult | null>(null);
  const [claiming, setClaiming] = useState(false);
  const [gate, setGate] = useState<GateState | null>(null);

  /* Cleared on the next scan rather than on a timer: a verdict that
     vanishes while someone is still reading it is worse than one that
     lingers. */
  const clearRef = useRef<(() => void) | null>(null);

  const claim = useCallback(async (token: string) => {
    setClaiming(true);

    try {
      const response = await fetch(`${API_BASE_URL}/api/scan/claim`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token }),
      });

      if (response.status === 401) {
        setDevice(null);
        setResult(null);
        return;
      }

      if (!response.ok) throw new Error(String(response.status));

      const claimed: ClaimResult = await response.json();

      /*
       * Felt before it is read. The phone is usually held low and
       * pointed at a pass while the volunteer is looking at a face, so
       * the buzz is what tells them the answer.
       */
      haptic(
        claimed.verdict === 'admitted'
          ? 'admitted'
          : claimed.verdict === 'already-in'
            ? 'warn'
            : 'refused',
      );

      setResult(claimed);
    } catch {
      /*
       * A distinct verdict, not one of the refusals. "Full" and "no
       * connection" both mean nobody goes in, but only one of them is
       * worth shouting across the foyer about.
       */
      haptic('refused');
      setResult({ verdict: 'error' });
    } finally {
      setClaiming(false);
    }
  }, []);

  /*
   * Scanning stops dead while a verdict is on screen.
   *
   * Left running, the next pass in the queue decodes the moment it
   * drifts into frame, which replaces the card the volunteer is still
   * reading and, worse, admits somebody nobody looked at. A person is
   * checked in when a person decides they are, so the camera waits for
   * a tap.
   */
  const scanner = useScanner({
    onToken: claim,
    paused: claiming || !device || result !== null,
    /*
     * No camera until the device has signed in. Asking earlier put an
     * iOS permission prompt in front of the sign-in form, before the
     * volunteer knew what the app was, and acquired a stream at a
     * moment when the video element did not exist to attach it to.
     */
    enabled: Boolean(device),
  });

  clearRef.current = scanner.release;

  /* Sign in with the device token, once per phone per event. */
  const signIn = async (event: React.FormEvent) => {
    event.preventDefault();

    setSigningIn(true);
    setSignInError('');

    /*
     * Inside the tap that submits the form, which is the last
     * guaranteed user gesture before scanning starts. Some platforms
     * only allow a haptic from within one, and without this the very
     * first admission of a shift is the one nobody feels.
     */
    primeHaptics();

    try {
      const response = await fetch(`${API_BASE_URL}/api/scan/session`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ device_token: deviceToken.trim() }),
      });

      if (!response.ok) {
        setSignInError(
          response.status === 401
            ? 'That token was not recognised.'
            : 'Could not sign in. Check the connection.',
        );
        return;
      }

      const body = await response.json();

      setDevice({ id: body.device_id, label: body.label });
      setDeviceToken('');
    } catch {
      setSignInError('Could not reach the server.');
    } finally {
      setSigningIn(false);
    }
  };

  /* Is this phone already signed in? */
  useEffect(() => {
    let live = true;

    fetch(`${API_BASE_URL}/api/scan/state`, { credentials: 'include' })
      .then((r) => (r.ok ? r.json() : null))
      .then((state) => {
        if (!live || !state) return;
        setGate(state);
        setDevice({ id: 'signed-in', label: 'Queue' });
      })
      .catch(() => {
        /* Not signed in, or offline. The form is the answer to both. */
      });

    return () => {
      live = false;
    };
  }, []);

  /*
   * The counter, polled on its own.
   *
   * Deliberately separate from the claim so a slow poll can never delay
   * the thing a person is standing there waiting for.
   */
  useEffect(() => {
    if (!device) return;

    let live = true;

    const read = () => {
      fetch(`${API_BASE_URL}/api/scan/state`, { credentials: 'include' })
        .then((r) => (r.ok ? r.json() : null))
        .then((state) => {
          if (live && state) setGate(state);
        })
        .catch(() => {
          /* The counter going stale is not worth interrupting anyone. */
        });
    };

    read();

    const timer = window.setInterval(read, 3000);

    return () => {
      live = false;
      window.clearInterval(timer);
    };
  }, [device, result]);

  /* Stops the phone sleeping between people. */
  useEffect(() => {
    if (!device) return;

    let sentinel: WakeLockSentinel | null = null;

    const request = async () => {
      try {
        sentinel = await navigator.wakeLock?.request('screen');
      } catch {
        /* Refused or unsupported: the phone will sleep, which is
           annoying rather than broken. */
      }
    };

    void request();

    const again = () => {
      if (document.visibilityState === 'visible') void request();
    };

    document.addEventListener('visibilitychange', again);

    return () => {
      document.removeEventListener('visibilitychange', again);
      void sentinel?.release();
    };
  }, [device]);

  if (!device) {
    return (
      /* Same dvh problem as the scanner: centred inside a 100vh box on
         iOS puts the form below the middle of what you can see. Scrolls
         rather than clips, so the keyboard cannot bury the button. */
      <div className="screen-h flex items-center justify-center overflow-y-auto bg-dark-900 px-6 py-10">
        <form onSubmit={signIn} className="w-full max-w-sm">
          <h1 className="text-2xl font-bold text-white">Door scanner</h1>

          <p className="mt-2 text-sm text-gray-400">
            Enter the token for this phone. You only do this once.
          </p>

          <input
            value={deviceToken}
            onChange={(e) => setDeviceToken(e.target.value)}
            autoComplete="off"
            autoCapitalize="none"
            spellCheck={false}
            placeholder="Device token"
            className="mt-6 w-full rounded-lg border border-dark-600 bg-dark-800 px-4 py-3 font-mono text-white placeholder:text-gray-600 focus:border-brand-primary focus:outline-none"
          />

          {signInError && (
            <p role="alert" className="mt-3 text-sm text-red-400">
              {signInError}
            </p>
          )}

          <button
            type="submit"
            disabled={signingIn || !deviceToken.trim()}
            className="mt-4 flex min-h-[52px] w-full items-center justify-center rounded-lg bg-brand-primary text-base font-semibold text-white disabled:opacity-40"
          >
            {signingIn ? 'Signing in…' : 'Start scanning'}
          </button>
        </form>
      </div>
    );
  }

  const look = result ? LOOK[result.verdict] : null;

  return (
    /* .screen-h is dvh with a vh fallback. See index.css: pairing them
       as height and min-height instead lets the larger vh win. */
    <div className="screen-h flex flex-col overflow-hidden bg-black">
      {/*
        * min-h-0 because a flex item's default min-height is auto, which
        * refuses to shrink below its content and leaves this box sized
        * by the video's intrinsic dimensions rather than by the space
        * available. That is what letterboxed the preview into a band in
        * the middle of a black screen.
        */}
      <div className="relative min-h-0 flex-1 overflow-hidden">
        <video
          ref={scanner.videoRef}
          /*
           * Absolute against the relative parent rather than h-full.
           * A percentage height needs a definite parent height to
           * resolve against, and a flex item's height is computed
           * rather than definite, so h-full quietly collapsed here.
           */
          className="absolute inset-0 h-full w-full object-cover"
          playsInline
          muted
          autoPlay
        />

        {/* Where to hold the pass. */}
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
          <div className="h-56 w-56 rounded-2xl border-4 border-white/70" />
        </div>

        {scanner.status !== 'running' && (
          <div className="absolute inset-x-0 top-0 bg-amber-500 px-4 py-3 text-center text-sm font-semibold text-black">
            {scanner.status === 'denied'
              ? 'Camera blocked. Allow it in the browser settings.'
              : scanner.status === 'unavailable'
                ? 'This browser cannot run the scanner. Use Chrome.'
                : scanner.status === 'restarting'
                  ? 'Camera restarting, hold on'
                  : scanner.status === 'failed'
                    ? 'Camera would not start.'
                    : 'Starting the camera…'}
          </div>
        )}

        {/* The verdict, over everything. */}
        {look && (
          <button
            type="button"
            onClick={() => {
              setResult(null);
              clearRef.current?.();
            }}
            className={`absolute inset-x-0 bottom-0 ${look.bg} px-5 pb-8 pt-6 text-left`}
          >
            <div className="text-3xl font-black leading-tight text-white">
              {look.label}
            </div>

            {result?.name && (
              <div className="mt-1 text-lg font-semibold text-white/90">
                {result.name}
              </div>
            )}

            {/*
              * Seat and registration number together, big and mono.
              * These are the two things a volunteer reads aloud while
              * walking somebody to a reserved seat, so they are sized to
              * be read at arm's length rather than squinted at.
              */}
            {(result?.seat_id || result?.college_registration_number) && (
              <div className="mt-2 flex flex-wrap items-baseline gap-x-4 font-mono">
                {result.seat_id && (
                  <span className="text-2xl font-bold text-white">
                    Seat {result.seat_id}
                  </span>
                )}

                {result.college_registration_number && (
                  <span className="text-xl font-bold text-white/95">
                    {result.college_registration_number}
                  </span>
                )}
              </div>
            )}

            {result?.verdict === 'already-in' && result.first_scanned_at && (
              <div className="mt-1 text-sm text-white/80">
                Scanned at {new Date(result.first_scanned_at).toLocaleTimeString()}
                {result.first_device ? ` on ${result.first_device}` : ''}
              </div>
            )}

            {/*
              * The whole card is the button, because a volunteer is
              * holding a phone one-handed and looking at a person
              * rather than at a target. Scanning does not resume until
              * this is tapped.
              */}
            <div className="mt-4 rounded-lg bg-black/25 py-3 text-center text-sm font-bold uppercase tracking-widest text-white">
              Tap for the next person
            </div>
          </button>
        )}
      </div>

      {/* The counter and the torch. */}
      <div className="flex items-center gap-4 border-t border-dark-700 bg-dark-900 px-4 py-3">
        <div className="min-w-0 flex-1">
          {gate?.configured ? (
            <div className="font-mono text-sm text-white">
              {gate.inside} / {gate.capacity}
              <span className="ml-2 text-gray-500">
                {gate.general_remaining} general left
              </span>
            </div>
          ) : (
            <div className="font-mono text-sm text-gray-500">counting…</div>
          )}

          <div className="mt-0.5 text-[11px] uppercase tracking-widest text-gray-600">
            {scanner.engine === 'native' ? 'fast decoder' : 'fallback decoder'}
          </div>
        </div>

        {scanner.torchAvailable && (
          <button
            type="button"
            onClick={scanner.toggleTorch}
            className={`min-h-[44px] rounded-lg px-4 text-sm font-semibold ${
              scanner.torchOn ? 'bg-white text-black' : 'bg-dark-700 text-white'
            }`}
          >
            Torch
          </button>
        )}
      </div>
    </div>
  );
};

export default ScanPage;
