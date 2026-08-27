import { CSSProperties, useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, Clock, HelpCircle, Loader2 } from 'lucide-react';
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
 * How long the page is willing to say "checking" before it gives up and
 * falls back to closed. Long enough for a bad campus connection to still
 * get an answer through, short enough that nobody is left watching a
 * spinner decide their afternoon.
 */
const REGISTRATION_TIMEOUT_MS = 8000;

type RegistrationState =
  | 'checking'
  | 'open'
  | 'closed';

/*
 * One box, three states.
 *
 * The size is reserved here rather than left to the labels: a set
 * height, a set width from `sm` up, and no wrapping anywhere. Equal
 * padding and border were not enough, because whichever label wrapped
 * decided the height. The closed label used to read "Registration
 * opening soon" and took two lines wherever the box was narrow, so it
 * grew at the exact moment the answer landed: on a 390px phone the
 * panel went 88px to 112px and everything under it dropped 24px, and at
 * 1024px, where the two-column layout makes this column narrowest,
 * 28px. The width moved with it — 204px to 309px across the three
 * states at 640px.
 *
 * Which is why both settled labels are short enough to sit on one line
 * at 320px, the narrowest phone this page is reached from. Below `sm`
 * the box is the panel's full width, so only the height is at stake
 * there.
 *
 * The open state used to carry no border at all while the closed one
 * carried two pixels of it, which was already a 4px jump between the
 * two outcomes before a third state existed.
 */
