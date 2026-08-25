import { useSearchParams } from 'react-router-dom';
import { EventPageFrame } from './eventPageKit';
import { useEventPageMeta } from './useEventPageMeta';
import PosterGround from './gittyup26/PosterGround';
import { LAYOUTS } from './gittyup26/PosterLayouts';
import { variantFromParam } from './gittyup26/posterVariants';

/*
 * GITTYUP 26 — 29 August 2026, AB-2 Auditorium.
 *
 * Thirty posters go up around campus, each carrying a QR code for
 * ?pg=1 … ?pg=30. Scanning one lands here on a page built from that
 * poster's own palette, wordmark and line, so the screen matches the
 * paper in the reader's hand. An absent or out-of-range value falls
 * back to the first poster, so a smudged code still lands somewhere.
 *
 * The variants live in ./gittyup26/posterVariants.ts, derived from the
 * print artwork. See src/data/gittyUp26Posters.json for the specs they
 * were read from.
 */

const GittyUp26 = () => {
  const [searchParams] = useSearchParams();

  const variant = variantFromParam(
    searchParams.get('pg'),
  );

  const Layout = LAYOUTS[variant.layout];

  useEventPageMeta(
    'GITTYUP 26 · Open Source Community, VIT-AP',
    'GITTYUP 2026 — one day on version control, Git, GitHub and home labs. 29 August 2026, AB-2 Auditorium, VIT-AP University.',
  );

  return (
    <EventPageFrame
      className="font-poster"
      key={variant.id}
    >
      <PosterGround variant={variant} />

      <div className="relative z-10 lg:h-full">
        <Layout variant={variant} />
      </div>
    </EventPageFrame>
  );
};

export default GittyUp26;
