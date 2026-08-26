import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { eventsData, Event } from '../data/eventsData';
import { eventPageForRegistration } from '../data/eventPages';
import {
  fetchEvents,
  isEventUpcoming,
  orFallback,
} from '../data/eventsApi';
import { MapPin, Calendar, ArrowRight } from 'lucide-react';

/*
 * D1 stores event_date as an ISO date, and it was printed straight onto
 * the card — "2026-08-29" next to hand-written entries like
 * "19–21 Apr 2026". Formatted here so both read the same way.
 *
 * A value that is already prose (every hardcoded event) is passed
 * through untouched rather than guessed at.
 */
const formatEventDate = (value: string): string => {
  if (!/^\d{4}-\d{2}-\d{2}/.test(value)) {
    return value;
  }

  const parsed = new Date(`${value.slice(0, 10)}T00:00:00`);

  if (Number.isNaN(parsed.getTime())) {
    return value;
  }

  return parsed.toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
};

const Events = () => {
  const [activeTab, setActiveTab] =
    useState<'upcoming' | 'past'>('upcoming');

  const [displayEvents, setDisplayEvents] =
    useState<Event[]>(eventsData);

  const [apiError, setApiError] =
    useState(false);

  useEffect(() => {
    const loadEvents = async () => {
      try {
        const apiEvents = await fetchEvents();

        /*
         * Convert D1 events into the same structure
         * already used by the existing Events page.
         */
        const apiMappedEvents: Event[] =
          apiEvents.map((event) => ({
            id: event.id,
            slug: event.slug,
            title: event.title,
            sub_title: orFallback(
              event.sub_title,
              '',
            ),
            venue: orFallback(
              event.venue,
              '',
            ),
            date: formatEventDate(
              event.event_date,
            ),
            image: orFallback(
              event.image,
              'https://images.unsplash.com/photo-1504384308090-c894fdcc538d?auto=format&fit=crop&w=800&q=80',
            ),
            carouselImage: orFallback(
              event.image,
              '',
            ),
            url: `/events/${event.slug}/register`,
            eventPageUrl:
              eventPageForRegistration(
                event.slug,
              )
                ? `/${eventPageForRegistration(event.slug)!.slug}`
                : undefined,
            isUpcoming:
              isEventUpcoming(event),
            description:
              event.description ?? '',
          }));

        /*
         * D1 takes priority for matching events.
         * Existing hardcoded events remain visible
         * until they are migrated to D1.
         */
        const apiBySlug = new Map(
          apiEvents.map((event) => [
            event.slug,
            event,
          ]),
        );

        const mergedEvents =
          eventsData.map((localEvent) => {
            const apiEvent =
              apiBySlug.get(
                localEvent.slug,
              );

            if (!apiEvent) {
              return localEvent;
            }

            return {
              id: apiEvent.id,
              slug: apiEvent.slug,
              title: apiEvent.title,
              sub_title: orFallback(
                apiEvent.sub_title,
                localEvent.sub_title,
              ),
              venue: orFallback(
                apiEvent.venue,
                localEvent.venue,
              ),
              date: formatEventDate(
                apiEvent.event_date,
              ),
              image: orFallback(
                apiEvent.image,
                localEvent.image,
              ),
              carouselImage: orFallback(
                apiEvent.image,
                localEvent.carouselImage,
              ),
              url: `/events/${apiEvent.slug}/register`,
              eventPageUrl:
                eventPageForRegistration(
                  apiEvent.slug,
                )
                  ? `/${eventPageForRegistration(apiEvent.slug)!.slug}`
                  : undefined,
              isUpcoming:
                isEventUpcoming(apiEvent),
              description: orFallback(
                apiEvent.description,
                localEvent.description,
              ),
            };
          });

        /*
         * Add D1 events which don't exist in the original static data,
         * compared on slug — the same key the merge above uses.
         *
         * This used to slugify titles on both sides, so a D1 event
         * whose title happened to slugify onto a local one was filtered
         * out here having already failed to merge above. "GittyUp"
         * (stored as gittyup-2025) hit exactly that and appeared
         * nowhere on the site at all.
         */
        const localSlugs = new Set(
          eventsData.map(
            (event) => event.slug,
          ),
        );

        const newApiEvents =
          apiMappedEvents.filter(
            (event) =>
              !localSlugs.has(event.slug),
          );

        setDisplayEvents([
          ...newApiEvents,
          ...mergedEvents,
        ]);

        setApiError(false);
      } catch (error) {
        console.error(
          'Failed to load events from API:',
          error,
        );

        /*
         * IMPORTANT:
         * Keep the original website working
         * if the Worker/API is unavailable.
         */
        setDisplayEvents(eventsData);
        setApiError(true);
      }
    };

    loadEvents();
  }, []);

  const upcomingEvents =
    displayEvents.filter(
      (event) => event.isUpcoming,
    );

  const pastEvents =
    displayEvents.filter(
      (event) => !event.isUpcoming,
    );

  const displayedEvents =
    activeTab === 'upcoming'
      ? upcomingEvents
      : pastEvents;

  return (
    <div className="container mx-auto px-4 py-10 sm:py-12 md:px-6">

      <div className="text-center max-w-2xl mx-auto mb-12">

        <h1 className="text-4xl md:text-5xl font-bold mb-4">
          Events &{' '}
          <span className="text-gradient">
            Workshops
          </span>
        </h1>

        <p className="text-gray-400">
          From hands-on technical workshops to
          48-hour hackathons, discover what we've
          been up to and what's coming next.
        </p>

      </div>

      <div className="mb-10 flex justify-center sm:mb-12">

        <div className="glass inline-flex w-full max-w-md flex-col rounded-lg p-1 sm:w-auto sm:flex-row">

          <button
            onClick={() =>
              setActiveTab('upcoming')
            }
            className={`w-full rounded-md px-6 py-3 text-sm font-medium transition-all sm:w-auto sm:py-2 ${
              activeTab === 'upcoming'
                ? 'bg-brand-primary text-white shadow-lg'
                : 'text-gray-400 hover:text-white'
            }`}
          >
            Upcoming Events
          </button>

          <button
            onClick={() =>
              setActiveTab('past')
            }
            className={`w-full rounded-md px-6 py-3 text-sm font-medium transition-all sm:w-auto sm:py-2 ${
              activeTab === 'past'
                ? 'bg-dark-600 text-white shadow-lg'
                : 'text-gray-400 hover:text-white'
            }`}
          >
            Past Events
          </button>

        </div>

      </div>

      {apiError && (
        <div className="max-w-2xl mx-auto mb-8 text-center text-xs text-gray-600">
          Live events are temporarily unavailable.
          Showing the existing event list.
        </div>
      )}

      <div className="grid grid-cols-1 gap-6 md:gap-8 lg:grid-cols-2">

        {displayedEvents.map(
          (event, i) => (
            <motion.div
              key={event.id}
              initial={{
                opacity: 0,
                scale: 0.95,
              }}
              animate={{
                opacity: 1,
                scale: 1,
              }}
              transition={{
                delay: i * 0.1,
              }}
              className="glass-card group flex flex-col overflow-hidden xl:flex-row"
            >

              <div className="relative h-48 overflow-hidden sm:h-56 xl:h-auto xl:w-2/5">

                <img
                  src={event.image}
                  alt={event.title}
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                />

                <div className="absolute inset-0 bg-brand-primary/20 mix-blend-overlay"></div>

              </div>

              <div className="flex min-w-0 flex-col p-5 sm:p-6 xl:w-3/5">

                <div className="text-brand-accent text-xs font-bold uppercase tracking-widest mb-1">
                  {event.sub_title}
                </div>

                <h3 className="text-2xl font-bold text-white mb-2">
                  {event.title}
                </h3>

                <p className="mb-6 flex-grow text-sm text-gray-400">
                  {event.description}
                </p>

                <div className="space-y-2 mb-6">

                  <div className="flex items-start gap-2 text-sm text-gray-300">
                    <Calendar
                      size={16}
                      className="text-gray-500"
                    />
                    {event.date}
                  </div>

                  <div className="flex items-start gap-2 text-sm text-gray-300">
                    <MapPin
                      size={16}
                      className="text-gray-500"
                    />
                    {event.venue}
                  </div>

                </div>

                {/*
                  * An event with a poster page of its own is the
                  * front door — it carries the details and its own
                  * Register Now. Everything else goes straight to
                  * the registration form.
                  */}
                {event.eventPageUrl ? (
                  <Link
                    to={event.eventPageUrl}
                    className="group mt-auto w-full py-2.5 rounded-lg font-semibold text-center transition-all flex items-center justify-center gap-2 bg-brand-primary hover:bg-brand-primary/90 text-white"
                  >
                    View Event
                    <ArrowRight
                      size={16}
                      className="transition-transform group-hover:translate-x-1"
                    />
                  </Link>
                ) : event.isUpcoming ? (
                  <Link
                    to={event.url}
                    className="poster-shine mt-auto w-full py-2.5 rounded-lg font-semibold text-center transition-all flex items-center justify-center gap-2 bg-brand-primary hover:bg-brand-primary/90 text-white"
                  >
                    Register Now
                  </Link>
                ) : (
                  /*
                    * A finished event has nowhere useful to go. This was
                    * a "View Details" link to event.url, which is "#" on
                    * every hardcoded event — a dead link that jumped to
                    * the top of the page — and on a D1-backed one is the
                    * registration form, offering to sign people up for
                    * something that already happened. An event with
                    * somewhere real to point is handled by the branch
                    * above.
                    */
                  <div className="mt-auto w-full py-2.5 text-center font-semibold text-sm text-gray-600">
                    This event has ended
                  </div>
                )}

              </div>

            </motion.div>
          ),
        )}

        {displayedEvents.length === 0 && (
          <div className="col-span-1 md:col-span-2 py-20 text-center text-gray-500">
            No {activeTab} events found at the moment.
            Stay tuned!
          </div>
        )}

      </div>

    </div>
  );
};

export default Events;
