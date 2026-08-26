import { CSSProperties, RefObject } from 'react';
import { PosterVariant } from './posterTypes';
import { GRID_WIDTH, LETTERS, boldThrough } from './posterGrid';

/*
 * The wordmark stack, in the two arrangements the printed posters use.
 *
 * Both run the same rows at the same size and clip to the room they
 * have, so a tall stack bleeds off the page as it does in print.
 */

interface PosterWordmarkProps {
  variant: PosterVariant;
  rows: number;
  fill: CSSProperties;
  containerRef: RefObject<HTMLDivElement>;
  className: string;
  style?: CSSProperties;
}

/*
 * The letter-grid posters set one letter per column and run the heavy
 * weight diagonally through the grid: the first row has only the
 * leading letter bold, and the front sweeps to the end of the word as
 * the eye travels down.
 */
const LetterGrid = ({
  rows,
  fill,
}: {
  rows: number;
  fill: CSSProperties;
}) => (
  <>
    {Array.from({ length: rows }, (_, row) => {
      const front = boldThrough(row, rows);

      return (
        <div
          key={row}
          className="poster-rise flex max-w-full leading-[1.16]"
          style={{
            ...fill,
            width: GRID_WIDTH,
            animationDelay: `${row * 0.07}s`,
          }}
        >
          {LETTERS.map((letter, column) => (
            <span
              key={column}
              /*
               * Each letter keeps its column whatever weight it takes,
               * so the grid stays square as the wave passes through.
               */
              className={`flex-1 text-center ${
                column <= front && column >= front - 2.5
                  ? 'font-black'
                  : 'font-thin'
              }`}
            >
              {letter === ' ' ? ' ' : letter}
            </span>
          ))}
        </div>
      );
    })}
  </>
);

const Stack = ({
  rows,
  fill,
}: {
  rows: number;
  fill: CSSProperties;
}) => (
  <>
    {Array.from({ length: rows }, (_, index) => (
      <div
        key={index}
        className={`overflow-hidden ${index > 0 ? '-mt-[0.26em]' : ''}`}
      >
        <div
          className="poster-rise flex whitespace-nowrap leading-[1.2]"
          style={{ ...fill, animationDelay: `${index * 0.07}s` }}
        >
          <span className={index % 2 === 0 ? 'font-thin' : 'font-black'}>
            gitty
          </span>

          <span
            className={index % 2 === 0 ? 'font-black' : 'font-thin'}
            style={{ marginLeft: '0.36em' }}
          >
            up
          </span>
        </div>
      </div>
    ))}
  </>
);

const PosterWordmark = ({
  variant,
  rows,
  fill,
  containerRef,
  className,
  style,
}: PosterWordmarkProps) => (
  <div
    ref={containerRef}
    aria-hidden="true"
    className={className}
    style={style}
  >
    {variant.layout === 'letter-grid' ? (
      <LetterGrid rows={rows} fill={fill} />
    ) : (
      <Stack rows={rows} fill={fill} />
    )}
  </div>
);

export default PosterWordmark;
