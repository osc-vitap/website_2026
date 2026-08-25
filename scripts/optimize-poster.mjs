/*
 * Turns an event poster into a web-sized WebP under public/events/.
 *
 * Print posters are typically 10-20 MB PNGs at print resolution, which
 * must never be served to a browser.
 *
 *   node scripts/optimize-poster.mjs <source-image> <slug> [width]
 *
 * e.g. node scripts/optimize-poster.mjs ~/Downloads/gittyup.png gittyup26
 *
 * Writes public/events/<slug>.webp and prints the path to use as the
 * event's `image` value.
 */

import { stat } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const [source, slug, width = '1000'] = process.argv.slice(2);

if (!source || !slug) {
	console.error(
		'Usage: node scripts/optimize-poster.mjs <source-image> <slug> [width]',
	);
	process.exit(1);
}

if (!/^[a-z0-9][a-z0-9-]*$/.test(slug)) {
	console.error(
		`Invalid slug "${slug}" — use lowercase letters, numbers and hyphens.`,
	);
	process.exit(1);
}

const projectRoot = path.resolve(
	path.dirname(fileURLToPath(import.meta.url)),
	'..',
);

const target = path.join(
	projectRoot,
	'public',
	'events',
	`${slug}.webp`,
);

const sourceStat = await stat(source).catch(() => null);

if (!sourceStat) {
	console.error(`Source image not found: ${source}`);
	process.exit(1);
}

const metadata = await sharp(source).metadata();

const result = await sharp(source)
	.resize({
		width: Number(width),
		withoutEnlargement: true,
	})
	.webp({ quality: 82 })
	.toFile(target);

const asKb = (bytes) => `${Math.round(bytes / 1024)} KB`;

console.log(
	`source  ${metadata.width}x${metadata.height} ${metadata.format}, ${asKb(sourceStat.size)}`,
);
console.log(
	`written ${result.width}x${result.height} webp, ${asKb(result.size)}`,
);
console.log(`\nimage value: /events/${slug}.webp`);
