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

export const useFittingRows = (
  ref: RefObject<HTMLElement>,
  requested: number,
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
          (maxHeight - FIRST_ROW * fontSize) /
            (ROW_ADVANCE * fontSize),
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
  }, [ref, requested]);

  return rows;
};
