/*
 * One printed GITTYUP 26 poster, described well enough to rebuild it
 * as a responsive web page.
 *
 * The printed posters sit on 4K photographic textures. Those are not
 * shipped to the web — a landing page reached by scanning a QR code on
 * a phone should not pull a full-bleed photograph per variant — so the
 * texture is rebuilt from layered CSS instead. `layers` carries the
 * poster's own overlay gradients, which is where most of the colour
 * came from anyway; the photograph underneath was texture, not
 * structure.
 */

export type PosterLayout =
  | 'wordmark-stack'
  | 'headline-led'
  | 'terminal'
  | 'data-block'
  /**
   * The wordmark spread one letter per column, with the heavy weight
   * running diagonally down through the grid so the stack reads as a
   * wave rather than a list.
   */
  | 'letter-grid'
  /** A single wordmark row over the emphasis word set as the hero. */
  | 'hero-word';

export interface PosterVariant {
  /** 1-based, matches ?pg= and the poster's position in the print run. */
  id: number;

  layout: PosterLayout;

  /** Base colour behind every layer. */
  ground: string;

  /**
   * The poster's own photographic texture, optimised for the web.
   * Sits directly on the ground, under everything in `layers`, which
   * are the scrims and tints the print design put over it.
   */
  image?: string;

  /**
   * Blend mode for `image`, for the two textures that are not meant to
   * be laid down flat.
   *
   * `multiply` is the halftone screen: a white sheet with black dots, so
   * multiplying drops the white away and prints the dots onto the colour
   * underneath the way the press does. It has to reach the finished
   * colour, so it paints above `layers`.
   *
   * `luminosity` recolours a texture that ships in the wrong hue. The
   * source set is generic — green heads, yellow shapes, teal cubes — and
   * the printed posters tint each one to its own palette. Taking the
   * texture's lightness and the ground's colour does the same thing, so
   * it paints in its usual place and lets the tints run over it.
   */
  imageBlend?: 'multiply' | 'luminosity';

  /**
   * Where `image` is anchored, as a CSS background-position. Defaults to
   * centre. The textures are portrait crops of wider artwork, so a
   * poster whose subject sits off to one side loses it entirely when a
   * landscape screen crops to the middle.
   */
  imagePosition?: string;

  /**
   * This sheet's artwork is dispersed glass or liquid chrome: prismatic
   * edges, a warm copy of every contour thrown one way and a cool one
   * the other. The details panel answers by splitting its own hairline
   * into the same two channels — see .poster-fringe in index.css.
   *
   * Carried on the variant rather than as a list of ids somewhere else,
   * for the same reason `unlisted` and `imageBlend` are. The run has
   * been re-ordered once already, and a list of ids goes quietly wrong
   * the next time it is — decorating whichever sheets have moved into
   * those positions instead.
   */
  dispersion?: boolean;

  /**
   * CSS background values painted over the ground, first entry
   * closest to the ground. Taken from the poster's own overlays,
   * plus a replacement for the photograph where there was one.
   *
   * Empty on the sheets the print leaves as ground plus artwork and
   * nothing else. That is a finished background, not a gap the
   * generator failed to fill, so it should be left alone.
   */
  layers: string[];

  /** Strength of the grain overlay, 0 to 1. Stands in for photo noise. */
  grain?: number;

  /** Technical graph-paper grid, on the posters that use one. */
  grid?: {
    size: string;
    color: string;
  };

  /** Colour of the repeated wordmark. Often translucent. */
  ink: string;

  /** Chrome posters fill the wordmark with a gradient instead of a flat colour. */
  inkGradient?: string;

  /*
   * The rest of the wordmark's fill, for the sheets whose type is not
   * filled with a gradient alone.
   *
   * The prism poster stacks the glass photograph over a dispersion
   * gradient and screens the two together inside the glyphs, which is
   * where its blue and peach tints come from. That needs a size, a
   * position and a blend mode as well as the image list, so they are
   * separate fields rather than one unparseable shorthand.
   */
  inkSize?: string;
  inkPosition?: string;
  inkBlend?: string;

  /** Body copy colour. */
  text: string;

  /** URL, labels and rules. */
  accent: string;

  /** How many times the wordmark repeats. */
  rows: number;

  /**
   * A sheet outside the printed run.
   *
   * Reachable by its own QR and by nothing else: it is kept out of the
   * random pool, so opening /gittyup26 with no query never lands on it,
   * and out of the NN/30 footline, which counts the print run.
   */
  unlisted?: boolean;

  /** Mono kicker above the wordmark, where the poster has one. */
  eyebrow?: string;

  /** The poster's distinctive line. */
  headline: string;

  /**
   * The word or phrase inside `headline` set in the heavy weight.
   * Must appear in `headline` verbatim; the renderer splits on it.
   */
  emphasis?: string;

  /**
   * The word set as the hero on a `hero-word` poster. Defaults to
   * `emphasis` when it is not given.
   */
  heroWord?: string;

  /**
   * The quieter line printed under the headline, explaining what the
   * session is. Distinct from `eyebrow`, which is the mono kicker in
   * the details column.
   */
  subline?: string;

  dateLine: string;

  venueLine?: string;

  /** Extra lines for the spec-table layout, e.g. HOST / ENTRY. */
  specs?: {
    label: string;
    value: string;
  }[];

  /** Command lines for the terminal layout. */
  terminal?: string[];
}
