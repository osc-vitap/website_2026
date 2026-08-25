/*
 * Colour helpers for the poster pages.
 *
 * The wordmark sits directly on photographic backgrounds whose
 * brightness varies across the page, so it needs a shadow that lifts it
 * off whatever is behind it. Which shadow depends on the ink: a light
 * wordmark needs a dark halo, a dark one needs a light halo. That has
 * to be derived from the colour rather than hardcoded, because the
 * thirty posters run from #ffffff to near-black ink.
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
 * A halo that separates display type from a busy background without
 * reading as a drop shadow. Two stacked shadows: a tight one to define
 * the edge, a wide soft one to darken (or lighten) the area behind.
 */
export const contrastHalo = (
  ink: string,
): string => {
  const light = luminance(ink) > 0.4;

  return light
    ? 'drop-shadow(0 1px 2px rgba(0,0,0,0.55)) drop-shadow(0 4px 22px rgba(0,0,0,0.45))'
    : 'drop-shadow(0 1px 2px rgba(255,255,255,0.35)) drop-shadow(0 4px 22px rgba(255,255,255,0.25))';
};
