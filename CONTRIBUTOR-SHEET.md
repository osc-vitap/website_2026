# Contributor Sheet

Everything you need to make your first change to the OSC VIT-AP website.
Read the part you need. You do not have to read all of it.

If something here is wrong or missing, fixing this file is a good first
pull request.

---

## 1. How to contribute

You cannot push to this repo directly. You work on your own copy and
send us a pull request. This is normal for open source.

**Step 1. Fork it.**
Open <https://github.com/osc-vitap/website_2026> and click **Fork** at
the top right. This makes a copy under your own GitHub account.

**Step 2. Clone your fork.**

```bash
git clone https://github.com/YOUR-USERNAME/website_2026.git
cd website_2026
```

**Step 3. Point at the original repo too.**
This lets you pull in other people's changes later.

```bash
git remote add upstream https://github.com/osc-vitap/website_2026.git
```

**Step 4. Make a branch.**
Never work on `main`. Name the branch after what you are doing.

```bash
git checkout -b fix-team-page-spacing
```

**Step 5. Do the work.** Then check it (see section 8).

**Step 6. Commit and push to your fork.**

```bash
git add .
git commit -m "fix: correct spacing on the team page"
git push origin fix-team-page-spacing
```

**Step 7. Open the pull request.**
Go to your fork on GitHub. It will show a banner asking if you want to
open a pull request. Click it. Make sure the target is
`osc-vitap/website_2026` and the branch is `main`.

Fill in the template. There is a copy in section 9.

**Step 8. Wait for checks.**
GitHub runs lint, type checks, a build and the Worker tests. If any go
red, click **Details** to see why, fix it, and push again. The same pull
request updates itself.

### Keeping your fork fresh

If your branch falls behind:

```bash
git fetch upstream
git rebase upstream/main
```

---

## 2. Run it on your machine

You need Node 22 or newer.

**The website:**

```bash
npm install
npm run dev
```

Open <http://localhost:5173>.

Most changes stop here. You only need the next part if you are changing
something under `osc-events-worker/`.

**The API:**

```bash
cd osc-events-worker
npm install
npm run dev
```

That runs on <http://localhost:8787>. It uses a local database on your
own machine, not the real one, so it starts empty. You cannot break
anything from here.

Some things will not work locally, and that is expected. Admin sign in
needs GitHub OAuth keys that are not in the repo. The poster files live
in Cloudflare storage you do not have keys for. Seat confirmation emails
are skipped without mail settings, though the booking itself still works.
Everything else, including the whole registration flow, works.

If you are changing API behaviour, the tests are the way to check it:

```bash
npx vitest run
```

To make the website talk to your local API instead of the live one,
make a file called `.env.local` in the project root:

```
VITE_API_BASE_URL=http://localhost:8787
```

Delete that file when you are done. It is ignored by git.

---

## 3. What lives where

| Folder | What is in it |
| --- | --- |
| `src/pages/` | One file per page (Home, Team, Events, and so on) |
| `src/components/` | Pieces reused across pages (navbar, footer, banner) |
| `src/data/` | Content and settings. Most edits go here |
| `src/pages/events/` | Standalone event pages like `/gittyup26` |
| `src/pages/SeatingPage.tsx` | The seat map at `/seat-reservation-gittyup26` |
| `public/` | Images and files served as they are |
| `osc-events-worker/` | The API. Runs on Cloudflare, not Vercel |
| `osc-events-worker/migrations/` | Database changes, in order |
| `scripts/` | One off tools you run by hand |
| `qr/` | Poster QR codes and the mapping doc |

The website is on Vercel. The API is on Cloudflare. They deploy
separately.

---

## 4. Changing content without touching code

Most updates need no React at all.

| I want to | Open this |
| --- | --- |
| Turn the top banner on or off | `src/data/config.ts` |
| Add or edit an event card | `src/data/eventsData.ts` |
| Add a project | `src/data/projectsData.ts` |
| Add a team member | `src/data/teamData.ts` |
| Add a gallery photo | `src/data/galleryData.ts` |
| Add a standalone event page | `src/data/eventPages.ts` |

Images go in `public/`. Reference them from the root, so a file at
`public/team/alex.jpg` is written as `/team/alex.jpg`.

---

## 5. The API

Base URL in production: `https://events.oscvitap.com`

Everything returns JSON. Errors look like `{"error": "..."}`.

