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

interface TestDevice {
  id: string;
  label: string;
  token: string;
  url: string;
}

interface TestDoor {
  event_slug: string;
  capacity: number;
  devices: TestDevice[];
  passes: TestPass[];
  expected: string;
}

/* Matches scripts/make-entry-qr.mjs. Measured, not picked: the golds
   people picture sit too close to white for a decoder to threshold. */
const INK = {
  reserved: '#8A6D00',
  registered: '#000000',
};

const Code = ({
  url,
  ink,
  caption,
  size = 150,
}: {
  url: string;
  ink: string;
  caption: string;
  size?: number;
}) => {
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
        width: size,
        height: size,
        type: 'svg',
        data: url,
        margin: 4,
        qrOptions: { errorCorrectionLevel: 'H' },
        dotsOptions: { color: ink, type: 'rounded' },
        backgroundOptions: { color: '#ffffff' },
        cornersSquareOptions: { color: ink, type: 'extra-rounded' },
        cornersDotOptions: { color: ink, type: 'dot' },
      }).append(host.current);
    };

    void draw();

    return () => {
      cancelled = true;
    };
  }, [url, ink, size]);

  return (
    <figure className="rounded-lg bg-white p-2 text-center">
      <div
        ref={host}
        className="mx-auto"
        style={{ width: size, height: size }}
      />

      <figcaption className="mt-1 font-mono text-[11px] font-bold text-black">
        {caption}
      </figcaption>
    </figure>
  );
};

const AdminDoorTest = () => {
  const [door, setDoor] = useState<TestDoor | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [open, setOpen] = useState(false);

  /*
   * Defaults sized for a real rehearsal rather than a smoke test: ten
   * reserved against fifteen seats leaves five for general admission,
   * so five of the ten registered get in and five are refused, and the
   * room fills to exactly fifteen.
   */
  const [capacity, setCapacity] = useState(15);
  const [reserved, setReserved] = useState(10);
  const [registered, setRegistered] = useState(10);

  const call = async (method: 'POST' | 'DELETE') => {
    setBusy(true);
    setError('');

    try {
      const response = await fetch(`${API_BASE_URL}/api/admin/entry-test`, {
        method,
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body:
          method === 'POST'
            ? JSON.stringify({ capacity, reserved, registered })
            : undefined,
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
          <p className="mt-2 text-sm text-gray-400 print:hidden">
            Builds passes and a scanner token on a separate, hidden event.
            Nothing here touches the real auditorium count, so it is safe to
            run on the day.
          </p>

          <div className="mt-4 flex flex-wrap items-end gap-3 print:hidden">
            {([
              ['Seats', capacity, setCapacity],
              ['Reserved', reserved, setReserved],
              ['Registered', registered, setRegistered],
            ] as const).map(([label, value, set]) => (
              <label key={label} className="block">
                <span className="block text-[11px] uppercase tracking-widest text-gray-500">
                  {label}
                </span>

                <input
                  inputMode="numeric"
                  value={value}
                  onChange={(e) => set(Math.max(0, Number(e.target.value) || 0))}
                  className="mt-1 min-h-[44px] w-24 rounded-lg border border-dark-600 bg-dark-800 px-3 font-mono text-white"
                />
              </label>
            ))}
          </div>

          <div className="mt-3 flex flex-wrap gap-2 print:hidden">
            <button
              type="button"
              disabled={busy}
              onClick={() => call('POST')}
              className="min-h-[44px] rounded-lg bg-brand-primary px-4 text-sm font-semibold text-white disabled:opacity-40"
            >
              {busy ? 'Working…' : door ? 'Build a fresh one' : 'Build test door'}
            </button>

            {door && (
              /*
               * One sheet, printed or saved as a PDF. Twenty separate
               * downloads get blocked by the browser after the first
               * few, and a printed sheet is what the real passes will
               * be anyway, so this tests the paper case too.
               */
              <button
                type="button"
                onClick={() => window.print()}
                className="min-h-[44px] rounded-lg border border-dark-600 px-4 text-sm font-semibold text-white"
              >
                Print / save as PDF
              </button>
            )}

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
            <div className="mt-5 door-test-sheet">
              <ol className="space-y-1 text-sm text-gray-300 print:hidden">
                <li>
                  1. Open <span className="font-mono text-white">/scan</span> on
                  each phone and tap <em>Scan the queue code</em>.
                </li>
                <li>2. Point it at one of the queue codes below.</li>
                <li>3. Then point it at the passes.</li>
              </ol>

              {/*
                * The queue codes, one per phone.
                *
                * A phone reads one of these once to authorise itself for
                * the shift. Kept visually apart from the passes and
                * captioned by queue, because the two are scanned by the
                * same camera and confusing them wastes a volunteer's
                * first minute.
                */}
              <h3 className="mt-5 text-xs font-bold uppercase tracking-widest text-gray-500">
                Queue codes, one per phone
              </h3>

              <div className="mt-3 flex flex-wrap gap-3">
                {door.devices.map((scanner) => (
                  <div key={scanner.id}>
                    <Code
                      url={scanner.url}
                      ink="#111827"
                      caption={scanner.label}
                      size={120}
                    />

                    {/* Typed only if a camera will not cooperate. */}
                    <div className="mt-1 max-w-[136px] select-all break-all text-center font-mono text-[10px] text-gray-600 print:hidden">
                      {scanner.token}
                    </div>
                  </div>
                ))}
              </div>

              <h3 className="mt-6 text-xs font-bold uppercase tracking-widest text-gray-500">
                Passes
              </h3>

              <p className="mt-1 text-xs text-gray-500">
                Capacity {door.capacity}. Expect {door.expected}. Scanning one
                twice should say already inside.
              </p>

              <div className="mt-3 flex flex-wrap gap-3">
                {door.passes.map((pass) => (
                  <Code
                    key={pass.token}
                    url={pass.url}
                    ink={INK[pass.kind]}
                    caption={pass.kind === 'reserved' ? 'Reserved' : 'Registered'}
                  />
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
