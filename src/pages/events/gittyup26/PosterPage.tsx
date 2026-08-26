import { CSSProperties, useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, Clock } from 'lucide-react';
import PosterGround from './PosterGround';
import PosterWordmark from './PosterWordmark';
import { gridFontSize } from './posterGrid';
import { PosterVariant } from './posterTypes';
import { POSTER_COUNT } from './posterVariants';
import PosterRegisterForm from './PosterRegisterForm';
import PosterAboutDialog from './PosterAboutDialog';
import { glassTint, textHalo } from './posterColor';
import { rowMetrics, useFittingRows } from './useFittingRows';
import { ApiEvent, fetchEvent } from '../../../data/eventsApi';

/* The D1 event these poster pages register for. */
const REGISTRATION_SLUG = 'gittyup26';

/*
 * A handful of layouts, thirty palettes.
 *
 * Every poster page uses this composition: the wordmark stack, the
 * toggle and the numeral on the left, the details and the call to
 * action on the right, the poster's line beneath. Only the colours,
 * the background, the row count and the copy change between the
 * set, which keeps the spacing predictable — a per-poster layout
 * left half the page empty at some viewport or other.
 *
 * It is one screen from `lg` up and flows on smaller screens, so the
 * call to action can never be clipped off a phone.
 */

interface PosterPageProps {
  variant: PosterVariant;
}

/*
 * The wordmark is sized to fill its column, not to fit its row count.
 *
 * Sizing by row count made the ten-row posters set tiny type and left
 * the page mostly empty. The printed posters instead run the stack at
 * one size and let it bleed off the page, so the stack here is clipped
 * to the space it has: every poster gets the same weight of type, and
 * a tall stack simply runs past the edge as it does in print.
 */
const WORDMARK_SIZE =
  'text-[clamp(2.5rem,19vw,7rem)] lg:text-[min(12.5vw,13rem)]';

/*
 * On a hero-word poster the single wordmark row is the kicker, not the
 * headline, so it sets smaller and leaves the hero the weight.
 */
const HERO_ROW_SIZE =
  'text-[clamp(1.8rem,11vw,3.5rem)] lg:text-[min(6vw,6rem)]';

/*
 * The letter grid's size depends on its row count, which Tailwind cannot
 * see at build time, so the value arrives as a custom property and these
 * two static classes read it.
 */
const GRID_SIZE =
  'text-[length:var(--wm-sm)] lg:text-[length:var(--wm-lg)]';

/*
 * A hero of one word runs at full height. A hero that is a whole phrase
 * wraps inside its 15ch column instead, so it sets smaller — at the
 * single-word size a sentence would leave the page sideways.
 */
const heroFontSize = (text: string) =>
  text.trim().length <= 8
    ? 'clamp(3.5rem, 22vw, 9rem)'
    : 'clamp(2.1rem, 10.5vw, 6.2rem)';

/*
 * Accent colours arrive as either hex or rgba(). Appending hex alpha to
 * an rgba() string produces invalid CSS, so the declaration is dropped
 * and the rule falls back to the browser default — a near-white hairline
 * on a dark poster. color-mix handles both notations.
 */
const withAlpha = (
  color: string,
  percent: number,
) =>
  `color-mix(in srgb, ${color} ${percent}%, transparent)`;

/*
 * The row of past-event marks every printed poster carries along its
 * bottom edge, under a label that changes from sheet to sheet.
 */
const PREVIOUS_BUILDS = [
  { src: '/events/gittyup26/ev-techeden.webp', alt: 'Tech Eden' },
  { src: '/events/gittyup26/ev-sff.webp', alt: 'Software Freedom Fest' },
  { src: '/events/gittyup26/ev-reactbootcamp.webp', alt: 'React Bootcamp' },
  { src: '/events/gittyup26/ev-gittyup.webp', alt: 'Gitty Up' },
];

