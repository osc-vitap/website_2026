---
name: event-page
description: Build a standalone event landing page for oscvitap.com from an event poster. Use when a new OSC event is announced and needs its own page at oscvitap.com/<event-slug> with a Register Now button. Triggers on "make an event page", "add the poster page for <event>", "new event landing page".
---

# Event page from a poster

You are building a single-screen landing page for one Open Source Community
(VIT-AP) event. The page lives at `oscvitap.com/<slug>`, carries the visual
identity of that event's poster, and sends people into the registration form.

The design changes for every event. The plumbing never does. Read the poster,
derive the design from it, and wire it up the same way each time.

## Inputs you need

Ask for whatever is missing before you start:

- **The poster image** — the design source of truth.
- **Event name** and the **URL slug** (usually printed on the poster, e.g.
  `oscvitap.com/gittyup26` → slug `gittyup26`).
- **Date, time, venue.**
- **A description** — the announcement email or blurb.
- **Registration slug** — the `slug` of the event row in D1. Normally the same
  as the URL slug.

## Read the poster first

Before writing any code, look at the poster and write down, in a sentence or
two each:

- **Palette** — the ground, the ink, the accent. Pull real hex values from the
  image rather than approximating from memory. Note the gradient direction.
- **Type** — the typeface's category (geometric grotesque, neo-grotesque, slab,
  display), and the weight contrast the poster leans on. The posters are set in
  **Objectivity**, already self-hosted at `public/fonts/objectivity/` and
  available as `font-poster`. It ships as static weights, so only 100, 300,
  400, 500, 700 and 900 exist — use `font-thin`, `font-light`, `font-normal`,
  `font-medium`, `font-bold`, `font-black` and nothing in between, or the
  browser synthesises a weight and the wordmark goes soft. If a poster genuinely
  uses a different face, self-host it the same way rather than hotlinking a CDN,
  and check the licence allows it. Never let a face fall back silently.
- **Motifs** — the structural devices: a repeated wordmark, a halftone field, a
  grid, a rule, an oversized numeral, a shape that means something for the
  subject. These are what make the page read as the same artefact as the poster.
- **Hierarchy** — what the poster shows first, second, third. Keep that order.

State the palette, type and motifs as a short plan, then build to it. If your
plan would work equally well for any other event, it is too generic — go back
to the poster.

## Build it

Create `src/pages/events/<PascalCaseSlug>.tsx`. Use the three shared helpers,
and design everything else yourself:

- `useEventPageMeta(title, description)` from `./useEventPageMeta` — sets the
  document title and meta description while the page is mounted.
- `<EventPageFrame>` from `./eventPageKit` — the viewport-fitting shell.
- `<RegisterLink registrationSlug="...">` from `./eventPageKit` — the link into
  `/events/<registrationSlug>/register`.

Keep hooks and components in separate modules; `npm run lint` fails the build
when one file exports both, because it breaks Fast Refresh.

Then add one entry to `eventPages` in `src/data/eventPages.ts`, and a `<url>`
entry to `public/sitemap.xml`.

### Rules

1. **One screen.** The page is locked to the viewport from `lg` up and flows
   normally below it. Size display type with viewport-aware `clamp()` — e.g.
   `text-[clamp(3rem,13vw,7.5rem)] lg:text-[min(8.5vw,12.5vh)]` — so it fills a
   wide screen without overflowing a short one. Never let the call to action get
   clipped; on a phone it is fine for the page to scroll.
2. **Register Now is mandatory** and must be visible without scrolling on
   desktop. It is the one thing the page exists to do.
3. **Commit to the poster's world.** These pages are single-theme by design —
   do not add a light/dark variant. The poster is the theme.
4. **Real content only.** Date, time, venue and the description come from the
   brief. No placeholder copy, no invented speakers, sponsors or logos. If the
   poster shows partner logos you do not have image files for, leave them out
   and say so rather than faking them.
5. **Assets** live in `public/`. The OSC mark is `/events/favicon.png`. Do not
   hotlink external images.
6. **Slugs** must avoid `RESERVED_SLUGS` in `src/data/eventPages.ts` — an event
   route is matched before the site's own routes and would shadow them.
7. **Accessibility.** Decorative layers get `aria-hidden="true"`; the CTA gets a
   visible `focus-visible` state; text must clear 4.5:1 against its ground —
   check the ink colour against the gradient's lightest and darkest points.
8. Match the file conventions already in `src/pages/events/`.

## Several posters for one event

When an event prints more than one poster design, each gets its own QR code
pointing at `?pg=N`, and the page renders a matching variant. `?pg=` is read in
the page component and resolved against a variants file (see
`src/pages/events/gittyUp26Variants.ts`); an absent or out-of-range value falls
back to the first variant, so a smudged QR still lands somewhere.

Once the pages exist, the posters need QR codes that actually encode those
URLs — see [references/poster-qr-prompt.md](references/poster-qr-prompt.md) for
a prompt to hand back to the design tool, and how to verify before printing.

## Create the event in D1

The Register button is dead until the event row exists. Create it through the
admin dashboard, or insert it directly:

```sql
INSERT INTO events (
  id, slug, title, sub_title, description, venue,
  event_date, event_end_at, image, is_open,
  registration_type, min_team_size, max_team_size,
  registration_deadline, archive_status
) VALUES (
  '<uuid>', '<slug>', '<Title>', '<Sub title>', '<Description>', '<Venue>',
  '<YYYY-MM-DD>', '<YYYY-MM-DDTHH:MM:SSZ>', NULL, 1,
  'workshop', 1, 1, NULL, 'pending'
);
```

`event_end_at` is UTC and drives both the "already ended" rejection on
registration and the scheduled archive job — convert from IST (subtract 5:30).
`registration_type` is `solo`, `team` or `workshop`.

## Before you call it done

```bash
npm run lint
npx tsc --noEmit
npm run build
```

Then check the real page: the route resolves, the Register button lands on the
registration form, the form loads the event from the API, and the layout holds
at 1280×800, 1920×1080 and 390×844. Report anything you could not verify.
