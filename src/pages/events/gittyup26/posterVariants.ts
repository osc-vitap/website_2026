import { notePosterSeen, takeNextPosterId } from './posterShuffle';
import { PosterVariant } from './posterTypes';

/*
 * The thirty GITTYUP 26 posters, as data.
 *
 * Generated from the print artwork in the Claude Design project: the
 * design specs were read off each poster into
 * src/data/gittyUp26Posters.json, then translated into these
 * CSS-only variants. That file also carries the reasoning behind each
 * background rebuild, in cssNotes.
 *
 * The printed posters sit on 4K photographs. Those are deliberately not
 * shipped — a page reached by scanning a QR code on a phone should not
 * pull a full-bleed photograph — so each background is rebuilt from the
 * poster's own overlay gradients plus a stand-in for what the
 * photograph contributed. Edit a variant here to retune one poster.
 */

export const POSTER_COUNT = 30;

export const posterVariants: PosterVariant[] = [
	{
		"id": 1,
		"layout": "wordmark-stack",
		"ground": "#020610",
		"layers": [
			"radial-gradient(115% 76% at 46% 18%,#9db4c6 0%,#5a7c99 24%,#24405e 54%,#0b1526 78%,#020610 100%)",
			"radial-gradient(64% 48% at 84% 70%,rgba(126,156,181,.26) 0%,rgba(126,156,181,0) 70%)",
			"linear-gradient(178deg,rgba(2,6,16,.88) 0%,rgba(2,6,16,.5) 26%,rgba(2,6,16,.62) 54%,rgba(2,6,16,.95) 84%,#020610 100%)",
			"radial-gradient(90% 44% at 76% 12%,rgba(86,0,255,.3) 0%,rgba(86,0,255,0) 66%)"
		],
		"ink": "#ffffff",
		"text": "rgba(255,255,255,.86)",
		"accent": "#8f7dff",
		"rows": 5,
		"eyebrow": "A history of version control",
		"headline": "You inherited a solution. Come meet the problem.",
		"emphasis": "problem",
		"dateLine": "1 September 2026",
		"venueLine": "10am to 5pm · AB-2 Auditorium"
	},
	{
		"id": 2,
		"layout": "wordmark-stack",
		"ground": "#04040a",
		"image": "/events/gittyup26/chrome-3.webp",
		"dispersion": true,
		"layers": [
			"linear-gradient(78deg,rgba(216,209,236,.5) 0%,rgba(216,209,236,.5) 9%,rgba(40,36,58,.55) 9%,rgba(40,36,58,.55) 17%,rgba(180,172,204,.3) 17%,rgba(180,172,204,.3) 23%,rgba(30,27,45,.6) 23%,rgba(30,27,45,.6) 38%,rgba(230,224,244,.26) 38%,rgba(230,224,244,.26) 44%,rgba(46,42,66,.5) 44%,rgba(46,42,66,.5) 62%,rgba(198,190,222,.28) 62%,rgba(198,190,222,.28) 70%,rgba(26,23,40,.55) 70%,rgba(26,23,40,.55) 100%)",
			"linear-gradient(168deg,rgba(255,255,255,.14) 0%,rgba(255,255,255,0) 22%,rgba(0,0,0,.34) 46%,rgba(255,255,255,.1) 60%,rgba(0,0,0,.4) 100%)",
			"linear-gradient(180deg,rgba(4,4,10,.8) 0%,rgba(4,4,10,.42) 30%,rgba(4,4,10,.8) 66%,#04040a 94%)"
		],
		"ink": "#cfc6e8",
		"inkGradient": "linear-gradient(102deg,#cfc6e8 0%,#6f6390 14%,#e6e0f4 30%,#574d76 46%,#d8d1ec 62%,#655a88 80%,#ded7f0 100%)",
		"text": "rgba(255,255,255,.78)",
		"accent": "#9d92c4",
		"rows": 5,
		"eyebrow": "A history of version control",
		"headline": "Undo is a design decision.",
		"emphasis": "design decision",
		"dateLine": "01 . 09 . 26",
		"venueLine": "10:00 to 17:00 · AB-2 Auditorium"
	},
	{
		"id": 3,
		"layout": "letter-grid",
		"ground": "#03100f",
		"image": "/events/gittyup26/noisy-2.webp",
		"imageBlend": "luminosity",
		"layers": [
			"linear-gradient(160deg,rgba(13,107,116,.42) 0%,rgba(3,16,15,.15) 52%,rgba(13,107,116,.28) 100%)",
			"linear-gradient(180deg,rgba(3,16,15,.74) 0%,rgba(3,16,15,.36) 34%,rgba(3,16,15,.9) 76%,#03100f 100%)"
		],
		"grain": 0.5,
		"grid": {
			"size": "110px",
			"color": "rgba(255,255,255,.05)"
		},
		"ink": "#eafcfb",
		"text": "rgba(255,255,255,.76)",
		"accent": "#7fdde4",
		"rows": 6,
		"headline": "Nobody remembers the workaround. Everybody uses the fix.",
		"emphasis": "fix",
		"dateLine": "2026-09-01 · 10:00-17:00",
		"venueLine": "AB-2 Auditorium · VIT-AP"
	},
	{
		"id": 4,
		"layout": "wordmark-stack",
		"ground": "#000",
		"image": "/events/gittyup26/glass-x.webp",
		"dispersion": true,
		/*
		 * A vignette taken from the print source, and a scrim the
		 * printed sheet itself does not carry.
		 *
		 * The vignette is the print's own method: leave the glass
		 * untouched where it is bright and crush everything around it
		 * to black, so the object reads as lit in a dark room instead
		 * of as a photograph laid on a dark page. It replaced three
		 * layers pinned to `0 68%/100% 18%` that rebuilt a chrome strip
		 * the print does not have and landed as a pinstriped bar ruled
		 * across the middle of the page.
		 *
		 * The scrim covers what the vignette cannot. The print can set
		 * its type at full strength because it never puts type over the
		 * artwork at all — it reserves clean ground for it. This page
		 * runs the headline straight across glass-x, which peaks near
		 * white halfway down the sheet, and the vignette is transparent
		 * at exactly that point. Measured against the isolated
		 * background, the headline fell to 1.46:1 there and missed the
		 * 4.5:1 floor at twelve of fourteen viewports; at .62 the worst
		 * is 5.27:1 and none miss. The halo in posterColor does not
		 * cover it — "lost the work" and "git" sit on the bright edge.
		 *
		 * Even, rather than a band reserving ground under the type
		 * alone: the headline lands anywhere from a third to three
		 * quarters of the way down depending on how the page flows,
		 * there is no artwork outside that range for a band to spare,
		 * and a band dark enough to clear the floor across all of it
		 * measured darker overall than this does.
		 */
		"layers": [
			"radial-gradient(64% 40% at 62% 50%,rgba(0,0,0,0) 0%,rgba(0,0,0,.5) 62%,rgba(0,0,0,.9) 92%)",
			"linear-gradient(rgba(3,2,10,.62), rgba(3,2,10,.62))"
		],
		"ink": "#ffffff",
		/*
		 * The prism fill, copied from design 2d.
		 *
		 * The glyphs are not filled with a gradient — they are filled
		 * with the glass photograph itself, screened over a dispersion
		 * ramp, so the blue and peach in the type are the same refraction
		 * as the object beside it. A flat white wordmark on this sheet
		 * throws that away, which is what the web version was doing.
		 *
		 * 210% with the position off-centre is what lands one bright
		 * facet inside the letterforms rather than an even wash.
		 */
		"inkGradient": "url(/events/gittyup26/glass-x.webp), linear-gradient(102deg,#ffffff 0%,#7fb0ff 16%,#ffffff 32%,#e08a5a 48%,#f4f8ff 64%,#6f9ce0 82%,#ffffff 100%)",
		"inkSize": "210% auto, 100% 100%",
		"inkPosition": "38% 44%, center",
		"inkBlend": "screen",
		"text": "rgba(255,255,255,.72)",
		"accent": "#b79dff",
		"rows": 2,
		"eyebrow": "A history of version control",
		"headline": "First they lost the work. Then they built git.",
		"emphasis": "git",
		"dateLine": "1 Sep 2026 / 10am to 5pm",
		"venueLine": "AB-2 Auditorium"
	},
	{
		"id": 5,
		"layout": "wordmark-stack",
		"ground": "#02060f",
		"image": "/events/gittyup26/grad-warmcool.webp",
		/*
		 * The two 16px dot lattices that used to lead this list are
		 * gone. The printed sheet is a clean warm-to-cool wash — its
		 * only texture is a faint vertical striping — so tiled dots read
		 * as a halftone screen belonging to a different poster.
		 *
		 * Losing them also drops this sheet out of the cursor spotlight,
		 * which lights only posters that already carry a lattice for it
		 * to deepen. That is the intended trade, not a regression.
		 *
		 * The scrim stays. It is the only thing dimming the warm half of
		 * the wash, and on a phone the subline sits right on top of
		 * that half: measured there, dropping the scrim takes the body
		 * copy from 7.1:1 to 3.4:1, under the 4.5:1 floor.
		 */
		"layers": [
			"linear-gradient(rgba(2,6,15,.44), rgba(2,6,15,.44))"
		],
		"ink": "#ffffff",
		"inkGradient": "url(/events/gittyup26/grad-warmcool.webp), linear-gradient(113deg,#ffffff 0%,#827e8d 18%,#ffffff 36%,#c1bfc6 52%,#ffffff 68%,#827e8d 84%,#ffffff 100%)",
		"inkSize": "220% auto, 100% 100%",
		"inkPosition": "59% 53%, center",
		"inkBlend": "screen",
		"text": "rgba(255,255,255,.84)",
		"accent": "#d8caff",
		"rows": 3,
		"eyebrow": "A history of version control",
		"headline": "Your remote can live in your room.",
		"emphasis": "your room",
		"dateLine": "1 September 2026",
		"venueLine": "10am to 5pm · AB-2 Auditorium"
	},
	{
		"id": 6,
		"layout": "letter-grid",
		"ground": "#0d0316",
		"image": "/events/gittyup26/noisy-4.webp",
		"imageBlend": "luminosity",
		"layers": [
			"radial-gradient(115% 75% at 52% 26%,rgba(138,15,158,.5) 0%,rgba(138,15,158,.24) 42%,rgba(13,3,22,0) 76%)",
			"linear-gradient(196deg,rgba(138,15,158,.34) 0%,rgba(138,15,158,.12) 46%,rgba(13,3,22,0) 82%)",
			"linear-gradient(180deg,rgba(13,3,22,.72) 0%,rgba(13,3,22,.3) 32%,rgba(13,3,22,.9) 74%,#0d0316 100%)",
			"radial-gradient(circle at 50% 50%,rgba(255,255,255,.075) 0 22%,rgba(255,255,255,0) 24%) 0 0/18px 18px"
		],
		"grain": 0.5,
		"ink": "#ffffff",
		"text": "rgba(255,255,255,.86)",
		"accent": "#cf6ae2",
		"rows": 5,
		"headline": "The graph came before the command.",
		"emphasis": "command",
		"dateLine": "1 September 2026",
		"venueLine": "10am to 5pm · AB-2 Auditorium"
	},
	{
		"id": 7,
		"layout": "wordmark-stack",
		"ground": "#15003e",
		"image": "/events/gittyup26/halftone.webp",
		"imageBlend": "multiply",
		"layers": [
			"linear-gradient(31.637deg,#5600ff 0%,#3700a4 24.76%,#15003e 57.87%)",
			"radial-gradient(78% 52% at 46% 26%,rgba(150,104,255,.26) 0%,rgba(96,26,220,.13) 42%,rgba(21,0,62,0) 76%)",
			"repeating-radial-gradient(circle at 50% 50%,rgba(6,0,24,.34) 0 1.5px,rgba(6,0,24,0) 1.6px 7px) 0 0 / 7px 7px repeat"
		],
		"ink": "rgba(255,255,255,.2)",
		"text": "rgba(255,255,255,.82)",
		"accent": "#d6c6ff",
		"rows": 5,
		"eyebrow": "A history of version control",
		"headline": "Somebody had to invent undo.",
		"emphasis": "undo",
		"dateLine": "1 September 2026",
		"venueLine": "10am to 5pm · AB-2 Auditorium"
	},
	{
		"id": 8,
		"layout": "wordmark-stack",
		"ground": "#000000",
		"image": "/events/gittyup26/chrome-rings.webp",
		"dispersion": true,
		"layers": [
			"linear-gradient(-16deg,rgba(255,255,255,.07) 0%,rgba(255,255,255,0) 11%,rgba(255,255,255,.11) 19%,rgba(255,255,255,0) 30%,rgba(255,255,255,.15) 43%,rgba(255,255,255,0) 54%,rgba(255,255,255,.08) 67%,rgba(255,255,255,0) 79%,rgba(255,255,255,.12) 92%,rgba(255,255,255,0) 100%)",
			"radial-gradient(88% 54% at 50% 10%,rgba(217,210,238,.34) 0%,rgba(150,142,176,.15) 38%,rgba(0,0,0,0) 72%)",
			"radial-gradient(120% 78% at 50% 24%,rgba(0,0,0,.1) 0%,rgba(0,0,0,.84) 50%,#000 82%)"
		],
		"ink": "#d9d2ee",
		"inkGradient": "linear-gradient(104deg,#d9d2ee 0%,#6d6190 15%,#efeaf9 31%,#544a72 47%,#ded7ee 63%,#615680 81%,#e8e2f5 100%)",
		"text": "rgba(255,255,255,.74)",
		"accent": "#c9c3d8",
		"rows": 4,
		"eyebrow": "A history of version control",
		"headline": "Your history should answer to you.",
		"emphasis": "history",
		"dateLine": "01 . 09 . 26",
		"venueLine": "10:00 to 17:00 · AB-2 Auditorium"
	},
	{
		"id": 9,
		"layout": "data-block",
		"ground": "#07060c",
		"layers": [
			"linear-gradient(160deg,#0d0a1a 0%,#07060c 45%,#0a0716 100%)",
			"radial-gradient(90% 60% at 78% 20%,rgba(42,140,151,.32) 0%,rgba(42,140,151,0) 62%)",
			"radial-gradient(80% 55% at 12% 84%,rgba(86,0,255,.36) 0%,rgba(86,0,255,0) 60%)"
		],
		"grid": {
			"size": "124px",
			"color": "rgba(255,255,255,.055)"
		},
		"ink": "#ffffff",
		"text": "rgba(255,255,255,.7)",
		"accent": "#2a8c97",
		"rows": 5,
		"headline": "Someone had to decide what a version was.",
		"emphasis": "version",
		"subline": "Where version control came from, and why your history should answer to you.",
		"dateLine": "2026-09-01",
		"venueLine": "10:00 to 17:00 · AB-2 Auditorium",
		"specs": [
			{
				"label": "DATE",
				"value": "2026-09-01"
			},
			{
				"label": "TIME",
				"value": "10:00 to 17:00"
			},
			{
				"label": "VENUE",
				"value": "AB-2 Auditorium"
			},
			{
				"label": "HOST",
				"value": "Open Source Community"
			},
			{
				"label": "ENTRY",
				"value": "open · free"
			}
		]
	},
	{
		"id": 10,
		"layout": "wordmark-stack",
		"ground": "#05030c",
		"image": "/events/gittyup26/art-purple.webp",
		"layers": [
			"radial-gradient(118% 72% at 50% 26%, rgba(150,96,255,.5) 0%, rgba(96,44,196,.32) 32%, rgba(40,14,96,.16) 58%, rgba(5,3,12,0) 82%)",
			"radial-gradient(56% 32% at 64% 15%, rgba(240,230,255,.3) 0%, rgba(201,164,255,.13) 42%, rgba(5,3,12,0) 76%)",
			"linear-gradient(180deg,rgba(5,3,12,.6) 0%,rgba(5,3,12,.16) 24%,rgba(5,3,12,.8) 60%,#05030c 86%)"
		],
		"grain": 0.16,
		"ink": "#c9a4ff",
		"inkGradient": "radial-gradient(120% 180% at 36% 42%, rgba(255,255,255,.5) 0%, rgba(255,255,255,0) 46%), linear-gradient(96deg,#c9a4ff 0%,#f0e6ff 34%,#8e5cff 62%,#e4d5ff 100%)",
		"text": "#ffffff",
		"accent": "#c9b3ff",
		"rows": 4,
		"eyebrow": "A history of version control",
		"headline": "Every commit has an ancestor.",
		"emphasis": "commit",
		"dateLine": "1 September 2026",
		"venueLine": "10am to 5pm · AB-2 Auditorium"
	},
	{
		"id": 11,
		"layout": "letter-grid",
		"ground": "#060210",
		"image": "/events/gittyup26/noisy-3.webp",
		"imageBlend": "luminosity",
		"layers": [
			"linear-gradient(196deg, rgba(75,18,200,.46) 0%, rgba(45,11,124,.5) 44%, rgba(14,4,44,.62) 100%)",
			"radial-gradient(112% 66% at 46% 30%, rgba(124,64,255,.44) 0%, rgba(62,20,158,.2) 44%, rgba(6,2,16,0) 76%)",
			"linear-gradient(180deg,rgba(6,2,16,.66) 0%,rgba(6,2,16,.3) 34%,rgba(6,2,16,.92) 74%,#060210 100%)",
			"radial-gradient(circle at 50% 50%, rgba(255,255,255,.06) 0 1.2px, rgba(255,255,255,0) 1.4px) 0 0 / 11px 11px"
		],
		"grain": 0.5,
		"ink": "#ffffff",
		"text": "#ffffff",
		"accent": "#a07bff",
		"rows": 4,
		"headline": "Copies of copies of copies. Then git.",
		"emphasis": "git",
		"subline": "A history of version control, and the case for hosting your own.",
		"dateLine": "1 September 2026",
		"venueLine": "10am to 5pm · AB-2 Auditorium"
	},
	{
		"id": 12,
		"layout": "wordmark-stack",
		"ground": "#000",
		"image": "/events/gittyup26/glass-soft.webp",
		"dispersion": true,
		"layers": [
			"linear-gradient(104deg, #101019 0%, #35304a 8%, #15141d 14%, #5b5474 23%, #1e1b29 30%, #746c92 40%, #272332 47%, #4e4767 57%, #151420 65%, #443d5a 77%, #121118 87%, #2a2639 100%) 0 0 / 100% 56% no-repeat",
			"linear-gradient(-56deg, rgba(231,225,244,.18) 0%, rgba(231,225,244,0) 11%, rgba(76,67,104,.32) 21%, rgba(0,0,0,0) 32%, rgba(219,212,236,.16) 43%, rgba(0,0,0,0) 54%, rgba(97,86,121,.3) 69%, rgba(0,0,0,0) 83%, rgba(226,220,242,.12) 100%) 0 0 / 100% 56% no-repeat",
			"linear-gradient(180deg,rgba(0,0,0,0) 0%,rgba(0,0,0,0) 26%,rgba(0,0,0,.7) 43%,#000 57%,#000 100%)"
		],
		"ink": "#ffffff",
		"inkGradient": "linear-gradient(101deg,#cdc5e6 0%,#615679 16%,#e7e1f4 32%,#4c4368 48%,#dbd4ec 64%,#585072 82%,#e2dcf2 100%)",
		"text": "#ffffff",
		"accent": "rgba(255,255,255,.6)",
		"rows": 2,
		"eyebrow": "A history of version control",
		"headline": "Undo was not always free.",
		"emphasis": "free",
		"dateLine": "01 . 09 . 26",
		"venueLine": "10:00 to 17:00 · AB-2 Auditorium"
	},
	{
		"id": 13,
		"layout": "wordmark-stack",
		"ground": "#000000",
		"image": "/events/gittyup26/art-arc.webp",
		"layers": [
			"radial-gradient(58% 42% at 50% 66%,rgba(138,105,208,.22) 0%,rgba(60,34,120,.10) 46%,rgba(0,0,0,0) 76%)",
			"radial-gradient(70% 44% at 50% 40%,rgba(86,0,255,.4) 0%,rgba(55,0,164,.12) 44%,rgba(0,0,0,0) 74%)",
			"linear-gradient(178deg,rgba(0,0,0,.82) 0%,rgba(0,0,0,.44) 30%,rgba(0,0,0,.58) 58%,rgba(0,0,0,.9) 84%,#000 100%)"
		],
		"grain": 0.2,
		"ink": "#ffffff",
		"text": "rgba(255,255,255,.8)",
		"accent": "#8f7dff",
		"rows": 2,
		"headline": "Every tool you trust was once a workaround.",
		"emphasis": "workaround",
		"subline": "We all use the solution. Almost nobody knows the problem.",
		"dateLine": "1 September 2026",
		"venueLine": "10am to 5pm · AB-2 Auditorium"
	},
	{
		"id": 14,
		"layout": "wordmark-stack",
		"ground": "#1c0060",
		"image": "/events/gittyup26/halftone.webp",
		"imageBlend": "multiply",
		"layers": [
			"linear-gradient(148deg,#8a2bff 0%,#6200ff 30%,#4a00d0 64%,#3a00a0 100%)",
			"radial-gradient(circle at center,rgba(18,0,60,.34) 0 3px,rgba(18,0,60,0) 3.6px) 0 0 / 18px 18px",
			"radial-gradient(circle at center,rgba(18,0,60,.22) 0 1.6px,rgba(18,0,60,0) 2.2px) 9px 9px / 18px 18px"
		],
		"ink": "#12003c",
		"text": "#ffffff",
		"accent": "#ddccff",
		"rows": 4,
		"headline": "Before git, there was a problem worth solving.",
		"emphasis": "git",
		"dateLine": "1 September 2026",
		"venueLine": "10am to 5pm · AB-2 Auditorium"
	},
	{
		"id": 15,
		"layout": "letter-grid",
		"ground": "#000000",
		"image": "/events/gittyup26/chrome-blobs.webp",
		"dispersion": true,
		"imagePosition": "72% center",
		"layers": [
			"radial-gradient(60% 46% at 76% 34%,rgba(0,0,0,0) 0%,rgba(0,0,0,.42) 62%,rgba(0,0,0,.9) 92%)",
			"linear-gradient(90deg,#000 0%,rgba(0,0,0,.86) 40%,rgba(0,0,0,0) 76%)",
			"linear-gradient(180deg,rgba(0,0,0,0) 0%,rgba(0,0,0,.32) 50%,rgba(0,0,0,.88) 88%)"
		],
		"ink": "rgba(255,255,255,.9)",
		"text": "rgba(255,255,255,.74)",
		"accent": "#fff0fa",
		"rows": 9,
		"headline": "Undo has an origin story.",
		"emphasis": "origin story",
		"subline": "We all use the solution. Almost nobody knows the problem.",
		"dateLine": "1 September 2026",
		"venueLine": "10am to 5pm · AB-2 Auditorium"
	},
	{
		"id": 16,
		"layout": "wordmark-stack",
		"ground": "#010409",
		"image": "/events/gittyup26/glass-tall.webp",
		"dispersion": true,
		"layers": [
			"linear-gradient(180deg, rgba(150,186,220,.34) 0%, rgba(96,132,172,.22) 18%, rgba(44,68,102,.10) 32%, rgba(1,5,12,0) 44%)",
			"radial-gradient(120% 58% at 50% 16%, rgba(196,220,240,.40) 0%, rgba(110,150,190,.24) 34%, rgba(28,50,82,.08) 62%, rgba(1,5,12,0) 80%)",
			"linear-gradient(180deg,rgba(1,5,12,0) 0%,rgba(1,5,12,.72) 52%,#01050c 100%)",
			"linear-gradient(180deg,rgba(1,5,12,.86) 0%,rgba(1,5,12,0) 100%)",
			"radial-gradient(70% 40% at 84% 84%,rgba(86,0,255,.26) 0%,rgba(86,0,255,0) 66%)"
		],
		"grain": 0.15,
		"ink": "#ffffff",
		"inkGradient": "url(/events/gittyup26/glass-tall.webp), linear-gradient(100deg,#ffffff 0%,#69798d 18%,#ffffff 36%,#b4bcc6 52%,#ffffff 68%,#69798d 84%,#ffffff 100%)",
		"inkSize": "220% auto, 100% 100%",
		"inkPosition": "36% 42%, center",
		"inkBlend": "screen",
		"text": "rgba(255,255,255,.76)",
		"accent": "#7fb6ff",
		"rows": 4,
		"eyebrow": "A history of version control",
		"headline": "History is a data structure.",
		"emphasis": "data structure",
		"subline": "We all use the solution. Almost nobody knows the problem.",
		"dateLine": "1 September 2026",
		"venueLine": "10am to 5pm · AB-2 Auditorium"
	},
	{
		"id": 17,
		"layout": "wordmark-stack",
		"ground": "#06040f",
		"image": "/events/gittyup26/chrome-blobs2.webp",
		"dispersion": true,
		"layers": [
			"linear-gradient(168deg, rgba(255,255,255,.14) 0%, rgba(255,255,255,0) 11%, rgba(0,0,0,.36) 21%, rgba(255,255,255,.12) 33%, rgba(0,0,0,.30) 46%, rgba(255,255,255,.18) 60%, rgba(0,0,0,.42) 75%, rgba(255,255,255,.09) 87%, rgba(0,0,0,.32) 100%)",
			"radial-gradient(95% 50% at 50% 24%, rgba(201,179,255,.20) 0%, rgba(201,179,255,.07) 42%, rgba(201,179,255,0) 74%)",
			"linear-gradient(180deg,rgba(6,4,15,.74) 0%,rgba(6,4,15,.4) 24%,rgba(6,4,15,.78) 48%,rgba(6,4,15,.94) 74%,#06040f 92%)"
		],
		"grain": 0.2,
		"ink": "#ffffff",
		"inkGradient": "url(/events/gittyup26/chrome-blobs2.webp), linear-gradient(107deg,#ffffff 0%,#7e788d 18%,#ffffff 36%,#bfbbc6 52%,#ffffff 68%,#7e788d 84%,#ffffff 100%)",
		"inkSize": "220% auto, 100% 100%",
		"inkPosition": "41% 45%, center",
		"inkBlend": "screen",
		"text": "rgba(255,255,255,.84)",
		"accent": "#c9b3ff",
		"rows": 4,
		"eyebrow": "A history of version control",
		"headline": "You type it every day. Somebody had to invent it.",
		"emphasis": "invent",
		"dateLine": "1 September 2026",
		"venueLine": "10am to 5pm · AB-2 Auditorium"
	},
	{
		"id": 18,
		"layout": "hero-word",
		"ground": "#000000",
		"image": "/events/gittyup26/glass-corner.webp",
		"dispersion": true,
		"layers": [
			"linear-gradient(100deg, rgba(118,113,140,.30) 0%, rgba(200,195,218,.42) 13%, rgba(68,64,88,.34) 27%, rgba(216,211,232,.38) 43%, rgba(82,77,104,.32) 57%, rgba(180,174,200,.36) 73%, rgba(60,56,78,.30) 100%)",
			"radial-gradient(80% 48% at 30% 30%, rgba(230,224,245,.32) 0%, rgba(140,132,168,.15) 44%, rgba(0,0,0,0) 78%)",
			"radial-gradient(110% 70% at 46% 40%,rgba(0,0,0,.16) 0%,rgba(0,0,0,.82) 52%,#000 84%)"
		],
		"ink": "#e6e0f5",
		"inkGradient": "linear-gradient(98deg,#e6e0f5 0%,#7b6fa0 20%,#f2edff 40%,#5a5079 56%,#e8e2f6 74%,#6d6293 90%,#efeaff 100%)",
		"text": "rgba(255,255,255,.72)",
		"accent": "#f2edff",
		"rows": 1,
		"eyebrow": "Somebody had to invent",
		"headline": "Keep your own history.",
		"emphasis": "history",
		"heroWord": "undo",
		"subline": "We all use the solution. Almost nobody knows the problem.",
		"dateLine": "1 September 2026",
		"venueLine": "10am to 5pm · AB-2 Auditorium"
	},
	{
		"id": 19,
		"layout": "terminal",
		"ground": "#04040a",
		"layers": [
			"linear-gradient(172deg,#0b0918 0%,#04040a 54%,#0a0620 100%)",
			"radial-gradient(70% 44% at 84% 88%,rgba(86,0,255,.32) 0%,rgba(86,0,255,0) 64%)"
		],
		"ink": "rgba(255,255,255,.055)",
		"text": "rgba(255,255,255,.66)",
		"accent": "#8f7dff",
		"rows": 5,
		"headline": "Someone had to lose work first.",
		"emphasis": "work",
		"subline": "We all use the solution. Almost nobody knows the problem.",
		"dateLine": "2026-09-01",
		"venueLine": "10:00 to 17:00 · AB-2 Auditorium",
		"terminal": [
			"git log",
			"someone had to lose work first",
			"someone had to name the branch",
			"someone had to invent undo",
			"gitty up_"
		]
	},
	{
		"id": 20,
		"layout": "data-block",
		"ground": "#05060d",
		"layers": [
			"linear-gradient(165deg,#0a0d1e 0%,#05060d 50%,#0a0620 100%)",
			"radial-gradient(74% 44% at 82% 74%,rgba(86,0,255,.3) 0%,rgba(86,0,255,0) 62%)"
		],
		"grid": {
			"size": "82px",
			"color": "rgba(120,160,255,.06)"
		},
		"ink": "#ffffff",
		"text": "rgba(255,255,255,.78)",
		"accent": "#8f7dff",
		"rows": 4,
		"headline": "The problem came first. The tool came later.",
		"emphasis": "tool",
		"dateLine": "2026-09-01",
		"venueLine": "10:00 to 17:00 · AB-2 Auditorium",
		"specs": [
			{
				"label": "DATE",
				"value": "2026-09-01"
			},
			{
				"label": "TIME",
				"value": "10:00-17:00"
			},
			{
				"label": "ROOM",
				"value": "AB-2"
			},
			{
				"label": "ENTRY",
				"value": "free"
			}
		]
	},
	{
		"id": 21,
		"layout": "wordmark-stack",
		"ground": "#12003c",
		"image": "/events/gittyup26/noisy-4.webp",
		"imageBlend": "luminosity",
		"layers": [
			"linear-gradient(200deg,rgba(106,18,255,.82) 0%,rgba(66,0,196,.82) 36%,rgba(32,0,110,.82) 72%,rgba(13,0,38,.82) 100%)",
			"linear-gradient(200deg,rgba(106,18,255,.5) 0%,rgba(66,0,196,.4) 36%,rgba(13,0,38,.7) 100%)",
			"radial-gradient(circle,rgba(0,0,0,.3) 1.3px,rgba(0,0,0,0) 1.5px) 0 0/9px 9px repeat, radial-gradient(circle,rgba(0,0,0,.22) 1.3px,rgba(0,0,0,0) 1.5px) 4.5px 4.5px/9px 9px repeat"
		],
		"grain": 0.5,
		"ink": "#f6f1ff",
		"inkGradient": "url(/events/gittyup26/noisy-4.webp), linear-gradient(99deg,#f6f1ff 0%,#7a718d 18%,#f9f6ff 36%,#b8b1c6 52%,#f6f1ff 68%,#7a718d 84%,#f9f6ff 100%)",
		"inkSize": "220% auto, 100% 100%",
		"inkPosition": "35% 57%, center",
		"inkBlend": "screen",
		"text": "rgba(255,255,255,.9)",
		"accent": "#c4a8ff",
		"rows": 5,
		"headline": "Every shortcut you type was once an argument.",
		"emphasis": "argument",
		"dateLine": "1 September 2026",
		"venueLine": "10am to 5pm · AB-2 Auditorium"
	},
	{
		"id": 22,
		"layout": "wordmark-stack",
		"ground": "#070313",
		"image": "/events/gittyup26/noisy-5.webp",
		"imageBlend": "luminosity",
		"layers": [
			"radial-gradient(135% 105% at 50% 18%, rgba(122,38,255,.42) 0%, rgba(74,18,190,.30) 34%, rgba(30,8,86,.22) 62%, rgba(7,3,19,.10) 88%)",
			"linear-gradient(180deg, rgba(90,18,216,.22) 0%, rgba(90,18,216,.14) 55%, rgba(90,18,216,.06) 100%)",
			"linear-gradient(180deg,rgba(7,3,19,.72) 0%,rgba(7,3,19,.3) 36%,rgba(7,3,19,.92) 78%,#070313 100%)",
			"repeating-linear-gradient(180deg,rgba(255,255,255,.055) 0px,rgba(255,255,255,.055) 2px,transparent 2px,transparent 8px)"
		],
		"grain": 0.5,
		"ink": "rgba(255,255,255,.94)",
		"inkGradient": "url(/events/gittyup26/noisy-5.webp), linear-gradient(106deg,#ffffff 0%,#75688d 18%,#ffffff 36%,#bab4c6 52%,#ffffff 68%,#75688d 84%,#ffffff 100%)",
		"inkSize": "220% auto, 100% 100%",
		"inkPosition": "40% 38%, center",
		"inkBlend": "screen",
		"text": "rgba(255,255,255,.9)",
		"accent": "#a97bff",
		"rows": 4,
		"headline": "Merge conflicts are older than you think.",
		"emphasis": "older",
		"subline": "We all use the solution. Almost nobody knows the problem.",
		"dateLine": "1 September 2026",
		"venueLine": "10am to 5pm · AB-2 Auditorium"
	},
	{
		"id": 23,
		"layout": "wordmark-stack",
		"ground": "#01040c",
		"image": "/events/gittyup26/art-blue.webp",
		"layers": [
			"radial-gradient(120% 62% at 50% 84%, rgba(168,203,242,.30) 0%, rgba(96,140,200,.22) 30%, rgba(34,62,116,.15) 56%, rgba(1,4,12,0) 84%)",
			"radial-gradient(80% 40% at 28% 68%, rgba(122,168,222,.16) 0%, rgba(1,4,12,0) 70%)",
			"linear-gradient(180deg,#01040c 0%,#01040c 40%,rgba(1,4,12,0) 56%,rgba(1,4,12,0) 100%)",
			"linear-gradient(180deg,rgba(1,4,12,0) 0%,rgba(1,4,12,0) 79%,rgba(1,4,12,.9) 91%,#01040c 100%)",
			"linear-gradient(180deg,rgba(1,4,12,0) 46%,rgba(1,4,12,.72) 66%,rgba(1,4,12,.84) 84%,rgba(1,4,12,.6) 100%)"
		],
		"ink": "#fff",
		"inkGradient": "url(/events/gittyup26/art-blue.webp), linear-gradient(113deg,#ffffff 0%,#757f8a 18%,#ffffff 36%,#babfc4 52%,#ffffff 68%,#757f8a 84%,#ffffff 100%)",
		"inkSize": "220% auto, 100% 100%",
		"inkPosition": "45% 41%, center",
		"inkBlend": "screen",
		"text": "rgba(255,255,255,.86)",
		"accent": "#a8cbf2",
		"rows": 3,
		"eyebrow": "A history of version control",
		"headline": "Somebody had to name the branch.",
		"emphasis": "branch",
		"dateLine": "1 September 2026",
		"venueLine": "10am to 5pm · AB-2 Auditorium"
	},
	{
		"id": 24,
		"layout": "wordmark-stack",
		"ground": "#04030d",
		"image": "/events/gittyup26/glass-fan.webp",
		"dispersion": true,
		"layers": [
			"conic-gradient(from 205deg at 40% 44%, rgba(122,74,238,.34) 0deg, rgba(38,20,96,.20) 88deg, rgba(196,162,255,.24) 172deg, rgba(26,14,66,.18) 256deg, rgba(122,74,238,.34) 360deg)",
			"radial-gradient(95% 68% at 64% 28%, rgba(242,236,255,.20) 0%, rgba(104,58,204,.16) 42%, rgba(4,3,13,0) 80%)",
			"linear-gradient(178deg,rgba(4,3,13,.8) 0%,rgba(4,3,13,.42) 26%,rgba(4,3,13,.6) 54%,rgba(4,3,13,.92) 84%,#04030d 100%)"
		],
		"ink": "#fff",
		"inkGradient": "url(/events/gittyup26/glass-fan.webp), linear-gradient(102deg,#ffffff 0%,#8a888d 18%,#ffffff 36%,#c4c3c6 52%,#ffffff 68%,#8a888d 84%,#ffffff 100%)",
		"inkSize": "220% auto, 100% 100%",
		"inkPosition": "50% 44%, center",
		"inkBlend": "screen",
		"text": "rgba(255,255,255,.86)",
		"accent": "#f2ecff",
		"rows": 5,
		"eyebrow": "A history of version control",
		"headline": "The repo is yours. The server can be too.",
		"emphasis": "server",
		"dateLine": "1 September 2026",
		"venueLine": "10am to 5pm · AB-2 Auditorium"
	},
	{
		"id": 25,
		"layout": "wordmark-stack",
		"ground": "#03020a",
		"image": "/events/gittyup26/art-arc.webp",
		"layers": [
			"radial-gradient(150% 115% at 14% 4%, rgba(152,134,198,.32) 0%, rgba(74,58,116,.20) 26%, rgba(40,30,66,.10) 48%, rgba(3,2,10,0) 76%)",
			"conic-gradient(from 196deg at 20% 10%, rgba(128,106,182,.30) 0deg, rgba(24,18,52,.10) 62deg, rgba(186,158,146,.24) 148deg, rgba(10,8,26,0) 236deg, rgba(128,106,182,.26) 360deg)",
			"linear-gradient(196deg,rgba(3,2,10,.38) 0%,rgba(3,2,10,.16) 20%,rgba(3,2,10,.84) 52%,#03020a 76%)"
		],
		"grain": 0.2,
		"ink": "#ffffff",
		"inkGradient": "url(/events/gittyup26/art-arc.webp), linear-gradient(109deg,#ffffff 0%,#8d8d8d 18%,#ffffff 36%,#c6c6c6 52%,#ffffff 68%,#8d8d8d 84%,#ffffff 100%)",
		"inkSize": "220% auto, 100% 100%",
		"inkPosition": "55% 47%, center",
		"inkBlend": "screen",
		"text": "rgba(255,255,255,.82)",
		"accent": "#ffffff",
		"rows": 5,
		"headline": "Before the graph, there was only the file.",
		"emphasis": "file",
		"dateLine": "1 Sep 2026",
		"venueLine": "10am to 5pm · AB-2"
	},
	{
		"id": 26,
		"layout": "wordmark-stack",
		"ground": "#050805",
		"layers": [
			"linear-gradient(158deg,#0a1408 0%,#050805 44%,#03120f 100%)",
			"radial-gradient(80% 46% at 18% 22%,rgba(160,255,80,.24) 0%,rgba(160,255,80,0) 62%)",
			"radial-gradient(70% 40% at 88% 84%,rgba(42,140,151,.34) 0%,rgba(42,140,151,0) 64%)",
			"radial-gradient(circle at 50% 50%, rgba(255,255,255,.10) 0 1.2px, rgba(255,255,255,0) 1.6px) 0 0 / 9px 9px repeat"
		],
		"ink": "#c9ff5e",
		"inkGradient": "linear-gradient(98deg,#c9ff5e 0%,#6f8d34 18%,#dcff96 36%,#9cc649 52%,#c9ff5e 68%,#6f8d34 84%,#dcff96 100%)",
		"text": "rgba(255,255,255,.84)",
		"accent": "#c9ff5e",
		"rows": 4,
		"headline": "Somebody had to invent history.",
		"emphasis": "history",
		"dateLine": "1 September 2026",
		"venueLine": "10am to 5pm · AB-2 Auditorium"
	},
	{
		"id": 27,
		"layout": "wordmark-stack",
		"ground": "#04020c",
		"image": "/events/gittyup26/chrome-blobs.webp",
		"dispersion": true,
		"layers": [
			"radial-gradient(125% 92% at 50% 32%, rgba(200,206,224,.30) 0%, rgba(112,118,142,.20) 40%, rgba(46,48,66,.12) 62%, rgba(4,2,12,0) 82%)",
			"linear-gradient(102deg, rgba(228,232,244,.26) 0 11%, rgba(68,74,94,.20) 11% 19%, rgba(198,206,226,.22) 19% 30%, rgba(26,28,42,.24) 30% 43%, rgba(214,220,238,.18) 43% 55%, rgba(52,56,74,.22) 55% 100%)",
			"linear-gradient(-24deg, rgba(12,12,22,.30) 0 17%, rgba(188,196,216,.18) 17% 25%, rgba(38,40,56,.26) 25% 46%, rgba(232,236,248,.16) 46% 54%, rgba(20,20,32,.28) 54% 100%)",
			"linear-gradient(178deg,rgba(4,2,12,.78) 0%,rgba(4,2,12,.4) 26%,rgba(4,2,12,.62) 56%,rgba(4,2,12,.92) 84%,#04020c 100%)"
		],
		"ink": "#ffffff",
		"inkGradient": "url(/events/gittyup26/chrome-blobs.webp), linear-gradient(105deg,#ffffff 0%,#7e7f84 18%,#ffffff 36%,#bebfc2 52%,#ffffff 68%,#7e7f84 84%,#ffffff 100%)",
		"inkSize": "220% auto, 100% 100%",
		"inkPosition": "39% 53%, center",
		"inkBlend": "screen",
		"text": "rgba(255,255,255,.74)",
		"accent": "#c8cee0",
		"rows": 4,
		"eyebrow": "We all use the solution. Almost nobody knows the problem.",
		"headline": "The workaround came first.",
		"emphasis": "workaround",
		"dateLine": "1 September 2026",
		"venueLine": "10am to 5pm · AB-2 Auditorium"
	},
	{
		"id": 28,
		"layout": "wordmark-stack",
		"ground": "#03090c",
		"layers": [
			"url(\"data:image/svg+xml,%3Csvg%20xmlns%3D%27http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%27%20width%3D%27760%27%20height%3D%27182%27%3E%3Ctext%20x%3D%270%27%20y%3D%2718%27%20font-family%3D%27monospace%27%20font-size%3D%2715%27%20letter-spacing%3D%271.2%27%20fill%3D%27rgb(46%2C230%2C214)%27%20fill-opacity%3D%270.16%27%3E436d87a1cbe50f2436d87a1cbe50f2%209436d87a1cbe50%3C%2Ftext%3E%3Ctext%20x%3D%270%27%20y%3D%2744%27%20font-family%3D%27monospace%27%20font-size%3D%2715%27%20letter-spacing%3D%271.2%27%20fill%3D%27rgb(46%2C230%2C214)%27%20fill-opacity%3D%270.16%27%3Ef29436d87a1cbe5f29436d87a1cbe5%200f29436d87a1cb%3C%2Ftext%3E%3Ctext%20x%3D%270%27%20y%3D%2770%27%20font-family%3D%27monospace%27%20font-size%3D%2715%27%20letter-spacing%3D%271.2%27%20fill%3D%27rgb(46%2C230%2C214)%27%20fill-opacity%3D%270.16%27%3Ee50f29436d87a1ce50f29436d87a1c%20be50f29436d87a%3C%2Ftext%3E%3Ctext%20x%3D%270%27%20y%3D%2796%27%20font-family%3D%27monospace%27%20font-size%3D%2715%27%20letter-spacing%3D%271.2%27%20fill%3D%27rgb(46%2C230%2C214)%27%20fill-opacity%3D%270.16%27%3E1cbe50f29436d871cbe50f29436d87%20a1cbe50f29436d%3C%2Ftext%3E%3Ctext%20x%3D%270%27%20y%3D%27122%27%20font-family%3D%27monospace%27%20font-size%3D%2715%27%20letter-spacing%3D%271.2%27%20fill%3D%27rgb(46%2C230%2C214)%27%20fill-opacity%3D%270.16%27%3E87a1cbe50f2943687a1cbe50f29436%20d87a1cbe50f294%3C%2Ftext%3E%3Ctext%20x%3D%270%27%20y%3D%27148%27%20font-family%3D%27monospace%27%20font-size%3D%2715%27%20letter-spacing%3D%271.2%27%20fill%3D%27rgb(46%2C230%2C214)%27%20fill-opacity%3D%270.16%27%3E36d87a1cbe50f2936d87a1cbe50f29%20436d87a1cbe50f%3C%2Ftext%3E%3Ctext%20x%3D%270%27%20y%3D%27174%27%20font-family%3D%27monospace%27%20font-size%3D%2715%27%20letter-spacing%3D%271.2%27%20fill%3D%27rgb(46%2C230%2C214)%27%20fill-opacity%3D%270.16%27%3E29436d87a1cbe5029436d87a1cbe50%20f29436d87a1cbe%3C%2Ftext%3E%3C%2Fsvg%3E\") 0 0 / 760px 182px repeat",
			"radial-gradient(105% 70% at 44% 34%, rgba(3,9,12,0) 0%, rgba(3,9,12,.55) 58%, rgba(3,9,12,.88) 100%)",
			"linear-gradient(180deg, rgba(3,9,12,.55) 0%, rgba(3,9,12,.2) 30%, rgba(3,9,12,.82) 82%, #03090c 100%)",
			"linear-gradient(rgba(46,230,214,.35), rgba(46,230,214,.35)) 0 77% / 100% 1px no-repeat"
		],
		"ink": "#ffffff",
		"inkGradient": "url(\"data:image/svg+xml,%3Csvg%20xmlns=%27http://www.w3.org/2000/svg%27%20width=%27104%27%20height=%2796%27%3E%3Ctext%20x=%270%27%20y=%2712%27%20font-family=%27monospace%27%20font-size=%2714%27%20letter-spacing=%274.6%27%20fill=%27%23dffaf6%27%3E%23%23%23%23%23%23%23%23%23%3C/text%3E%3Ctext%20x=%276.5%27%20y=%2728%27%20font-family=%27monospace%27%20font-size=%2714%27%20letter-spacing=%274.6%27%20fill=%27%23dffaf6%27%3E%23%23%23%23%23%23%23%23%23%3C/text%3E%3Ctext%20x=%270%27%20y=%2744%27%20font-family=%27monospace%27%20font-size=%2714%27%20letter-spacing=%274.6%27%20fill=%27%23dffaf6%27%3E%23%23%23%23%23%23%23%23%23%3C/text%3E%3Ctext%20x=%276.5%27%20y=%2760%27%20font-family=%27monospace%27%20font-size=%2714%27%20letter-spacing=%274.6%27%20fill=%27%23dffaf6%27%3E%23%23%23%23%23%23%23%23%23%3C/text%3E%3Ctext%20x=%270%27%20y=%2776%27%20font-family=%27monospace%27%20font-size=%2714%27%20letter-spacing=%274.6%27%20fill=%27%23dffaf6%27%3E%23%23%23%23%23%23%23%23%23%3C/text%3E%3Ctext%20x=%276.5%27%20y=%2792%27%20font-family=%27monospace%27%20font-size=%2714%27%20letter-spacing=%274.6%27%20fill=%27%23dffaf6%27%3E%23%23%23%23%23%23%23%23%23%3C/text%3E%3C/svg%3E\"), linear-gradient(100deg,#0d3b3f 0%,#08272b 22%,#12494d 44%,#072226 62%,#0f4247 82%,#0a2c30 100%)",
		"inkSize": "104px 96px, 100% 100%",
		"inkPosition": "0 0, center",
		"inkBlend": "normal",
		"inkRepeat": "repeat, no-repeat",
		"text": "#ffffff",
		"accent": "#2ee6d6",
		"rows": 5,
		"headline": "Git won. But why?",
		"emphasis": "why",
		"dateLine": "1 September 2026",
		"venueLine": "10:00 to 17:00 · AB-2 Auditorium"
	},
	{
		"id": 29,
		"layout": "wordmark-stack",
		"ground": "#4a1fb5",
		"image": "/events/gittyup26/noisy-1.webp",
		"imageBlend": "luminosity",
		"layers": [
			"radial-gradient(60% 45% at 78% 78%, rgba(106,13,255,.35) 0%, rgba(106,13,255,0) 70%)",
			"linear-gradient(180deg,rgba(8,3,28,.72) 0%,rgba(8,3,28,.52) 32%,rgba(8,3,28,.92) 76%,#08031c 100%)",
			"radial-gradient(112% 72% at 44% 42%,rgba(8,3,28,.18) 0%,rgba(8,3,28,.78) 54%,rgba(8,3,28,.94) 86%)",
			"radial-gradient(circle at center, rgba(255,255,255,.07) 0 1.2px, rgba(255,255,255,0) 1.5px) 0 0 / 6px 6px"
		],
		"grain": 0.5,
		"ink": "#ffffff",
		"inkGradient": "url(/events/gittyup26/noisy-1.webp), linear-gradient(101deg,#ffffff 0%,#5b4f77 18%,#f4f1fb 36%,#8f86a8 52%,#ffffff 68%,#5b4f77 84%,#f4f1fb 100%)",
		"inkSize": "220% auto, 100% 100%",
		"inkPosition": "49% 59%, center",
		"inkBlend": "screen",
		"text": "#ffffff",
		"accent": "#a97dff",
		"rows": 6,
		"eyebrow": "A history of version control, and why you should be hosting your own git.",
		"headline": "A remote you own.",
		"emphasis": "remote",
		"dateLine": "1 September 2026",
		"venueLine": "10am to 5pm · AB-2 Auditorium"
	},
	{
		"id": 30,
		"layout": "headline-led",
		"ground": "#020104",
		"image": "/events/gittyup26/glass-stack.webp",
		"dispersion": true,
		"layers": [
			"radial-gradient(56% 34% at 62% 58%,rgba(86,0,255,.44) 0%,rgba(35,0,90,.14) 46%,rgba(0,0,0,0) 74%)",
			"linear-gradient(rgba(2,1,4,.46), rgba(2,1,4,.46))"
		],
		"ink": "rgba(255,255,255,.62)",
		"inkGradient": "url(/events/gittyup26/glass-stack.webp), linear-gradient(108deg,#ffffff 0%,#73688d 18%,#ffffff 36%,#b9b4c6 52%,#ffffff 68%,#73688d 84%,#ffffff 100%)",
		"inkSize": "220% auto, 100% 100%",
		"inkPosition": "54% 40%, center",
		"inkBlend": "screen",
		"text": "#ffffff",
		"accent": "#a17cff",
		"rows": 4,
		"headline": "The fix is famous. The problem is not.",
		"emphasis": "problem",
		"dateLine": "1 September 2026",
		"venueLine": "10am to 5pm · AB-2 Auditorium"
	},
	{
		"id": 31,
		"layout": "hero-word",
		"ground": "#000000",
		"image": "/events/gittyup26/carkey.webp",
		"dispersion": true,
		"imagePosition": "88% 52%",
		"layers": [
			"radial-gradient(58% 68% at 84% 56%, rgba(120,150,190,.18) 0%, rgba(70,95,130,.08) 46%, rgba(0,0,0,0) 76%)",
			"linear-gradient(90deg, #000 0%, rgba(0,0,0,.94) 34%, rgba(0,0,0,.5) 60%, rgba(0,0,0,0) 86%)",
			"linear-gradient(0deg, rgba(0,0,0,.95) 0%, rgba(0,0,0,.78) 13%, rgba(0,0,0,.34) 26%, rgba(0,0,0,0) 42%)"
		],
		"ink": "#ffffff",
		"inkGradient": "linear-gradient(101deg,#eef2fa 0%,#79808f 11%,#ffffff 24%,#565d6b 35%,#c9d2e4 47%,#6fe6ff 55%,#8e97a8 63%,#ffffff 76%,#646b7b 88%,#dfe5f0 100%)",
		"text": "rgba(255,255,255,.9)",
		"accent": "#c4cddd",
		"rows": 1,
		"headline": "They are in GITTY UP.",
		"emphasis": "GITTY UP",
		"heroWord": "LOOKING FOR CAR KEYS??",
		"subline": "Not really. But the session is, and so is everything else you have lost track of.",
		"dateLine": "1 September 2026",
		"venueLine": "10am to 5pm · AB-2 Auditorium",
		"unlisted": true
	},
	{
		"id": 32,
		"layout": "hero-word",
		"ground": "#050505",
		"image": "/events/gittyup26/crying-emoji-web.webp",
		"dispersion": true,
		"imagePosition": "78% 42%",
		"layers": [
			"radial-gradient(56% 62% at 78% 34%, rgba(150,86,255,.26) 0%, rgba(96,44,190,.12) 46%, rgba(0,0,0,0) 76%)",
			"linear-gradient(90deg, #050505 0%, rgba(5,5,5,.94) 32%, rgba(5,5,5,.48) 58%, rgba(5,5,5,0) 84%)",
			"linear-gradient(0deg, rgba(5,5,5,.96) 0%, rgba(5,5,5,.8) 14%, rgba(5,5,5,.34) 27%, rgba(5,5,5,0) 43%)"
		],
		"ink": "#ffffff",
		"inkGradient": "linear-gradient(101deg,#f2eefa 0%,#8a7fa0 12%,#ffffff 26%,#5e4f7a 38%,#d2c9e4 50%,#b98cff 58%,#948aa8 66%,#ffffff 78%,#6b647b 89%,#e8e5f0 100%)",
		"text": "rgba(255,255,255,.9)",
		"accent": "#c4cddd",
		"rows": 1,
		"headline": "It is all still in GITTY UP.",
		"emphasis": "GITTY UP",
		"heroWord": "SHOULD'VE COMMITTED EARLIER.",
		"subline": "Nothing you never saved is coming back. Everything after this one is up to you.",
		"dateLine": "1 September 2026",
		"venueLine": "10am to 5pm · AB-2 Auditorium",
		"unlisted": true
	},
	{
		"id": 33,
		"takedownNote": true,
		"layout": "wordmark-stack",
		/*
		 * The "restored" sheet: five wordmark rows down a diff gutter,
		 * two struck out at 35% behind a `-`, three restored at full
		 * strength behind a `+`. Ground is true #000 rather than the
		 * run's #050505 — the print took it there to buy the deleted
		 * rows 2.91 → 3.00:1, which is the ceiling for 35% white.
		 *
		 * The stack here cannot carry that fade. `fill` is applied per
		 * row in PosterWordmark, so a vertical inkGradient fades every
		 * row through itself rather than fading the top of the stack —
		 * the ink is flat white and the diff is carried by the copy.
		 */
		"ground": "#000000",
		/*
		 * Read off gittyup26-restored.png. The sheet uses no figure at
		 * all: its only ground is a weak violet wash in the top-right
		 * corner, peaking around #261a3a at roughly 88% across and 13%
		 * down and reaching pure black by a third of the way down and
		 * half of the way across. Everything else on the sheet measures
		 * #000000 exactly.
		 *
		 * The third layer is the scrim the print does not need. The
		 * printed sheet keeps its type in the left column, clear of the
		 * wash; the web layout reflows, and on a narrow viewport the
		 * headline and subline stack straight under the corner the wash
		 * is in. Deepening the ground around the copy holds it on the
		 * black the print reserved for it and leaves the wash where the
		 * sheet put it. Measured on a text-free render of this stack at
		 * 1440x900, 1280x800, 768x1024 and 390x844: the brightest ground
		 * anywhere in the copy column is #0e0718 and the body colour
		 * reads 15.2:1 on it, the accent 7.8:1. The brightest pixel on
		 * the page at all is #392459, at the heart of the wash under the
		 * details panel — which paints its own ground — and even bare,
		 * the body colour is 10.7:1 there.
		 */
		"layers": [
			"radial-gradient(64% 40% at 88% 13%, rgba(132,61,232,.30) 0%, rgba(96,44,170,.13) 40%, rgba(0,0,0,0) 74%)",
			"radial-gradient(34% 20% at 93% 6%, rgba(185,140,255,.16) 0%, rgba(185,140,255,0) 72%)",
			"radial-gradient(78% 60% at 26% 62%, rgba(0,0,0,.9) 0%, rgba(0,0,0,.6) 46%, rgba(0,0,0,0) 78%)"
		],
		/*
		 * The print grain is a monochrome feTurbulence clipped clear of
		 * the type column. Overlay over a black ground resolves to
		 * black, so this is visible only inside the wash — which is
		 * exactly where the sheet's grain is visible too.
		 */
		"grain": 0.18,
		"ink": "#ffffff",
		"text": "rgba(255,255,255,.88)",
		/* Sampled off the sheet's own URL line: #b98cff, 8.3:1 on #000. */
		"accent": "#b98cff",
		"rows": 5,
		"eyebrow": "Commit 4 · restored",
		"headline": "You removed the poster. We restored it.",
		"emphasis": "restored",
		"subline": "That's the whole event. Nothing you commit is ever really gone.",
		"dateLine": "1 September 2026",
		"venueLine": "10am to 5pm · AB-2 Auditorium",
		"unlisted": true
	},
	{
		"id": 34,
		"takedownNote": true,
		"layout": "hero-word",
		/*
		 * The "rip it down" sheet: one quiet wordmark row, the dare set
		 * as the largest type in the run, and the answer under it. The
		 * print tears along a dashed perforation across the exact
		 * vertical middle; the web sheet does not carry that rule, so
		 * the dare and the answer stack down a clear ground instead.
		 */
		"ground": "#050505",
		/*
		 * Read off gittyup26-ripitdown.png. No figure again: the sheet's
		 * whole ground is the headline's own misregistration bleeding
		 * into the field along the tear — red left, cyan right, both
		 * confined to a band across the middle. Measured at 46-54% down:
		 * #1e090e at the left trim, #09181b at the right, and #0a0809 in
		 * the centre where the two clear the type. Above 38% and below
		 * 63% the sheet is #050505 everywhere.
		 *
		 * Layer three is that centre. It is the sheet's own behaviour
		 * rather than an addition — the inks are strongest at the trim
		 * edges and give the middle up to the type — and it is what
		 * holds the hero and the headline off the colour. Measured on a
		 * text-free render of this stack at 1440x900, 1280x800,
		 * 768x1024 and 390x844, the strongest field the body copy can
		 * reach is #0f3a42 on the cyan side and #461319 on the red: the
		 * body colour reads 10.2:1 and 12.6:1 on them.
		 *
		 * The print's perforation was a fourth layer here, a dashed 2px
		 * rule full bleed to both trim edges at the vertical middle. It
		 * is gone: full bleed on the web means it ran through the copy
		 * column as well as the field, and the copy reflows, so at some
		 * viewport it always crossed a line of type. These three washes
		 * are the whole ground now.
		 */
		"layers": [
			"radial-gradient(44% 26% at 0% 50%, rgba(255,59,82,.26) 0%, rgba(255,59,82,.08) 46%, rgba(255,59,82,0) 78%)",
			"radial-gradient(44% 26% at 100% 50%, rgba(46,226,255,.24) 0%, rgba(46,226,255,.07) 46%, rgba(46,226,255,0) 78%)",
			"radial-gradient(62% 38% at 50% 50%, rgba(5,5,5,.82) 0%, rgba(5,5,5,.42) 48%, rgba(5,5,5,0) 80%)"
		],
		"grain": 0.12,
		"ink": "#ffffff",
		/*
		 * The print splits the headline into a red plate and a cyan one,
		 * offset 6px against a 258px line. A fill cannot offset a copy
		 * of itself, so the split is carried where it is visible anyway:
		 * as the two inks left standing at the ends of the run, white
		 * across everything between them.
		 */
		"inkGradient": "linear-gradient(100deg,#ff5a6e 0%,#ffb9c2 4%,#ffffff 12%,#ffffff 84%,#a8f0ff 93%,#2ee2ff 100%)",
		"text": "rgba(255,255,255,.9)",
		/* The sheet's accent is cyan, not the run's violet: #2ee2ff, 13:1 on #050505. */
		"accent": "#2ee2ff",
		"rows": 1,
		"eyebrow": "Backups exist",
		"headline": "It's under version control.",
		"emphasis": "version control",
		"heroWord": "Rip it down.",
		"subline": "Go ahead. There's a copy in the repo and another one on this wall.",
		"dateLine": "1 September 2026",
		"venueLine": "10am to 5pm · AB-2 Auditorium",
		"unlisted": true
	},
	{
		"id": 35,
		"layout": "wordmark-stack",
		/*
		 * The "waiting" sheet: a whole prismatic lift car standing dead
		 * centre of the page, doors open, empty, with a bracket off its
		 * call panel annotating `requested: 10:04 / arrived: 10:17`. Two
		 * wordmark rows above it and one line of copy below.
		 */
		"ground": "#050505",
		/*
		 * Genuine dispersion. Sampled down the uprights of
		 * gittyup26-liftwaiting.webp the fringe runs #0f3fff, #0f98f9,
		 * #19a1ff on one side and mauve #6e5265 on the other — a warm
		 * copy of every contour thrown one way and a cool one the other,
		 * which is what .poster-fringe answers.
		 */
		"image": "/events/gittyup26/chrome-lift-web.webp",
		"imageBlend": "screen",
		"imagePosition": "center",
		"dispersion": true,
		/*
		 * Read off gittyup26-liftwaiting.webp (1240x1754). The sheet is
		 * one object on an otherwise empty field: every column outside
		 * x 33-68% measures #050505 to #06080c, and every row outside
		 * y 29-73% the same. So the rebuild is a single centred column
		 * with nothing else in it, which is also the sheet's argument —
		 * the lift is the only centred thing on the page and everything
		 * typographic hangs off one left axis.
		 *
		 * Layer 2 is the car itself, mapped column by column off the
		 * sheet at 10px intervals: mauve at the left corner (#6e5265 at
		 * 33.1%), the lit uprights (#7e75a9 at 36.3%, #62697e at 41.1%,
		 * #576d89 at 44.4%), the deep blue back wall between them
		 * (#1a253f to #333959 across 46-58%), and the bright right corner
		 * (#6f7da5, then #b6c3d9 at 64.5%). Layers 3 and 4 are the
		 * ceiling light bar and its reflection in the floor, the two
		 * places the sheet reaches white.
		 *
		 * Each stop is the measured hue at a little over half strength
		 * rather than the measured colour flat, because these composite
		 * over each other and over the radial beneath. Set at the sheet's
		 * own values the stack came out half again as bright as the
		 * sheet, and the ceiling bar — a hot spot the print puts safely
		 * above its upper rule — landed on the headline on every phone
		 * viewport at 3.4:1.
		 *
		 * Layer 5 is the print's own pair of hairline rules, translated:
		 * on the sheet the artwork stops at two ruled lines and every
		 * word on the page is set on flat black outside them. A gradient
		 * back to the ground does the same job without ruling a bar
		 * across a page that reflows.
		 *
		 * Layers 6 and 7 are the scrims the print does not carry, and
		 * they are here for the reason page 4's is: the sheet never sets
		 * type over the car, and this layout does.
		 *
		 * They are two because the copy is in two different places. From
		 * `lg` up the headline and subline are in the left column at
		 * x 2.5-56%, y 62-85% — layer 7, the radial, is theirs. Below
		 * `lg` the page flows and the copy runs the full width at
		 * y 34-55%, straight across the car's brightest part, and no
		 * radial anchored to one side reaches it — layer 6, a full-width
		 * band, is that one. It costs the desktop view nothing visible
		 * because it lands on the car's own dark interior, which is the
		 * one part of the sheet that measures #1a253f rather than
		 * #6f7da5.
		 *
		 * Measured on a text-free render of this stack — the content
		 * layer hidden, the background screenshotted, sampled at the
		 * headline's and subline's own bounding boxes across fourteen
		 * viewports from 320x640 to 1920x1080 — the worst case is
		 * #565b64 at 320x640 and 5.73:1. Without layers 6 and 7 the same
		 * pixel is #656970 and 4.71:1.
		 */
		"layers": [
			"linear-gradient(180deg,#050505 0%,#050505 14%,rgba(5,5,5,.55) 19%,rgba(5,5,5,0) 25%,rgba(5,5,5,0) 68%,rgba(5,5,5,.5) 76%,rgba(5,5,5,.95) 84%,#050505 90%)",
			"linear-gradient(180deg, rgba(5,5,5,0) 28%, rgba(5,5,5,.40) 36%, rgba(5,5,5,.46) 46%, rgba(5,5,5,.40) 54%, rgba(5,5,5,0) 62%)",
			"radial-gradient(62% 34% at 16% 76%, rgba(5,5,5,.92) 0%, rgba(5,5,5,.58) 50%, rgba(5,5,5,0) 84%)",
			"radial-gradient(110% 70% at 46% 40%,rgba(5,5,5,.16) 0%,rgba(5,5,5,.82) 52%,#050505 84%)"
		],
		"grain": 0.14,
		"ink": "#e8eefb",
		"inkGradient": "linear-gradient(98deg,#e8eefb 0%,#6f7f9e 20%,#f2f7ff 40%,#4e5a75 56%,#e2ebfa 74%,#63718f 88%,#eef4ff 100%)",
		"text": "rgba(255,255,255,.88)",
		/* The sheet's own accent, sampled off its footer URL: ice cyan
		   #7ad4ff pulled from the dispersion in the uprights, 12.3:1 on
		   this ground. */
		"accent": "#7ad4ff",
		"rows": 2,
		"eyebrow": "requested 10:04 · arrived 10:17",
		"headline": "Waiting is the problem. git was built by people who hated waiting.",
		"emphasis": "hated waiting",
		"subline": "Thirteen minutes for one floor. Somebody once refused to wait that long for a file, and you have been using what they built ever since.",
		"dateLine": "1 September 2026",
		"venueLine": "10am to 5pm · AB-2 Auditorium",
		"unlisted": true
	},
	{
		"id": 36,
		"layout": "wordmark-stack",
		/*
		 * The "pending" sheet: the same lift car, but pushed off three
		 * edges so only the doorframe is lit, with a status block below
		 * the wordmark reading `lift/arrival — pending` and
		 * `you/version-control — pending` against two amber dots.
		 */
		"ground": "#050505",
		"image": "/events/gittyup26/chrome-lift-right.webp",
		"imageBlend": "screen",
		"imagePosition": "center",
		"dispersion": true,
		/*
		 * Read off gittyup26-liftpending.webp (1240x1754), sampled in
		 * bands the type does not cross — y 200-330, y 855-885 and
		 * y 1400-1470 — because a naive column mean here is measuring
		 * the white wordmark, not the sheet.
		 *
		 * Measured that way the sheet is far darker than it looks: the
		 * whole left two-thirds runs #050505 to #1d1d22, and everything
		 * right of 82% is #050505 exactly apart from the call panel. All
		 * of the sheet's light is in one narrow jamb between 68% and 82%,
		 * which is layer 2 — two stripes with a dead column between them,
		 * mapped at 10px intervals: #233e60, #88788b, #465b7c, #777d96,
		 * #7d97cb, #7880a7 down the near stripe, then #92626b and a
		 * near-white core #e9f7f8 at 79.8% down the far one. The warm
		 * rose and the blue on either side of that core are the same
		 * dispersion the sibling sheet has, thrown much harder.
		 *
		 * Layer 1 is the car's dark interior glass, which is all the left
		 * field has. Layer 3 is the call panel, floating free to the
		 * right of the jamb the way it does on the sheet (#221f32 to
		 * #8c95b1 across 88-96%, y 55-69%) — a radial rather than a
		 * banded gradient so it stays an object rather than a stripe.
		 *
		 * Layer 5 confines the jamb only at the very top and bottom; on
		 * the sheet it is genuinely full bleed.
		 *
		 * Layers 6 and 7 are the scrims, and 6 is the one that matters
		 * here. From `lg` up the copy is in the left column, which on
		 * this sheet is already black, and the jamb is behind the details
		 * panel — nothing needs holding and the desktop measurements are
		 * all around 15.8:1. Below `lg` the page flows, the copy runs the
		 * full width at y 34-55%, and it crosses the jamb's near-white
		 * core head on. Measured on a text-free render — the content
		 * layer hidden, sampled at the headline's and subline's own
		 * bounding boxes across fourteen viewports from 320x640 to
		 * 1920x1080 — the ground there without these two layers is
		 * #aab4bb and the subline falls to 1.98:1, with thirteen of the
		 * twenty-eight measurements under the 4.5:1 floor. With them the
		 * worst case is #4f5456 and 6.61:1, and none miss.
		 *
		 * The band sits at y 30-60% because that is where the copy lands
		 * on every viewport below `lg`, and because from `lg` up it is
		 * exactly the height the details panel occupies — so it dims the
		 * jamb only where the panel was covering it anyway.
		 */
		"layers": [
			"linear-gradient(180deg,#050505 0%,rgba(5,5,5,.62) 6%,rgba(5,5,5,0) 15%,rgba(5,5,5,0) 83%,rgba(5,5,5,.72) 92%,#050505 100%)",
			"linear-gradient(180deg, rgba(5,5,5,0) 25%, rgba(5,5,5,.5) 32%, rgba(5,5,5,.74) 44%, rgba(5,5,5,.74) 52%, rgba(5,5,5,.5) 60%, rgba(5,5,5,0) 66%)",
			"radial-gradient(88% 52% at 24% 64%, rgba(5,5,5,.86) 0%, rgba(5,5,5,.56) 48%, rgba(5,5,5,0) 84%)"
		],
		"grain": 0.16,
		"ink": "#ffffff",
		"text": "rgba(255,255,255,.9)",
		/* The sheet's URL is amber rather than the run's violet, and it is
		   the same amber as its two status dots — #d29922 against
		   #d0a94d sampled off the dots. Keeping it is what stops a second
		   hue getting onto a sheet whose only warm is those two marks.
		   8.1:1 on this ground, and the button inverts to 8.1:1 as well. */
		"accent": "#d29922",
		"rows": 4,
		"eyebrow": "lift/arrival · pending",
		"headline": "The lift is still pending. So is your knowledge of version control.",
		"emphasis": "pending",
		"subline": "Some checks haven't completed yet. Neither have you: expected, waiting for 1 September.",
		"dateLine": "1 September 2026",
		"venueLine": "10am to 5pm · AB-2 Auditorium",
		"unlisted": true
	},
];

