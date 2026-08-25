import { RefObject, useEffect } from 'react';

/*
 * Writes the cursor position onto an element as --mx / --my.
 *
 * Deliberately not React state: the pointer moves at screen refresh
 * rate, and re-rendering the poster on every move would be far more
 * work than the effect is worth. Writing custom properties keeps the
 * whole thing in the compositor.
 *
 * Desktop only. A coarse pointer has no hover position to follow, and
 * anyone who has asked for reduced motion should not get a light that
 * chases them around the page.
 */
export const useCursorSpotlight = (
  ref: RefObject<HTMLElement>,
  enabled: boolean,
) => {
  useEffect(() => {
    const element = ref.current;

    if (!element || !enabled) return;

    const fine = window.matchMedia(
      '(hover: hover) and (pointer: fine)',
    );

    const still = window.matchMedia(
      '(prefers-reduced-motion: reduce)',
    );

    if (!fine.matches || still.matches) return;

    let frame = 0;
    let x = 0;
    let y = 0;

    const paint = () => {
      frame = 0;
      element.style.setProperty('--mx', `${x}px`);
      element.style.setProperty('--my', `${y}px`);
    };

    const onMove = (event: PointerEvent) => {
      x = event.clientX;
      y = event.clientY;

      // One write per frame, however fast the pointer reports.
      if (!frame) {
        frame = window.requestAnimationFrame(paint);
      }
    };

    const onLeave = () => {
      element.style.setProperty('--spot', '0');
    };

    const onEnter = () => {
      element.style.setProperty('--spot', '1');
    };

    window.addEventListener('pointermove', onMove, {
      passive: true,
    });

    document.addEventListener(
      'pointerleave',
      onLeave,
    );

    document.addEventListener(
      'pointerenter',
      onEnter,
    );

    return () => {
      if (frame) {
        window.cancelAnimationFrame(frame);
      }

      window.removeEventListener('pointermove', onMove);
      document.removeEventListener('pointerleave', onLeave);
      document.removeEventListener('pointerenter', onEnter);
    };
  }, [ref, enabled]);
};
