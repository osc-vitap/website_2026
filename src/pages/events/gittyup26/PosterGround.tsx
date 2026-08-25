import { useRef } from 'react';
import { PosterVariant } from './posterTypes';
import { useCursorSpotlight } from './useCursorSpotlight';

/*
 * The background of a poster page: the flat ground, the poster's own
 * overlay gradients, an optional graph grid, and grain standing in for
 * the photographic texture the print version used.
 *
 * All of it is decorative, so none of it is exposed to assistive tech.
 */

/*
 * Fractal noise as a data URI. Cheaper and sharper than a tiled image,
 * and it does not cost a network request per variant.
 */
const GRAIN_SVG = encodeURIComponent(
  `<svg xmlns="http://www.w3.org/2000/svg" width="160" height="160"><filter id="n"><feTurbulence type="fractalNoise" baseFrequency="0.85" numOctaves="3" stitchTiles="stitch"/><feColorMatrix type="saturate" values="0"/></filter><rect width="160" height="160" filter="url(#n)" opacity="1"/></svg>`,
);

/*
 * A layer that paints a repeating dot lattice: a circular gradient tiled
 * at a fixed size. Grain and full-bleed washes are not dots and are left
 * out.
 */
const isDotLayer = (layer: string) =>
  /radial-gradient\(\s*circle/.test(layer) &&
  /\/\s*[\d.]+px\s+[\d.]+px/.test(layer);

/*
 * The poster's own dot layers, returned verbatim.
 *
 * The cursor light re-paints exactly these rather than drawing a dot
 * field of its own. The old light carried its own lattice at its own
 * spacing and phase, so it beat against the dots underneath and read as
 * moiré — two grids, not one responding. Re-painting the poster's own
 * values lines them up by construction: the dots it already has simply
 * strengthen where the pointer is.
 *
 * Only these lattices count. A poster with no dot layer gets no light,
 * because there is nothing there to react — the noisy-* and grain
 * textures are not dot fields, and the two halftone posters each carry
 * a lattice of their own anyway.
 */
const dotLayers = (variant: PosterVariant) => variant.layers.filter(isDotLayer);

/*
 * How many times the light re-paints those layers. The lattices are
 * deliberately faint — several sit at 7% alpha — so a single extra pass
 * is barely a change. Stacking identical copies at identical offsets
 * composes alpha over itself and deepens only the dots, never the space
 * between them.
 */
const REINFORCE = 3;

interface PosterGroundProps {
  variant: PosterVariant;
}

const PosterGround = ({
  variant,
}: PosterGroundProps) => {
  const spotRef = useRef<HTMLDivElement>(null);

  const dots = dotLayers(variant);

  useCursorSpotlight(spotRef, dots.length > 0);

  return (
  <>
    <div
      aria-hidden="true"
      className="absolute inset-0"
      style={{ background: variant.ground }}
    />

    {variant.image && (
      <div
        aria-hidden="true"
        className="absolute inset-0 bg-cover bg-center"
        style={{
          backgroundImage: `url(${variant.image})`,
        }}
      />
    )}

    {variant.layers.map((layer, index) => (
      <div
        key={index}
        aria-hidden="true"
        className="absolute inset-0"
        style={{ background: layer }}
      />
    ))}

    {variant.grid && (
      <div
        aria-hidden="true"
        className="absolute inset-0"
        style={{
          backgroundImage: `linear-gradient(${variant.grid.color} 1px, transparent 1px), linear-gradient(90deg, ${variant.grid.color} 1px, transparent 1px)`,
          backgroundSize: `${variant.grid.size} ${variant.grid.size}`,
        }}
      />
    )}

    {variant.grain ? (
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 mix-blend-overlay"
        style={{
          opacity: variant.grain,
          backgroundImage: `url("data:image/svg+xml,${GRAIN_SVG}")`,
          backgroundSize: '160px 160px',
        }}
      />
    ) : null}

    {/*
      * A second pass over the poster's own dots, revealed only in a
      * circle around the cursor, so those dots deepen where the pointer
      * is instead of a separate pattern appearing over them.
      *
      * The mask is driven by --mx / --my, which the hook writes directly
      * on this element — no React render per pointer move. --spot drops
      * to 0 when the pointer leaves the window, so the light fades out
      * rather than freezing wherever it left.
      */}
    {dots.length > 0 && (
      <div
        ref={spotRef}
        aria-hidden="true"
        className="poster-spotlight pointer-events-none absolute inset-0"
        style={{
          background: Array.from({ length: REINFORCE }, () => dots)
            .flat()
            .join(', '),
        }}
      />
    )}
  </>
  );
};

export default PosterGround;
