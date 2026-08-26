# Poster QR codes — verified mapping

Decoded from the final print PDF, not from the generated `qr/*.png`
handover files. What matters is what the sheet that goes to the printer
actually encodes.

## The run is 30 posters

All thirty QR codes read first time. They resolve to `?pg=1` through
`?pg=30`, every value present exactly once and contiguous.

An earlier version of this file said 23, taken from a 23-file export
folder that turned out to be a partial hand-off. The site was trimmed to
match it, which left seven printed posters — the ones encoding pg 24 to
30 — pointing at pages that had been deleted. A scan of any of those
landed on a random poster instead. All thirty variants are restored and
`POSTER_COUNT` is 30 again.

## Page order is not pg order

The document opens on pg 7 and wraps around: pages 1-24 carry pg 7-30,
then pages 25-30 carry pg 1-6. That is the same "second design turn
first" pattern the earlier hand-off had, and it is why this table is
decoded rather than assumed from position.

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

## Re-checking

Decode from the artwork itself, not from the handover PNGs:

```
node scripts/verify-poster-qr.mjs
```

A code that renders is not a code that resolves. If any poster is ever
re-exported, decode it again before it goes to print, and confirm the
page it points at still exists on the site.