/*
 * Reads ?pg= and resolves it to a poster.
 *
 * A valid number selects that poster, which is what the printed QR
 * codes rely on. Anything else — no query, a mistyped one, a smudged
 * code — picks at random, so the bare URL shows a different poster on
 * each visit rather than always the first.
 */
/*
 * Only the printed run is in the random pool. An unlisted sheet is
 * reachable by its own QR and by nothing else — opening /gittyup26 with
 * no query should not ask a stranger whether they have lost their car
 * keys.
 */
const randomPool = (): PosterVariant[] =>
	posterVariants.filter(
		(variant) => !variant.unlisted,
	);

export const variantFromParam = (
	value: string | null,
): PosterVariant => {
	const page = Number(value);

	const valid =
		value !== null &&
		value.trim() !== '' &&
		Number.isInteger(page) &&
		page >= 1 &&
		page <= posterVariants.length;

	if (valid) {
		const chosen = posterVariants[page - 1];

		/*
		 * Scanning a sheet counts as seeing it, so it is struck from
		 * the cycle — opening the bare URL afterwards should not hand
		 * back the poster still in their hand.
		 */
		notePosterSeen(
			chosen.id,
			randomPool().map(
				(variant) => variant.id,
			),
		);

		return chosen;
	}

	const pool = randomPool();

	/*
	 * Dealt from a shuffled bag rather than drawn at random, so all
	 * thirty are seen before any is seen twice and the same sheet can
	 * never come up two visits running. See posterShuffle.
	 */
	const id = takeNextPosterId(
		pool.map((variant) => variant.id),
	);

	return (
		pool.find(
			(variant) => variant.id === id,
		) ?? pool[0]
	);
};
