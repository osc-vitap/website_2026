import { useEffect, useState } from 'react';

/*
 * True once the poster is actually ready to show: the typefaces have
 * loaded and so have the images the first screen depends on.
 *
 * The wordmark is the page and Objectivity is self-hosted, so a fallback
 * flash is very visible. The background photograph matters just as much
 * — without it the poster renders as a flat gradient for a beat, then
 * the texture snaps in underneath the type.
 *
 * The timeout is the important part: if a font or an image never
 * arrives, the reader must still get the page. After it elapses we
 * render regardless, which is the same outcome as not gating at all.
 */

const preload = (src: string) =>
  new Promise<void>((resolve) => {
    const image = new Image();

    // Resolve either way — a missing texture must not hold the page.
    image.onload = () => resolve();
    image.onerror = () => resolve();
    image.src = src;

    if (image.complete) resolve();
  });

export const usePosterReady = (
  images: string[],
  timeoutMs = 4000,
) => {
  const [ready, setReady] = useState(false);

  /* Join the list so the effect keys on its contents, not its identity. */
  const key = images.join('|');

  useEffect(() => {
    let settled = false;

    const done = () => {
      if (settled) return;
      settled = true;
      setReady(true);
    };

    const timer = window.setTimeout(
      done,
      timeoutMs,
    );

    const fonts = document.fonts;

    /*
     * document.fonts.ready settles only for faces the browser has
     * decided to fetch, so ask for the two the wordmark needs by name.
     */
    const fontsReady = fonts
      ? Promise.all([
          fonts.load('100 1em Objectivity'),
          fonts.load('900 1em Objectivity'),
        ])
          .catch(() => undefined)
          .then(() => fonts.ready)
          .then(() => undefined)
      : Promise.resolve();

    Promise.all([
      fontsReady,
      ...key
        .split('|')
        .filter(Boolean)
        .map(preload),
    ])
      .then(done)
      .catch(done);

    return () => window.clearTimeout(timer);
  }, [key, timeoutMs]);

  return ready;
};
