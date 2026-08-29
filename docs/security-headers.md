# Security headers

`vercel.json` is JSON, so it cannot carry comments — a `"//"` key looks
harmless but Vercel validates the config against a schema that forbids
unknown properties, and the whole deployment is rejected. The reasoning
for each header lives here instead.

## Why each one is set

**`X-Frame-Options: DENY`** and **`frame-ancestors 'none'`** — the admin
dashboard was framable. A page elsewhere could load `/admin` in an
invisible iframe over its own UI and harvest clicks from a signed-in
admin; the destructive controls there delete an event, every
registration for it, and the R2 archive in one action. Both headers say
the same thing for browsers that prefer one or the other.

**`Content-Security-Policy`** — `connect-src` has to name
`https://events.oscvitap.com` explicitly, because the Worker is a
different origin from the site. `style-src` allows `'unsafe-inline'`
because framer-motion writes inline styles for animation; script-src
does not, which is the part that matters. `img-src` allows `https:`
because event images may be hosted anywhere, including the Unsplash URLs
some seeded events still use.

**`Strict-Transport-Security`** — `includeSubDomains` was missing, so
`events.oscvitap.com` was not covered by the site's HSTS policy. Not
added to the preload list: preloading is very hard to undo and should be
a deliberate decision.

**`Permissions-Policy`** — the microphone and location are switched off,
because nothing here uses them and saying so is better than leaving it to
the default.

The camera is `self` rather than off. `/scan` is the door scanner for
event entry: it holds one camera stream and decodes the QR on the phone,
so no frame is ever uploaded. This was `camera=()` until then, which
blocks `getUserMedia` outright, before the browser ever asks the person
for permission — the scanner would have failed on event day with a
permission error that no amount of tapping "allow" could fix.

`self` is not a grant. It says a same-origin page may *ask*; the browser
still prompts, and every other origin, including anything framed, stays
blocked. Narrow it back to `camera=()` if `/scan` is ever removed.

**`worker-src` and `media-src`** — the scanner decodes in a Web Worker
and paints frames to a canvas. `default-src 'self'` already covered the
worker, but only because it is loaded from a real URL; both are named
explicitly so that stays true if anyone reaches for a blob worker later,
which `'self'` alone would reject.

**`X-Content-Type-Options: nosniff`** — the SPA rewrite answers unknown
paths with `index.html`, so a request for `/something.js` that does not
exist returns HTML. Without nosniff a browser may sniff that as script.

## Caching

`/assets/*` and `/fonts/*` are content-hashed by Vite, so a given URL's
bytes never change and they can be immutable for a year. They were being
revalidated on every page load. Do not extend this to `/index.html` —
that filename is stable and must stay revalidated, or a deploy would
never reach anyone.

## Checking a change

The schema rejects unknown keys anywhere in `headers`, and a rejected
config means the site silently keeps serving the previous deployment.
Before pushing a change to `vercel.json`:

```
npx vercel build
```

or verify the headers reached production afterwards:

```
curl -sS -D - -o /dev/null https://www.oscvitap.com/ | grep -iE '^(content-security|x-frame|strict-transport)'
```
