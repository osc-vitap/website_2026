import { useMemo } from 'react';

import CountdownDigits from './CountdownDigits';
import { useCountdown } from '../hooks/useCountdown';
import { ApiEvent } from '../data/eventsApi';
import {
  eventStartsAt,
  formatIst,
  readableRemaining,
} from '../data/eventCountdown';

/*
 * "Starts in 02 days 05 hrs 20 min", for the registration success
 * screens — the moment someone most wants to know how long they have
 * to wait is the moment they have just signed up.
 *
 * Renders nothing if the event has no usable date, so a malformed row
 * costs a line of the confirmation rather than the whole screen.
 */

interface EventStartsInProps {
  /*
   * Only the two fields this reads, so both the shared ApiEvent and the
   * registration page's own local Event interface satisfy it.
   */
  event: Pick<
    ApiEvent,
    'title' | 'event_date'
  >;
  size?: number;
  accent?: string;
  /** Surface behind the digits, for the odometer's fade. */
  ground?: string;
  labelColor?: string;
}

const EventStartsIn = ({
  event,
  size = 34,
  accent = '#c084fc',
  ground = 'rgba(19,19,22,0.95)',
  labelColor,
}: EventStartsInProps) => {
  const target = useMemo(
    () => eventStartsAt(event),
    [event],
  );

  const remaining = useCountdown(target);

  if (target === null || !remaining) {
    return null;
  }

  return (
    <div title={`${formatIst(target)} IST`}>
      <span className="sr-only">
        {readableRemaining(
          remaining,
          event.title,
        )}
      </span>

      <p
        aria-hidden
        className="font-mono text-[10px] uppercase tracking-[0.25em] opacity-60"
        style={{ color: labelColor }}
      >
        {remaining.total <= 0
          ? 'Happening today'
          : 'Starts in'}
      </p>

      {remaining.total > 0 && (
        <CountdownDigits
          remaining={remaining}
          size={size}
          accent={accent}
          ground={ground}
          stacked
          className="mt-3"
        />
      )}
    </div>
  );
};

export default EventStartsIn;
