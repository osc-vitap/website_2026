/*
 * Renders one QR per entry pass, in the colour that says which kind it is.
 *
 *   node scripts/make-entry-qr.mjs --in passes.json --out entry-qr
 *   node scripts/make-entry-qr.mjs --probe            # colour legibility only
 *
 * The input is [{ token, kind, name }]. Reserved passes are drawn in
 * gold and registered passes in black, so a volunteer can tell at a
 * glance which queue a person belongs in before the scan even happens.
 *
 * Same pipeline as scripts/make-poster-qr.mjs: qr-code-styling drawn by
 * headless Chrome, the OSC mark inset on a cleared patch, error
 * correction H. Only the module colour and the payload differ, so the
 * two runs cannot drift into looking like different families.
 *
 * A QR is a contrast pattern before it is a picture. Every code this
 * writes is decoded again before the file is kept, at the size it will
 * actually be scanned at, because a gold that photographs beautifully
 * and does not decode is worse than no colour at all.
 */

import { execFileSync } from 'node:child_process';
import { mkdirSync, writeFileSync, readFileSync, rmSync, existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';
import jsQRModule from 'jsqr';

const jsQR = jsQRModule.default ?? jsQRModule;

const arg = (name, fallback) => {
	const at = process.argv.indexOf(`--${name}`);
	return at === -1 ? fallback : process.argv[at + 1];
};

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

const SIZE = 1024;

const CHROME = process.env.CHROME_PATH ?? 'C:/Program Files/Google/Chrome/Application/chrome.exe';

const LIB = path.join(projectRoot, 'node_modules/qr-code-styling/lib/qr-code-styling.js');
const LOGO = path.join(projectRoot, 'public/events/gittyup26/osc-mark.webp');

/*
 * The two inks.
 *
 * Gold is a dark gold, not a bright one. A QR decoder thresholds the
 * image into light and dark; the metallic golds people picture, #FFD700
 * and #D4AF37, sit at roughly 78% and 67% relative luminance, which is
 * nearer the white background than the black modules a decoder expects
 * and puts the pattern on the wrong side of the threshold once a phone
 * camera adds its own exposure. --probe measures this rather than
 * asserting it.
 */
/*
 * Measured, not guessed. `--probe` renders the same payload in each
 * candidate and decodes it back at 1024, 512 and 256 px:
 *
 *   #FFD700  69.9%   FAIL  FAIL  ok    gold, as usually meant
 *   #D4AF37  44.9%   FAIL  FAIL  ok    metallic gold
 *   #B8860B  27.3%    ok    ok   ok    dark goldenrod
 *   #8A6D00  16.3%    ok    ok   ok    <- chosen
 *   #6B4E00   8.6%    ok    ok   ok
 *
 * Everything at or below about 27% luminance reads at every size, so
 * this sits in the middle of the passing range rather than at its edge:
 * jsQR on a clean render is the easy case, and a phone at a door adds
 * glare, angle and auto-exposure that all eat the same margin.
 *
 * The bright gold people actually picture belongs in the card and the
 * email around the code, where it can be as bright as it likes. Inside
 * the symbol it is not a colour choice, it is a contrast budget.
 */
const INKS = {
	reserved: '#8A6D00',
	registered: '#000000',
};

for (const [label, file] of [
	['Chrome', CHROME],
	['qr-code-styling', LIB],
	['OSC mark', LOGO],
]) {
	if (!existsSync(file)) {
		console.error(`${label} not found at ${file}`);
		process.exit(1);
	}
}

const outDir = path.resolve(projectRoot, arg('out', 'entry-qr'));
const tempDir = path.join(outDir, '.build');

mkdirSync(outDir, { recursive: true });
mkdirSync(tempDir, { recursive: true });

const asFileUrl = (p) => `file:///${p.replace(/\\/g, '/')}`;

/* The mark as a flat silhouette, painted from its alpha channel. Plain
   greyscale maps its yellow figure to near-white and loses an arm of the
   ring; the alpha keeps every figure at equal weight. */
const monoLogo = path.join(tempDir, 'osc-mark-mono.png');

const { width: logoW = 512, height: logoH = 512 } = await sharp(LOGO).metadata();

const logoAlpha = await sharp(LOGO).ensureAlpha().extractChannel('alpha').toBuffer();

await sharp({
	create: { width: logoW, height: logoH, channels: 3, background: '#000000' },
})
	.joinChannel(logoAlpha)
	.png()
	.toFile(monoLogo);

const page = (data, ink) => `<!doctype html>
<html><head><meta charset="utf-8"><style>
  html,body{margin:0;padding:0;background:#fff}
  #qr{width:${SIZE}px;height:${SIZE}px}
  #qr svg,#qr canvas{display:block}
</style></head>
<body>
<div id="qr"></div>
<script src="${asFileUrl(LIB)}"></script>
<script>
  new QRCodeStyling({
    width: ${SIZE},
    height: ${SIZE},
    type: 'svg',
    data: ${JSON.stringify(data)},
    image: ${JSON.stringify(asFileUrl(monoLogo))},
    margin: 4,
    qrOptions: { errorCorrectionLevel: 'H' },
    dotsOptions: { color: ${JSON.stringify(ink)}, type: 'rounded' },
    backgroundOptions: { color: '#ffffff' },
    cornersSquareOptions: { color: ${JSON.stringify(ink)}, type: 'extra-rounded' },
    cornersDotOptions: { color: ${JSON.stringify(ink)}, type: 'dot' },
    imageOptions: { imageSize: 0.43, margin: 5, hideBackgroundDots: true, crossOrigin: 'anonymous' },
  }).append(document.getElementById('qr'));
</script>
</body></html>`;

const render = (data, ink, png) => {
	const html = path.join(tempDir, `${path.basename(png, '.png')}.html`);

	writeFileSync(html, page(data, ink), 'utf8');

	execFileSync(
		CHROME,
		[
			'--headless=new',
			'--disable-gpu',
			'--hide-scrollbars',
			'--allow-file-access-from-files',
			'--force-device-scale-factor=1',
			'--virtual-time-budget=6000',
			`--window-size=${SIZE},${SIZE}`,
			`--user-data-dir=${tempDir}/profile`,
			`--screenshot=${png.split(path.sep).join('/')}`,
			asFileUrl(html),
		],
		{ stdio: 'ignore' },
	);

	rmSync(html, { force: true });
};

/*
 * Decode it back at the sizes it will really be seen at.
 *
 * 1024 is the file. 512 is a phone screen holding the email. 256 is a
 * hurried camera frame from half a metre away. A code that only reads
 * at full size is a code that fails in a queue.
 */
const SCALES = [1024, 512, 256];

const decodes = async (png, expect) => {
	const results = [];

	for (const scale of SCALES) {
		const { data, info } = await sharp(png)
			.resize(scale, scale, { fit: 'inside' })
			.flatten({ background: '#ffffff' })
			.ensureAlpha()
			.raw()
			.toBuffer({ resolveWithObject: true });

		const code = jsQR(new Uint8ClampedArray(data), info.width, info.height);

		results.push({ scale, ok: code?.data === expect });
	}

	return results;
};

/* ---------------------------------------------------------------- */
/* Colour probe                                                      */
/* ---------------------------------------------------------------- */

if (process.argv.includes('--probe')) {
	const sample = 'https://www.oscvitap.com/e/0123456789abcdef0123456789abcdef';

	const candidates = [
		['#000000', 'black, the control'],
		['#FFD700', 'gold, as usually meant'],
		['#D4AF37', 'metallic gold'],
		['#B8860B', 'dark goldenrod'],
		['#8A6D00', 'darker gold'],
		['#6B4E00', 'dark gold'],
		['#4A3600', 'very dark gold'],
	];

	console.log('ink       luminance  1024  512   256   note\n');

	for (const [ink, note] of candidates) {
		const png = path.join(tempDir, `probe-${ink.slice(1)}.png`);

		render(sample, ink, png);

		const results = await decodes(png, sample);

		/* Relative luminance, the thing a decoder's threshold actually
		   responds to. */
		const [r, g, b] = [1, 3, 5].map((i) => parseInt(ink.slice(i, i + 2), 16) / 255);
		const lin = (c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
		const L = 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);

		console.log(
			`${ink}   ${(L * 100).toFixed(1).padStart(6)}%  ` +
				results.map((x) => (x.ok ? ' ok  ' : 'FAIL ').padEnd(6)).join('') +
				note,
		);
	}

	process.exit(0);
}

/* ---------------------------------------------------------------- */
/* The real run                                                      */
/* ---------------------------------------------------------------- */

/*
 * Old shape against new, measured by the only thing that matters at a
 * door: how small the code can get and still read.
 *
 * A QR encodes uppercase letters, digits and a few symbols including
 * : / and . in alphanumeric mode at 5.5 bits a character, and anything
 * else in byte mode at 8. One lowercase character anywhere drops the
 * whole symbol into byte mode, so a lowercase URL wrapping a lowercase
 * hex token was paying twice: once for the length, once for the case.
 */
if (process.argv.includes('--compare')) {
	const cases = [
		['old', 'https://www.oscvitap.com/e/9f3c1a7b4e2d8065b1a4c7e0d3f68259', '#000000'],
		['new', 'HTTPS://OSCVITAP.COM/E/K7M2XR4P', '#000000'],
	];

	console.log('shape  chars  smallest size that still decodes\n');

	for (const [label, payload, ink] of cases) {
		const png = path.join(tempDir, `cmp-${label}.png`);

		render(payload, ink, png);

		let smallest = null;

		/* Step down until it stops reading. */
		for (const size of [512, 384, 256, 192, 160, 128, 112, 96, 80, 72, 64, 56, 48]) {
			const { data, info } = await sharp(png)
				.resize(size, size, { fit: 'inside' })
				.flatten({ background: '#ffffff' })
				.ensureAlpha()
				.raw()
				.toBuffer({ resolveWithObject: true });

			const code = jsQR(new Uint8ClampedArray(data), info.width, info.height);

			if (code?.data === payload) smallest = size;
			else break;
		}

		console.log(
			`${label.padEnd(6)} ${String(payload.length).padStart(5)}  ${
				smallest ? `${smallest}px` : 'did not decode'
			}`,
		);
	}

	process.exit(0);
}

const inFile = arg('in', null);

if (!inFile) {
	console.error('Usage: node scripts/make-entry-qr.mjs --in passes.json [--out entry-qr]');
	console.error('       node scripts/make-entry-qr.mjs --probe');
	process.exit(1);
}

const passes = JSON.parse(readFileSync(path.resolve(projectRoot, inFile), 'utf8'));

/*
 * Uppercase, and the apex rather than www.
 *
 * Both are density, not style. Uppercase keeps the payload in the QR's
 * alphanumeric mode, which is 5.5 bits a character against byte mode's
 * 8, and dropping www is four fewer characters. Measured with
 * --compare: the old lowercase form stopped decoding below 72px, this
 * one reads down to 48px, so it scans from half again the distance.
 *
 * Hostnames are case insensitive and the apex redirects to www.
 */
const BASE = process.env.ENTRY_BASE_URL ?? 'HTTPS://OSCVITAP.COM/E';

console.log(`${passes.length} passes into ${outDir}\n`);

let failed = 0;

for (const pass of passes) {
	const ink = INKS[pass.kind];

	if (!ink) {
		console.error(`${pass.token}: unknown kind ${pass.kind}`);
		failed += 1;
		continue;
	}

	const url = `${BASE}/${pass.token}`;
	const png = path.join(outDir, `${pass.kind}-${pass.token.slice(0, 12)}.png`);

	render(url, ink, png);

	const results = await decodes(png, url);
	const bad = results.filter((r) => !r.ok);

	if (bad.length) {
		failed += 1;
		rmSync(png, { force: true });
	}

	console.log(
		`${pass.kind.padEnd(11)} ${pass.token.slice(0, 12)}  ` +
			results.map((r) => `${r.scale}:${r.ok ? 'ok' : 'FAIL'}`).join('  ') +
			(bad.length ? '   <-- deleted, would not scan' : ''),
	);
}

rmSync(tempDir, { recursive: true, force: true });

console.log(`\n${passes.length - failed} written, ${failed} rejected`);

if (failed) process.exit(1);
