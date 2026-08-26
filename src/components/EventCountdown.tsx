import {
  useEffect,
  useMemo,
  useState,
} from 'react';
import { Link } from 'react-router-dom';
import { useReducedMotion } from 'framer-motion';

import Counter from './Counter';
import { useUpcomingEvents } from '../hooks/useUpcomingEvents';
import { eventPageForRegistration } from '../data/eventPages';
import {
  eventStartsAt,
  formatIst,
  readableRemaining,
  remainingUntil,
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

const DIGIT_SIZE = 22;

interface UnitProps {
  value: number;
  places: number[];
  label: string;
  still: boolean;
}

const Unit = ({
  value,
  places,
  label,
  still,
}: UnitProps) => (
  /*
   * Centred, not baseline-aligned: the Counter is an inline-block whose
   * baseline is the bottom of its box, so a baseline-aligned label
   * hangs well below the digits it belongs to.
   */
  <span className="flex items-center gap-1">
    {still ? (
      /*
       * Reduced motion: the same number, without ten copies of every
       * digit sliding past. Padded by hand to the width the rolling
       * version reserves, so the row does not shift between the two.
       */
      <span
        className="tabular-nums font-semibold text-brand-accent"
        style={{
          fontSize: DIGIT_SIZE,
          lineHeight: 1,
        }}
      >
        {String(value).padStart(
          places.length,
          '0',
        )}
      </span>
    ) : (
      <Counter
        value={value}
        places={places}
        fontSize={DIGIT_SIZE}
        padding={6}
        gap={1}
        horizontalPadding={0}
        fontWeight={600}
        textColor="#c084fc"
        gradientHeight={5}
        gradientFrom="rgba(10,10,12,0.9)"
      />
    )}

    <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-white/40">
      {label}
    </span>
  </span>
);

const EventCountdown = () => {
  const { events, loading, failed } =
    useUpcomingEvents(1);

  const event = events[0];

  const target = useMemo(
    () =>
      event ? eventStartsAt(event) : null,
    [event],
  );

  const [now, setNow] = useState(() =>
    Date.now(),
  );

  useEffect(() => {
    if (target === null) return;

    /*
     * Ticks every second even though only minutes are shown, so the
     * minute turns over when it actually turns over rather than up to
     * a minute late. Date.now() is re-read each tick rather than
     * accumulated, so a throttled background tab catches up correctly
     * on return.
     */
    const id = window.setInterval(
      () => setNow(Date.now()),
      1000,
    );

    return () =>
      window.clearInterval(id);
  }, [target]);

  const still = useReducedMotion();

  if (
    loading ||
    failed ||
    !event ||
    target === null
  ) {
    return null;
  }

  const remaining = remainingUntil(
    target,
    now,
  );

  const page = eventPageForRegistration(
    event.slug,
  );

  const href = page
    ? `/${page.slug}`
    : '/events';

  /* Keeps its own width as it counts down, so the row never reflows. */
  const dayPlaces =
    remaining.days >= 100
      ? [100, 10, 1]
      : [10, 1];

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
          * copies of every numeral read as gibberish — so the whole
          * group is hidden and a written sentence stands in. No
          * aria-live: this changes every minute, and announcing it
          * every minute would make the site unusable.
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

              <span
                aria-hidden
                className="flex items-center gap-3"
              >
                <Unit
                  value={remaining.days}
                  places={dayPlaces}
                  label="days"
                  still={!!still}
                />
                <Unit
                  value={remaining.hours}
                  places={[10, 1]}
                  label="hrs"
                  still={!!still}
                />
                <Unit
                  value={
                    remaining.minutes
                  }
                  places={[10, 1]}
                  label="min"
                  still={!!still}
                />
              </span>
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
