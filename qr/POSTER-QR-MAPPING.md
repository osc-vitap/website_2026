# Poster QR codes — verified mapping

The finalised posters carry their QR codes and every one of them has been
decoded back from the artwork. This file records what the printed sheets
actually encode, so the print run and the site can be checked against
each other without opening a design tool.

## The run is 23 posters, not 30

The brief that generated these codes asked for thirty. The finalised
export in `Event Poster Design Directions(2)/export` contains
twenty-three, named `gittyup26-1a` to `gittyup26-1q` and `gittyup26-2a`
to `gittyup26-2f`.

The pages followed: `POSTER_COUNT` is 23, variants 24 to 30 have been
removed, and the footline on every page reads `NN/23`. Those seven
designs were never printed, no QR points at them, and a visitor landing
on `?pg=24` would otherwise have seen a poster that does not exist.

## Verified mapping

Decoded from the artwork with `jsqr`, all twenty-three read first time.
Every code resolves to its own page, the numbering is contiguous from 1
to 23, and no two encode the same URL.

| File | Page | Encodes |
| --- | --- | --- |
| `gittyup26-2a.png` | 1 | `https://www.oscvitap.com/gittyup26?pg=1` |
| `gittyup26-2b.png` | 2 | `https://www.oscvitap.com/gittyup26?pg=2` |
| `gittyup26-2c.png` | 3 | `https://www.oscvitap.com/gittyup26?pg=3` |
| `gittyup26-2d.png` | 4 | `https://www.oscvitap.com/gittyup26?pg=4` |
| `gittyup26-2e.png` | 5 | `https://www.oscvitap.com/gittyup26?pg=5` |
| `gittyup26-2f.png` | 6 | `https://www.oscvitap.com/gittyup26?pg=6` |
| `gittyup26-1a.png` | 7 | `https://www.oscvitap.com/gittyup26?pg=7` |
| `gittyup26-1b.png` | 8 | `https://www.oscvitap.com/gittyup26?pg=8` |
| `gittyup26-1c.png` | 9 | `https://www.oscvitap.com/gittyup26?pg=9` |
| `gittyup26-1d.png` | 10 | `https://www.oscvitap.com/gittyup26?pg=10` |
| `gittyup26-1e.png` | 11 | `https://www.oscvitap.com/gittyup26?pg=11` |
| `gittyup26-1f.png` | 12 | `https://www.oscvitap.com/gittyup26?pg=12` |
| `gittyup26-1g.png` | 13 | `https://www.oscvitap.com/gittyup26?pg=13` |
| `gittyup26-1h.png` | 14 | `https://www.oscvitap.com/gittyup26?pg=14` |
| `gittyup26-1i.png` | 15 | `https://www.oscvitap.com/gittyup26?pg=15` |
| `gittyup26-1j.png` | 16 | `https://www.oscvitap.com/gittyup26?pg=16` |
| `gittyup26-1k.png` | 17 | `https://www.oscvitap.com/gittyup26?pg=17` |
| `gittyup26-1l.png` | 18 | `https://www.oscvitap.com/gittyup26?pg=18` |
| `gittyup26-1m.png` | 19 | `https://www.oscvitap.com/gittyup26?pg=19` |
| `gittyup26-1n.png` | 20 | `https://www.oscvitap.com/gittyup26?pg=20` |
| `gittyup26-1o.png` | 21 | `https://www.oscvitap.com/gittyup26?pg=21` |
| `gittyup26-1p.png` | 22 | `https://www.oscvitap.com/gittyup26?pg=22` |
| `gittyup26-1q.png` | 23 | `https://www.oscvitap.com/gittyup26?pg=23` |

Note that the `2*` sheets come first: the second design turn produced
pages 1 to 6 and the first turn produced 7 to 23. The filenames are not
in page order, which is exactly why this table is decoded from the codes
themselves rather than assumed from the names.

## Re-checking

```
node scripts/verify-poster-qr.mjs
```

Decode from the artwork rather than from the generated `qr/*.png`: what
matters is what the printed sheet encodes, not what was handed over. If
a poster is ever re-exported, decode it again before it goes to print —
a code that renders is not a code that resolves.
