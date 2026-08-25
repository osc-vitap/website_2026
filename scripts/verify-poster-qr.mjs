/*
 * Decodes every generated QR and checks it resolves to the poster it is
 * named for.
 *
 * A QR that renders is not a QR that resolves. Getting this wrong is a
 * reprint, so the check is mechanical: decode the actual pixels, parse
 * the pg parameter, and compare it against the number in the filename.
 *
 *   node scripts/verify-poster-qr.mjs [dir]
 */

import { readdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';
import jsQRModule from 'jsqr';

const jsQR = jsQRModule.default ?? jsQRModule;

const [dirArg = 'qr'] = process.argv.slice(2);

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const dir = path.resolve(projectRoot, dirArg);

const files = readdirSync(dir)
	.filter((f) => f.endsWith('.png'))
	.sort();

const problems = [];
const seen = new Map();

for (const file of files) {
	const expected = Number(file.match(/poster-(\d+)\.png$/)?.[1]);

	const { data, info } = await sharp(path.join(dir, file))
		.ensureAlpha()
		.raw()
		.toBuffer({ resolveWithObject: true });

	const decoded = jsQR(new Uint8ClampedArray(data), info.width, info.height);

	if (!decoded) {
		problems.push(`${file}: does not decode at all`);
		continue;
	}

	const url = decoded.data;
	const pg = Number(new URL(url).searchParams.get('pg'));

	if (pg !== expected) {
		problems.push(`${file}: encodes pg=${pg}, filename says ${expected}`);
	}

	if (seen.has(url)) {
		problems.push(`${file}: encodes the same URL as ${seen.get(url)}`);
	}

	seen.set(url, file);

	console.log(`${file}  ->  ${url}${pg === expected ? '' : '   <-- MISMATCH'}`);
}

console.log(`\n${files.length} codes, ${seen.size} distinct URLs`);

if (problems.length) {
	console.error(`\n${problems.length} problem(s):`);
	for (const problem of problems) console.error(`  ${problem}`);
	process.exit(1);
}

console.log('every code decodes to its own poster number');
