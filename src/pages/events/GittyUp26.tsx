import { useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import { EventPageFrame } from './eventPageKit';
import { useEventPageMeta } from './useEventPageMeta';
import { useFontsReady } from './gittyup26/useFontsReady';
import PosterPage from './gittyup26/PosterPage';
import { variantFromParam } from './gittyup26/posterVariants';

/*
 * GITTYUP 26 — 29 August 2026, AB-2 Auditorium.
 *
 * Thirty posters go up around campus, each carrying a QR code for
 * ?pg=1 … ?pg=30. Scanning one lands here on that poster's colours,
 * line and wordmark, so the screen matches the paper in the reader's
 * hand.
 *
 * Without a ?pg the page picks a poster at random, so the bare URL
 * shows a different one on each visit.
 */

const GittyUp26 = () => {
  const [searchParams] = useSearchParams();

  const pg = searchParams.get('pg');

  /*
   * Resolved once per pg value rather than per render — the random
   * branch would otherwise pick a new poster every time React
   * re-rendered the page.
   */
  const variant = useMemo(
    () => variantFromParam(pg),
    [pg],
  );

  const fontsReady = useFontsReady();

  useEventPageMeta(
    'GITTYUP 26 · Open Source Community, VIT-AP',
    'GITTYUP 2026 — one day on version control, Git, GitHub and home labs. 29 August 2026, AB-2 Auditorium, VIT-AP University.',
  );

  return (
    <EventPageFrame
      className="font-poster"
      key={variant.id}
    >
      <PosterPage variant={variant} />

      {/*
        * Held over the poster until the typefaces land, so the wordmark
        * never renders in a fallback face first. Fades out rather than
        * cutting, and is removed from the tree once it has.
        */}
      {!fontsReady && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center"
          style={{ background: variant.ground }}
          role="status"
          aria-label="Loading"
        >
          <div
            className="h-9 w-9 animate-spin rounded-full border-2 border-transparent"
            style={{
              borderTopColor: variant.accent,
              borderRightColor: variant.accent,
            }}
          />
        </div>
      )}
    </EventPageFrame>
  );
};

export default GittyUp26;
