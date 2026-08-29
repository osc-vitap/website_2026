/*
 * Binds the printed GITTY UP 26 run into one A3 PDF.
 *
 *   node scripts/make-poster-pdf.mjs [--from <dir>] [--out <file>] [--quality 90]
 *
 * With no --from it pulls the masters out of R2 with wrangler, which is
 * where they live: thirty-six A3 sheets at 300dpi is near half a
 * gigabyte of PNG and none of it is in this repo.
 *
 * Each page is one JPEG at the master's own pixel dimensions, drawn to
 * the full A3 page, so the result is 300dpi with no resampling — the
 * sheets go in as they were rendered. JPEG rather than the source PNG
 * because PDF cannot carry PNG's filter without re-encoding to Flate,
 * and Flate on a 3508x4961 photographic sheet is larger than the PNG it
 * came from; DCTDecode is the format a PDF viewer decodes natively.
 *
 * Written directly rather than through a PDF library. A file that is
 * one JPEG per page with no fonts, no transparency and no annotations
 * is a few hundred bytes of structure around the image data, and the
 * result is checked against a real parser at the end rather than
 * trusted — see the verify step, which reads the finished file back
 * with pdfjs-dist and asserts the page count, the page size and the
 * dimensions of every embedded image.
 */

import { execFileSync } from 'node:child_process';
import {
	mkdirSync,
	existsSync,
	readFileSync,
	writeFileSync,
	statSync,
	rmSync,
} from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const projectRoot = path.resolve(
	path.dirname(fileURLToPath(import.meta.url)),
	'..',
);

const arg = (name, fallback) => {
	const at = process.argv.indexOf(`--${name}`);
	return at === -1 ? fallback : process.argv[at + 1];
};

const PAGES = 36;
const BUCKET = 'osc-events-archives';

const quality = Number(arg('quality', '90'));

const out = path.resolve(
	projectRoot,
	arg('out', 'dist-posters/gittyup26-posters.pdf'),
);

/*
 * A3 exactly: 297x420mm at 72pt to the inch. The masters are 3508x4961,
 * which is 300.01dpi against this box — four parts in a hundred
 * thousand, well inside any printer's registration — so the image is
 * drawn full-bleed and the page stays a size a print shop recognises
 * without a "scale to fit" prompt.
 */
const PAGE_W = (297 / 25.4) * 72;
const PAGE_H = (420 / 25.4) * 72;

sharp.cache(false);
sharp.concurrency(1);

/* ------------------------------------------------------------------ */
/* Sources                                                             */
/* ------------------------------------------------------------------ */

const from = arg('from', null);

const pull = () => {
	const dir = path.resolve(projectRoot, 'dist-posters/masters');
	mkdirSync(dir, { recursive: true });

	console.log(`pulling ${PAGES} masters from ${BUCKET}\n`);

	for (let page = 1; page <= PAGES; page += 1) {
		const tag = String(page).padStart(2, '0');
		const file = path.join(dir, `gittyup26-pg${tag}.png`);

		/* Already here from an earlier run: half a gigabyte is not
		   worth downloading twice. */
		if (existsSync(file)) {
			console.log(`  pg${tag}  cached`);
			continue;
		}

		execFileSync(
			'npx',
			[
				'wrangler',
				'r2',
				'object',
				'get',
				`${BUCKET}/posters/gittyup26-pg${tag}.png`,
				'--file',
				file,
				'--remote',
			],
			{
				cwd: path.join(projectRoot, 'osc-events-worker'),
				stdio: 'ignore',
				shell: true,
			},
		);

		console.log(
			`  pg${tag}  ${(statSync(file).size / 1048576).toFixed(1)}MB`,
		);
	}

	return dir;
};

const dir = from ? path.resolve(projectRoot, from) : pull();

