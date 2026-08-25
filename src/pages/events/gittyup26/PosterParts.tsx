import { PosterVariant } from './posterTypes';

/*
 * The elements every GITTYUP poster is built from. Each takes its
 * appearance from the variant, so the same part reads differently on
 * each of the thirty pages.
 */

interface Part {
  variant: PosterVariant;
}

/*
 * The wordmark has to fill the page without overflowing it, and the row
 * count decides how much room each row gets — a ten-row poster sets far
 * smaller type than a four-row one. Capped against both the viewport
 * width and its height so a short laptop window does not push the
 * headline and the call to action off the bottom.
 */
const wordmarkSize = (rows: number) => {
  /*
   * Rows overlap by 0.26em, so n rows occupy roughly n * 0.94em. Aim
   * for the stack filling about half the viewport height, leaving room
   * for the headline, the details and the call to action below it.
   */
  const byHeight = Math.max(
    3.4,
    Math.min(10.5, 48 / Math.max(rows, 1)),
  );

  return `clamp(1.6rem, ${Math.min(9, byHeight + 0.5)}vw, ${byHeight}vh)`;
};

/*
 * Both marks come from the print artwork. They sit on dark grounds, so
 * they carry a drop shadow rather than a plate behind them.
 */
export const PosterMasthead = () => (
  <header className="flex items-start justify-between gap-4">

    <img
      src="/events/gittyup26/osc-lockup.webp"
      alt="Open Source Community, campus club at VIT-AP"
      className="h-8 w-auto drop-shadow-[0_2px_6px_rgba(0,0,0,0.6)] md:h-11"
    />

    <img
      src="/events/gittyup26/vitap-logo.webp"
      alt="VIT-AP University"
      className="h-7 w-auto drop-shadow-[0_2px_6px_rgba(0,0,0,0.6)] md:h-10"
      style={{ opacity: 0.92 }}
    />

  </header>
);

/*
 * The wordmark repeated down the page. Each row is clipped so the rise
 * animation reads as the letters coming up from under the line, and so
 * descenders never collide with the row below.
 */
export const PosterWordmark = ({
  variant,
  className = '',
}: Part & { className?: string }) => {
  const fill = variant.inkGradient
    ? {
        backgroundImage: variant.inkGradient,
        WebkitBackgroundClip: 'text',
        backgroundClip: 'text',
        color: 'transparent',
      }
    : { color: variant.ink };

  return (
    <div
      aria-hidden="true"
      className={`select-none tracking-[-0.015em] ${className}`}
      style={{ fontSize: wordmarkSize(variant.rows) }}
    >
      {Array.from(
        { length: Math.max(1, variant.rows) },
        (_, index) => (
          <div
            key={index}
            className={`overflow-hidden ${index > 0 ? '-mt-[0.26em]' : ''}`}
          >
            <div
              className="poster-rise flex justify-between whitespace-nowrap leading-[1.2]"
              style={{
                ...fill,
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
              >
                up
              </span>
            </div>
          </div>
        ),
      )}
    </div>
  );
};

/*
 * The poster's line, with its emphasised phrase in the heavy weight.
 * Splitting on the phrase keeps the emphasis exactly where the printed
 * poster put it instead of guessing at a word.
 */
export const PosterHeadline = ({
  variant,
  className = '',
}: Part & { className?: string }) => {
  const { headline, emphasis } = variant;

  const at =
    emphasis && headline.includes(emphasis)
      ? headline.indexOf(emphasis)
      : -1;

  return (
    <h1
      className={`font-thin leading-[1.12] tracking-[-0.03em] ${className}`}
      style={{ color: variant.text }}
    >
      {at === -1 ? (
        headline
      ) : (
        <>
          {headline.slice(0, at)}
          <span className="font-extrabold">
            {emphasis}
          </span>
          {headline.slice(
            at + (emphasis?.length ?? 0),
          )}
        </>
      )}
    </h1>
  );
};

export const PosterEyebrow = ({
  variant,
  className = '',
}: Part & { className?: string }) =>
  variant.eyebrow ? (
    <div
      className={`font-postermono text-[10px] font-medium uppercase tracking-[0.26em] md:text-xs ${className}`}
      style={{ color: variant.text, opacity: 0.7 }}
    >
      {variant.eyebrow}
    </div>
  ) : null;

export const PosterFootline = ({
  variant,
}: Part) => (
  <footer
    className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 border-t pt-4 font-postermono text-[10px] md:text-xs"
    style={{
      borderColor: `${variant.accent}44`,
      color: variant.text,
    }}
  >
    <span style={{ color: variant.accent }}>
      oscvitap.com/gittyup26
    </span>

    <span className="opacity-70">
      Open Source Community · VIT-AP University
    </span>

    <span
      className="tabular-nums opacity-40"
      title={`Poster ${variant.id} of 30`}
    >
      {String(variant.id).padStart(2, '0')}/30
    </span>
  </footer>
);
