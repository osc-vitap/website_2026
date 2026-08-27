import {
  useEffect,
  useState,
} from 'react';
import { createPortal } from 'react-dom';
import { CalendarClock, X } from 'lucide-react';

/*
 * "The date has moved" — shown while somebody is filling in a
 * registration form.
 *
 * GittyUp '26 was 29 August. Thirty printed sheets still say so, and
 * they are on walls around campus, so a good number of the people
 * reaching this form scanned one and are working from the old date.
 * Telling them at the point of registering is the only moment we are
 * certain to have their attention.
 *
 * It does NOT auto-dismiss. A toast that fades after five seconds is
 * fine for "sent" and wrong for "the thing you are signing up to happens
 * on a different day" — someone typing a registration number is looking
 * at the keyboard, not the corner of the screen. It stays until closed.
 */

const STORAGE_KEY = 'gittyup26.date-change-seen.v1';

interface DateChangeToastProps {
  /** Optional accent, so the poster pages can theme it to their sheet. */
  accent?: string;
}

const DateChangeToast = ({
  accent = '#c084fc',
}: DateChangeToastProps) => {
  /*
   * Starts hidden and is raised in an effect rather than rendered
   * immediately: appearing in the same frame as the form makes it read
   * as part of the layout, and it is then dismissed without being read.
   * A beat later it reads as something that arrived.
   */
  const [shown, setShown] = useState(false);

  const [dismissed, setDismissed] =
    useState(false);

  useEffect(() => {
    /*
     * Remembered across visits. Somebody who has already been told, and
     * closed it, should not be told again every time they open a form —
     * that is how a notice becomes furniture people click past.
     */
    try {
      if (
        globalThis.localStorage?.getItem(
          STORAGE_KEY,
        )
      ) {
        return;
      }
    } catch {
      /* Storage unavailable: show it, which is the safe direction. */
    }

    const timer = window.setTimeout(
      () => setShown(true),
      450,
    );

    return () =>
      window.clearTimeout(timer);
  }, []);

  const close = () => {
    setDismissed(true);

    try {
      globalThis.localStorage?.setItem(
        STORAGE_KEY,
        '1',
      );
    } catch {
      /* Nothing to remember it in; it will show again. */
    }
  };

  if (!shown || dismissed) return null;

  /*
   * Portalled to <body>. position: fixed resolves against the nearest
   * ancestor carrying a transform, filter or backdrop-filter rather than
   * the viewport, and the poster form sits inside a glass panel with all
   * three — rendered in place this would be pinned inside the card.
   */
  return createPortal(
    <div
      role="status"
      aria-live="polite"
      className="pointer-events-none fixed inset-x-0 bottom-0 z-50 flex justify-center p-4 sm:bottom-auto sm:top-0 sm:p-6"
    >
      <div
        className="pointer-events-auto flex w-full max-w-md items-start gap-3 border bg-dark-800/95 p-4 shadow-2xl backdrop-blur-md"
        style={{
          borderColor: `color-mix(in srgb, ${accent} 45%, transparent)`,
        }}
      >
        <CalendarClock
          size={18}
          aria-hidden="true"
          className="mt-0.5 shrink-0"
          style={{ color: accent }}
        />

        <p className="min-w-0 flex-1 text-sm leading-relaxed text-white/85">
          <span className="font-semibold text-white">
            The date has moved.
          </span>{' '}
          GITTY UP is now{' '}
          <span
            className="font-semibold"
            style={{ color: accent }}
          >
            1 September
          </span>
          , not 29 August. Printed posters still show the old date.
        </p>

        <button
          type="button"
          onClick={close}
          aria-label="Dismiss the date change notice"
          className="-m-1 shrink-0 p-1 text-white/50 transition-colors hover:text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2"
          style={{ outlineColor: accent }}
        >
          <X size={16} aria-hidden="true" />
        </button>
      </div>
    </div>,
    document.body,
  );
};

export default DateChangeToast;
