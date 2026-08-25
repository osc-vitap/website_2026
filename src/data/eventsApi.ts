/*
 * Shared access to the events Worker (events.oscvitap.com).
 *
 * Both the events page and the home page read from here so the
 * "is this upcoming?" rule and the empty-string handling stay in one
 * place.
 */

export const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL ||
  'https://events.oscvitap.com';

export interface ApiEvent {
  id: string;
  slug: string;
  title: string;
  sub_title: string | null;
  description: string | null;
  venue: string | null;
  event_date: string;
  event_end_at: string | null;
  image: string | null;
  is_open: number;
  registration_type: string;
  min_team_size: number;
  max_team_size: number;
  archive_status: string;
}

/*
 * The admin form saves cleared fields as empty strings rather than
 * null, so `??` alone would hand an empty src to <img>.
 */
export const orFallback = (
  value: string | null | undefined,
  fallback: string,
) => (value?.trim() ? value : fallback);

/*
 * event_end_at is the real end of the event, so it decides whether an
 * event is still upcoming. Events created before that column existed
 * fall back to their start date, which keeps an event listed for the
 * whole day it runs on.
 */
export const isEventUpcoming = (
  event: ApiEvent,
): boolean => {
  const endsAt = event.event_end_at
    ? Date.parse(event.event_end_at)
    : Number.NaN;

  if (!Number.isNaN(endsAt)) {
    return endsAt >= Date.now();
  }

  const startsAt = Date.parse(
    event.event_date,
  );

  if (Number.isNaN(startsAt)) {
    return false;
  }

  const startOfToday = Date.parse(
    new Date().toISOString().split('T')[0],
  );

  return startsAt >= startOfToday;
};

export const fetchEvents = async (): Promise<
  ApiEvent[]
> => {
  const response = await fetch(
    `${API_BASE_URL}/api/events`,
  );

  if (!response.ok) {
    throw new Error(
      'Failed to load events',
    );
  }

  const data: { events: ApiEvent[] } =
    await response.json();

  return data.events ?? [];
};
