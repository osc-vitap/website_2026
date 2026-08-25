/*
 * Poster variants for GITTYUP 26.
 *
 * 25 physical posters go up around campus, each with its own QR code
 * pointing at ?pg=1 … ?pg=25. Scanning a poster should land on a page
 * that looks like the poster in your hand.
 *
 * STAGED: the printed designs do not exist yet. Until they do, each
 * variant is a systematic recolour and re-arrangement of the base
 * design, so all 25 QR codes already resolve to visibly different
 * pages. When a poster's artwork arrives, replace that entry's values
 * with the real palette and arrangement — or, if the poster is a
 * bigger departure, give it its own component and branch on the
 * variant id in GittyUp26.tsx.
 */

export interface WordmarkRow {
  /** Tailwind font-weight class for "gitty" */
  gitty: string;
  /** Tailwind font-weight class for "up" */
  up: string;
  /** Space between the two words, in em */
  gap: string;
}

export interface PosterVariant {
  /** 1-based, matches ?pg= */
  id: number;
  /** Full-bleed CSS background for the poster ground */
  gradient: string;
  /** Dark colour used for the wordmark, toggle and numeral */
  ink: string;
  /** Colour of the halftone dots */
  dot: string;
  /** The four wordmark rows, top to bottom */
  rows: WordmarkRow[];
  /** Which side the toggle knob sits on */
  toggle: 'left' | 'right';
}

/*
 * Five grounds x five wordmark arrangements = 25 combinations.
 * The hues stay inside the community's violet/indigo range so every
 * variant still reads as the same event.
 */
const GROUNDS = [
  {
    gradient:
      'radial-gradient(125% 95% at 18% -5%, #8B5CFF 0%, #7040FF 22%, #5A27F2 48%, #4517D8 72%, #2E0BA6 100%)',
    ink: '#150A4E',
    dot: 'rgba(21,10,78,0.62)',
  },
  {
    gradient:
      'radial-gradient(120% 100% at 82% 0%, #A26BFF 0%, #7C42FB 26%, #5A24E8 52%, #3C12BE 78%, #250887 100%)',
    ink: '#180B44',
    dot: 'rgba(24,11,68,0.60)',
  },
  {
    gradient:
      'radial-gradient(135% 90% at 50% -10%, #6E7BFF 0%, #5A54FF 24%, #4733F0 50%, #3520C6 76%, #1E1090 100%)',
    ink: '#0F0A46',
    dot: 'rgba(15,10,70,0.58)',
  },
  {
    gradient:
      'radial-gradient(120% 100% at 12% 105%, #B457FF 0%, #8735F8 26%, #6420E4 54%, #4614B8 78%, #2B0A80 100%)',
    ink: '#1C0942',
    dot: 'rgba(28,9,66,0.60)',
  },
  {
    gradient:
      'radial-gradient(130% 95% at 88% 100%, #7B4DFF 0%, #6233F5 24%, #4A1FDE 50%, #3413AE 76%, #1F0A78 100%)',
    ink: '#130846',
    dot: 'rgba(19,8,70,0.62)',
  },
];

/*
 * Objectivity ships as static weights, so only the ones declared in
 * index.css are usable: 100, 300, 400, 500, 700, 900. Asking for a
 * weight in between makes the browser synthesise it, which ruins the
 * wordmark, so the classes here map exactly onto real files.
 */
const LIGHT = 'font-thin';
const HEAVY = 'font-black';

const ARRANGEMENTS: WordmarkRow[][] = [
  // The printed original: light on top, heavy below.
  [
    { gitty: LIGHT, up: HEAVY, gap: '0.36em' },
    { gitty: LIGHT, up: HEAVY, gap: '0.44em' },
    { gitty: HEAVY, up: LIGHT, gap: '0.30em' },
    { gitty: HEAVY, up: LIGHT, gap: '0.38em' },
  ],
  // Inverted: heavy on top.
  [
    { gitty: HEAVY, up: LIGHT, gap: '0.30em' },
    { gitty: HEAVY, up: LIGHT, gap: '0.38em' },
    { gitty: LIGHT, up: HEAVY, gap: '0.36em' },
    { gitty: LIGHT, up: HEAVY, gap: '0.44em' },
  ],
  // Alternating each row.
  [
    { gitty: LIGHT, up: HEAVY, gap: '0.34em' },
    { gitty: HEAVY, up: LIGHT, gap: '0.42em' },
    { gitty: LIGHT, up: HEAVY, gap: '0.30em' },
    { gitty: HEAVY, up: LIGHT, gap: '0.40em' },
  ],
  // Heavy pair in the middle.
  [
    { gitty: LIGHT, up: LIGHT, gap: '0.40em' },
    { gitty: HEAVY, up: HEAVY, gap: '0.28em' },
    { gitty: HEAVY, up: HEAVY, gap: '0.32em' },
    { gitty: LIGHT, up: LIGHT, gap: '0.44em' },
  ],
  // Building weight down the stack.
  [
    { gitty: LIGHT, up: LIGHT, gap: '0.46em' },
    { gitty: LIGHT, up: HEAVY, gap: '0.38em' },
    { gitty: HEAVY, up: LIGHT, gap: '0.32em' },
    { gitty: HEAVY, up: HEAVY, gap: '0.26em' },
  ],
];

export const POSTER_COUNT = 25;

export const gittyUp26Variants: PosterVariant[] =
  Array.from(
    { length: POSTER_COUNT },
    (_, index) => {
      const ground =
        GROUNDS[index % GROUNDS.length];

      const rows =
        ARRANGEMENTS[
          Math.floor(index / GROUNDS.length) %
            ARRANGEMENTS.length
        ];

      return {
        id: index + 1,
        gradient: ground.gradient,
        ink: ground.ink,
        dot: ground.dot,
        rows,
        toggle:
          index % 2 === 0 ? 'right' : 'left',
      };
    },
  );

/*
 * Reads ?pg= and falls back to the first poster for anything missing
 * or out of range, so a smudged or mistyped QR still lands somewhere.
 */
export const variantFromParam = (
  value: string | null,
): PosterVariant => {
  const page = Number(value);

  const valid =
    Number.isInteger(page) &&
    page >= 1 &&
    page <= gittyUp26Variants.length;

  return gittyUp26Variants[
    valid ? page - 1 : 0
  ];
};
