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
  | 'data-block';

export interface PosterVariant {
  /** 1-based, matches ?pg= and the poster's position in the print run. */
  id: number;

  layout: PosterLayout;

  /** Base colour behind every layer. */
  ground: string;

  /**
   * CSS background values painted over the ground, first entry
   * closest to the ground. Taken from the poster's own overlays,
   * plus a replacement for the photograph where there was one.
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

  /** Body copy colour. */
  text: string;

  /** URL, labels and rules. */
  accent: string;

  /** How many times the wordmark repeats. */
  rows: number;

  /** Mono kicker above the wordmark, where the poster has one. */
  eyebrow?: string;

  /** The poster's distinctive line. */
  headline: string;

  /**
   * The word or phrase inside `headline` set in the heavy weight.
   * Must appear in `headline` verbatim; the renderer splits on it.
   */
  emphasis?: string;

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