Only these origins may call it from a browser: `oscvitap.com`,
`www.oscvitap.com`, `localhost:5173` and `127.0.0.1:5173`. Anything else
is blocked by the browser.

### Open to everyone

| Method | Path | What it does |
| --- | --- | --- |
| GET | `/api/health` | Returns `{"status":"ok"}`. Use it to check the API is up |
| GET | `/api/events` | Every event. Add `?include_archived=1` to include old ones |
| GET | `/api/events/:slug` | One event. 404 if the slug is unknown |
| POST | `/api/events/:slug/register` | Signs a person or team up |
| GET | `/api/events/:slug/seats` | Which seats are already taken |
| POST | `/api/events/:slug/seats/reserve` | Books seats using a seat code |

### Needs you to be signed in

All of these return 401 if you are not signed in as an admin.

| Method | Path | What it does |
| --- | --- | --- |
| GET | `/api/admin/me` | Tells you who you are signed in as |
| GET | `/api/admin/events` | Every event, with sign up counts |
| POST | `/api/admin/events` | Creates an event |
| PATCH | `/api/admin/events/:slug` | Edits an event |
| DELETE | `/api/admin/events/:slug` | Deletes an event and its archive |
| GET | `/api/admin/events/:slug/registrations` | Lists sign ups with member details |
| GET | `/api/admin/events/:slug/registrations.csv` | Same list as a CSV download |
| POST | `/api/admin/events/:slug/registrations/archive` | Moves sign ups into storage |
| GET | `/api/admin/events/:slug/registrations/archive` | Downloads a past archive |
| GET | `/api/admin/events/:slug/seat-codes` | Lists seat codes and which are used |
| POST | `/api/admin/events/:slug/seat-codes` | Makes new seat codes. Body: `{"count": 25}` |
| DELETE | `/api/admin/events/:slug/seat-codes/:code` | Removes one seat code |
| GET | `/api/admin/events/:slug/seats` | Lists who booked which seat |
| GET | `/api/admin/events/:slug/seats.csv` | Same list as a CSV download |
| DELETE | `/api/admin/events/:slug/seats/:seatId` | Frees a seat and emails the person |
| GET | `/api/admin/events/:slug/entry` | Door counts: who is inside, and the capacity |
| PATCH | `/api/admin/events/:slug/entry` | Sets the capacity, or closes the door |
| GET | `/api/admin/events/:slug/entry/log` | Every scan including the refusals |
| POST | `/api/admin/entry-test` | Builds a throwaway door for trying the scanner |
| DELETE | `/api/admin/entry-test` | Removes it again |

### The door scanner

Four volunteers on four queues scan people in at the auditorium. These
are the only routes a scanning phone can reach, and they are not behind
GitHub OAuth: a volunteer handed a phone at 9am cannot be asked to join
the organisation, and making them a member to work a door would hand out
real admin access for the afternoon.

| Method | Path | What it does |
| --- | --- | --- |
| POST | `/api/scan/session` | Trades a device token for a session |
| POST | `/api/scan/claim` | One pass in, one verdict out |
| GET | `/api/scan/state` | Live counts for the queue display |

A claim answers with one of `admitted`, `already-in`, `full`, `unknown`,
`revoked`, `closed` or `not-configured`. It returns the holder's name,
and their registration number only for a reserved pass, where there is
an assigned seat to check them against.
| GET | `/api/admin/posters` | Lists the 36 print files |
| GET | `/api/admin/posters/:name` | Downloads one print file |
| GET | `/api/admin/posters/thumb/:name` | Small preview image |
| GET | `/api/admin/posters/preview/:name` | Larger preview image |
| GET | `/api/admin/posters/bundle` | All 36 posters as one A3 PDF |
| DELETE | `/api/admin/sessions/:handle` | Signs another admin out everywhere |

### Sign in and out

| Method | Path | What it does |
| --- | --- | --- |
| GET | `/auth/github` | Starts sign in. Sends you to GitHub |
| GET | `/auth/github/callback` | Where GitHub sends you back. You never open this yourself |
| POST | `/auth/logout` | Signs you out and clears the cookie |

### Sending a registration

`POST /api/events/:slug/register` takes a body like this:

