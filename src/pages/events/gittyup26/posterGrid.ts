/*
 * The letter-grid wordmark, as measurements.
 *
 * Kept out of the component file so the page can size the grid before
 * rendering it without either file exporting a mix of components and
 * constants.
 */

/*
 * One column per letter, including the gap between the two words. The
 * columns are fixed so the letters line up vertically down the stack —
 * that alignment is the whole effect, and it does not survive normal
 * kerning.
 */
export const LETTERS = ['g', 'i', 't', 't', 'y', ' ', 'u', 'p'];

/*
 * The grid is held to roughly the width its own letters need. Left to
 * fill the column it spaces them out into a crossword; the printed
 * sheets set the columns just wider than the glyphs.
 */
export const GRID_WIDTH = `${(LETTERS.length * 1.05).toFixed(2)}em`;

/* A grid row costs its full line height — the rows cannot overlap. */
export const GRID_ROW = 1.16;

/*
 * Unlike the stack, a letter grid is sized by its row count: every row
 * has to land inside the same box, so a nine-row poster sets less than
 * half the size of a four-row one. The vw term keeps a tall stack from
 * running off the side of a phone.
 */
export const gridFontSize = (
  rows: number,
  vh: number,
  vwCap: number,
) =>
  `min(${(vh / (rows * GRID_ROW)).toFixed(2)}vh, ${vwCap}vw)`;

/*
 * How far the heavy weight has travelled by a given row. The printed
 * sheets move the front about one and a half letters per row, reaching
 * the end of the word on the last row whether the poster runs four rows
 * or nine.
 */
export const boldThrough = (row: number, rows: number) =>
  rows <= 1
    ? LETTERS.length
    : (row * (LETTERS.length - 1)) / (rows - 1);
