import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { useReducedMotion } from 'framer-motion';

import CountdownDigits from './CountdownDigits';
import { useCountdown } from '../hooks/useCountdown';
import { useUpcomingEvents } from '../hooks/useUpcomingEvents';
import { eventPageForRegistration } from '../data/eventPages';
import {
  eventStartsAt,
  formatIst,
  readableRemaining,
} from '../data/eventCountdown';

/*
 * The strip under the navbar: how long until the next event.
 *
 * Rendered once in the site shell rather than per page, so every page
 * carries it without each one having to remember to. It takes the
 * soonest upcoming event straight from D1, so it retires itself when
 * the event ends and picks up whatever is scheduled next with no code
 * change.
 *
 * Nothing is rendered while loading, on failure, or with no event
 * scheduled — a countdown to nothing is worse than no countdown, and a
 * placeholder bar would push the whole page down for a moment on every
 * navigation.
 */

const EventCountdown = () => {
  const { events, loading, failed } =
    useUpcomingEvents(1);

  const event = events[0];

  const target = useMemo(
    () =>
      event ? eventStartsAt(event) : null,
    [event],
  );

  const remaining = useCountdown(target);
  const still = useReducedMotion();

  if (
    loading ||
    failed ||
    !event ||
    target === null ||
    !remaining
  ) {
    return null;
  }

  const page = eventPageForRegistration(
    event.slug,
  );

  const href = page
    ? `/${page.slug}`
    : '/events';

  const live = remaining.total <= 0;

  return (
    <div className="border-b border-dark-700 bg-dark-900/80 backdrop-blur-md">
      <div className="container mx-auto flex items-center justify-center gap-4 px-4 py-2 md:justify-between md:px-6">

        <div className="hidden min-w-0 items-center gap-2 md:flex">
          <span
            className={`h-1.5 w-1.5 shrink-0 rounded-full bg-brand-accent ${
              still ? '' : 'animate-pulse'
            }`}
          />

          <span className="truncate font-mono text-[11px] uppercase tracking-[0.2em] text-white/70">
            {event.title}
          </span>
        </div>

        {/*
          * The digits are decoration for a screen reader — ten stacked
          * copies of every numeral read as gibberish — so they are
          * hidden and a written sentence stands in. No aria-live: this
          * changes every minute, and announcing it every minute would
          * make the site unusable.
          */}
        <div
          className="flex items-center gap-3"
          title={`${formatIst(target)} IST`}
        >
          <span className="sr-only">
            {readableRemaining(
              remaining,
              event.title,
            )}
          </span>

          {live ? (
            <span
              aria-hidden
              className="font-mono text-xs uppercase tracking-[0.25em] text-brand-accent"
            >
              Happening today
            </span>
          ) : (
            <>
              <span
                aria-hidden
                className="hidden font-mono text-[10px] uppercase tracking-[0.2em] text-white/40 sm:inline"
              >
                Starts in
              </span>

              <CountdownDigits
                remaining={remaining}
                size={22}
              />
            </>
          )}
        </div>

        <Link
          to={href}
          className="hidden shrink-0 font-mono text-[11px] uppercase tracking-[0.2em] text-white/60 transition-colors hover:text-brand-accent focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-brand-accent md:inline"
        >
          Details →
        </Link>
      </div>
    </div>
  );
};

export default EventCountdown;
