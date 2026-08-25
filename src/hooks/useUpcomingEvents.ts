import { useEffect, useState } from 'react';
import {
  ApiEvent,
  fetchEvents,
  isEventUpcoming,
} from '../data/eventsApi';

interface UpcomingEvents {
  events: ApiEvent[];
  loading: boolean;
  failed: boolean;
}

/*
 * Upcoming events straight from D1, soonest first.
 *
 * A failure is reported rather than thrown: callers on the home page
 * hide the section instead of breaking the rest of the page.
 */
export const useUpcomingEvents = (
  limit?: number,
): UpcomingEvents => {
  const [events, setEvents] = useState<
    ApiEvent[]
  >([]);

  const [loading, setLoading] =
    useState(true);

  const [failed, setFailed] =
    useState(false);

  useEffect(() => {
    let active = true;

    const load = async () => {
      try {
        const all = await fetchEvents();

        if (!active) return;

        const upcoming = all
          .filter(isEventUpcoming)
          .sort(
            (a, b) =>
              Date.parse(a.event_date) -
              Date.parse(b.event_date),
          );

        setEvents(
          limit
            ? upcoming.slice(0, limit)
            : upcoming,
        );

        setFailed(false);
      } catch (error) {
        if (!active) return;

        console.error(
          'Failed to load upcoming events:',
          error,
        );

        setEvents([]);
        setFailed(true);
      } finally {
        if (active) setLoading(false);
      }
    };

    load();

    return () => {
      active = false;
    };
  }, [limit]);

  return { events, loading, failed };
};
