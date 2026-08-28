# Poster QR codes — verified mapping

Decoded from the print masters themselves, not from the generated
`qr/*.png` handover files. What matters is what the sheet that goes to
the printer actually encodes.

## The run is 36 posters

Thirty numbered sheets, then six named ones designed after them. All
thirty-six QR codes decode from their own artwork and resolve to `?pg=1`
through `?pg=36`, every value present exactly once and contiguous.

An earlier version of this file said 23, taken from a 23-file export
folder that turned out to be a partial hand-off. The site was trimmed to
match it, which left seven printed posters — the ones encoding pg 24 to
30 — pointing at pages that had been deleted. A scan of any of those
landed on a random poster instead. All the variants are restored.

## The six named sheets are 31-36

They were laid out by hand, one at a time, after the numbered run had
gone to print, and they carry their design name rather than a number.
The page each one belongs to is not a matter of record-keeping: it is
decoded from the sheet's own QR.

| pg | Sheet | Master |
| --- | --- | --- |
| 31 | car keys | `gittyup26-carkey.png` |
| 32 | should've committed earlier | `gittyup26-committed.png` |
| 33 | restored | `gittyup26-restored.png` |
| 34 | rip it down | `gittyup26-ripitdown.png` |
| 35 | lift waiting | `gittyup26-liftwaiting.png` |
| 36 | lift pending | `gittyup26-liftpending.png` |

All six are `unlisted` in `posterVariants.ts`, which keeps them out of
the random deal and off the printed `NN/30` counter. They are still
reachable at the page their QR encodes — that is the whole point of
them — and `POSTER_COUNT` is derived from the listed variants so adding
another named sheet cannot silently change the counter.

## Page order is not pg order

The numbered document opens on pg 7 and wraps around: pages 1-24 carry
pg 7-30, then pages 25-30 carry pg 1-6. That is the same "second design
turn first" pattern the earlier hand-off had, and it is why this table
is decoded rather than assumed from position.

| PDF page | pg | Encodes |
| --- | --- | --- |
| 1 | 7 | `https://www.oscvitap.com/gittyup26?pg=7` |
| 2 | 8 | `https://www.oscvitap.com/gittyup26?pg=8` |
| 3 | 9 | `https://www.oscvitap.com/gittyup26?pg=9` |
| 4 | 10 | `https://www.oscvitap.com/gittyup26?pg=10` |
| 5 | 11 | `https://www.oscvitap.com/gittyup26?pg=11` |
| 6 | 12 | `https://www.oscvitap.com/gittyup26?pg=12` |
| 7 | 13 | `https://www.oscvitap.com/gittyup26?pg=13` |
| 8 | 14 | `https://www.oscvitap.com/gittyup26?pg=14` |
| 9 | 15 | `https://www.oscvitap.com/gittyup26?pg=15` |
| 10 | 16 | `https://www.oscvitap.com/gittyup26?pg=16` |
| 11 | 17 | `https://www.oscvitap.com/gittyup26?pg=17` |
| 12 | 18 | `https://www.oscvitap.com/gittyup26?pg=18` |
| 13 | 19 | `https://www.oscvitap.com/gittyup26?pg=19` |
| 14 | 20 | `https://www.oscvitap.com/gittyup26?pg=20` |
| 15 | 21 | `https://www.oscvitap.com/gittyup26?pg=21` |
| 16 | 22 | `https://www.oscvitap.com/gittyup26?pg=22` |
| 17 | 23 | `https://www.oscvitap.com/gittyup26?pg=23` |
| 18 | 24 | `https://www.oscvitap.com/gittyup26?pg=24` |
| 19 | 25 | `https://www.oscvitap.com/gittyup26?pg=25` |
| 20 | 26 | `https://www.oscvitap.com/gittyup26?pg=26` |
| 21 | 27 | `https://www.oscvitap.com/gittyup26?pg=27` |
| 22 | 28 | `https://www.oscvitap.com/gittyup26?pg=28` |
| 23 | 29 | `https://www.oscvitap.com/gittyup26?pg=29` |
| 24 | 30 | `https://www.oscvitap.com/gittyup26?pg=30` |
| 25 | 1 | `https://www.oscvitap.com/gittyup26?pg=1` |
| 26 | 2 | `https://www.oscvitap.com/gittyup26?pg=2` |
| 27 | 3 | `https://www.oscvitap.com/gittyup26?pg=3` |
| 28 | 4 | `https://www.oscvitap.com/gittyup26?pg=4` |
| 29 | 5 | `https://www.oscvitap.com/gittyup26?pg=5` |
| 30 | 6 | `https://www.oscvitap.com/gittyup26?pg=6` |
| — | 31 | `https://www.oscvitap.com/gittyup26?pg=31` |
| — | 32 | `https://www.oscvitap.com/gittyup26?pg=32` |
| — | 33 | `https://www.oscvitap.com/gittyup26?pg=33` |
| — | 34 | `https://www.oscvitap.com/gittyup26?pg=34` |
| — | 35 | `https://www.oscvitap.com/gittyup26?pg=35` |
| — | 36 | `https://www.oscvitap.com/gittyup26?pg=36` |

The named six were never in the numbered document, which is why they
have no PDF page.

## Where the masters live

In R2, under `posters/` in the `osc-events-archives` bucket, reachable
through the admin panel. Half a gigabyte of A3-at-300dpi PNG does not
belong in git, where every clone would carry it forever. The panel also
serves two small renders of each sheet from `posters/thumb/` and
`posters/preview/`, so the grid can be looked at without pulling the
masters.

`public/posters/` holds only the six named sheets and their QR sources.
It once also held four loose copies of numbered sheets — pg13, 19, 20
and 26 — left over from a manual export. Two of them still read
29 August, and because `public/` is Vite's static directory they were
being deployed and were reachable on the live site. They are gone.

## Re-checking

```
node scripts/verify-poster-qr.mjs
```

Decodes all thirty-six QR sources in the repo — `qr/` for the numbered
run, `public/posters/qr-*.png` for the named six — checks each against
the page it is supposed to be for, and checks the set covers 1 to 36
with no gap and no repeat. Uniqueness alone is not enough: thirty-six
codes can all be different, all valid, and still leave one page
unprinted and another printed twice.

That checks the sources. It does not check the sheets, and the sheet is
what goes on the wall — a code that is right on disk and wrong on the
poster is the failure worth catching. Decoding the masters means pulling
them from R2, so it is not a repo script; do it whenever a sheet is
re-exported, before it goes to print, and confirm the page it opens
still exists and still names the right date.
