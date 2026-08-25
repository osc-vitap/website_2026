/*
 * Crops a wide banner out of a portrait event poster.
 *
 * The registration page shows the event image in a short, full-width
 * strip. A portrait poster dropped into that strip with object-cover
 * gets sliced through the middle, which usually lands on half a word.
 * This takes a deliberate horizontal band instead.
 *
 *   node scripts/make-event-banner.mjs <slug> [focusPercent] [bandPercent]
 *
 * focusPercent  vertical centre of the band, 0-100 down the poster
 * bandPercent   height of the band as a share of the poster
 *
 * Reads public/events/<slug>.webp, writes public/events/<slug>-banner.webp.
 */

import path from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const [slug, focusArg = '42', bandArg = '26'] = process.argv.slice(2);

if (!slug) {
	console.error('Usage: node scripts/make-event-banner.mjs <slug> [focusPercent] [bandPercent]');
	process.exit(1);
}

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const source = path.join(projectRoot, 'public', 'events', `${slug}.webp`);
const target = path.join(projectRoot, 'public', 'events', `${slug}-banner.webp`);

const image = sharp(source);
const { width, height } = await image.metadata();

if (!width || !height) {
	console.error(`Could not read dimensions from ${source}`);
	process.exit(1);
}

const bandHeight = Math.round((height * Number(bandArg)) / 100);
const centre = Math.round((height * Number(focusArg)) / 100);

// Keep the band inside the poster.
const top = Math.max(0, Math.min(height - bandHeight, centre - Math.round(bandHeight / 2)));

const result = await sharp(source)
	.extract({ left: 0, top, width, height: bandHeight })
	.resize({ width: 1600, withoutEnlargement: true })
	.webp({ quality: 82 })
	.toFile(target);

console.log(`source  ${width}x${height}`);
console.log(`band    y ${top}..${top + bandHeight} (${bandArg}% tall, centred at ${focusArg}%)`);
console.log(`written ${result.width}x${result.height}, ${Math.round(result.size / 1024)} KB`);
console.log(`\nimage value: /events/${slug}-banner.webp`);