const PosterPage = ({
  variant,
}: PosterPageProps) => {
  const [showForm, setShowForm] = useState(false);

  /* What the session is, asked for from the footnote under the panel. */
  const [showAbout, setShowAbout] = useState(false);

  /* Held so the dialog can put focus back where it came from. */
  const aboutTriggerRef =
    useRef<HTMLButtonElement>(null);

  /*
   * Whether the event is taking registrations, read from the event
   * itself rather than hardcoded here.
   *
   * Starts closed on purpose. Offering a form for a closed event wastes
   * someone's time and ends in a rejection from the Worker, while
   * showing "opening soon" for a second longer than necessary costs
   * nothing — so an unread or unreachable API keeps the safe answer.
   */
  const [registrationOpen, setRegistrationOpen] =
    useState(false);

  /* Kept whole, not just its is_open flag: the confirmation screen
     counts down to this event's own start. */
  const [event, setEvent] =
    useState<ApiEvent | null>(null);

  useEffect(() => {
    let live = true;

    fetchEvent(REGISTRATION_SLUG).then((found) => {
      if (!live) return;

      setEvent(found);

      if (found?.is_open) {
        setRegistrationOpen(true);
      }
    });

    return () => {
      live = false;
    };
  }, []);

  const wordmarkRef = useRef<HTMLDivElement>(null);

  const visibleRows = useFittingRows(
    wordmarkRef,
    /* The hero-word posters print a single row over the hero. */
    variant.layout === 'hero-word'
      ? 1
      : Math.max(1, variant.rows),
    rowMetrics(variant.layout),
  );

  const { headline, emphasis } = variant;

  const emphasisAt =
    emphasis && headline.includes(emphasis)
      ? headline.indexOf(emphasis)
      : -1;

  const wordmarkFill = variant.inkGradient
    ? {
        backgroundImage: variant.inkGradient,
        WebkitBackgroundClip: 'text' as const,
        backgroundClip: 'text' as const,
        color: 'transparent',
      }
    : { color: variant.ink };

  return (
    <>
      <PosterGround variant={variant} />

      <div className="relative z-10 flex min-h-[100dvh] flex-col px-6 py-7 md:px-12 md:py-9 lg:h-full">

        {/* Masthead */}

        <header className="poster-fade-up flex items-start justify-between gap-4">
          {/*
            * The poster page is reached by scanning a printed sheet, so
            * for most visitors it is the whole site — there was no way
            * out of it at all. The mark is the way back.
            */}
          <Link
            to="/"
            aria-label="Open Source Community — go to the OSC home page"
            className="inline-block rounded-sm transition-opacity hover:opacity-80 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4"
            style={{ outlineColor: variant.accent }}
          >
            <img
              src="/events/gittyup26/osc-lockup.webp"
              alt="Open Source Community, campus club at VIT-AP"
              className="h-8 w-auto drop-shadow-[0_2px_6px_rgba(0,0,0,0.55)] md:h-11"
            />
          </Link>

          <img
            src="/events/gittyup26/vitap-logo.webp"
            alt="VIT-AP University"
            className="h-7 w-auto opacity-95 drop-shadow-[0_2px_6px_rgba(0,0,0,0.55)] md:h-10"
          />
        </header>

        {/* Poster body */}

        <main className="grid flex-1 content-start items-start gap-8 py-6 lg:grid-cols-[1.5fr_1fr] lg:content-center lg:items-center lg:gap-12 lg:py-4">

          <section>

            {/* Wordmark stack, clipped to the room it has */}

            <PosterWordmark
              variant={variant}
              rows={visibleRows}
              fill={wordmarkFill}
              containerRef={wordmarkRef}
              /*
                * The terminal poster spends most of its height on the
                * git log, so its stack is held well back — in print the
                * wordmark is a ghost behind the box rather than the
                * thing you read first.
                */
              className={`${
                variant.terminal
                  ? 'max-h-[18vh] lg:max-h-[24vh]'
                  : 'max-h-[36vh] lg:max-h-[46vh]'
              } select-none overflow-hidden tracking-[-0.015em] ${
                variant.layout === 'letter-grid'
                  ? GRID_SIZE
                  : variant.layout === 'hero-word'
                    ? HERO_ROW_SIZE
                    : WORDMARK_SIZE
              }`}
              style={
                variant.layout === 'letter-grid'
                  ? ({
                      '--wm-sm': gridFontSize(variant.rows, 36, 10.5),
                      '--wm-lg': gridFontSize(variant.rows, 46, 7.5),
                    } as CSSProperties)
                  : undefined
              }
            />

            {/*
              * On the hero-word posters the emphasis is the artwork: one
              * quiet wordmark row, then the word itself at full width.
              */}
            {variant.layout === 'hero-word' && (
              <div
                aria-hidden="true"
                /*
                  * Sized by how long the hero is. A single word can run
                  * at full height, but a whole phrase at that size would
                  * leave the page horizontally — so the size comes down
                  * as the character count goes up, and it is allowed to
                  * wrap rather than being clipped.
                  */
                className="poster-rise mt-3 max-w-[13ch] select-none font-black leading-[0.94] tracking-[-0.03em] md:mt-4"
                style={{
                  ...wordmarkFill,
                  fontSize: heroFontSize(
                    variant.heroWord ?? variant.emphasis ?? '',
                  ),
                  animationDelay: '0.12s',
                }}
              >
                {variant.heroWord ?? variant.emphasis}
              </div>
            )}

            {/* Toggle and numeral */}

            <div className="poster-fade-up mt-7 flex items-center gap-6 lg:mt-6"
              style={{ animationDelay: '0.45s' }}>
              <div
                aria-hidden="true"
                className="flex w-[clamp(5rem,12vw,9rem)] items-center justify-end rounded-full border-[3px] p-[0.3rem] md:border-4"
                style={{ borderColor: variant.ink }}
              >
                <div
                  className="aspect-square w-[clamp(1.2rem,3vw,2.2rem)] rounded-full"
                  style={{
                    backgroundColor: variant.ink,
                  }}
                />
              </div>

              <div
                className="font-black leading-none text-[clamp(2.5rem,8vw,5.5rem)] lg:text-[min(5.5vw,8vh)]"
                style={{ color: variant.ink }}
              >
                26
              </div>

              {/*
                * Sits with the numeral rather than down in the details,
                * so it is on the first screen at any viewport — on a
                * phone the details block starts below the fold.
                */}
              <span
                className="rounded-full border-2 px-3.5 py-1.5 font-postermono text-[11px] font-bold tracking-[0.1em] md:px-4 md:text-sm"
                style={{
                  borderColor: variant.accent,
                  color: variant.accent,
                }}
              >
                ODs Provided
              </span>
            </div>

            {/* The poster's line */}

            <h1
              className="poster-fade-up mt-8 max-w-2xl font-thin leading-snug tracking-[-0.02em] text-[clamp(1.1rem,2.5vw,1.8rem)] lg:mt-7"
              style={{
                color: variant.text,
                textShadow: textHalo(variant.text),
              }}
            >
              {emphasisAt === -1 ? (
                headline
              ) : (
                <>
                  {headline.slice(
                    0,
                    emphasisAt,
                  )}
                  {/* Heavy weight carries itself; a halo here only muddies it. */}
                  <span
                    className="font-extrabold"
                    style={{ textShadow: 'none' }}
                  >
                    {emphasis}
                  </span>
                  {headline.slice(
                    emphasisAt +
                      (emphasis?.length ?? 0),
                  )}
                </>
              )}
            </h1>

            {/* The quieter line the printed sheet sets under the headline */}

            {variant.subline && (
              <p
                className="poster-fade-up mt-5 max-w-xl text-[clamp(0.85rem,1.6vw,1rem)] leading-relaxed opacity-75"
                style={{
                  color: variant.text,
                  textShadow: textHalo(variant.text),
                  animationDelay: '0.5s',
                }}
              >
                {variant.subline}
              </p>
            )}

            {/*
              * The terminal poster prints its own git log. The prompt
              * lines take the accent, the output stays quiet.
              */}
            {variant.terminal && (
              <div
                className="poster-fade-up mt-7 max-w-xl rounded-2xl border p-5 font-postermono text-[clamp(0.7rem,1.5vw,0.9rem)] leading-relaxed md:p-6"
                style={{
                  borderColor: withAlpha(variant.accent, 30),
                  backgroundColor: withAlpha(variant.ground, 55),
                  animationDelay: '0.5s',
                }}
              >
                {variant.terminal.map((line, index) => {
                  const isPrompt =
                    index === 0 ||
                    index === (variant.terminal?.length ?? 0) - 1;

                  return (
                    <div
                      key={index}
                      className={isPrompt ? 'font-bold' : 'opacity-70'}
                      style={{
                        color: isPrompt
                          ? variant.accent
                          : variant.text,
                        marginTop: index === 0 ? 0 : '0.4em',
                      }}
                    >
                      {isPrompt && (
                        <span className="mr-2 opacity-60">$</span>
                      )}
                      {line}
                    </div>
                  );
                })}
              </div>
            )}

          </section>

          {/* Details and call to action */}

          <aside className="poster-slide-in lg:pb-4" style={{ animationDelay: '0.3s' }}>

            {showForm ? (
              <PosterRegisterForm
                variant={variant}
                event={event}
                onClose={() =>
                  setShowForm(false)
                }
              />
            ) : (
            <div
              /*
                * The details sit over whatever the artwork happens to be
                * doing at that point, and the mono lines are the
                * smallest type on the page — several of the printed
                * sheets set this block on its own panel for exactly that
                * reason.
                *
                * Every poster gets the panel, not only the ones with a
                * photograph: the CSS grounds are just as busy in places,
                * and one detail block that changes shape between posters
                * reads as an accident.
                */
              className="poster-glass p-5 md:p-6"
              style={{
                /*
                  * The panel's tint is the poster's own ground, so it
                  * belongs to each design rather than greying all thirty
                  * towards the same slab. --glass-solid is the opaque
                  * fallback for browsers without backdrop-filter.
                  */
                backgroundColor: glassTint(variant.ground),
                ['--glass-solid' as string]: glassTint(variant.ground, 0.94),
                borderColor: withAlpha(variant.accent, 22),
              }}
            >

              {variant.eyebrow && (
                <div
                  className="font-postermono text-[10px] font-medium uppercase tracking-[0.26em] md:text-xs"
                  style={{
                    color: variant.accent,
                  }}
                >
                  {variant.eyebrow}
                </div>
              )}

              {/*
                * Two posters set their details as a labelled table
                * rather than a date and a venue line. Where one is
                * given it replaces both, so the same facts are not
                * printed twice.
                */}
              {variant.specs ? (
                <dl className="mt-4 font-postermono text-xs md:text-sm">
                  {variant.specs.map((spec) => (
                    <div
                      key={spec.label}
                      className="flex items-baseline justify-between gap-4 border-b py-2.5"
                      style={{
                        borderColor: withAlpha(variant.accent, 18),
                      }}
                    >
                      <dt
                        className="uppercase tracking-[0.22em]"
                        style={{ color: variant.accent }}
                      >
                        {spec.label}
                      </dt>

                      <dd
                        className="text-right font-bold"
                        style={{ color: variant.text }}
                      >
                        {spec.value}
                      </dd>
                    </div>
                  ))}
                </dl>
              ) : (
                <>
                  <div
                    className="mt-4 text-[clamp(1.5rem,3.6vw,2.4rem)] font-bold leading-none tracking-[-0.02em]"
                    style={{ color: variant.text }}
                  >
                    {variant.dateLine}
                  </div>

                  {variant.venueLine && (
                    <div
                      className="mt-3 font-postermono text-xs opacity-80 md:text-sm"
                      style={{ color: variant.text }}
                    >
                      {variant.venueLine}
                    </div>
                  )}
                </>
              )}

              {/*
                * Registration happens here rather than on a separate
                * page: someone who scanned a poster should not be
                * dropped out of the design they scanned into.
                */}
              {registrationOpen ? (
                <button
                  type="button"
                  onClick={() => setShowForm(true)}
                  className="poster-shine group mt-7 inline-flex w-full items-center justify-between gap-4 rounded-full px-7 py-4 text-base font-bold transition-transform hover:scale-[1.02] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 sm:w-auto md:text-lg"
                  style={{
                    backgroundColor: variant.accent,
                    color: variant.ground,
                    outlineColor: variant.accent,
                  }}
                >
                  Register Now
                  <ArrowRight
                    size={20}
                    className="transition-transform group-hover:translate-x-1"
                  />
                </button>
              ) : (
                /*
                  * Registration is closed on the event, so the form is
                  * not offered. It used to be: someone scanned a poster,
                  * filled in every field, and only then got "Registration
                  * is closed" back from the Worker.
                  *
                  * This follows the event's is_open flag, so opening
                  * registration in the admin dashboard turns the button
                  * back on without a deploy.
                  */
                <div
                  className="mt-7 inline-flex w-full items-center justify-center gap-3 rounded-full border-2 px-7 py-4 text-base font-bold sm:w-auto md:text-lg"
                  style={{
                    borderColor: withAlpha(variant.accent, 55),
                    color: variant.accent,
                  }}
                >
                  <Clock size={18} />
                  Registration opening soon
                </div>
              )}

            </div>
            )}

            {/*
              * A footnote, under the panel rather than inside it.
              *
              * Outside so it survives the panel being replaced by the
              * registration form, and small so it never reads as a
              * second call to action — the poster has one of those. The
              * halo is the same one the footline uses: this line sits on
              * the artwork, which on several of the thirty is at its
              * brightest right here.
              */}
            <button
              ref={aboutTriggerRef}
              type="button"
              onClick={() => setShowAbout(true)}
              className="mt-4 inline-block font-postermono text-[10px] uppercase tracking-[0.18em] underline decoration-dotted underline-offset-4 opacity-85 transition-opacity hover:opacity-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 md:text-[11px]"
              style={{
                /*
                  * Set in the body colour, not the accent. Two of the
                  * accents are dark enough that they measure near 3:1
                  * on their own poster's ground — the accent stays on
                  * the underline, where being quiet is the point.
                  */
                color: variant.text,
                textDecorationColor: withAlpha(variant.accent, 70),
                textShadow: textHalo(variant.text),
                outlineColor: variant.accent,
              }}
            >
              What is GITTY UP?
            </button>

          </aside>

        </main>

        {/*
          * Previous builds. Every printed sheet carries this row of past
          * event marks along its bottom edge — it is how the poster says
          * who is running the session without spending a line of copy on
          * it, so the page carries it too.
          */}

        <div
          className="poster-fade-up mb-3 flex flex-wrap items-center justify-center gap-x-6 gap-y-2 md:gap-x-9"
          style={{ animationDelay: '0.6s' }}
        >
          <span
            className="font-postermono text-[8px] uppercase tracking-[0.22em] opacity-60 md:text-[9px]"
            style={{ color: variant.text }}
          >
            Some of our events that you might recognise
          </span>

          {PREVIOUS_BUILDS.map((build) => (
            <img
              key={build.src}
              src={build.src}
              alt={build.alt}
              /*
               * The marks are white artwork of differing weights; in
               * print they sit back from the poster rather than
               * competing with it.
               */
              className="h-4 w-auto opacity-70 md:h-[18px]"
            />
          ))}
        </div>

        {/* Footline */}

        <footer
          className="poster-fade-up flex flex-wrap items-center justify-between gap-x-4 gap-y-2 border-t pt-5 font-postermono text-[10px] md:text-xs"
          style={{
            borderColor: withAlpha(variant.accent, 25),
            color: variant.text,
            /*
              * The footline sits at the bottom of the page where the
              * background photographs are often at their brightest, and
              * it is the smallest type on the poster. The halo holds it
              * apart from whatever is behind it.
              */
            textShadow: textHalo(variant.text),
          }}
        >
          <span style={{ color: variant.accent }}>
            oscvitap.com/gittyup26
          </span>

          <span className="opacity-80">
            Open Source Community · VIT-AP University
          </span>

          {/* The counter is of the printed run, so a sheet outside it has none. */}
          {!variant.unlisted && (
            <span
              className="tabular-nums opacity-60"
              title={`Poster ${variant.id} of ${POSTER_COUNT}`}
            >
              {String(variant.id).padStart(2, '0')}/{POSTER_COUNT}
            </span>
          )}
        </footer>

      </div>

      {showAbout && (
        <PosterAboutDialog
          variant={variant}
          returnFocusTo={aboutTriggerRef}
          onClose={() => setShowAbout(false)}
        />
      )}
    </>
  );
};

export default PosterPage;


