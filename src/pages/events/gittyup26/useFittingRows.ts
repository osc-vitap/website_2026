import {
  RefObject,
  useEffect,
  useState,
} from 'react';

/*
 * How many whole wordmark rows fit in the space available.
 *
 * The stack is meant to bleed off the page as it does in print, but
 * clipping the box at an arbitrary height slices through the middle of
 * the letters, which reads as a rendering fault rather than a crop. So
 * the row count is measured instead: the container's own max-height and
 * font size give the number of complete rows that fit, and only those
 * are rendered.
 *
 * Rows overlap by 0.26em against a 1.2em line box, so each one occupies
 * 0.94em after the first, which needs its full 1.2em.
 */
const ROW_ADVANCE = 0.94;
const FIRST_ROW = 1.2;

/*
 * The letter-grid posters do not overlap their rows — each letter has
 * to keep its own line box for the columns to line up — so a row there
 * costs its full line height. Shared with the sizing helper so the two
 * cannot drift apart.
 */
import { GRID_ROW } from './posterGrid';

export const useFittingRows = (
  ref: RefObject<HTMLElement>,
  requested: number,
  { advance = ROW_ADVANCE, first = FIRST_ROW } = {},
) => {
  const [rows, setRows] = useState(requested);

  useEffect(() => {
    const element = ref.current;

    if (!element) return;

    const measure = () => {
      const styles =
        window.getComputedStyle(element);

      const fontSize = parseFloat(
        styles.fontSize,
      );

      const maxHeight = parseFloat(
        styles.maxHeight,
      );

      if (
        !Number.isFinite(fontSize) ||
        !Number.isFinite(maxHeight) ||
        fontSize <= 0
      ) {
        setRows(requested);
        return;
      }

      const fits =
        1 +
        Math.floor(
          (maxHeight - first * fontSize) /
            (advance * fontSize),
        );

      setRows(
        Math.max(
          1,
          Math.min(requested, fits),
        ),
      );
    };

    measure();

    const observer = new ResizeObserver(
      measure,
    );

    observer.observe(element);
    window.addEventListener(
      'resize',
      measure,
    );

    return () => {
      observer.disconnect();
      window.removeEventListener(
        'resize',
        measure,
      );
    };
  }, [ref, requested, advance, first]);

  return rows;
};

/* Row metrics for a poster's layout, for callers of useFittingRows. */
export const rowMetrics = (layout: string) =>
  layout === 'letter-grid'
    ? { advance: GRID_ROW, first: GRID_ROW }
    : { advance: ROW_ADVANCE, first: FIRST_ROW };
