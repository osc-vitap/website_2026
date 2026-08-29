import {
  useEffect,
  useRef,
  useState,
} from 'react';
import { FlaskConical, Trash2 } from 'lucide-react';

const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL || 'https://events.oscvitap.com';

/*
 * A throwaway door, for trying the scanner today.
 *
 * Every pass this makes belongs to its own archived event, not to
 * gittyup26, so scanning one cannot move the real auditorium's count.
 * That is a property of where the rows live rather than a flag someone
 * has to remember, which is why it is safe to leave this button in the
 * panel on the day.
 *
 * The codes are drawn on screen so a phone can be pointed straight at
 * the monitor. Gold is reserved and black is registered, the same two
 * inks the printed passes use.
 */

interface TestPass {
  token: string;
  kind: 'reserved' | 'registered';
  name: string;
  url: string;
}

interface TestDoor {
  event_slug: string;
  capacity: number;
  device_token: string;
  device_id: string;
  passes: TestPass[];
  expected: string;
}

/* Matches scripts/make-entry-qr.mjs. Measured, not picked: the golds
   people picture sit too close to white for a decoder to threshold. */
const INK = {
  reserved: '#8A6D00',
  registered: '#000000',
};

const PassCode = ({ pass }: { pass: TestPass }) => {
  const host = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let cancelled = false;

    const draw = async () => {
      /*
       * Imported here rather than at the top of the file so the QR
       * library is a chunk nobody downloads unless they open this. It
       * draws into the DOM, so it cannot be rendered by React directly.
       */
      const { default: QRCodeStyling } = await import('qr-code-styling');

      if (cancelled || !host.current) return;

      host.current.replaceChildren();

      new QRCodeStyling({
        width: 150,
        height: 150,
        type: 'svg',
        data: pass.url,
        margin: 4,
        qrOptions: { errorCorrectionLevel: 'H' },
        dotsOptions: { color: INK[pass.kind], type: 'rounded' },
        backgroundOptions: { color: '#ffffff' },
        cornersSquareOptions: { color: INK[pass.kind], type: 'extra-rounded' },
        cornersDotOptions: { color: INK[pass.kind], type: 'dot' },
      }).append(host.current);
    };

    void draw();

    return () => {
      cancelled = true;
    };
  }, [pass]);

  return (
    <figure className="rounded-lg bg-white p-2 text-center">
      <div ref={host} className="mx-auto h-[150px] w-[150px]" />

      <figcaption className="mt-1 font-mono text-[11px] font-bold text-black">
        {pass.kind === 'reserved' ? 'Reserved' : 'Registered'}
      </figcaption>
    </figure>
  );
};

const AdminDoorTest = () => {
  const [door, setDoor] = useState<TestDoor | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [open, setOpen] = useState(false);

  const call = async (method: 'POST' | 'DELETE') => {
    setBusy(true);
    setError('');

    try {
      const response = await fetch(`${API_BASE_URL}/api/admin/entry-test`, {
        method,
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: method === 'POST' ? JSON.stringify({}) : undefined,
      });

      const body = await response.json();

      if (!response.ok) {
        setError(body.error ?? 'That did not work.');
        return;
      }

      setDoor(method === 'POST' ? body : null);
    } catch {
      setError('Could not reach the server.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="glass-card mb-8 p-4 md:mb-10">
      <button
        type="button"
        onClick={() => setOpen((was) => !was)}
        aria-expanded={open}
        className="flex min-h-[44px] w-full items-center gap-2 text-left text-sm font-semibold uppercase tracking-widest text-brand-accent"
      >
        <FlaskConical size={16} aria-hidden="true" />
        Test the door scanner
      </button>

      {open && (
        <>
          <p className="mt-2 text-sm text-gray-400">
            Builds six passes and a scanner token on a separate, hidden
            event. Nothing here touches the real auditorium count, so it is
            safe to run on the day.
          </p>

          <div className="mt-3 flex flex-wrap gap-2">
            <button
              type="button"
              disabled={busy}
              onClick={() => call('POST')}
              className="min-h-[44px] rounded-lg bg-brand-primary px-4 text-sm font-semibold text-white disabled:opacity-40"
            >
              {busy ? 'Working…' : door ? 'Build a fresh one' : 'Build test door'}
            </button>

            {door && (
              <button
                type="button"
                disabled={busy}
                onClick={() => call('DELETE')}
                className="flex min-h-[44px] items-center gap-2 rounded-lg border border-red-500/40 bg-red-500/10 px-4 text-sm font-semibold text-red-300 disabled:opacity-40"
              >
                <Trash2 size={15} aria-hidden="true" />
                Remove
              </button>
            )}
          </div>

          {error && (
            <p role="alert" className="mt-3 text-sm text-red-400">
              {error}
            </p>
          )}

          {door && (
            <div className="mt-5">
              <ol className="space-y-1 text-sm text-gray-300">
                <li>
                  1. Open <span className="font-mono text-white">/scan</span> on a phone.
                </li>
                <li>
                  2. Paste this device token:
                  <span className="ml-2 select-all break-all font-mono text-xs text-brand-accent">
                    {door.device_token}
                  </span>
                </li>
                <li>3. Point it at the codes below.</li>
              </ol>

              <p className="mt-3 text-xs text-gray-500">
                Capacity {door.capacity}. Expect {door.expected}. Scanning one
                twice should say already inside.
              </p>

              <div className="mt-4 flex flex-wrap gap-3">
                {door.passes.map((pass) => (
                  <PassCode key={pass.token} pass={pass} />
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </section>
  );
};

export default AdminDoorTest;
