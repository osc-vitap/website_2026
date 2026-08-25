# Prompt: give every poster its own QR code

When an event prints several poster designs, each one should carry a QR code
pointing at its own variant of the web page (`?pg=N`), so scanning the poster in
front of you lands on the page that matches it.

Paste the prompt below into the Claude Design session holding the posters,
adjusting the URL, the poster count and the numbering rule.

---

## The prompt

> Every poster in this document currently shows one of the pre-rendered QR
> images (`assets/qr-cold.png`, `qr-neutral.png`, `qr-teal.png`, `qr-violet.png`,
> `qr-warm.png`). They all encode the same bare URL, so a scan cannot tell the
> posters apart.
>
> Replace them so that each poster encodes its own URL:
>
>     https://www.oscvitap.com/gittyup26?pg=N
>
> where **N is the poster's position in this document, counting from 1, in the
> order the posters appear**. Number every poster in the file, including the
> "Turn 1" set and the "Turn 2" set, in a single continuous sequence. Do not
> skip, reuse or reorder numbers — the web page reads `pg` directly and a
> duplicate means two posters lead to the same design.
>
> Requirements:
>
> - **Generate each QR at render time** rather than reusing the static PNGs.
>   Encode the full URL including `https://`.
> - **Error correction level M**, with the standard 4-module quiet zone kept
>   clear. Nothing may overlap the quiet zone.
> - **Keep the existing tints.** Each poster's QR currently matches its palette
>   (cold / neutral / teal / violet / warm). Preserve that per-poster tint by
>   recolouring the generated modules — dark modules in the poster's ink colour,
>   light modules in the poster's ground colour. Contrast between the two must
>   stay above 3:1 or scanners will fail; if a tint pairing is too close, use
>   the poster's darkest ink on white instead and tell me which posters you
>   changed.
> - **Size.** The canvas is 2480×3508 at 300 DPI, so 11.81px = 1mm. The QRs are
>   currently about 196px, which is 16.6mm. The URL is longer now, so at error
>   correction M this is a 29×29-module symbol — about 0.57mm per module, which
>   is tight for a poster read at arm's length. **Render them at 240px (20.3mm)
>   or larger**, keeping the existing position and alignment. Tell me if that
>   collides with any poster's layout instead of silently shrinking it back.
> - **Add the URL in text** immediately under or beside each QR, at a legible
>   size, in the poster's body colour: `oscvitap.com/gittyup26?pg=N`. If a scan
>   fails, someone can still type it.
>
> When you are done, list every poster with the number you assigned and the
> exact URL it encodes, so I can check the sequence has no gaps or duplicates
> before anything goes to print.

---

## Verifying before print

Decode the exported artwork rather than trusting the render — a QR that looks
right can still encode the wrong string.

1. Export the posters as images.
2. Decode each one (any phone camera, or a batch decoder) and confirm the `pg`
   value matches the poster's position.
3. Open two or three of the decoded URLs and confirm the page variant matches
   the poster in hand.

A mismatch found now is a re-export. Found after printing, it is a reprint.