const CTA_BOX =
  'mt-7 inline-flex h-[3.75rem] w-full items-center gap-3 whitespace-nowrap rounded-full border-2 px-7 text-base font-bold sm:w-[17rem] md:h-[4rem] md:text-lg';

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
   * Three states rather than a boolean. It was a boolean that started
   * false, so for the whole of the fetch — and permanently if the fetch
   * never came back — the page said registration was opening soon in
   * the same confident type it uses when that is actually true. On
   * campus wifi that is long enough to read, believe and walk away
   * from. Not knowing yet is a different thing from knowing it is shut,
   * and only one of them is worth telling somebody.
   *
   * `closed` is still where an unread or unreachable API lands, because
   * the property that matters has not changed: never offer a form the
   * Worker is going to reject.
   */
  const [registration, setRegistration] =
    useState<RegistrationState>('checking');

  /* Kept whole, not just its is_open flag: the confirmation screen
     counts down to this event's own start. */
  const [event, setEvent] =
    useState<ApiEvent | null>(null);

  useEffect(() => {
    let live = true;
    let timer = 0;

    /*
     * fetchEvent takes no AbortSignal, so the request cannot be called
     * off from here — what this bounds is the wait. Without it a
     * connection that opens and then hangs leaves the pill spinning for
     * as long as the page is open, which is the same lie as before with
     * a spinner on it.
     */
    const timeout = new Promise<null>(
      (resolve) => {
        timer = window.setTimeout(
          () => resolve(null),
          REGISTRATION_TIMEOUT_MS,
        );
      },
    );

    Promise.race([
      fetchEvent(REGISTRATION_SLUG),
      timeout,
    ]).then((found) => {
      window.clearTimeout(timer);

      if (!live) return;

      setEvent(found);
      setRegistration(
        found?.is_open ? 'open' : 'closed',
      );
    });

    return () => {
      live = false;
      window.clearTimeout(timer);
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
        /*
          * no-repeat because a fill sized past 100% — the prism sheet
          * runs its photograph at 210% so one bright facet lands in the
          * type — would otherwise tile a second copy into the glyphs.
          */
        backgroundSize: variant.inkSize,
        backgroundPosition:
          variant.inkPosition,
        backgroundRepeat: variant.inkSize
          ? ('no-repeat' as const)
          : undefined,
        backgroundBlendMode: variant.inkBlend,
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

              {/*
                * Display type, and the date line below already says
                * 2026 — so it is the poster's mark rather than a fact,
                * and it is announced as one. Several sheets set it in a
                * near-transparent ink on purpose, which is a ghost
                * numeral in print and an unreadable one to a checker.
                */}
              <div
                aria-hidden="true"
                className="font-black leading-none text-[clamp(2.5rem,8vw,5.5rem)] lg:text-[min(5.5vw,8vh)]"
                style={{ color: variant.ink }}
              >
                26
              </div>

              {/*
                * Sits with the numeral rather than down in the details,
                * so it is on the first screen at any viewport — on a
                * phone the details block starts below the fold.
                *
                * It carries its own ground for the same reason the
                * details panel does: out here it is on bare artwork, and
                * the accent alone over the brightest sheets measured
                * 2.99:1. Filled, the ground under it is the poster's own
                * and the accent clears 5:1 on all thirty.
                */}
              <span
                className="rounded-full border-2 px-3.5 py-1.5 font-postermono text-[11px] font-bold tracking-[0.1em] md:px-4 md:text-sm"
                style={{
                  backgroundColor: glassTint(variant.ground, 0.95),
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

            {/*
              * No opacity utility on top of the colour. variant.text is
              * already translucent on most of the run — .72 on poster 4,
              * .66 on poster 19 — and an opacity-75 over that landed the
              * subline at an effective .5 and 3.59:1. The colour carries
              * the whole of how quiet this line is, in one place.
              */}
            {variant.subline && (
              <p
                className="poster-fade-up mt-5 max-w-xl text-[clamp(0.85rem,1.6vw,1rem)] leading-relaxed"
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
              * Not in the variant data, because it is not about any one
              * sheet — somebody went round taking the posters down, and
              * every sheet that went back up says so. It is set in the
              * accent rather than the body colour: the copy above it is
              * the poster's own line, and this is the club answering,
              * which should not read as more of the same paragraph.
              */}
            <p
              className="poster-fade-up mt-4 max-w-xl text-[clamp(0.8rem,1.5vw,0.95rem)] font-semibold leading-relaxed"
              style={{
                color: variant.accent,
                textShadow: textHalo(variant.accent),
                animationDelay: '0.55s',
              }}
            >
              They tried to remove our posters but just demonstrated
              {' '}
              <span className="font-postermono">git restore</span>!
            </p>

            {/*
              * The terminal poster prints its own git log. The prompt
              * lines take the accent, the output stays quiet.
              */}
            {variant.terminal && (
              <div
                className="poster-fade-up mt-7 max-w-xl rounded-2xl border p-5 font-postermono text-[clamp(0.7rem,1.5vw,0.9rem)] leading-relaxed md:p-6"
                style={{
                  borderColor: withAlpha(variant.accent, 30),
                  /*
                    * Reserved ground, not a 55% wash of it. A terminal is
                    * the one thing on these pages that is genuinely a
                    * box with its own background, and at 55% the artwork
                    * came through it: the output lines measured 2.98:1.
                    */
                  backgroundColor: glassTint(variant.ground, 0.95),
                  animationDelay: '0.5s',
                }}
              >
                {variant.terminal.map((line, index) => {
                  const isPrompt =
                    index === 0 ||
                    index === (variant.terminal?.length ?? 0) - 1;

                  return (
                    /* The output steps back from the prompt by colour
                       alone. An opacity utility on top of variant.text,
                       which is already translucent, put these at an
                       effective half strength. */
                    <div
                      key={index}
                      className={isPrompt ? 'font-bold' : undefined}
                      style={{
                        color: isPrompt
                          ? variant.accent
                          : variant.text,
                        marginTop: index === 0 ? 0 : '0.4em',
                      }}
                    >
                      {isPrompt && (
                        <span className="mr-2">$</span>
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
                  *
                  * Held at 0.9 rather than the helper's 0.74. The printed
                  * sheets do not float their details over the artwork and
                  * then fight it back — they stop the artwork and set the
                  * type on clean ground. At 0.74 the picture came through
                  * far enough that the smallest mono line in here
                  * measured 2.35:1 on the busiest sheet, with a halo
                  * holding it up. Reserved ground is cheaper than a halo
                  * and it is what the print does.
                  */
                backgroundColor: glassTint(variant.ground, 0.95),
                ['--glass-solid' as string]: glassTint(variant.ground, 0.96),
                borderColor: withAlpha(variant.accent, 22),
              }}
            >

              {/*
                * On the dispersed-glass sheets the panel's hairline
                * splits into a warm and a cool copy, the way every
                * contour in that artwork does. Decorative and 1px, so
                * it is a bare span rather than anything with meaning.
                */}
              {variant.dispersion && (
                <span
                  aria-hidden="true"
                  className="poster-fringe"
                >
                  {/* The torn band, an extra copy over the two rings
                      rather than a hole cut in one of them. */}
                  <span className="poster-fringe-tear" />
                </span>
              )}

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
                    /* Same reason as the subline: the colour is already
                       carrying the step down from the date above it. */
                    <div
                      className="mt-3 font-postermono text-xs md:text-sm"
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
              <div aria-busy={registration === 'checking'}>
                {registration === 'checking' && (
                  /*
                    * The box is in the layout immediately and only its
                    * ink is late — see .poster-checking. A Worker that
                    * answers in 80ms is never seen to have been asked.
                    */
                  <div
                    className={`${CTA_BOX} poster-checking justify-center`}
                    style={{
                      borderColor: withAlpha(variant.accent, 40),
                      color: variant.text,
                    }}
                  >
                    <Loader2
                      size={18}
                      aria-hidden="true"
                      className="poster-checking-spin shrink-0"
                    />
                    Checking…
                  </div>
                )}

                {registration === 'open' && (
                  <button
                    type="button"
                    onClick={() => setShowForm(true)}
                    className={`${CTA_BOX} poster-shine group justify-between transition-transform hover:scale-[1.02] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4`}
                    style={{
                      backgroundColor: variant.accent,
                      borderColor: variant.accent,
                      color: variant.ground,
                      outlineColor: variant.accent,
                    }}
                  >
                    Register Now
                    <ArrowRight
                      size={20}
                      className="shrink-0 transition-transform group-hover:translate-x-1"
                    />
                  </button>
                )}

                {registration === 'closed' && (
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
                    className={`${CTA_BOX} justify-center`}
                    style={{
                      borderColor: withAlpha(variant.accent, 55),
                      color: variant.accent,
                    }}
                  >
                    <Clock size={18} className="shrink-0" />
                    Opening soon
                  </div>
                )}

                {/*
                  * The resolution is announced, not the wait. A live
                  * region that fired on "checking" would interrupt a
                  * screen reader to say nothing had happened yet;
                  * aria-busy above already carries that. This speaks
                  * once, when there is an answer.
                  */}
                <p
                  aria-live="polite"
                  className="sr-only"
                >
                  {registration === 'open' &&
                    'Registration is open.'}
                  {registration === 'closed' &&
                    'Registration is not open yet.'}
                </p>
              </div>

            </div>
            )}

            {/*
              * Under the panel rather than inside it, so it survives the
              * panel being replaced by the registration form.
              *
              * This was a 10px letter-spaced mono footnote and nobody
              * could see it — which is the whole problem with setting a
              * question nobody has asked yet in the quietest type on the
              * page. Most people arriving here scanned a poster in a
              * corridor and have no idea what the event is, so this is
              * the second most useful thing on the screen after the
              * register button, and it now looks like it.
              *
              * A bordered chip rather than a bare link: on a phone an
              * underlined line of text is a guess, a bordered box is a
              * target. min-h-[44px] is the tap size the old one missed
              * by half.
              */}
            <button
              ref={aboutTriggerRef}
              type="button"
              onClick={() => setShowAbout(true)}
              className="poster-glass group mt-5 inline-flex min-h-[44px] w-full items-center justify-center gap-2.5 px-5 py-3 text-sm font-semibold sm:w-auto md:text-base focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4"
              style={{
                /*
                  * The label stays in the body colour and the accent goes
                  * on the border and the fill. The accent is not
                  * dependable as body ink across the run: on the
                  * purple-ground sheet it measures 3.28:1 against its own
                  * poster, where every other sheet clears 5:1. One
                  * failure is enough, and it is the one sheet nobody
                  * would have checked.
                  *
                  * The fill is the panel's, not a half-strength wash. At
                  * 0.55 the artwork still came through and the label
                  * measured 1.60:1 on the brightest sheet; the halo that
                  * was here was covering for that, so it is gone with it.
                  */
                color: variant.text,
                backgroundColor: glassTint(variant.ground, 0.95),
                /*
                  * The opaque fallback .poster-glass reaches for where
                  * there is no backdrop-filter, the same one the panel
                  * and the dialog set. Unset, that rule painted this
                  * chip flat black while everything around it kept the
                  * sheet's tint.
                  */
                ['--glass-solid' as string]: glassTint(variant.ground, 0.96),
                borderColor: withAlpha(variant.accent, 55),
                outlineColor: variant.accent,
              }}
            >
              <HelpCircle
                size={18}
                aria-hidden="true"
                className="shrink-0 transition-transform group-hover:scale-110"
                style={{ color: variant.accent }}
              />
              What is GITTY UP?
            </button>

          </aside>

        </main>

        {/*
          * The bottom matter, on ground the artwork does not reach.
          *
          * This is the print's method rather than the web's. On the
          * printed sheets the picture stops and the whole details stack
          * — rule, date, venue, URL, the row of past marks — is set on
          * flat black; not one line of it is over the artwork and there
          * is no scrim anywhere in the run. Here both rows sat directly
          * on the poster image, and the two smallest things on the page
          * measured 2.32:1 and 2.27:1 against the sheets that are bright
          * down here, propped up by a halo that was losing.
          *
          * Ground first. The halo then has nothing to do, and the ink
          * can come back up to the colour the variant actually asked
          * for instead of a fraction of it.
          */}

        <div
          className="poster-fade-up mt-6 rounded-[12px] px-5 pb-4 pt-5 md:px-7"
          style={{
            backgroundColor: glassTint(variant.ground, 0.95),
            animationDelay: '0.6s',
          }}
        >

        {/*
          * Previous builds. Every printed sheet carries this row of past
          * event marks along its bottom edge — it is how the poster says
          * who is running the session without spending a line of copy on
          * it, so the page carries it too.
          */}

        <div
          className="mb-4 flex flex-wrap items-center justify-center gap-x-6 gap-y-2 md:gap-x-9"
        >
          <span
            className="font-postermono text-[9px] uppercase tracking-[0.22em] md:text-[10px]"
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

        {/*
          * No halo on any of this now. A halo is what you reach for when
          * type has to survive a photograph underneath it; on reserved
          * ground it only thickens the smallest type on the page.
          */}
        <footer
          className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 border-t pt-4 font-postermono text-[10px] md:text-xs"
          style={{
            borderColor: withAlpha(variant.accent, 25),
            color: variant.text,
          }}
        >
          {/*
            * The URL is set in the body colour and carried by its
            * weight, which is what the printed run does with it. Sampled
            * off the artwork: on sheet 4 the URL prints #ffffff against
            * #05030c and on sheet 2 #cccccc against black — 20.5:1 and
            * 13.1:1, achromatic on both. It is the eyebrow that takes
            * the colour up in the details, not the footline. In the
            * accent here it was the darkest thing on the page: 2.17:1 on
            * poster 9, whose accent is a deep teal.
            */}
          <span className="font-bold">
            oscvitap.com/gittyup26
          </span>

          <span>
            Open Source Community · VIT-AP University
          </span>

          {/* The counter is of the printed run, so a sheet outside it has none. */}
          {!variant.unlisted && (
            <span
              className="tabular-nums"
              title={`Poster ${variant.id} of ${POSTER_COUNT}`}
            >
              {String(variant.id).padStart(2, '0')}/{POSTER_COUNT}
            </span>
          )}
        </footer>

        </div>

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


