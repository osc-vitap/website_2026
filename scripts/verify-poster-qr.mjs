/*
 * Decodes every generated QR and checks it resolves to the poster it is
 * named for.
 *
 * A QR that renders is not a QR that resolves. Getting this wrong is a
 * reprint, so the check is mechanical: decode the actual pixels, parse
 * the pg parameter, and compare it against the page the source is for.
 *
 * Two families, because the run was made in two passes:
 *
 *   qr/gittyup26-poster-NN.png   the numbered thirty, page in the name
 *   public/posters/qr-slug.png   the six named sheets, page in the table
 *
 * The named six were laid out one at a time after the numbered run had
 * gone to print, so their sources carry a design name and not a number.
 * Their page comes from NAMED below, which is the only hand-kept fact
 * here and the reason the table sits next to the check that would catch
 * it being wrong.
 *
 *   node scripts/verify-poster-qr.mjs [dir ...]
 */

import { readdirSync, existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';
import jsQRModule from 'jsqr';

const jsQR = jsQRModule.default ?? jsQRModule;

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

const dirArgs = process.argv.slice(2);

const dirs = (dirArgs.length ? dirArgs : ['qr', 'public/posters']).map((d) =>
	path.resolve(projectRoot, d),
);

/** The named sheets, and the page each one's QR is for. */
const NAMED = {
	carkeys: 31,
	committed: 32,
	restored: 33,
	ripitdown: 34,
	liftwaiting: 35,
	liftpending: 36,
};

/** The page a QR source is for, from its own filename. */
const pageOf = (file) => {
	const numbered = file.match(/poster-(\d+)\.png$/);
	if (numbered) return Number(numbered[1]);

	const named = file.match(/^qr-([a-z]+)\.png$/);
	if (named) return NAMED[named[1]] ?? null;

	return null;
};

const problems = [];
const seen = new Map();
let checked = 0;

for (const dir of dirs) {
	if (!existsSync(dir)) {
		problems.push(`${dir}: no such directory`);
		continue;
	}

	const files = readdirSync(dir)
		.filter((f) => f.endsWith('.png'))
		.filter((f) => pageOf(f) !== null)
		.sort();

	for (const file of files) {
		const expected = pageOf(file);

		const { data, info } = await sharp(path.join(dir, file))
			.ensureAlpha()
			.raw()
			.toBuffer({ resolveWithObject: true });

		const decoded = jsQR(new Uint8ClampedArray(data), info.width, info.height);

		checked += 1;

		if (!decoded) {
			problems.push(`${file}: does not decode at all`);
			continue;
		}

		const url = decoded.data;
		const pg = Number(new URL(url).searchParams.get('pg'));

		if (pg !== expected) {
			problems.push(`${file}: encodes pg=${pg}, should be ${expected}`);
		}

		if (seen.has(url)) {
			problems.push(`${file}: encodes the same URL as ${seen.get(url)}`);
		}

		seen.set(url, file);

		console.log(
			`${file.padEnd(28)} ->  ${url}${pg === expected ? '' : '   <-- MISMATCH'}`,
		);
	}
}

console.log(`\n${checked} codes, ${seen.size} distinct URLs`);

/*
 * Contiguity, not just uniqueness. Thirty-six codes that are all
 * different and all valid can still leave a page unprinted and a page
 * printed twice, and only counting catches that.
 */
const pages = [...seen.keys()]
	.map((url) => Number(new URL(url).searchParams.get('pg')))
	.sort((a, b) => a - b);

const gaps = pages.filter((page, i) => page !== i + 1);

if (gaps.length) {
	problems.push(
		`pages are not 1..${pages.length} contiguous — first break at ${gaps[0]}`,
	);
}

if (problems.length) {
	console.error(`\n${problems.length} problem(s):`);
	for (const problem of problems) console.error(`  ${problem}`);
	process.exit(1);
}

console.log(
	`every code decodes to its own poster number, pages 1..${pages.length} each once`,
);
