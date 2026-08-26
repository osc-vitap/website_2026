import {
  useEffect,
  useRef,
  useState,
} from 'react';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router-dom';
import { ArrowRight } from 'lucide-react';
import { useReducedMotion } from 'framer-motion';

/*
 * "Taking you to oscvitap.com in 5..." — shown after a registration
 * goes through, then it navigates.
 *
 * Counts down out loud rather than moving the page without warning,
 * and offers both a way to go now and a way to stay. Someone
 * screenshotting their registration ID should not have the page pulled
 * out from under them, so dismissing cancels the redirect entirely.
 */

interface RedirectToastProps {
  /** Where to send them. */
  to?: string;
  /** Whole seconds to wait. */
  seconds?: number;
  label?: string;
}

const RedirectToast = ({
  to = '/',
  seconds = 5,
  label = 'oscvitap.com',
}: RedirectToastProps) => {
  const navigate = useNavigate();
  const still = useReducedMotion();

  const [left, setLeft] =
    useState(seconds);

  const [dismissed, setDismissed] =
    useState(false);

  /*
   * Held in a ref so the ticking effect does not depend on `navigate`
   * and re-run — restarting the interval every render would make the
   * countdown crawl.
   */
  const go = useRef(() => navigate(to));
  go.current = () => navigate(to);

  useEffect(() => {
    if (dismissed) return;

    /*
     * Driven off a deadline rather than by decrementing a counter, so
     * a throttled background tab does not stretch five seconds into
     * however long it felt like taking.
     */
    const deadline =
      Date.now() + seconds * 1000;

    const id = window.setInterval(() => {
      const remaining = Math.ceil(
        (deadline - Date.now()) / 1000,
      );

      if (remaining <= 0) {
        window.clearInterval(id);
        setLeft(0);
        go.current();
        return;
      }

      setLeft(remaining);
    }, 250);

    return () =>
      window.clearInterval(id);
  }, [dismissed, seconds]);

  if (dismissed) return null;

  /*
   * Portalled to <body> rather than rendered in place.
   *
   * position: fixed is resolved against the nearest ancestor with a
   * transform, filter or backdrop-filter — not the viewport. The poster
   * page's confirmation panel has all three, so the toast was pinned
   * inside the panel, half-covering the very message it was announcing.
   */
  return createPortal(
    <div
      role="status"
      aria-live="polite"
      className="pointer-events-none fixed inset-x-0 bottom-0 z-50 flex justify-center p-4 sm:p-6"
    >
      <div className="pointer-events-auto w-full max-w-md overflow-hidden border border-dark-600 bg-dark-800/95 shadow-2xl backdrop-blur-md">

        {/* Reads as time running out without needing to be read. */}
        <div className="h-0.5 w-full bg-dark-600">
          <div
            className="h-full bg-brand-accent"
            style={{
              width: `${(left / seconds) * 100}%`,
              transition: still
                ? undefined
                : 'width 250ms linear',
            }}
          />
        </div>

        <div className="flex items-center gap-3 p-4">
          <p className="min-w-0 flex-1 text-sm text-white/80">
            Taking you to{' '}
            <span className="text-white">
              {label}
            </span>{' '}
            in{' '}
            <span className="tabular-nums font-semibold text-brand-accent">
              {left}
            </span>
            s
          </p>

          <button
            type="button"
            onClick={() => setDismissed(true)}
            className="shrink-0 font-mono text-[10px] uppercase tracking-[0.2em] text-white/50 transition-colors hover:text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-brand-accent"
          >
            Stay
          </button>

          <button
            type="button"
            onClick={() => go.current()}
            className="inline-flex shrink-0 items-center gap-1.5 border border-brand-primary/60 bg-brand-primary/20 px-3 py-1.5 font-mono text-[10px] uppercase tracking-[0.2em] text-white transition-colors hover:bg-brand-primary/40 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-accent"
          >
            Go now
            <ArrowRight size={12} />
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
};

export default RedirectToast;
