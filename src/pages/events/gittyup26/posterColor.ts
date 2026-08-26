/*
 * Colour helpers for the poster pages.
 *
 * Small copy sits directly on photographic backgrounds whose brightness
 * varies across the page, so it needs a shadow that lifts it off
 * whatever is behind it. Which shadow depends on the text colour: light
 * copy needs a dark halo, dark copy needs a light one. That has to be
 * derived from the colour rather than hardcoded, because the twenty-three
 * posters run from #ffffff to near-black.
 *
 * The display wordmark deliberately gets none of this — at that size a
 * halo reads as a glow around the letterforms.
 */

interface Rgb {
  r: number;
  g: number;
  b: number;
}

const parse = (color: string): Rgb | null => {
  const value = color.trim();

  const rgbMatch = value.match(
    /^rgba?\(\s*([\d.]+)[\s,]+([\d.]+)[\s,]+([\d.]+)/i,
  );

  if (rgbMatch) {
    return {
      r: Number(rgbMatch[1]),
      g: Number(rgbMatch[2]),
      b: Number(rgbMatch[3]),
    };
  }

  const hex = value.replace('#', '');

  const expanded =
    hex.length === 3 || hex.length === 4
      ? hex
          .slice(0, 3)
          .split('')
          .map((c) => c + c)
          .join('')
      : hex.slice(0, 6);

  if (!/^[0-9a-f]{6}$/i.test(expanded)) {
    return null;
  }

  return {
    r: parseInt(expanded.slice(0, 2), 16),
    g: parseInt(expanded.slice(2, 4), 16),
    b: parseInt(expanded.slice(4, 6), 16),
  };
};

/** WCAG relative luminance, 0 (black) to 1 (white). */
export const luminance = (
  color: string,
): number => {
  const rgb = parse(color);

  if (!rgb) return 1;

  const channel = (value: number) => {
    const c = value / 255;
    return c <= 0.03928
      ? c / 12.92
      : ((c + 0.055) / 1.055) ** 2.4;
  };

  return (
    0.2126 * channel(rgb.r) +
    0.7152 * channel(rgb.g) +
    0.0722 * channel(rgb.b)
  );
};

/*
 * The same idea for small copy. Text this size cannot carry a wide
 * blur without going muddy, so it gets a tight shadow plus a short
 * spread — enough to hold the letterforms apart from a background
 * that brightens underneath them.
 */
export const textHalo = (
  color: string,
): string => {
  const light = luminance(color) > 0.4;

  return light
    ? '0 1px 2px rgba(0,0,0,0.75), 0 0 10px rgba(0,0,0,0.5)'
    : '0 1px 2px rgba(255,255,255,0.6), 0 0 10px rgba(255,255,255,0.4)';
};

/*
 * The tint behind the frosted details panel.
 *
 * Taking the poster's ground at a fixed alpha does not work: the
 * grounds run from #000 to a mid purple, so the same alpha produces a
 * near-opaque black on one poster and a pale wash on another — and on
 * the pale ones the small mono type ends up light-on-light.
 *
 * The hue is kept, the lightness is not: the ground is pulled towards
 * black first, so every panel darkens what is behind it by a similar
 * amount whatever colour it started from, and the poster's palette
 * still shows through the glass.
 */
export const glassTint = (
  ground: string,
  alpha = 0.74,
): string => {
  const rgb = parse(ground);

  if (!rgb) return `rgba(0, 0, 0, ${alpha})`;

  /*
   * How far towards black. A ground that is already dark barely moves;
   * a bright one loses most of its lightness but keeps its hue.
   */
  const KEEP = 0.3;

  const darken = (value: number) =>
    Math.round(value * KEEP);

  return `rgba(${darken(rgb.r)}, ${darken(rgb.g)}, ${darken(rgb.b)}, ${alpha})`;
};
