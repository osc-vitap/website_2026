import { useEffect, useState } from 'react';

/*
 * True once the poster typefaces have actually loaded.
 *
 * The wordmark is the page, and Objectivity is self-hosted, so a
 * fallback flash is very visible — Arial for a beat, then a reflow into
 * a geometric grotesque at display size. The page holds a splash until
 * the faces are ready instead.
 *
 * The timeout matters: if a font request hangs or fails, the reader must
 * still get the page. After it elapses we render regardless, which is
 * the same outcome as not gating at all.
 */
export const useFontsReady = (
  timeoutMs = 2500,
) => {
  const [ready, setReady] = useState(false);

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

    if (!fonts) {
      done();
      return () => window.clearTimeout(timer);
    }

    /*
     * document.fonts.ready resolves once loading settles, but only for
     * faces the browser has decided to fetch. Asking for the two the
     * poster actually needs makes sure they are among them.
     */
    Promise.all([
      fonts.load('100 1em Objectivity'),
      fonts.load('900 1em Objectivity'),
    ])
      .catch(() => undefined)
      .then(() => fonts.ready)
      .then(done)
      .catch(done);

    return () => window.clearTimeout(timer);
  }, [timeoutMs]);

  return ready;
};