```json
{
  "team_name": "detached HEAD",
  "source": { "page": "/gittyup26", "poster": 12 },
  "members": [
    {
      "name": "Ada Lovelace",
      "email": "ada.lovelace2023@vitapstudent.ac.in",
      "year_of_study": "2",
      "college_registration_number": "23BCE1234",
      "github": "adalovelace"
    }
  ]
}
```

`team_name`, `source` and `github` are optional. Everything else is
required.

`source` says where the sign up came from, so the Discord message can
name it. `page` is a path with no host or query. `poster` is the sheet
number if they scanned a QR code, or `null`. If either looks wrong the
whole `source` is dropped and the message says "unknown". It is never
guessed at, because the browser sends it and the browser can lie.

Rules the API checks, and the reason for each:

| Rule | Why |
| --- | --- |
| Email must end in `@vitapstudent.ac.in` or `@vitap.ac.in` | Only students and staff can sign up |
| Registration number must look like `23BCE1234` | Catches typing mistakes early |
| Year of study must be 1 to 5 | People type the joining year instead. This catches it |
| Team size must fit the event's min and max | Set per event |
| No repeated registration numbers in one team | Stops the same person being added twice |
| The same person cannot sign up twice for one event | Checked across all teams |
| Registration must be open and the deadline not passed | |

On success you get `201` and:

```json
{
  "success": true,
  "registration_id": "...",
  "event": "GITTY UP 26",
  "members_registered": 1
}
```

On a bad field you get `400`, with an `error` message written to be shown
to the user as it is. On a repeat sign up, or an event that has already
ended, you get `409`.

### Seat booking

There is a seat map at `/seat-reservation-gittyup26`. The page is
`src/pages/SeatingPage.tsx`.

You need a seat code to book. An admin makes codes in the panel and hands
them out. Booking sends this:

```json
{
  "seats": [
    {
      "seat_id": "F12",
      "code": "ABCD1234",
      "college_registration_number": "23BCE1234"
    }
  ]
}
```

Rules worth knowing before you change anything here:

- The first two rows are held for the OSC team and cannot be booked.
- A seat id has to be a real seat on the map. Made up ones are refused.
- Closing the event closes seat booking too. There is no separate switch.
- Errors come back per seat, with the position in your list and which
  field was wrong, so the page can mark the right row.
- A confirmation email goes out after booking, and another if an admin
  frees the seat later. If the mail settings are missing the email is
  skipped and the booking still works.

### Rate limits

If you go over, you get `429`.

| Limit | How much |
| --- | --- |
| Per registration number | 5 tries a minute |
| Per IP address, for registration | 60 tries a minute |
| Per IP address, for sign in | 10 tries a minute |

The per IP limit is high on purpose. The whole campus shares a few IP
addresses, so a tight limit would lock out a room full of students who
register together.

---

## 6. How sign in works

There are no passwords. Admins sign in with GitHub.

1. You click sign in. The Worker makes a random `state` value, saves it
   in the database, puts it in a cookie, and sends you to GitHub.
2. GitHub sends you back with a code and that same `state`. The Worker
   checks the state against both the saved row and your cookie. Checking
   both is what stops someone starting a sign in and tricking you into
   finishing it in your browser.
3. The Worker swaps the code for a GitHub token and reads your user id
   and username.
4. It checks you are a member of the `osc-vitap` GitHub organisation.
5. If you are, it saves a session and sets an `osc_admin_session` cookie.
   That cookie lasts 8 hours. It is `HttpOnly`, so JavaScript cannot read
   it, and `Secure` everywhere except localhost.
6. Every admin request looks up the session and checks the rules again.
   Removing someone from the org logs them out right away instead of
   waiting for their session to run out.

Two settings change who gets in. Both live in
`osc-events-worker/wrangler.jsonc`.

- `ADMIN_GITHUB_USERS`: leave empty to allow anyone in the organisation.
  Fill it with GitHub usernames to allow only those people.
- `ADMIN_OUTSIDER_ID_HASHES`: lets one specific GitHub account in without
  being in the organisation. It stores a hash of the **numeric user id**,
  not the username. Usernames can be changed and given to someone else.
  Numeric ids never are.

Secrets are not in the repo. They are set with
`wrangler secret put NAME`:

