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
 * Whether this poster's ground reads as a dot field — a CSS lattice in
 * its layers, or one of the halftone-style photographs. Only those get
 * the cursor light; adding dots to a poster that has none would invent
 * a texture the print version does not have.
 */
const isDotted = (variant: PosterVariant) =>
  variant.layers.some(
    (layer) =>
      /radial-gradient\(\s*circle/.test(layer) &&
      /\d+px\s+\d+px/.test(layer),
  ) || /halftone|noisy/.test(variant.image ?? '');

interface PosterGroundProps {
  variant: PosterVariant;
}

const PosterGround = ({
  variant,
}: PosterGroundProps) => {
  const spotRef = useRef<HTMLDivElement>(null);

  const dotted = isDotted(variant);

  useCursorSpotlight(spotRef, dotted);

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
      * A brighter copy of the dot field, revealed only in a circle
      * around the cursor, so the dots appear to light up under it. The
      * mask is driven by --mx / --my, which the hook writes directly on
      * this element — no React render per pointer move.
      *
      * --spot drops to 0 when the pointer leaves the window, so the
      * light fades out rather than freezing wherever it left.
      */}
    {dotted && (
      <div
        ref={spotRef}
        aria-hidden="true"
        className="poster-spotlight pointer-events-none absolute inset-0"
        style={{
          backgroundImage: `radial-gradient(circle, ${variant.ink} 1.3px, transparent 1.4px)`,
          backgroundSize: '8px 8px',
        }}
      />
    )}
  </>
  );
};

export default PosterGround;