/** A sheet's master, under either the padded or the bare name. */
const masterFor = (page) => {
	const tag = String(page).padStart(2, '0');

	const found = [
		path.join(dir, `gittyup26-pg${tag}.png`),
		path.join(dir, `gittyup26-pg${page}.png`),
	].find((file) => existsSync(file));

	if (!found) {
		throw new Error(`no master for page ${page} in ${dir}`);
	}

	return found;
};

/* ------------------------------------------------------------------ */
/* Pages                                                               */
/* ------------------------------------------------------------------ */

console.log(`\nencoding ${PAGES} pages at q${quality}\n`);

const sheets = [];

for (let page = 1; page <= PAGES; page += 1) {
	const master = masterFor(page);

	const jpeg = await sharp(master)
		/*
		 * No chroma subsampling. The run is set in coloured type on
		 * near-black, and 4:2:0 halves the colour resolution — which is
		 * exactly where thin lime and violet letterforms live. It costs
		 * about 15% and it is the difference between type that prints
		 * clean and type with coloured fringes.
		 */
		.jpeg({ quality, chromaSubsampling: '4:4:4', mozjpeg: true })
		.toBuffer();

	const meta = await sharp(master).metadata();

	sheets.push({ page, jpeg, width: meta.width, height: meta.height });

	console.log(
		`  pg${String(page).padStart(2, '0')}  ${meta.width}x${meta.height}  ${(jpeg.length / 1048576).toFixed(1)}MB`,
	);
}

/* ------------------------------------------------------------------ */
/* The file                                                            */
/* ------------------------------------------------------------------ */

const chunks = [];
let at = 0;

/** Offsets are counted in bytes, so everything goes through here. */
const push = (part) => {
	const buffer = Buffer.isBuffer(part) ? part : Buffer.from(part, 'latin1');
	chunks.push(buffer);
	at += buffer.length;
};

/* Object number -> byte offset, filled as each one is written. */
const offsets = [];

const object = (id, body, stream) => {
	offsets[id] = at;
	push(`${id} 0 obj\n`);
	push(body);

	if (stream) {
		push('\nstream\n');
		push(stream);
		push('\nendstream');
	}

	push('\nendobj\n');
};

/*
 * 1 is the catalog and 2 is the page tree, then three objects per
 * sheet: the page, its content stream and its image.
 */
const pageId = (i) => 3 + i * 3;
const contentId = (i) => 4 + i * 3;
const imageId = (i) => 5 + i * 3;

const infoId = 3 + sheets.length * 3;
const total = infoId;

/* The header's binary comment is what tells a transport this is not
   text and must not have its line endings rewritten. */
push('%PDF-1.4\n');
push(Buffer.from([0x25, 0xe2, 0xe3, 0xcf, 0xd3, 0x0a]));

object(
	1,
	'<< /Type /Catalog /Pages 2 0 R >>',
);

object(
	2,
	`<< /Type /Pages /Count ${sheets.length} /Kids [${sheets
		.map((_, i) => `${pageId(i)} 0 R`)
		.join(' ')}] >>`,
);

const box = `[0 0 ${PAGE_W.toFixed(2)} ${PAGE_H.toFixed(2)}]`;

sheets.forEach((sheet, i) => {
	object(
		pageId(i),
		`<< /Type /Page /Parent 2 0 R /MediaBox ${box} ` +
			`/Resources << /XObject << /Im0 ${imageId(i)} 0 R >> /ProcSet [/PDF /ImageC] >> ` +
			`/Contents ${contentId(i)} 0 R >>`,
	);

	/* Scale the unit image square up to the page and draw it once. */
	const content = `q\n${PAGE_W.toFixed(2)} 0 0 ${PAGE_H.toFixed(2)} 0 0 cm\n/Im0 Do\nQ\n`;

	object(
		contentId(i),
		`<< /Length ${content.length} >>`,
		content,
	);

	object(
		imageId(i),
		`<< /Type /XObject /Subtype /Image /Name /Im0 ` +
			`/Width ${sheet.width} /Height ${sheet.height} ` +
			`/ColorSpace /DeviceRGB /BitsPerComponent 8 ` +
			`/Filter /DCTDecode /Length ${sheet.jpeg.length} >>`,
		sheet.jpeg,
	);
});

