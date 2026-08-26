import { motion } from 'framer-motion';
import { Link } from 'react-router-dom';
import { ArrowRight, Calendar, MapPin } from 'lucide-react';
import { useUpcomingEvents } from '../hooks/useUpcomingEvents';
import { orFallback } from '../data/eventsApi';
import { eventPageForRegistration } from '../data/eventPages';
import EventStartsIn from './EventStartsIn';

/*
 * Upcoming events on the home page, read live from D1.
 *
 * The section removes itself when there is nothing upcoming or the
 * Worker is unreachable — an empty "no events" slab on the home page
 * is worse than no section at all.
 */

const formatDate = (value: string) => {
  const parsed = Date.parse(value);

  if (Number.isNaN(parsed)) {
    return value;
  }

  return new Date(parsed).toLocaleDateString(
    'en-IN',
    {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    },
  );
};

const cardVariants = {
  hidden: { opacity: 0, y: 28 },
  show: {
    opacity: 1,
    y: 0,
    transition: {
      duration: 0.55,
      ease: [0.16, 1, 0.3, 1] as const,
    },
  },
};

const UpcomingEvents = () => {
  const { events, loading } =
    useUpcomingEvents(3);

  if (loading || events.length === 0) {
    return null;
  }

  return (
    <section className="w-full border-b border-dark-700 bg-dark-900 relative overflow-hidden">

      <div
        aria-hidden="true"
        className="absolute inset-0 bg-brand-primary/5 opacity-20"
      />

      <div className="container relative z-10 mx-auto max-w-7xl px-4 py-16 md:px-12 md:py-24">

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, amount: 0.4 }}
          transition={{ duration: 0.5 }}
          className="mb-10 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between md:mb-14"
        >

          <div>
            <span className="text-brand-accent text-xs font-bold uppercase tracking-[0.2em]">
              // Upcoming //
            </span>

            <h2 className="mt-3 font-bebas text-4xl uppercase tracking-wider text-white md:text-6xl">
              What&apos;s Next
            </h2>
          </div>

          <Link
            to="/events"
            className="group inline-flex items-center gap-2 self-start font-mono text-xs uppercase tracking-[0.15em] text-gray-400 transition-colors hover:text-white sm:self-auto"
          >
            All events
            <ArrowRight
              size={14}
              className="transition-transform group-hover:translate-x-1"
            />
          </Link>

        </motion.div>

        {/*
          * Mobile only. The strip in the masthead drops the event name
          * and the link on a phone to stay one line tall, leaving bare
          * digits with nothing to attach them to — so the full
          * countdown sits here instead, under the heading and above the
          * cards. On wider screens the masthead strip already says all
          * of this with room to spare.
          */}
        <div className="mb-10 border border-dark-700 bg-dark-800/40 p-5 md:hidden">
          <EventStartsIn
            event={events[0]}
            size={30}
            ground="rgba(19,19,22,0.95)"
          />
        </div>

        <motion.div
          initial="hidden"
          whileInView="show"
          viewport={{ once: true, amount: 0.15 }}
          transition={{ staggerChildren: 0.12 }}
          className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3"
        >

          {events.map((event) => {
            const page =
              eventPageForRegistration(
                event.slug,
              );

            const href = page
              ? `/${page.slug}`
              : `/events/${event.slug}/register`;

            const image = orFallback(
              event.image,
              '',
            );

            return (
              <motion.div
                key={event.id}
                variants={cardVariants}
              >
                <Link
                  to={href}
                  className="group flex h-full flex-col border border-dark-700 bg-dark-800/40 transition-colors hover:border-brand-primary/60 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-accent"
                >

                  <div className="relative aspect-[4/3] overflow-hidden border-b border-dark-700 bg-dark-900">

                    {image ? (
                      <img
                        src={image}
                        alt=""
                        loading="lazy"
                        className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
                      />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center font-bebas text-5xl uppercase tracking-wider text-dark-600">
                        {event.title}
                      </div>
                    )}

                    <div
                      aria-hidden="true"
                      className="absolute inset-0 bg-brand-primary/10 mix-blend-overlay"
                    />

                  </div>

                  <div className="flex flex-1 flex-col p-5 md:p-6">

                    {event.sub_title && (
                      <div className="mb-2 font-mono text-[10px] uppercase tracking-[0.15em] text-brand-accent line-clamp-1">
                        {event.sub_title}
                      </div>
                    )}

                    <h3 className="font-bebas text-2xl uppercase tracking-wide text-white md:text-3xl">
                      {event.title}
                    </h3>

                    <div className="mt-4 space-y-2 font-mono text-xs text-gray-400">

                      <div className="flex items-center gap-2">
                        <Calendar
                          size={13}
                          className="shrink-0 text-gray-600"
                        />
                        {formatDate(
                          event.event_date,
                        )}
                      </div>

                      {event.venue && (
                        <div className="flex items-center gap-2">
                          <MapPin
                            size={13}
                            className="shrink-0 text-gray-600"
                          />
                          <span className="line-clamp-1">
                            {event.venue}
                          </span>
                        </div>
                      )}

                    </div>

                    <span className="mt-6 inline-flex items-center gap-2 font-mono text-xs font-bold uppercase tracking-[0.12em] text-brand-accent">
                      {page
                        ? 'View event'
                        : 'Register'}
                      <ArrowRight
                        size={14}
                        className="transition-transform group-hover:translate-x-1"
                      />
                    </span>

                  </div>

                </Link>
              </motion.div>
            );
          })}

        </motion.div>

      </div>

    </section>
  );
};

export default UpcomingEvents;