| Secret | What it is for |
| --- | --- |
| `GITHUB_CLIENT_ID` | The GitHub OAuth app |
| `GITHUB_CLIENT_SECRET` | The GitHub OAuth app |
| `DISCORD_WEBHOOK_URL` | Posts new sign ups to Discord. Optional |
| `ADMIN_HANDLE_PEPPER` | The key the id hashes above are made with |
| `OSC_SMTP_USER` | The account seat emails are sent from |
| `OSC_SMTP_PASS` | Its app password |

Never put a secret in a file you commit. If you ever do by accident, say
so straight away so it can be replaced. Do not just delete the commit.

### The admin panel

The panel lives at `/admin`. It is not linked from anywhere on the site.

It can be installed as an app on a phone. When it runs as an installed
app it hides the site navbar and footer and shows its own bar instead.
That code is in `src/components/AppChrome.tsx`.

---

## 7. The database

The API uses Cloudflare D1, which is SQLite.

Changes go in `osc-events-worker/migrations/` as numbered files. They run
in order when the Worker deploys.

**Never edit a migration that is already in `main`.** It has already run
on the real database, so editing it changes nothing there and makes your
copy disagree with production. Add a new numbered file instead.

Main tables:

| Table | What it holds |
| --- | --- |
| `events` | One row per event |
| `registrations` | One row per person or team who signed up |
| `registration_members` | One row per person inside a registration |
| `admin_sessions` | Who is signed in right now |
| `admin_oauth_states` | Sign ins that are half finished |
| `seat_reservation_codes` | Codes that let someone book a seat |
| `seat_reservations` | Which seat belongs to whom |

Every hour a scheduled job archives events that have ended and clears out
expired sign in rows.

---

## 8. Checks before you open a pull request

Run these. They are the same ones GitHub runs.

```bash
npm run lint
npx tsc --noEmit
npm run build
```

If you changed anything in `osc-events-worker/`:

```bash
cd osc-events-worker
npx tsc --noEmit
npx vitest run
```

All tests must pass. If you add a feature to the API, add a test for it
in `osc-events-worker/test/index.spec.ts`. Copy the style of the tests
already there.

---

## 9. Pull request template

This is filled in for you when you open a pull request. Here it is so
you know what to expect.

```markdown
## What this changes

One or two lines. What is different after this is merged?

## Why

What problem does this fix, or what does it add?
Link the issue if there is one, like: Closes #12

## How to check it

Steps someone else can follow to see it working.

1.
2.

## Screenshots

Before and after, if you changed anything visual.
Delete this section if you did not.

## Checklist

- [ ] I ran `npm run lint` and it passed
- [ ] I ran `npx tsc --noEmit` and it passed
- [ ] I ran `npm run build` and it passed
- [ ] If I changed the Worker, `npx vitest run` passed
- [ ] I did not commit any secret, key or password
- [ ] I worked on a branch, not on `main`
```

---

## 10. House style

- Match the style of the file you are in. Do not reformat code you are
  not changing.
- Write comments that say **why**, not what. The code already says what.
- Small pull requests get reviewed faster. One change per pull request.
- Commit messages start with a type: `fix:`, `feat:`, `docs:`,
  `style:`, `test:`, `chore:`.

---

## 11. Things that catch people out

**My change does not show up.** The site is on Vercel and the API is on
Cloudflare. They deploy separately. A change under
`osc-events-worker/` does not redeploy the website, and the other way
round.

**A file in `public/` is served as it is.** Anything you put there is
public on the internet. Do not put drafts or private files there.

**Files in `public/` win over routes.** If you add
`public/team/index.html`, it will be served instead of the Team page.

**The admin API needs a cookie.** Calls from the browser must use
`credentials: 'include'` or the session cookie is not sent and you get a
401. Images too, with `crossOrigin="use-credentials"` on the `<img>`.
Without it the picture just fails to load and the console says nothing
useful.

**You cannot sign into the admin panel locally.** It needs GitHub OAuth
keys that are not in the repo, for good reason. If you are changing the
panel's layout, write a small local stand-in that returns fake data, or
ask a maintainer to check it for you.

**Print posters are not in the repo.** All 36 are A3 at 300dpi and come
to about half a gigabyte. They live in Cloudflare R2 and are reachable
through the admin panel. Do not commit them.

---

## 12. Getting help

- Open an issue on the repo and describe what you tried.
- Ask in the OSC Discord.
- Unsure if an idea fits? Open an issue first and ask, before writing
  the code. That saves you work.

Thanks for contributing.

Made by xyoda