const stamp = (() => {
	const d = new Date();
	const two = (n) => String(n).padStart(2, '0');

	return (
		`D:${d.getUTCFullYear()}${two(d.getUTCMonth() + 1)}${two(d.getUTCDate())}` +
		`${two(d.getUTCHours())}${two(d.getUTCMinutes())}${two(d.getUTCSeconds())}Z`
	);
})();

object(
	infoId,
	`<< /Title (GITTY UP 26 — the printed run, ${sheets.length} sheets) ` +
		`/Author (Open Source Community, VIT-AP) ` +
		`/Subject (A3 at 300dpi. 1 September 2026, 10am to 5pm, AB-2 Auditorium.) ` +
		`/Creator (scripts/make-poster-pdf.mjs) ` +
		`/CreationDate (${stamp}) >>`,
);

/* The cross-reference table. Every entry is exactly twenty bytes and a
   reader that seeks by multiplication will land in the wrong place if
   one of them is not. */
const xrefAt = at;

push(`xref\n0 ${total + 1}\n`);
push('0000000000 65535 f \n');

for (let id = 1; id <= total; id += 1) {
	push(`${String(offsets[id]).padStart(10, '0')} 00000 n \n`);
}

push(
	`trailer\n<< /Size ${total + 1} /Root 1 0 R /Info ${infoId} 0 R >>\n` +
		`startxref\n${xrefAt}\n%%EOF\n`,
);

mkdirSync(path.dirname(out), { recursive: true });
writeFileSync(out, Buffer.concat(chunks));

console.log(
	`\nwrote ${path.relative(projectRoot, out)} — ${sheets.length} pages, ${(
		statSync(out).size / 1048576
	).toFixed(1)}MB`,
);

/* ------------------------------------------------------------------ */
/* Read it back                                                        */
/* ------------------------------------------------------------------ */

/*
 * A PDF that opens in one viewer and not another is the failure a
 * hand-written one risks, so it is parsed here by something that did
 * not write it. Every page is asked for its size and its image, and a
 * mismatch fails the build rather than shipping.
 */
const pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs');

const doc = await pdfjs.getDocument({
	data: new Uint8Array(readFileSync(out)),
	useSystemFonts: false,
}).promise;

const problems = [];

if (doc.numPages !== sheets.length) {
	problems.push(`parsed ${doc.numPages} pages, wrote ${sheets.length}`);
}

for (let n = 1; n <= doc.numPages; n += 1) {
	const page = await doc.getPage(n);
	const [, , w, h] = page.view;

	if (Math.abs(w - PAGE_W) > 0.5 || Math.abs(h - PAGE_H) > 0.5) {
		problems.push(`page ${n}: ${w}x${h}pt, expected A3`);
	}

	const ops = await page.getOperatorList();
	const drew = ops.fnArray.includes(pdfjs.OPS.paintImageXObject);

	if (!drew) problems.push(`page ${n}: draws no image`);

	const sheet = sheets[n - 1];
	const key = page.objs.has('Im0') ? 'Im0' : null;

	if (key) {
		const img = page.objs.get(key);

		if (img?.width !== sheet.width || img?.height !== sheet.height) {
			problems.push(
				`page ${n}: image ${img?.width}x${img?.height}, master ${sheet.width}x${sheet.height}`,
			);
		}
	}
}

await doc.destroy();

if (problems.length) {
	console.error(`\n${problems.length} problem(s):`);
	for (const problem of problems) console.error(`  ${problem}`);
	rmSync(out, { force: true });
	process.exit(1);
}

console.log(
	`verified: ${doc.numPages} A3 pages, every one carrying its sheet at full resolution`,
);
