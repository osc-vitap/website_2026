import { ApiEvent } from './eventsApi';

/*
 * When an event begins, as an absolute instant.
 *
 * Everything the club schedules is in IST, but nothing the API stores
 * says so, and the two ways a browser guesses are both wrong here:
 *
 *   - Date.parse("2026-09-01") reads a bare date as UTC midnight. Taken
 *     at face value the countdown runs 5h30m fast and claims the event
 *     started at half five in the morning.
 *   - Date.parse("2026-09-01 10:00:00") — a time with no zone — is
 *     implementation-defined, and Chrome reads it in the *viewer's*
 *     timezone. The same event would then start at a different moment
 *     for someone abroad than for someone on campus.
 *
 * So any value without an explicit zone is read as IST wall-clock, and
 * only a value that carries a Z or a ±HH:MM offset is trusted as
 * written. The result is one instant for every viewer, wherever they
 * are — the countdown is a duration to that instant, so it needs no
 * timezone of its own.
 */

/** Asia/Kolkata is a fixed +05:30. No daylight saving, ever. */
const IST_OFFSET_MS = 330 * 60 * 1000;

/** Carries its own zone: trust it verbatim. */
const HAS_ZONE = /(?:Z|[+-]\d{2}:?\d{2})$/i;

/** Bare date, or a date and time with no zone. Both mean IST here. */
const WALL_CLOCK =
  /^(\d{4})-(\d{2})-(\d{2})(?:[T ](\d{2}):(\d{2})(?::(\d{2}))?)?$/;

/*
 * Date.UTC reads its arguments as UTC, so subtracting the offset
 * reinterprets the same wall-clock reading as IST.
 */
const fromIst = (
  year: number,
  month: number,
  day: number,
  hour: number,
  minute: number,
  second: number,
): number =>
  Date.UTC(
    year,
    month - 1,
    day,
    hour,
    minute,
    second,
  ) - IST_OFFSET_MS;

export const parseIstInstant = (
  value: string | null | undefined,
): number | null => {
  const raw = value?.trim();

  if (!raw) return null;

  if (HAS_ZONE.test(raw)) {
    const parsed = Date.parse(raw);
    return Number.isNaN(parsed)
      ? null
      : parsed;
  }

  const match = WALL_CLOCK.exec(raw);

  if (!match) return null;

  const [, y, mo, d, h, mi, s] = match;

  return fromIst(
    Number(y),
    Number(mo),
    Number(d),
    Number(h ?? 0),
    Number(mi ?? 0),
    Number(s ?? 0),
  );
};

/**
 * The instant an event begins. A bare date means the start of that day
 * in IST, which is what "counting down to the event day" means.
 *
 * Typed to the one field it reads rather than to ApiEvent: the
 * registration page carries its own local Event interface, and this is
 * the only thing either shape needs to agree on.
 */
export const eventStartsAt = (
  event: Pick<ApiEvent, 'event_date'>,
): number | null =>
  parseIstInstant(event.event_date);

/** The event start written out in IST, whatever the viewer's clock says. */
export const formatIst = (
  instant: number,
): string =>
  new Intl.DateTimeFormat('en-IN', {
    timeZone: 'Asia/Kolkata',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  }).format(new Date(instant));

export interface Remaining {
  days: number;
  hours: number;
  minutes: number;
  /** Milliseconds left; 0 once the target has passed. */
  total: number;
}

const DAY = 86_400_000;
const HOUR = 3_600_000;
const MINUTE = 60_000;

export const remainingUntil = (
  target: number,
  now: number,
): Remaining => {
  /*
   * Clamped rather than allowed to go negative: the caller shows a
   * "happening now" state at zero, and digits rolling backwards would
   * be worse than useless.
   */
  const total = Math.max(0, target - now);

  return {
    days: Math.floor(total / DAY),
    hours:
      Math.floor(total / HOUR) % 24,
    minutes:
      Math.floor(total / MINUTE) % 60,
    total,
  };
};

/** Spoken form, for the screen-reader label. */
export const readableRemaining = (
  remaining: Remaining,
  title: string,
): string => {
  if (remaining.total <= 0) {
    return `${title} is happening today.`;
  }

  const part = (
    value: number,
    unit: string,
  ) =>
    `${value} ${unit}${value === 1 ? '' : 's'}`;

  return `${title} starts in ${part(
    remaining.days,
    'day',
  )}, ${part(
    remaining.hours,
    'hour',
  )} and ${part(
    remaining.minutes,
    'minute',
  )}.`;
};
