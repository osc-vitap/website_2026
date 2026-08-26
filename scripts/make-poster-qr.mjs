/*
 * Generates one styled QR code per printed poster.
 *
 *   node scripts/make-poster-qr.mjs [count] [outDir]
 *
 * Each poster carries its own code pointing at that poster's page, so a
 * scan lands on the design in the reader's hand:
 *
 *   https://www.oscvitap.com/gittyup26?pg=N
 *
 * Style matches the qr-maker.dev settings chosen for this run — soft
 * dots, rounded corner borders, dot corner centres, OSC mark inset at
 * 43% on a cleared patch, error correction H. That site is a front end
 * for qr-code-styling, the same library used here, so the options map
 * one to one rather than being approximated.
 *
 * Rendering goes through headless Chrome because qr-code-styling draws
 * into a DOM. The page is written to a temp file, screenshotted, and
 * removed.
 */

import { execFileSync } from 'node:child_process';
import { mkdirSync, writeFileSync, rmSync, existsSync, readdirSync, statSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const [countArg = '30', outArg = 'qr'] = process.argv.slice(2);

const COUNT = Number(countArg);
const SIZE = 1024;
const BASE_URL = 'https://www.oscvitap.com/gittyup26';

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const outDir = path.resolve(projectRoot, outArg);
const tempDir = path.join(outDir, '.build');

const CHROME =
	process.env.CHROME_PATH ?? 'C:/Program Files/Google/Chrome/Application/chrome.exe';

const LIB = path.join(projectRoot, 'node_modules/qr-code-styling/lib/qr-code-styling.js');
const LOGO = path.join(projectRoot, 'public/events/gittyup26/osc-mark.webp');

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

mkdirSync(outDir, { recursive: true });
mkdirSync(tempDir, { recursive: true });

const asFileUrl = (p) => `file:///${p.replace(/\\/g, '/')}`;

/*
 * The OSC mark is full colour, which reads as a stray sticker in the
 * middle of a black and white code. Desaturating it and pushing the
 * contrast turns it into a mono silhouette that belongs to the code.
 *
 * Contrast matters beyond looks: the mark covers 43% of the symbol and
 * the dots behind it are cleared, so it is already spending error
 * correction. Mid greys would blur into the white field and give a
 * scanner less to lock onto than solid dark shapes do.
 *
 * Derived at generation time rather than committed, so it can never
 * drift from the mark it comes from.
 */
const monoLogo = path.join(tempDir, 'osc-mark-mono.png');

/*
 * Painted from the alpha channel rather than desaturated. Plain
 * grayscale maps the mark's yellow figure to near-white, which
 * disappears against the code's white field and leaves the logo looking
 * lopsided — one arm of the ring simply missing. Taking the silhouette
 * keeps every figure at equal weight and the gaps between them
 * transparent.
 */
const { width: logoW = 512, height: logoH = 512 } =
	await sharp(LOGO).metadata();

const logoAlpha = await sharp(LOGO)
	.ensureAlpha()
	.extractChannel('alpha')
	.toBuffer();

await sharp({
	create: {
		width: logoW,
		height: logoH,
		channels: 3,
		background: '#000000',
	},
})
	.joinChannel(logoAlpha)
	.png()
	.toFile(monoLogo);

const page = (url) => `<!doctype html>
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
    data: ${JSON.stringify(url)},
    image: ${JSON.stringify(asFileUrl(monoLogo))},
    margin: 0,
    qrOptions: { errorCorrectionLevel: 'H' },
    dotsOptions: { color: '#000000', type: 'rounded' },
    backgroundOptions: { color: '#ffffff' },
    cornersSquareOptions: { color: '#000000', type: 'extra-rounded' },
    cornersDotOptions: { color: '#000000', type: 'dot' },
    imageOptions: { imageSize: 0.43, margin: 5, hideBackgroundDots: true, crossOrigin: 'anonymous' },
  }).append(document.getElementById('qr'));
</script>
</body></html>`;

console.log(`Generating ${COUNT} QR codes at ${SIZE}x${SIZE} into ${outDir}\n`);

const written = [];

for (let n = 1; n <= COUNT; n += 1) {
	const id = String(n).padStart(2, '0');
	const url = `${BASE_URL}?pg=${n}`;
	const html = path.join(tempDir, `qr-${id}.html`);
	const png = path.join(outDir, `gittyup26-poster-${id}.png`);

	writeFileSync(html, page(url), 'utf8');

	execFileSync(
		CHROME,
		[
			'--headless=new',
			'--disable-gpu',
			'--hide-scrollbars',
			'--allow-file-access-from-files',
			'--virtual-time-budget=4000',
			`--window-size=${SIZE},${SIZE}`,
			`--screenshot=${png}`,
			asFileUrl(html),
		],
		{ stdio: 'ignore' },
	);

	if (!existsSync(png)) {
		console.error(`poster ${id}: FAILED, no file written`);
		continue;
	}

	written.push({ id, url, png, kb: Math.round(statSync(png).size / 1024) });
	console.log(`poster ${id}  ->  ${path.basename(png)}  (${url})`);
}

rmSync(tempDir, { recursive: true, force: true });

console.log(`\n${written.length}/${COUNT} written`);

if (written.length !== COUNT) process.exit(1);

console.log(
	`\nDecode a couple before printing — a code that renders is not a code that resolves:\n  ${readdirSync(outDir).slice(0, 2).join('\n  ')}`,
);
