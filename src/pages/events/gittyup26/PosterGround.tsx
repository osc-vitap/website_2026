import { PosterVariant } from './posterTypes';

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

interface PosterGroundProps {
  variant: PosterVariant;
}

const PosterGround = ({
  variant,
}: PosterGroundProps) => (
  <>
    <div
      aria-hidden="true"
      className="absolute inset-0"
      style={{ background: variant.ground }}
    />

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
  </>
);

export default PosterGround;
