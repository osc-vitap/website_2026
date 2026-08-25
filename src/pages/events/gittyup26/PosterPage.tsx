import { useRef, useState } from 'react';
import { ArrowRight } from 'lucide-react';
import PosterGround from './PosterGround';
import { PosterVariant } from './posterTypes';
import PosterRegisterForm from './PosterRegisterForm';
import { textHalo } from './posterColor';
import { useFittingRows } from './useFittingRows';

/*
 * One layout, thirty palettes.
 *
 * Every poster page uses this composition: the wordmark stack, the
 * toggle and the numeral on the left, the details and the call to
 * action on the right, the poster's line beneath. Only the colours,
 * the background, the row count and the copy change between the
 * thirty, which keeps the spacing predictable — a per-poster layout
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

const PosterPage = ({
  variant,
}: PosterPageProps) => {
  const [showForm, setShowForm] = useState(false);

  const wordmarkRef = useRef<HTMLDivElement>(null);

  const visibleRows = useFittingRows(
    wordmarkRef,
    Math.max(1, variant.rows),
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
          <img
            src="/events/gittyup26/osc-lockup.webp"
            alt="Open Source Community, campus club at VIT-AP"
            className="h-8 w-auto drop-shadow-[0_2px_6px_rgba(0,0,0,0.55)] md:h-11"
          />

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

            <div
              ref={wordmarkRef}
              aria-hidden="true"
              className={`max-h-[36vh] select-none overflow-hidden tracking-[-0.015em] lg:max-h-[46vh] ${WORDMARK_SIZE}`}
            >
              {Array.from(
                {
                  length: visibleRows,
                },
                (_, index) => (
                  <div
                    key={index}
                    className={`overflow-hidden ${index > 0 ? '-mt-[0.26em]' : ''}`}
                  >
                    <div
                      className="poster-rise flex whitespace-nowrap leading-[1.2]"
                      style={{
                        ...wordmarkFill,
                        animationDelay: `${index * 0.07}s`,
                      }}
                    >
                      <span
                        className={
                          index % 2 === 0
                            ? 'font-thin'
                            : 'font-black'
                        }
                      >
                        gitty
                      </span>

                      <span
                        className={
                          index % 2 === 0
                            ? 'font-black'
                            : 'font-thin'
                        }
                        style={{
                          marginLeft: '0.36em',
                        }}
                      >
                        up
                      </span>
                    </div>
                  </div>
                ),
              )}
            </div>

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
                  textShadow: textHalo(variant.accent),
                }}
              >
                ODs Provided
              </span>
            </div>

            {/* The poster's line */}

            <h1
              className="poster-fade-up mt-8 max-w-2xl font-thin leading-snug tracking-[-0.02em] text-[clamp(1.1rem,2.5vw,1.8rem)] lg:mt-7"
              style={{ color: variant.text }}
            >
              {emphasisAt === -1 ? (
                headline
              ) : (
                <>
                  {headline.slice(
                    0,
                    emphasisAt,
                  )}
                  <span className="font-extrabold">
                    {emphasis}
                  </span>
                  {headline.slice(
                    emphasisAt +
                      (emphasis?.length ?? 0),
                  )}
                </>
              )}
            </h1>

          </section>

          {/* Details and call to action */}

          <aside className="poster-slide-in lg:pb-4" style={{ animationDelay: '0.3s' }}>

            {showForm ? (
              <PosterRegisterForm
                variant={variant}
                onClose={() =>
                  setShowForm(false)
                }
              />
            ) : (
            <div
              className="border-t-2 pt-6"
              style={{
                borderColor: withAlpha(variant.accent, 35),
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

              {/*
                * Registration happens here rather than on a separate
                * page: someone who scanned a poster should not be
                * dropped out of the design they scanned into.
                */}
              <button
                type="button"
                onClick={() => setShowForm(true)}
                className="group mt-7 inline-flex w-full items-center justify-between gap-4 rounded-full px-7 py-4 text-base font-bold transition-transform hover:scale-[1.02] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 sm:w-auto md:text-lg"
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

            </div>
            )}

          </aside>

        </main>

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

          <span
            className="tabular-nums opacity-60"
            title={`Poster ${variant.id} of 30`}
          >
            {String(variant.id).padStart(2, '0')}/30
          </span>
        </footer>

      </div>
    </>
  );
};

export default PosterPage;


