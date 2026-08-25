# Replace the QR codes — poster by poster

Thirty QR code images are attached, one per poster. Each encodes that
poster's own page, so scanning the sheet in front of you opens the design
you are holding. They are already generated, decoded and checked: every
file resolves to its own poster number and no two encode the same URL.

**Do not regenerate them.** Place the supplied images. Regenerating risks
a mismatch between what a poster shows and what it encodes, and that is a
reprint rather than a re-export.

## What to do

For each poster in this document, replace its current `assets/qr-*.png`
image with the file named for that poster in the table below.

Match by the poster's **position in this document, counting from 1, in
the order the posters appear** — the same continuous numbering across the
"Turn 1" set and the "Turn 2" set. The table's headline column is there
so you can confirm you are on the right poster before swapping the image:
if the line on the poster does not match the line in the table, stop and
tell me rather than guessing.

## Placement

- Keep each QR where it already sits and keep its alignment.
- **Render at 240px or larger.** The current codes are about 196px, which
  is 16.6mm at this document's 300 DPI. The encoded URL is longer now, so
  at error correction H the symbol is denser and 196px leaves each module
  under half a millimetre — unreliable at arm's length. If 240px collides
  with a layout, tell me which posters rather than shrinking it back.
- Keep the quiet zone clear. Nothing may overlap the white margin.
- The supplied codes are black on white. Several posters previously
  tinted their code to the poster palette — do not re-tint these. The
  OSC mark is inset at 43% with the dots cleared behind it, which already
  costs error-correction headroom; recolouring on top of that is what
  makes a code fail under bad lighting. Black on white is the reliable
  choice, and the codes read as a deliberate white patch on the design.
- Put the URL in text beside or under each code, in the poster's body
  colour: `oscvitap.com/gittyup26?pg=N`. If a scan fails, someone can
  still type it.

## The mapping

The tint column records which `qr-*.png` each poster used before, so you
can find the image you are replacing.

| # | Use this file | Encodes | Was using | Poster line |
|---|---|---|---|---|
| 01 | `gittyup26-poster-01.png` | `https://www.oscvitap.com/gittyup26?pg=1` | qr-cold | You inherited a solution. Come meet the problem. |
| 02 | `gittyup26-poster-02.png` | `https://www.oscvitap.com/gittyup26?pg=2` | qr-neutral | Undo is a design decision. |
| 03 | `gittyup26-poster-03.png` | `https://www.oscvitap.com/gittyup26?pg=3` | qr-teal | Nobody remembers the workaround. Everybody uses the fix. |
| 04 | `gittyup26-poster-04.png` | `https://www.oscvitap.com/gittyup26?pg=4` | qr-violet | First they lost the work. Then they built git. |
| 05 | `gittyup26-poster-05.png` | `https://www.oscvitap.com/gittyup26?pg=5` | qr-cold | Your remote can live in your room. |
| 06 | `gittyup26-poster-06.png` | `https://www.oscvitap.com/gittyup26?pg=6` | qr-warm | The graph came before the command. |
| 07 | `gittyup26-poster-07.png` | `https://www.oscvitap.com/gittyup26?pg=7` | qr-violet | Somebody had to invent undo. |
| 08 | `gittyup26-poster-08.png` | `https://www.oscvitap.com/gittyup26?pg=8` | qr-neutral | Your history should answer to you. |
| 09 | `gittyup26-poster-09.png` | `https://www.oscvitap.com/gittyup26?pg=9` | qr-teal | Someone had to decide what a version was. |
| 10 | `gittyup26-poster-10.png` | `https://www.oscvitap.com/gittyup26?pg=10` | qr-violet | Every commit has an ancestor. |
| 11 | `gittyup26-poster-11.png` | `https://www.oscvitap.com/gittyup26?pg=11` | qr-violet | Copies of copies of copies. Then git. |
| 12 | `gittyup26-poster-12.png` | `https://www.oscvitap.com/gittyup26?pg=12` | qr-neutral | Undo was not always free. |
| 13 | `gittyup26-poster-13.png` | `https://www.oscvitap.com/gittyup26?pg=13` | qr-neutral | Every tool you trust was once a workaround. |
| 14 | `gittyup26-poster-14.png` | `https://www.oscvitap.com/gittyup26?pg=14` | qr-violet | Before git, there was a problem worth solving. |
| 15 | `gittyup26-poster-15.png` | `https://www.oscvitap.com/gittyup26?pg=15` | qr-warm | Undo has an origin story. |
| 16 | `gittyup26-poster-16.png` | `https://www.oscvitap.com/gittyup26?pg=16` | qr-cold | History is a data structure. |
| 17 | `gittyup26-poster-17.png` | `https://www.oscvitap.com/gittyup26?pg=17` | qr-violet | You type it every day. Somebody had to invent it. |
| 18 | `gittyup26-poster-18.png` | `https://www.oscvitap.com/gittyup26?pg=18` | qr-neutral | Somebody had to invent undo. |
| 19 | `gittyup26-poster-19.png` | `https://www.oscvitap.com/gittyup26?pg=19` | qr-neutral | Someone had to lose work first. |
| 20 | `gittyup26-poster-20.png` | `https://www.oscvitap.com/gittyup26?pg=20` | qr-cold | The problem came first. The tool came later. |
| 21 | `gittyup26-poster-21.png` | `https://www.oscvitap.com/gittyup26?pg=21` | qr-violet | Every shortcut you type was once an argument. |
| 22 | `gittyup26-poster-22.png` | `https://www.oscvitap.com/gittyup26?pg=22` | qr-violet | Merge conflicts are older than you think. |
| 23 | `gittyup26-poster-23.png` | `https://www.oscvitap.com/gittyup26?pg=23` | qr-cold | Somebody had to name the branch. |
| 24 | `gittyup26-poster-24.png` | `https://www.oscvitap.com/gittyup26?pg=24` | qr-violet | The repo is yours. The server can be too. |
| 25 | `gittyup26-poster-25.png` | `https://www.oscvitap.com/gittyup26?pg=25` | qr-violet | Before the graph, there was only the file. |
| 26 | `gittyup26-poster-26.png` | `https://www.oscvitap.com/gittyup26?pg=26` | qr-neutral | Somebody had to invent history. |
| 27 | `gittyup26-poster-27.png` | `https://www.oscvitap.com/gittyup26?pg=27` | qr-warm | The workaround came first. |
| 28 | `gittyup26-poster-28.png` | `https://www.oscvitap.com/gittyup26?pg=28` | qr-neutral | Git won. But why? |
| 29 | `gittyup26-poster-29.png` | `https://www.oscvitap.com/gittyup26?pg=29` | qr-violet | A remote you own. |
| 30 | `gittyup26-poster-30.png` | `https://www.oscvitap.com/gittyup26?pg=30` | qr-violet | The fix is famous. The problem is not. |

## Before you hand it back

List every poster with the file you placed and the URL it encodes, so the
sequence can be checked for gaps and duplicates. Then export and decode a
few of the exported images — not the live preview — to confirm the code
survived export at the size it was placed.
