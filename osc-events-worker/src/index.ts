import { sendMail } from './mail/smtp';
import { renderSeatReservationEmail } from './mail/seatReservationEmail';
import { renderSeatCancellationEmail } from './mail/seatCancellationEmail';

/*
 * Local development origins are always allowed. Every other
 * origin comes from the comma-separated ALLOWED_ORIGINS var.
 */
const LOCAL_ORIGINS = ['http://localhost:5173', 'http://127.0.0.1:5173'];

function allowedOrigins(env?: Env): string[] {
	const configured = (env?.ALLOWED_ORIGINS ?? '')
		.split(',')
		.map((origin) => origin.trim())
		.filter(Boolean);

	return [...new Set([...LOCAL_ORIGINS, ...configured])];
}

/*
 * The request Origin is reflected only when it is allowed.
 * Unknown origins get no Access-Control-Allow-Origin header
 * at all, which is what makes the browser block them.
 */
function corsHeaders(request?: Request, env?: Env): Record<string, string> {
	const origin = request?.headers.get('Origin');

	const headers: Record<string, string> = {
		'Access-Control-Allow-Methods': 'GET, POST, PATCH, DELETE, OPTIONS',
		'Access-Control-Allow-Headers': 'Content-Type',
		'Access-Control-Allow-Credentials': 'true',
		Vary: 'Origin',
	};

	if (origin && allowedOrigins(env).includes(origin)) {
		headers['Access-Control-Allow-Origin'] = origin;
	}

	return headers;
}

function json(data: unknown, status = 200, request?: Request, env?: Env): Response {
	return Response.json(data, {
		status,
		headers: corsHeaders(request, env),
	});
}

const GITHUB_ORG = 'osc-vitap';

/*
 * Optional allow list of GitHub handles, on top of the osc-vitap
 * organisation membership check. An empty ADMIN_GITHUB_USERS means
 * "anyone in the organisation".
 */
function adminGithubUsers(env?: Env): string[] {
	return (env?.ADMIN_GITHUB_USERS ?? '')
		.split(',')
		.map((user) => user.trim().toLowerCase())
		.filter(Boolean);
}

/*
 * GitHub accounts allowed into the dashboard WITHOUT being in the
 * osc-vitap organisation.
 *
 * This is a deliberate hole in the only real gate this admin has, so it
 * is its own setting rather than a flag on the existing one: an account
 * here is trusted on GitHub's word alone. Keep it to people who cannot
 * be added to the organisation, and empty it when they can.
 *
 * Keyed on the NUMERIC user id, never on the handle. GitHub logins are
 * mutable and are not reserved when released: if an exempt account were
 * ever renamed or deleted, whoever claimed the username next would sign
 * in and skip the organisation check entirely — full admin, registrant
 * PII, event PATCH/DELETE, and the session eviction endpoint that
 * removes the real admins. An ordinary org member cannot be taken over
 * that way because a rename breaks their membership too; this exemption
 * is precisely what removes that backstop, and the log line reads the
 * same either way. Numeric ids are never reused.
 *
 * The ids themselves are not stored, only digests: this repository is
 * public, and the list named a real person on every clone.
 */
function adminOrgExempt(env?: Env): string[] {
	return (env?.ADMIN_OUTSIDER_ID_HASHES ?? '')
		.split(',')
		.map((digest) => digest.trim().toLowerCase())
		.filter(Boolean);
}

/*
 * HMAC-SHA256 of the GitHub user id under ADMIN_HANDLE_PEPPER, hex.
 *
 * Keyed, not a bare SHA-256. The id space is small and dense, so an
 * unkeyed digest is reversed by hashing a counter — minutes' work, and
 * worse than the plaintext it replaced because it looks private.
 * Without the pepper the committed digest is meaningless.
 *
 * Trimmed first so the digest does not depend on stray whitespace in
 * the configured list.
 */
/*
 * HMAC-SHA256 of a value under a secret, hex.
 *
 * Used for two unrelated things that want the same property: a stored
 * digest that says nothing about its input to anyone without the
 * secret, and cannot be reversed by counting up through the input space
 * the way a bare SHA-256 of a short value can.
 */
async function hmacHex(value: string, pepper: string): Promise<string> {
	const encoder = new TextEncoder();

	const key = await crypto.subtle.importKey('raw', encoder.encode(pepper), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);

	const signature = await crypto.subtle.sign('HMAC', key, encoder.encode(value.trim()));

	return [...new Uint8Array(signature)].map((byte) => byte.toString(16).padStart(2, '0')).join('');
}

async function adminIdDigest(githubUserId: string, pepper: string): Promise<string> {
	return hmacHex(githubUserId, pepper);
}

/*
 * `===` on two hex strings stops at the first character that differs,
 * so how long it takes to say no tells an attacker how much of a
 * guessed digest was right. Compare every character and accumulate.
 */
function digestsMatch(a: string, b: string): boolean {
	if (a.length !== b.length) {
		return false;
	}

	let difference = 0;

	for (let index = 0; index < a.length; index++) {
		difference |= a.charCodeAt(index) ^ b.charCodeAt(index);
	}

	return difference === 0;
}

async function isOrgExempt(githubUserId: string, env?: Env): Promise<boolean> {
	const digests = adminOrgExempt(env);

	const pepper = (env?.ADMIN_HANDLE_PEPPER ?? '').trim();

	/*
	 * Nothing configured, or no pepper to reproduce the digests with,
	 * exempts nobody. This gate skips the organisation check entirely,
	 * so a missing secret has to fail closed.
	 */
	if (digests.length === 0 || pepper === '') {
		return false;
	}

	const digest = await adminIdDigest(githubUserId, pepper);

	return digests.some((configured) => digestsMatch(configured, digest));
}

/*
 * Takes both identifiers because they answer different questions: the
 * exemption is keyed on the id GitHub can never reassign, while
 * ADMIN_GITHUB_USERS is a handle list a human maintains by eye.
 */
async function isAllowedAdmin(githubUserId: string, username: string, env?: Env): Promise<boolean> {
	/*
	 * An exempt account is allowed even once ADMIN_GITHUB_USERS is
	 * populated — otherwise turning that list on would silently lock out
	 * the very people this exists for.
	 */
	if (await isOrgExempt(githubUserId, env)) {
		return true;
	}

	const allowList = adminGithubUsers(env);

	return allowList.length === 0 || allowList.includes(username.toLowerCase());
}

/*
 * When an event actually finishes. Drives both the "this event has
 * already ended" rejection on registration and the scheduled archive
 * job, so it is stored as a UTC instant.
 *
 * The admin form posts a value from an <input type="datetime-local">,
 * which the browser converts to UTC before sending. A bare local
 * string arriving from anywhere else is read as UTC, matching how
 * SQLite's datetime() treats it.
 */
function normalizeEventEnd(value: string | null | undefined): { ok: true; value: string | null } | { ok: false } {
	if (value === undefined || value === null || value.trim() === '') {
		return { ok: true, value: null };
	}

	const parsed = Date.parse(value);

	if (Number.isNaN(parsed)) {
		return { ok: false };
	}

	return { ok: true, value: new Date(parsed).toISOString() };
}

/*
 * A college registration number is the participant's identity within an
 * event, so it is compared and stored in one canonical form: uppercase,
 * no surrounding or internal whitespace. "22bce1234" and " 22BCE 1234 "
 * are the same student.
 */
function normalizeRegistrationNumber(value: string): string {
	return value.toUpperCase().replace(/\s+/g, '');
}

/*
 * The VIT-AP format exactly: admission year 22 to 26, a three-letter
 * programme code, a four-digit roll — 22BCE1234. Tested after
 * normalisation, so casing and stray spaces have already been handled.
 *
 * Mirrored client-side in src/data/registrationNumber.ts; change both
 * together. The year range needs widening for the 2027 intake.
 */
const REGISTRATION_NUMBER_PATTERN = /^2[2-6][A-Z]{3}[0-9]{4}$/;

/*
 * The canonical form of an event slug: lowercase, words joined by single
 * hyphens, nothing else.
 *
 * Create and update used to disagree — POST stored `body.slug.trim()`
 * verbatim while PATCH lowercased and hyphenated it. The admin form
 * round-trips the stored slug on every save, so the first unrelated edit
 * to an event created with, say, "GittyUp 26" silently changed its
 * public URL and broke every printed QR code pointing at it. Both paths
 * normalise through here now, which also makes a re-save idempotent.
 */
function normalizeSlug(value: string): string {
	return value
		.trim()
		.toLowerCase()
		.replace(/[^a-z0-9]+/g, '-')
		.replace(/^-+|-+$/g, '');
}

const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

/*
 * Not a full RFC 5322 validator — just enough to reject values that
 * cannot possibly receive mail, without locking out unusual real
 * addresses.
 */
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/*
 * Registration is for VIT-AP, so the address has to be a university
 * one. Students are @vitapstudent.ac.in and staff @vitap.ac.in.
 *
 * Enforced here rather than only in the form: the form is a
 * convenience, and anyone can post to this endpoint directly.
 */
const ALLOWED_EMAIL_DOMAINS = ['vitapstudent.ac.in', 'vitap.ac.in'];

function hasAllowedEmailDomain(email: string): boolean {
	const at = email.lastIndexOf('@');

	if (at === -1) return false;

	const domain = email.slice(at + 1);

	/*
	 * Exact match only. A suffix test would accept
	 * "vitap.ac.in.attacker.com", and a contains test would accept
	 * anything with the string in it.
	 */
	return ALLOWED_EMAIL_DOMAINS.includes(domain);
}

/*
 * Degrees at VIT-AP run to five years — B.Tech is four, the integrated
 * programmes five — so anything outside 1 to 5 is not a year of study,
 * whatever produced it.
 */
const MAX_YEAR_OF_STUDY = 5;

/*
 * Above this, a plain integer is read as the calendar year the student
 * joined rather than the year they are in.
 */
const CALENDAR_YEAR_THRESHOLD = 10;

/*
 * The year a first-year is in during the current academic year. Moves
 * with the intake: once 2027 admissions register, a first-year types
 * "2027" and this has to become 2028 or they are turned away.
 */
const ACADEMIC_YEAR_BASE = 2027;

/*
 * Six of the first 239 participants answered "Year of Study" with
 * "2026" — the year they joined, not the year they are in. The rule is
 * the owner's: an integer above ten is one of those, so 2026 becomes 1
 * and 2025 becomes 2.
 *
 * The subtraction alone invents years for input it was never written
 * for: 2027 gives 0, 2028 gives -1, and a mistyped "25" gives 2002. So
 * the result is range-checked afterwards and a bad one is refused
 * rather than clamped — storing a year nobody entered is worse than
 * asking for the field again. That check is also what rejects the "0"
 * already sitting in the table, which the subtraction never touches.
 *
 * Digits only. "1st year" and "2025-2026" appear in the existing rows
 * too, and guessing at those would be a second rule the owner has not
 * written; the caller is told what to type instead. The rows already
 * stored are the migration stream's problem, not this function's.
 *
 * The registration form has to refuse exactly what this refuses, the
 * way src/data/registrationNumber.ts mirrors
 * REGISTRATION_NUMBER_PATTERN. A form that accepts what the Worker
 * turns away is a submit button that fails with no field marked.
 */
function normalizeYearOfStudy(value: string): string | null {
	if (!/^[0-9]{1,4}$/.test(value)) {
		return null;
	}

	const entered = Number(value);

	const year = entered > CALENDAR_YEAR_THRESHOLD ? ACADEMIC_YEAR_BASE - entered : entered;

	if (year < 1 || year > MAX_YEAR_OF_STUDY) {
		return null;
	}

	return String(year);
}

/*
 * GitHub's own username rule: 1 to 39 characters, letters, digits and
 * single hyphens, never starting or ending with one. Spelled out
 * because the obvious \w+ accepts "-", "--" and a 200-character string
 * as handles, and the roster would then name profiles that cannot
 * exist.
 */
const GITHUB_USERNAME = /^[A-Za-z0-9](?:[A-Za-z0-9]|-(?=[A-Za-z0-9])){0,38}$/;

/*
 * A profile URL, in every shape the address bar hands out: with or
 * without the scheme, with or without www., with or without a trailing
 * slash. The username is what is captured.
 *
 * A deeper path does not match at all, so "github.com/name/project" is
 * refused rather than trimmed to its first segment — that is a
 * repository someone pasted by mistake, and storing half of it would
 * be a guess.
 */
const GITHUB_PROFILE_URL = /^(?:https?:\/\/)?(?:www\.)?github\.com\/([^/]+)\/?$/i;

/*
 * Accepts a handle or a profile URL and stores the handle.
 *
 * One stored form because the field is asking for a handle and the
 * Discord roster renders one: escapeDiscord backslashes every ':' it
 * meets, so a URL reaches the channel as "https\://github.com/ada".
 * Casing is left as typed — GitHub resolves either way, and lowercasing
 * "AdaLovelace" only makes the roster read wrong.
 *
 * "https://github.com/" names nobody, so it fails the username test
 * with everything else that has no handle in it.
 *
 * An empty github is not this function's business: the field is
 * optional and 177 of the first 239 participants left it blank.
 */
function normalizeGithub(value: string): string | null {
	/*
	 * Copying the link while sitting on your own Repositories tab
	 * gives "github.com/ada?tab=repositories", and the address bar
	 * hands out "#top" the same way. Both name the user, so cutting
	 * the query and the fragment is what keeps the error from telling
	 * a student to paste the profile link they just pasted. Only the
	 * URL form is cut: a bare handle carrying a '?' is not a handle.
	 */
	const url = value.split(/[?#]/)[0];

	const handle = GITHUB_PROFILE_URL.exec(url)?.[1] ?? value;

	return GITHUB_USERNAME.test(handle) ? handle : null;
}

/*
 * Field length ceilings. These are resource limits, not format
 * validation: without them a single request can park megabytes of
 * garbage in D1 and in every CSV export after it.
 */
const LIMITS = {
	name: 120,
	yearOfStudy: 40,
	email: 254,
	github: 100,
	teamName: 120,
	members: 20,
} as const;

/*
 * A member field is whatever the client put in the JSON, and a client
 * that runs Number(input) before POSTing sends year_of_study as 2026
 * rather than "2026". That number reached collapseWhitespace and threw
 * "value.replace is not a function" — a 500 for what is an input
 * problem, and from the one field normalizeYearOfStudy exists to
 * forgive. A non-string becomes empty here and is refused as missing
 * information, like a field nobody filled in.
 */
function asString(value: unknown): string {
	return typeof value === 'string' ? value : '';
}

/*
 * The same fields were length-checked but never character-checked, and
 * they reach three renderers that do not treat a line break as ordinary
 * text.
 *
 * The Discord announcement joins one participant's fields with " · " and
 * puts one participant per line, so a name carrying a newline renders as
 * extra roster rows under a header still reading "Participant" — one
 * registration presenting itself as three, the last of them called
 * "Admin Override". A "·" inside year_of_study forges the same thing
 * inside a single line. The CSV export has its own version: an embedded
 * newline splits one record across two rows.
 *
 * Collapsing every run of whitespace to one space removes the newline,
 * tab and Unicode line-separator forms together, and is what a real
 * registrant who pasted a name with a trailing newline wanted anyway.
 */
function collapseWhitespace(value: string): string {
	return value.replace(/\s+/g, ' ').trim();
}

/*
 * What collapsing cannot reach: the C0 and C1 control characters that
 * are not whitespace, and the "·" the roster joins on. None of them
 * belongs in a name, a year of study, a handle or a team name, so a
 * value containing one is rejected rather than quietly rewritten — that
 * submission is not a typo.
 */
const FORBIDDEN_FIELD_CHARACTERS = /[\p{Cc}\u00b7]/u;

/*
 * ============================================================
 * DISCORD NOTIFICATIONS
 * ============================================================
 *
 * Every registration is announced to the club's #event-logs channel.
 *
 * The webhook URL is a credential — anyone holding it can post to that
 * channel — so it lives in DISCORD_WEBHOOK_URL, set with
 * `wrangler secret put`, and never in this repo. With no secret set the
 * announcement is skipped and registration is unaffected.
 */

/** Where the registration came from, as told by the page that sent it. */
interface RegistrationSource {
	/** Path only, no query or host. */
	page: string;
	/** Which printed sheet, for a scan of a poster QR. */
	poster: number | null;
}

/*
 * The source is supplied by the browser, so it is treated as hostile:
 * a path of a known shape, and a small integer. Anything else is
 * dropped rather than corrected, and the message then says "unknown"
 * instead of repeating whatever was sent.
 */
const SOURCE_PATH = /^\/[A-Za-z0-9\-_/]{0,64}$/;

const MAX_POSTER_ID = 99;

function normalizeSource(raw: unknown): RegistrationSource | null {
	if (!raw || typeof raw !== 'object') {
		return null;
	}

	const value = raw as { page?: unknown; poster?: unknown };

	const page = typeof value.page === 'string' ? value.page.trim() : '';

	if (!SOURCE_PATH.test(page)) {
		return null;
	}

	const poster =
		typeof value.poster === 'number' && Number.isInteger(value.poster) && value.poster >= 1 && value.poster <= MAX_POSTER_ID
			? value.poster
			: null;

	return { page, poster };
}

/*
 * Discord renders message content as markdown, and these fields carry
 * names typed by strangers. Escaping the markdown characters stops a
 * registration called `**` from reformatting the channel.
 *
 * This is defence in depth, not the whole defence: the payload also
 * sends allowed_mentions with an empty parse list, which is what
 * actually guarantees an @everyone in a name cannot ping anyone.
 *
 * The line breaks and the "·" separator are flattened here as well as
 * at ingest, because the event title never meets the validator that
 * does it: PATCH /api/admin/events/:id stores body.title.trim(), so a
 * newline in a title splits the embed heading in two and a "·" in one
 * reads as a roster separator. Participant fields and the team name
 * are flattened at ingest already — the title is the one string this
 * encoder renders that arrives raw.
 */
function escapeDiscord(value: string): string {
	return value
		.replace(/[\s\p{Cc}]+/gu, ' ')
		.replace(/·/g, '-')
		.replace(/[\\`*_~|<>@#:[\]()]/g, (character) => `\\${character}`);
}

function truncate(value: string, max: number): string {
	return value.length <= max ? value : `${value.slice(0, max - 1)}…`;
}

/** Human wording for where a registration came from. */
function describeSource(source: RegistrationSource | null): string {
	if (!source) {
		return 'Unknown page';
	}

	if (source.poster !== null) {
		return `${source.page} — poster ${source.poster}`;
	}

	return source.page;
}

interface RegistrationAnnouncement {
	eventTitle: string;
	eventSlug: string;
	registrationId: number | string;
	teamName: string | null;
	source: RegistrationSource | null;
	members: {
		name: string;
		year_of_study: string;
		college_registration_number: string;
		email: string;
		github: string | null;
	}[];
}

function registrationEmbed(announcement: RegistrationAnnouncement) {
	const { members } = announcement;

	const roster = members
		.map((member) => {
			const parts = [
				escapeDiscord(member.college_registration_number),
				`year ${escapeDiscord(member.year_of_study)}`,
			];

			if (member.github) {
				parts.push(escapeDiscord(member.github));
			}

			return `**${escapeDiscord(member.name)}** · ${parts.join(' · ')}`;
		})
		.join('\n');

	const fields = [
		{
			name: members.length > 1 ? `Participants (${members.length})` : 'Participant',
			value: truncate(roster || '—', 1024),
		},
		{
			name: 'Registered from',
			value: truncate(escapeDiscord(describeSource(announcement.source)), 1024),
		},
	];

	if (announcement.teamName) {
		fields.unshift({
			name: 'Team',
			value: truncate(escapeDiscord(announcement.teamName), 1024),
		});
	}

	return {
		title: truncate(`New registration — ${escapeDiscord(announcement.eventTitle)}`, 256),
		url: `https://www.oscvitap.com/events`,
		/* The site's own accent, so the channel reads as one system. */
		color: 0xc0_84_fc,
		fields,
		footer: {
			text: truncate(`${announcement.eventSlug} · #${announcement.registrationId}`, 2048),
		},
		timestamp: new Date().toISOString(),
	};
}

/*
 * Posts the announcement, and never lets it affect the registration.
 *
 * Called through waitUntil so the participant's response is not held
 * behind a call to discord.com, and wrapped so that a Discord outage,
 * a revoked webhook or a slow response is logged rather than turned
 * into a failed registration for someone standing in a corridor.
 */
function announceRegistration(env: Env, ctx: ExecutionContext, announcement: RegistrationAnnouncement): void {
	const webhook = env.DISCORD_WEBHOOK_URL?.trim();

	if (!webhook) {
		return;
	}

	const body = {
		username: 'OSC Events',
		/*
		 * The single most important line here. Names arrive from a public
		 * form; without this, "@everyone" as a first name would ping the
		 * entire server on every registration.
		 */
		allowed_mentions: { parse: [] as string[] },
		embeds: [registrationEmbed(announcement)],
	};

	ctx.waitUntil(
		fetch(webhook, {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify(body),
			/* A hung webhook must not hold the invocation open. */
			signal: AbortSignal.timeout(5000),
		})
			.then(async (response) => {
				if (!response.ok) {
					console.error('Discord webhook rejected:', response.status, await response.text().catch(() => ''));
				}
			})
			.catch((error) => {
				console.error('Discord webhook failed:', error);
			}),
	);
}

/*
 * ============================================================
 * SEAT RESERVATIONS
 * ============================================================
 */

/*
 * The unambiguous alphabet, no I, no O, no zero, no one. Codes are read
 * off a screen and typed back in by hand.
 */
const SEAT_CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

const SEAT_CODE_PATTERN = /^[ABCDEFGHJKLMNPQRSTUVWXYZ23456789]{4}-[ABCDEFGHJKLMNPQRSTUVWXYZ23456789]{4}$/;

/* 22 rows of 26 seats, the same map the seating page draws. */
const SEAT_ID_PATTERN = /^R(?:[1-9]|1[0-9]|2[0-2])-S(?:[1-9]|1[0-9]|2[0-6])$/;

/*
 * The front rows belong to the club. The map hides them, but the map is
 * only a suggestion, so the rule is enforced here where it counts.
 */
const TEAM_ROWS = [1, 2];

function isTeamSeat(seatId: string): boolean {
	const match = /^R(\d+)-S\d+$/.exec(seatId);

	return match ? TEAM_ROWS.includes(Number(match[1])) : false;
}

const MAX_SEATS_PER_RESERVATION = 35;

const MAX_SEAT_CODES_PER_BATCH = 200;

const SEAT_EVENT_TIME = '10:00 AM to 5:00 PM';

const SEAT_EVENT_VENUE = 'AB-2 Auditorium, VIT-AP';

const SEAT_REGISTRATION_REQUIRED =
	'That registration number is not registered for gitty up. Register at oscvitap.com/gittyup26 first.';

/*
 * The alphabet is 32 characters and a byte holds 256 values, so the
 * modulo divides evenly and no character is more likely than another.
 */
function generateSeatCode(): string {
	const bytes = new Uint8Array(8);

	crypto.getRandomValues(bytes);

	const characters = [...bytes].map((byte) => SEAT_CODE_ALPHABET[byte % SEAT_CODE_ALPHABET.length]);

	return `${characters.slice(0, 4).join('')}-${characters.slice(4).join('')}`;
}

function seatLabel(seatId: string): string {
	const match = /^R([0-9]+)-S([0-9]+)$/.exec(seatId);

	return match ? `Row ${match[1]} Seat ${match[2]}` : seatId;
}

/*
 * event_date is stored as a plain date, which Date.parse reads as UTC.
 * The event is in India, so it is rendered in India time.
 */
function formatSeatEventDate(eventDate: string | null): string {
	const value = (eventDate ?? '').trim();

	if (!value) {
		return '';
	}

	const parsed = Date.parse(value.includes('T') ? value : `${value}T00:00:00+05:30`);

	if (Number.isNaN(parsed)) {
		return value;
	}

	return new Intl.DateTimeFormat('en-IN', {
		weekday: 'long',
		day: 'numeric',
		month: 'long',
		year: 'numeric',
		timeZone: 'Asia/Kolkata',
	}).format(new Date(parsed));
}

interface SeatMailEvent {
	title: string;
	event_date: string | null;
	venue: string | null;
}

interface SeatMailRow {
	id: number;
	seat_id: string;
	name: string;
	email: string;
	college_registration_number: string;
}

/*
 * One mail per reserved seat, sent one at a time so there is a single
 * SMTP conversation, and never allowed to fail the reservation.
 */
function sendSeatCancellationMail(env: Env, ctx: ExecutionContext, event: SeatMailEvent, row: SeatMailRow): void {
	const user = env.OSC_SMTP_USER?.trim();

	const pass = env.OSC_SMTP_PASS?.trim();

	if (!user || !pass) {
		return;
	}

	const eventDate = formatSeatEventDate(event.event_date);

	const venue = (event.venue ?? '').trim() || SEAT_EVENT_VENUE;

	ctx.waitUntil(
		(async () => {
			try {
				const message = renderSeatCancellationEmail({
					name: row.name,
					seatId: row.seat_id,
					seatLabel: seatLabel(row.seat_id),
					eventTitle: event.title,
					eventDate,
					eventTime: SEAT_EVENT_TIME,
					venue,
					registrationNumber: row.college_registration_number,
				});

				await sendMail(
					{ host: 'smtp.gmail.com', port: 587, user, pass },
					{
						to: row.email,
						toName: row.name,
						fromName: 'Open Source Community',
						replyTo: 'osc@vitap.ac.in',
						subject: message.subject,
						html: message.html,
						text: message.text,
					},
				);
			} catch (error) {
				console.error('Seat cancellation mail failed:', row.seat_id, error);
			}
		})(),
	);
}

function sendSeatReservationMails(env: Env, ctx: ExecutionContext, event: SeatMailEvent, rows: SeatMailRow[]): void {
	const user = env.OSC_SMTP_USER?.trim();

	const pass = env.OSC_SMTP_PASS?.trim();

	if (!user || !pass) {
		return;
	}

	const eventDate = formatSeatEventDate(event.event_date);

	const venue = (event.venue ?? '').trim() || SEAT_EVENT_VENUE;

	ctx.waitUntil(
		(async () => {
			for (const row of rows) {
				let status = 'sent';

				try {
					const message = renderSeatReservationEmail({
						name: row.name,
						seatId: row.seat_id,
						seatLabel: seatLabel(row.seat_id),
						eventTitle: event.title,
						eventDate,
						eventTime: SEAT_EVENT_TIME,
						venue,
						registrationNumber: row.college_registration_number,
					});

					await sendMail(
						{ host: 'smtp.gmail.com', port: 587, user, pass },
						{
							to: row.email,
							toName: row.name,
							fromName: 'Open Source Community',
							replyTo: 'osc@vitap.ac.in',
							subject: message.subject,
							html: message.html,
							text: message.text,
						},
					);
				} catch (error) {
					console.error('Seat reservation mail failed:', row.seat_id, error);

					status = 'failed';
				}

				try {
					await env.DB.prepare(
						`
              UPDATE seat_reservations
              SET email_status = ?
              WHERE id = ?
            `,
					)
						.bind(status, row.id)
						.run();
				} catch (error) {
					console.error('Seat reservation mail status update failed:', row.id, error);
				}
			}
		})(),
	);
}

/*
 * The Workers rate limiting API (open beta).
 *
 * Fails open on purpose: if the binding is missing in a local setup or
 * the limiter itself errors, registration must keep working — the
 * limiter protects the service, it is not an authorisation control.
 */
async function withinRateLimit(limiter: RateLimit | undefined, key: string): Promise<boolean> {
	if (!limiter) {
		return true;
	}

	try {
		const { success } = await limiter.limit({ key });

		return success;
	} catch (error) {
		console.error('Rate limiter unavailable:', error);

		return true;
	}
}

function clientIp(request: Request): string {
	return request.headers.get('CF-Connecting-IP') ?? 'unknown';
}

function rateLimited(request: Request, env: Env): Response {
	return new Response(JSON.stringify({ error: 'Too many requests. Please wait a minute and try again.' }), {
		status: 429,
		headers: {
			...corsHeaders(request, env),
			'Content-Type': 'application/json',
			'Retry-After': '60',
		},
	});
}

/*
 * EXPIRY_NOTE — why every expiry comparison wraps both sides in
 * datetime().
 *
 * expires_at is written with Date#toISOString(), which produces
 * "2026-08-26T07:00:00.000Z". SQLite's datetime('now') produces
 * "2026-08-26 07:00:00". Comparing those two directly is a STRING
 * comparison, and at the eleventh character it compares "T" (0x54)
 * against " " (0x20) — so an ISO timestamp always sorts after a SQLite
 * one for the same date, whatever the time says.
 *
 * The effect was that a session which expired at midnight still passed
 * `expires_at > datetime('now')` for the rest of that day: eight-hour
 * sessions stayed usable for up to thirty-two hours, and ten-minute
 * OAuth states stayed replayable until the date rolled over.
 *
 * datetime() parses both into the same format, so the comparison is a
 * real one.
 */
function randomToken(): string {
	return crypto.randomUUID() + crypto.randomUUID();
}

/*
 * A random token as plain hex, no dashes.
 *
 * Entry passes use this rather than randomToken because the value ends
 * up inside a QR code and then back out of a camera: hex is a single
 * character class the scanner can validate in one expression, and it
 * survives being read aloud, typed by hand, or pasted out of a
 * spreadsheet in a way a dashed UUID pair does not.
 *
 * Sixteen bytes. Guessing one is not a thing that happens.
 */
function hexToken(bytes = 16): string {
	const buffer = new Uint8Array(bytes);

	crypto.getRandomValues(buffer);

	return [...buffer].map((byte) => byte.toString(16).padStart(2, '0')).join('');
}

function getCookie(request: Request, name: string): string | null {
	const cookies = request.headers.get('Cookie');

	if (!cookies) {
		return null;
	}

	const match = cookies
		.split(';')
		.map((cookie) => cookie.trim())
		.find((cookie) => cookie.startsWith(`${name}=`));

	return match ? decodeURIComponent(match.substring(name.length + 1)) : null;
}

function isLocalRequest(request: Request): boolean {
	const hostname = new URL(request.url).hostname;

	return hostname === '127.0.0.1' || hostname === 'localhost';
}

/* Where the browser belongs once the Worker is done with it. */
function siteOrigin(request: Request): string {
	return isLocalRequest(request) ? 'http://localhost:5173' : 'https://www.oscvitap.com';
}

/*
 * Reasons a sign-in did not go through. Mirrored in
 * src/data/adminAuth.ts, which turns each code into the copy shown on
 * the restricted page — add a code in one place and it needs adding in
 * the other.
 */
type AuthFailure =
	| 'denied'
	| 'no-code'
	| 'bad-state'
	| 'github-error'
	| 'not-allowed'
	| 'not-a-member'
	| 'pending-invite'
	| 'signed-out';

/*
 * A failed sign-in belongs back on the site, not on a JSON body at the
 * Worker's own domain. Someone who is simply not in the organisation
 * used to be left looking at {"error":"Access denied..."} on
 * events.oscvitap.com with no way back; now they land on a page that
 * says what happened.
 *
 * The reason is a fixed code from the union above, never anything
 * echoed from the request, so this cannot be turned into an open
 * redirect or a way to render attacker text on the site.
 */
function authFailureRedirect(request: Request, reason: AuthFailure): Response {
	const headers = new Headers({
		Location: `${siteOrigin(request)}/admin/restricted?reason=${reason}`,
	});

	/* A failure must not leave a half-made session or a live state behind. */
	headers.append('Set-Cookie', clearedSessionCookie(request));
	headers.append('Set-Cookie', clearedOauthStateCookie(request));

	return new Response(null, { status: 302, headers });
}

function sessionCookie(sessionId: string, request: Request): string {
	const secure = !isLocalRequest(request);

	return [
		`osc_admin_session=${encodeURIComponent(sessionId)}`,
		'Path=/',
		'HttpOnly',
		'SameSite=Lax',
		'Max-Age=28800',
		secure ? 'Secure' : '',
	]
		.filter(Boolean)
		.join('; ');
}

/*
 * Binds an in-flight OAuth attempt to the browser that started it.
 *
 * SameSite=Lax rather than Strict because the browser arrives here from
 * github.com — a Strict cookie would not be sent on that navigation and
 * every sign-in would fail.
 */
function oauthStateCookie(state: string, request: Request): string {
	const secure = !isLocalRequest(request);

	return [
		`osc_oauth_state=${encodeURIComponent(state)}`,
		'Path=/',
		'HttpOnly',
		'SameSite=Lax',
		'Max-Age=600',
		secure ? 'Secure' : '',
	]
		.filter(Boolean)
		.join('; ');
}

function clearedOauthStateCookie(request: Request): string {
	const secure = !isLocalRequest(request);

	return ['osc_oauth_state=', 'Path=/', 'HttpOnly', 'SameSite=Lax', 'Max-Age=0', secure ? 'Secure' : '']
		.filter(Boolean)
		.join('; ');
}

/*
 * The same cookie with an immediate expiry. Attributes have to match
 * the ones it was set with or the browser keeps the original.
 */
function clearedSessionCookie(request: Request): string {
	const secure = !isLocalRequest(request);

	return [
		'osc_admin_session=',
		'Path=/',
		'HttpOnly',
		'SameSite=Lax',
		'Max-Age=0',
		secure ? 'Secure' : '',
	]
		.filter(Boolean)
		.join('; ');
}

async function getAdminSession(request: Request, env: Env) {
	const sessionId = getCookie(request, 'osc_admin_session');

	if (!sessionId) {
		return null;
	}

	const session = await env.DB.prepare(
		`
      SELECT
        id,
        github_user_id,
        github_username,
        expires_at
      FROM admin_sessions
      WHERE id = ?
        AND datetime(expires_at) > datetime('now')
    `,
	)
		.bind(sessionId)
		.first<{
			id: string;
			github_user_id: string;
			github_username: string;
			expires_at: string;
		}>();

	if (!session) {
		return null;
	}

	/*
	 * The allow list is enforced on every request, not only at login,
	 * so removing a handle takes effect immediately instead of when
	 * their eight hour session happens to expire.
	 */
	if (!(await isAllowedAdmin(session.github_user_id, session.github_username, env))) {
		return null;
	}

	return session;
}

async function requireAdmin(
	request: Request,
	env: Env,
): Promise<
	| {
			authorized: true;
			session: {
				id: string;
				github_user_id: string;
				github_username: string;
				expires_at: string;
			};
	  }
	| {
			authorized: false;
			response: Response;
	  }
> {
	const session = await getAdminSession(request, env);

	if (!session) {
		return {
			authorized: false,
			response: json(
				{
					error: 'Authentication required',
				},
				401,
				request,
				env,
			),
		};
	}

	return {
		authorized: true,
		session,
	};
}

/*
 * ================================================================
 * DOOR SCANNERS
 * ================================================================
 *
 * The five phones on the four queues at the auditorium door.
 *
 * Deliberately outside the GitHub OAuth gate. A volunteer handed a
 * phone at 9am cannot be asked to be in the osc-vitap organisation, and
 * making them one to work a door would hand out real admin access for
 * the afternoon.
 *
 * So this is its own everything: its own table, its own cookie on its
 * own path, and its own resolver that never reads admin_sessions. The
 * one thing a door phone can do is turn a token into a verdict. It
 * cannot read a registrant's email, list an event, or reach anything
 * under /api/admin.
 */

/* Long enough to cover a full event day plus the overrun. A door phone
   being signed out mid-queue is worse than a session that outlives the
   event, and the device row can be revoked instantly either way. */
const SCAN_SESSION_HOURS = 14;

/*
 * The throwaway event the door test builds itself on.
 *
 * Deliberately not gittyup26. Every test pass, device and scan hangs
 * off this event id, so a test admission is counted against a gate that
 * is not the auditorium's. There is nothing to remember to switch off.
 */
const TEST_DOOR_SLUG = 'door-scanner-test';

function scanSessionCookie(sessionId: string, request: Request): string {
	const secure = !isLocalRequest(request);

	return [
		`osc_scan_session=${encodeURIComponent(sessionId)}`,
		/*
		 * Scoped to the scan API, not to /. A cookie on / would be sent
		 * to every admin route as well, which is exactly the confusion
		 * this separation exists to prevent.
		 */
		'Path=/api/scan',
		'HttpOnly',
		'SameSite=Lax',
		`Max-Age=${SCAN_SESSION_HOURS * 3600}`,
		secure ? 'Secure' : '',
	]
		.filter(Boolean)
		.join('; ');
}

interface ScannerSession {
	sessionId: string;
	deviceId: string;
	eventId: string;
	label: string;
}

/*
 * Resolves a door phone, or refuses.
 *
 * Joined to scanner_devices rather than trusting the session row alone,
 * so revoking a device takes effect on its very next scan instead of
 * whenever its session happens to expire. A phone left in a taxi is
 * revoked from the admin panel and is dead one scan later.
 */
async function requireScanner(
	request: Request,
	env: Env,
): Promise<{ ok: true; scanner: ScannerSession } | { ok: false; response: Response }> {
	const sessionId = getCookie(request, 'osc_scan_session');

	const deny = () => ({
		ok: false as const,
		response: json({ error: 'Scanner sign-in required' }, 401, request, env),
	});

	if (!sessionId) {
		return deny();
	}

	const row = await env.DB.prepare(
		`
      SELECT
        s.id AS session_id,
        s.device_id,
        s.event_id,
        d.label
      FROM scanner_sessions s
      JOIN scanner_devices d ON d.id = s.device_id
      WHERE s.id = ?
        AND datetime(s.expires_at) > datetime('now')
        AND d.revoked_at IS NULL
    `,
	)
		.bind(sessionId)
		.first<{ session_id: string; device_id: string; event_id: string; label: string }>();

	if (!row) {
		return deny();
	}

	return {
		ok: true,
		scanner: {
			sessionId: row.session_id,
			deviceId: row.device_id,
			eventId: row.event_id,
			label: row.label,
		},
	};
}

/*
 * Every outcome, including the refusals.
 *
 * entry_scans only holds admissions, so without this there is no record
 * of the person turned away at 10:40 and no way to answer "how many did
 * we refuse" afterwards. Workers logs are sampled and cannot be
 * queried, so the answer has to be a row.
 *
 * Fired through waitUntil: the volunteer's verdict must not wait on the
 * audit write, and a failed audit write must not fail an admission.
 */
async function recordEntryEvent(
	env: Env,
	eventId: string,
	token: string | null,
	deviceId: string | null,
	result: string,
	actor?: string,
	reason?: string,
): Promise<void> {
	try {
		await env.DB.prepare(
			`
        INSERT INTO entry_events (event_id, token, device_id, result, actor, reason)
        VALUES (?, ?, ?, ?, ?, ?)
      `,
		)
			.bind(eventId, token, deviceId, result, actor ?? null, reason ?? null)
			.run();
	} catch (error) {
		console.error('Entry event not recorded:', result, error);
	}
}

interface Refusal {
	verdict: 'unknown' | 'revoked' | 'already-in' | 'closed' | 'not-configured' | 'full';
	name?: string | null;
	first_device?: string;
	first_scanned_at?: string;
}

/*
 * Why the claim admitted nobody.
 *
 * A separate read rather than an inference, because "already inside"
 * and "never registered" both look like an absent row and need opposite
 * reactions at the door: one is a person to wave through a second time
 * or query, the other is a person to send to the registration desk.
 */
async function classifyRefusal(env: Env, eventId: string, token: string): Promise<Refusal> {
	const row = await env.DB.prepare(
		`
      SELECT
        p.token AS pass_token,
        p.name,
        p.revoked_at,
        g.event_id AS gate_event,
        g.is_open,
        s.device_id AS first_device,
        s.scanned_at AS first_scanned_at
      FROM (SELECT ?2 AS event_id) base
      LEFT JOIN entry_passes p
        ON p.token = ?1
      LEFT JOIN entry_gate g
        ON g.event_id = base.event_id
      LEFT JOIN entry_scans s
        ON s.event_id = base.event_id
       AND s.token = ?1
       AND s.voided_at IS NULL
    `,
	)
		.bind(token, eventId)
		.first<{
			pass_token: string | null;
			name: string | null;
			revoked_at: string | null;
			gate_event: string | null;
			is_open: number | null;
			first_device: string | null;
			first_scanned_at: string | null;
		}>();

	if (!row?.pass_token) {
		return { verdict: 'unknown' };
	}

	if (row.revoked_at) {
		return { verdict: 'revoked', name: row.name };
	}

	/*
	 * Checked before the gate: someone already inside should be told so
	 * even after the doors close, otherwise the last person through gets
	 * "full" when they try to re-enter and reads it as being ejected.
	 */
	if (row.first_scanned_at) {
		return {
			verdict: 'already-in',
			name: row.name,
			first_device: row.first_device ?? undefined,
			first_scanned_at: row.first_scanned_at,
		};
	}

	/*
	 * A missing gate row would otherwise read as a full auditorium, which
	 * is the worst possible way to discover the migration did not seed.
	 */
	if (!row.gate_event) {
		return { verdict: 'not-configured', name: row.name };
	}

	if (!row.is_open) {
		return { verdict: 'closed', name: row.name };
	}

	return { verdict: 'full', name: row.name };
}

/*
 * What the queue display shows.
 *
 * Occupancy is counted from entry_scans rather than read from the
 * entry_gate columns, so the number on a volunteer's phone is the same
 * number the claim just enforced. The stored counters are a cache and
 * are reported alongside, so drift between the two is visible instead
 * of silent.
 */
async function gateState(env: Env, eventId: string) {
	const row = await env.DB.prepare(
		`
      SELECT
        g.capacity,
        g.is_open,
        g.admitted_reserved AS cached_reserved,
        g.admitted_general  AS cached_general,
        (SELECT COUNT(*) FROM entry_scans s
          WHERE s.event_id = g.event_id AND s.voided_at IS NULL)                        AS inside,
        (SELECT COUNT(*) FROM entry_scans s
          WHERE s.event_id = g.event_id AND s.kind = 'registered' AND s.voided_at IS NULL) AS inside_general,
        (SELECT COUNT(*) FROM entry_passes p
          WHERE p.event_id = g.event_id AND p.kind = 'reserved' AND p.revoked_at IS NULL)  AS reserved_issued
      FROM entry_gate g
      WHERE g.event_id = ?
    `,
	)
		.bind(eventId)
		.first<{
			capacity: number;
			is_open: number;
			cached_reserved: number;
			cached_general: number;
			inside: number;
			inside_general: number;
			reserved_issued: number;
		}>();

	if (!row) {
		return { configured: false as const };
	}

	const generalCap = row.capacity - row.reserved_issued;

	return {
		configured: true as const,
		is_open: row.is_open === 1,
		capacity: row.capacity,
		inside: row.inside,
		inside_general: row.inside_general,
		inside_reserved: row.inside - row.inside_general,
		reserved_issued: row.reserved_issued,
		general_cap: generalCap,
		general_remaining: Math.max(0, generalCap - row.inside_general),
		/* Reported so a mismatch with `inside` is visible on the display
		   rather than being discovered afterwards. */
		cached: {
			reserved: row.cached_reserved,
			general: row.cached_general,
		},
	};
}

/*
 * Names, years of study and team names arrive from the unauthenticated
 * registration endpoint, and the export is written with a BOM so that
 * Excel is the expected reader. A value starting =, +, - or @ is
 * treated by Excel, Sheets and LibreOffice as a formula, so a
 * registrant calling themselves `=cmd|'/c calc'!A1` runs when an admin
 * opens the export.
 *
 * Prefixing with an apostrophe is the standard neutraliser: the cell
 * reads as text, and the apostrophe is not part of the value.
 */
function csvEscape(value: unknown): string {
	const text = value === null || value === undefined ? '' : String(value);

	const safe = /^[=+\-@\t\r]/.test(text) ? `'${text}` : text;

	return /[",\n\r]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe;
}

/*
 * The R2 object holding an event's registrations.
 *
 * Keyed on the event's immutable id, never on its slug. The slug went
 * through `replace(/[^a-zA-Z0-9_-]/g, '-')`, which is many-to-one:
 * "dumbathon-2.0" and "dumbathon-2-0" both became "dumbathon-2-0", so
 * archiving the second event overwrote the first's object — and the
 * cron then deleted the first event's rows from D1, having "verified"
 * that an object existed at that key. Renaming an event had the mirror
 * problem: the key moved and the old archive became unreachable.
 */
function archiveKeyFor(eventId: string): string {
	return `events/${eventId}/registrations.csv.gz`;
}

/*
 * The public /team roster lives in D1 (see 0014_team_members.sql) so the
 * admin panel can add, edit and remove members and upload photos at
 * runtime. These helpers shape a row for the API and locate the R2 object
 * behind an uploaded photo so it can be freed on replace or delete.
 */
const TEAM_TIERS = ['Admins', 'Track Leads', 'Technical Leads', 'Executive Members'];

const TEAM_IMAGE_EXT: Record<string, string> = {
	'image/png': 'png',
	'image/jpeg': 'jpg',
	'image/webp': 'webp',
};

const TEAM_IMAGE_MAX_BYTES = 5 * 1024 * 1024;

interface TeamMemberRow {
	id: number;
	name: string;
	role: string;
	tier: string;
	bio: string;
	image_url: string;
	github: string | null;
	linkedin: string | null;
	instagram: string | null;
	website: string | null;
}

const TEAM_MEMBER_COLUMNS =
	'id, name, role, tier, bio, image_url, github, linkedin, instagram, website';

function serializeTeamMember(row: TeamMemberRow) {
	return {
		id: String(row.id),
		name: row.name,
		role: row.role,
		tier: row.tier,
		bio: row.bio,
		image: row.image_url,
		/*
		 * Undefined keys are dropped by JSON.stringify, so the shape matches
		 * the old static teamData where a missing social was simply absent.
		 */
		socials: {
			github: row.github ?? undefined,
			linkedin: row.linkedin ?? undefined,
			instagram: row.instagram ?? undefined,
			website: row.website ?? undefined,
		},
	};
}

/* Empty and whitespace-only inputs collapse to null so the column is clear. */
function cleanSocial(value: unknown): string | null {
	if (typeof value !== 'string') return null;
	const trimmed = value.trim();
	return trimmed ? trimmed : null;
}

/*
 * The R2 key behind an uploaded photo, or null for a seeded /team/*.webp
 * path — those live in the site's public folder and must never be deleted.
 */
function teamImageKey(imageUrl: string | null | undefined): string | null {
	if (!imageUrl) return null;
	const match = /\/api\/team\/image\/([A-Za-z0-9._-]+)$/.exec(imageUrl);
	return match ? `team/${match[1]}` : null;
}

async function buildRegistrationCsv(
	env: Env,
	slug: string,
): Promise<{
	event: {
		id: string;
		slug: string;
		title: string;
	};
	csv: string;
	/*
	 * Data rows, excluding the header. An empty registration set is
	 * otherwise indistinguishable from a full one at the call site,
	 * which is how a header-only CSV came to overwrite a good archive.
	 */
	rowCount: number;
} | null> {
	const event = await env.DB.prepare(
		`
      SELECT id, slug, title
      FROM events
      WHERE slug = ?
    `,
	)
		.bind(slug)
		.first<{
			id: string;
			slug: string;
			title: string;
		}>();

	if (!event) {
		return null;
	}

	const { results } = await env.DB.prepare(
		`
      SELECT
        r.id AS registration_id,
        r.team_name,
        r.team_size,
        rm.member_number,
        rm.name,
        rm.year_of_study,
        rm.college_registration_number,
        rm.github,
        rm.email,
        r.created_at AS registration_date
      FROM registrations r
      INNER JOIN registration_members rm
        ON rm.registration_id = r.id
      WHERE r.event_id = ?
      ORDER BY r.created_at ASC, rm.member_number ASC
    `,
	)
		.bind(event.id)
		.all<{
			registration_id: number;
			team_name: string | null;
			team_size: number;
			member_number: number;
			name: string;
			year_of_study: string;
			college_registration_number: string;
			github: string | null;
			email: string;
			registration_date: string;
		}>();

	const headers = [
		'Registration ID',
		'Team Name',
		'Team Size',
		'Member Number',
		'Name',
		'Year of Study',
		'College Registration Number',
		'GitHub',
		'Email',
		'Registration Date',
	];

	const lines = [
		headers.map(csvEscape).join(','),
		...results.map((row) =>
			[
				row.registration_id,
				row.team_name,
				row.team_size,
				row.member_number,
				row.name,
				row.year_of_study,
				row.college_registration_number,
				row.github,
				row.email,
				row.registration_date,
			]
				.map(csvEscape)
				.join(','),
		),
	];

	return {
		event,
		csv: `\uFEFF${lines.join('\r\n')}\r\n`,
		rowCount: results.length,
	};
}

function csvResponse(csv: string, filename: string, request: Request, env: Env): Response {
	return new Response(csv, {
		status: 200,
		headers: {
			...corsHeaders(request, env),
			'Content-Type': 'text/csv; charset=utf-8',
			'Content-Disposition': `attachment; filename="${filename}"`,
			'Access-Control-Expose-Headers': 'Content-Disposition',
		},
	});
}

async function archiveEventAfterCompletion(
	env: Env,
	event: {
		id: string;
		slug: string;
		title: string;
	},
): Promise<void> {
	/*
	 * Claim the event first so two scheduled executions cannot
	 * archive the same event at the same time.
	 *
	 * IMPORTANT: event_end_at is the trigger. The registration
	 * deadline is intentionally NOT used here.
	 */
	const claim = await env.DB.prepare(
		`
      UPDATE events
      SET archive_status = 'archiving'
      WHERE id = ?
        AND archive_status = 'pending'
        AND event_end_at IS NOT NULL
        AND datetime(event_end_at) <= datetime('now')
    `,
	)
		.bind(event.id)
		.run();

	if (!claim.meta.changes) {
		return;
	}

	const objectKey = archiveKeyFor(event.id);

	/*
	 * Whether this run got as far as removing the D1 rows. Past that
	 * point R2 holds the only copy, so a retry must never be allowed to
	 * rebuild the CSV from an empty table and overwrite it.
	 */
	let d1Purged = false;

	try {
		/*
		 * Build the CSV BEFORE deleting anything from D1.
		 */
		const registrationCsv = await buildRegistrationCsv(env, event.slug);

		if (!registrationCsv) {
			throw new Error('Event not found while creating archive.');
		}

		/*
		 * An event nobody registered for has nothing to preserve. Writing
		 * a header-only object would spend a write and, worse, would look
		 * exactly like a successful archive to anyone reading the bucket
		 * later. Mark it archived and leave R2 alone.
		 */
		if (registrationCsv.rowCount === 0) {
			await env.DB.prepare(
				`
          UPDATE events
          SET
            archive_status = 'archived',
            is_open = 0,
            archived_at = ?
          WHERE id = ?
            AND archive_status = 'archiving'
        `,
			)
				.bind(new Date().toISOString(), event.id)
				.run();

			return;
		}

		/*
		 * Gzip the CSV and materialize the result because R2 requires
		 * a body with a known length in local/Miniflare as well.
		 */
		const source = new Blob([registrationCsv.csv]).stream();

		const compressed = source.pipeThrough(new CompressionStream('gzip'));

		const compressedBody = await new Response(compressed).arrayBuffer();

		await env.osc_events_archives.put(objectKey, compressedBody, {
			httpMetadata: {
				contentType: 'text/csv; charset=utf-8',
				contentEncoding: 'gzip',
			},
			customMetadata: {
				eventId: event.id,
				eventSlug: event.slug,
				eventTitle: event.title,
				rowCount: String(registrationCsv.rowCount),
				archivedBy: 'scheduled-worker',
				archivedAt: new Date().toISOString(),
			},
		});

		/*
		 * Verify the object we just wrote, not merely that something
		 * exists at the key. The old check passed as long as ANY object
		 * was there — including another event's, back when the key was
		 * derived from a lossy slug transform — and the D1 delete went
		 * ahead on that basis.
		 */
		const archive = await env.osc_events_archives.head(objectKey);

		if (!archive) {
			throw new Error('R2 archive verification failed: no object at key.');
		}

		if (archive.customMetadata?.eventId !== event.id) {
			throw new Error('R2 archive verification failed: object belongs to a different event.');
		}

		if (archive.size !== compressedBody.byteLength) {
			throw new Error('R2 archive verification failed: size does not match the upload.');
		}

		/*
		 * Record where the archive lives BEFORE removing the rows it
		 * replaces, so a crash between the two still leaves a pointer to
		 * the surviving copy.
		 */
		await env.DB.prepare(
			`
        UPDATE events
        SET
          archive_key = ?,
          archived_at = ?
        WHERE id = ?
          AND archive_status = 'archiving'
      `,
		)
			.bind(objectKey, new Date().toISOString(), event.id)
			.run();

		/*
		 * Delete members first, then registrations.
		 * The archived CSV is already safely stored in R2.
		 */
		await env.DB.batch([
			env.DB.prepare(
				`
          DELETE FROM registration_members
          WHERE event_id = ?
        `,
			).bind(event.id),

			env.DB.prepare(
				`
          DELETE FROM registrations
          WHERE event_id = ?
        `,
			).bind(event.id),
		]);

		d1Purged = true;

		/*
		 * Mark the event archived only after the R2 archive and D1
		 * cleanup have succeeded.
		 */
		await env.DB.prepare(
			`
        UPDATE events
        SET
          archive_status = 'archived',
          is_open = 0
        WHERE id = ?
          AND archive_status = 'archiving'
      `,
		)
			.bind(event.id)
			.run();
	} catch (error) {
		console.error('Automatic event archive failed:', event.slug, error);

		/*
		 * Retrying is only safe while the rows still exist. Once they are
		 * gone R2 is the sole copy, and a retry would rebuild an empty
		 * CSV over it — so that case goes to a state the cron does not
		 * select, to be looked at by a human.
		 */
		const nextStatus = d1Purged ? 'needs_attention' : 'pending';

		if (d1Purged) {
			console.error(
				'Archive left needing attention: D1 rows for',
				event.slug,
				'are deleted and the archive is at',
				objectKey,
			);
		}

		try {
			await env.DB.prepare(
				`
          UPDATE events
          SET archive_status = ?
          WHERE id = ?
            AND archive_status = 'archiving'
        `,
			)
				.bind(nextStatus, event.id)
				.run();
		} catch (rollbackError) {
			/*
			 * The event stays claimed as 'archiving', which the cron does
			 * not select — safe, but it needs a human. Swallowing this
			 * keeps one stuck event from aborting the whole run.
			 */
			console.error('Archive rollback failed, event left claimed:', event.slug, rollbackError);
		}
	}
}

async function processCompletedEvents(env: Env): Promise<void> {
	/*
	 * Only the ACTUAL EVENT END TIME triggers cleanup.
	 * Registration deadline is deliberately ignored.
	 */
	const { results } = await env.DB.prepare(
		`
      SELECT
        id,
        slug,
        title
      FROM events
      WHERE event_end_at IS NOT NULL
        AND datetime(event_end_at) <= datetime('now')
        AND archive_status = 'pending'
      ORDER BY event_end_at ASC
      LIMIT 10
    `,
	).all<{
		id: string;
		slug: string;
		title: string;
	}>();

	/*
	 * One event that throws must not take the rest of the batch — or the
	 * expired-row purge that runs after it — down with it.
	 */
	for (const event of results) {
		try {
			await archiveEventAfterCompletion(env, event);
		} catch (error) {
			console.error('Archive threw for event, continuing:', event.slug, error);
		}
	}
}

/*
 * Expired sessions and OAuth states are dead on read — the lookups all
 * filter on expires_at — but the rows themselves used to accumulate
 * forever. Sweeping them hourly keeps the tables at working-set size.
 *
 * datetime() on both sides for the reason described at EXPIRY_NOTE.
 */
async function purgeExpiredAuthRows(env: Env): Promise<void> {
	await env.DB.batch([
		env.DB.prepare(`DELETE FROM admin_sessions WHERE datetime(expires_at) <= datetime('now')`),
		env.DB.prepare(`DELETE FROM admin_oauth_states WHERE datetime(expires_at) <= datetime('now')`),
		/* Door phones expire the same way admins do. Their sessions are
		   long, so without this they would sit in the table until the
		   event row was deleted. */
		env.DB.prepare(`DELETE FROM scanner_sessions WHERE datetime(expires_at) <= datetime('now')`),
	]);
}

export default {
	async scheduled(_controller: ScheduledController, env: Env, _ctx: ExecutionContext): Promise<void> {
		await processCompletedEvents(env);

		await purgeExpiredAuthRows(env);
	},

	async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
		try {
			const url = new URL(request.url);

			/*
			 * ============================================================
			 * CORS
			 * ============================================================
			 */

			if (request.method === 'OPTIONS') {
				return new Response(null, {
					status: 204,
					headers: corsHeaders(request, env),
				});
			}

			/*
			 * ============================================================
			 * HEALTH
			 * ============================================================
			 */

			if (request.method === 'GET' && url.pathname === '/api/health') {
				return json({ status: 'ok' }, 200, request, env);
			}

			/*
			 * ============================================================
			 * DOOR SCANNING
			 * ============================================================
			 *
			 * Everything a phone on a queue can do. Three routes, no
			 * OAuth, and no path from here into /api/admin.
			 */

			/* Trade a device token for a session. */
			if (request.method === 'POST' && url.pathname === '/api/scan/session') {
				/* Same budget as the admin sign-in: this is a credential
				   check and there are five of them in the world. */
				if (!(await withinRateLimit(env.AUTH_LIMITER, `scan-session:${clientIp(request)}`))) {
					return rateLimited(request, env);
				}

				const pepper = env.ADMIN_HANDLE_PEPPER?.trim();

				/*
				 * Without the pepper no digest can be computed, so no
				 * device can be recognised. Failing closed rather than
				 * falling back to comparing raw tokens.
				 */
				if (!pepper) {
					console.error('Scanner sign-in attempted with no ADMIN_HANDLE_PEPPER set');
					return json({ error: 'Scanner sign-in is unavailable' }, 503, request, env);
				}

				let body: { device_token?: unknown };

				try {
					body = await request.json();
				} catch {
					return json({ error: 'Invalid JSON body' }, 400, request, env);
				}

				const deviceToken = asString(body.device_token).trim();

				if (!deviceToken) {
					return json({ error: 'Device token is required' }, 400, request, env);
				}

				const digest = await hmacHex(deviceToken, pepper);

				/*
				 * Looked up by digest, so the token itself is never
				 * compared and never has to be in memory next to the
				 * stored value.
				 */
				const device = await env.DB.prepare(
					`
            SELECT id, event_id, label
            FROM scanner_devices
            WHERE token_hash = ?
              AND revoked_at IS NULL
          `,
				)
					.bind(digest)
					.first<{ id: string; event_id: string; label: string }>();

				if (!device) {
					/* Deliberately the same answer as a malformed token:
					   this endpoint should not confirm that a device id
					   exists to someone guessing. */
					return json({ error: 'That device token was not recognised' }, 401, request, env);
				}

				const sessionId = randomToken();

				const expiresAt = new Date(Date.now() + SCAN_SESSION_HOURS * 3600 * 1000).toISOString();

				await env.DB.prepare(
					`
            INSERT INTO scanner_sessions (id, device_id, event_id, expires_at)
            VALUES (?, ?, ?, ?)
          `,
				)
					.bind(sessionId, device.id, device.event_id, expiresAt)
					.run();

				console.log('Scanner signed in:', device.id, device.label);

				const headers = new Headers(corsHeaders(request, env));
				headers.set('Content-Type', 'application/json');
				headers.set('Set-Cookie', scanSessionCookie(sessionId, request));

				return new Response(
					JSON.stringify({
						device_id: device.id,
						label: device.label,
						expires_at: expiresAt,
					}),
					{ status: 200, headers },
				);
			}

			/*
			 * The claim. One person, one token, one verdict.
			 *
			 * The whole admission is a single SQL statement, which is
			 * the point. An earlier design took a capacity slot with an
			 * UPDATE and then recorded the entry with an INSERT, which
			 * leaks a slot every time the insert loses to the unique
			 * index — and the compensating write is itself a write that
			 * can fail, on wifi this design already calls bad. There is
			 * nothing to compensate for here: the capacity test and the
			 * slot are the same commit, and a duplicate simply inserts
			 * no row.
			 */
			if (request.method === 'POST' && url.pathname === '/api/scan/claim') {
				const auth = await requireScanner(request, env);

				if (!auth.ok) {
					return auth.response;
				}

				const { deviceId, eventId } = auth.scanner;

				let body: { token?: unknown };

				try {
					body = await request.json();
				} catch {
					return json({ error: 'Invalid JSON body' }, 400, request, env);
				}

				const token = asString(body.token).trim();

				if (!token || token.length > 200) {
					return json({ verdict: 'unknown' }, 200, request, env);
				}

				/*
				 * Admitted only if every one of these holds, checked
				 * inside the one statement so none of them can go stale
				 * between the check and the insert:
				 *
				 *   the pass exists and is not revoked
				 *   the gate is open
				 *   the room is not at capacity
				 *   for a registered pass, general admission is not full
				 *   this token is not already inside
				 *
				 * General admission is capped at capacity less the
				 * reserved passes actually issued, counted live rather
				 * than read from a column, so a reserved person who has
				 * not arrived yet still has a seat waiting.
				 */
				const claimed = await env.DB.prepare(
					`
            INSERT INTO entry_scans (event_id, token, kind, device_id)
            SELECT p.event_id, p.token, p.kind, ?2
              FROM entry_passes p
              JOIN entry_gate g ON g.event_id = p.event_id
             WHERE p.token = ?1
               AND p.revoked_at IS NULL
               AND g.is_open = 1
               AND (
                     SELECT COUNT(*) FROM entry_scans s
                      WHERE s.event_id = p.event_id AND s.voided_at IS NULL
                   ) < g.capacity
               AND (
                     p.kind = 'reserved'
                     OR (
                          SELECT COUNT(*) FROM entry_scans s
                           WHERE s.event_id = p.event_id
                             AND s.kind = 'registered'
                             AND s.voided_at IS NULL
                        ) < g.capacity - (
                          SELECT COUNT(*) FROM entry_passes r
                           WHERE r.event_id = p.event_id
                             AND r.kind = 'reserved'
                             AND r.revoked_at IS NULL
                        )
                   )
            ON CONFLICT (event_id, token) WHERE voided_at IS NULL DO NOTHING
            RETURNING id, kind
          `,
				)
					.bind(token, deviceId)
					.all<{ id: number; kind: string }>();

				const admitted = claimed.results?.[0];

				if (admitted) {
					const pass = await env.DB.prepare(
						`SELECT name, seat_id, kind, college_registration_number FROM entry_passes WHERE token = ?`,
					)
						.bind(token)
						.first<{
							name: string;
							seat_id: string | null;
							kind: string;
							college_registration_number: string;
						}>();

					/*
					 * One line per scan, so `wrangler tail` is a live view
					 * of the door.
					 *
					 * Only the first eight characters of the token. It is a
					 * credential: anyone reading it out of a log can walk in
					 * on somebody else's pass, and eight is enough to match
					 * a scan against its row when something needs chasing.
					 */
					console.log(
						`SCAN admitted  ${deviceId}  ${token.slice(0, 8)}…  ${admitted.kind}`,
					);

					ctx.waitUntil(recordEntryEvent(env, eventId, token, deviceId, 'admitted'));

					return json(
						{
							verdict: 'admitted',
							kind: admitted.kind,
							name: pass?.name ?? null,
							seat_id: pass?.seat_id ?? null,
							/*
							 * The registration number, but only for a
							 * reserved pass.
							 *
							 * A reserved seat is assigned to one named
							 * person, so the volunteer showing them to it
							 * has to be able to check the pass belongs to
							 * whoever is holding it. General admission has
							 * no seat to be wrong about, so it does not get
							 * the same field: a door phone should carry the
							 * least identifying detail that still does the
							 * job, and for most of the queue that is a name.
							 */
							college_registration_number:
								pass?.kind === 'reserved'
									? (pass.college_registration_number ?? null)
									: null,
						},
						200,
						request,
						env,
					);
				}

				/*
				 * Nothing was inserted. Why is a separate read, because
				 * inferring it from an absent row would turn "already
				 * inside" and "never registered" into the same answer,
				 * and those need opposite reactions from a volunteer.
				 */
				const verdict = await classifyRefusal(env, eventId, token);

				console.log(
					`SCAN ${verdict.verdict.padEnd(9)} ${deviceId}  ${token.slice(0, 8)}…`,
				);

				ctx.waitUntil(recordEntryEvent(env, eventId, token, deviceId, verdict.verdict));

				return json(verdict, 200, request, env);
			}

			/* Live counts for the queue display. */
			if (request.method === 'GET' && url.pathname === '/api/scan/state') {
				const auth = await requireScanner(request, env);

				if (!auth.ok) {
					return auth.response;
				}

				return json(await gateState(env, auth.scanner.eventId), 200, request, env);
			}

			/*
			 * ============================================================
			 * GITHUB OAUTH
			 * ============================================================
			 */

			if (request.method === 'GET' && url.pathname === '/auth/github') {
				/*
				 * This endpoint writes a state row per hit and is only used
				 * by a handful of admins, so it gets the strictest limit.
				 */
				if (!(await withinRateLimit(env.AUTH_LIMITER, `auth:${clientIp(request)}`))) {
					return rateLimited(request, env);
				}

				const state = randomToken();

				const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString();

				await env.DB.prepare(
					`
	          INSERT INTO admin_oauth_states
	            (state, expires_at)
	          VALUES (?, ?)
	        `,
				)
					.bind(state, expiresAt)
					.run();

				const githubUrl = new URL('https://github.com/login/oauth/authorize');

				githubUrl.searchParams.set('client_id', env.GITHUB_CLIENT_ID);

				githubUrl.searchParams.set('redirect_uri', `${url.origin}/auth/github/callback`);

				githubUrl.searchParams.set('scope', 'read:org');

				githubUrl.searchParams.set('state', state);

				/*
				 * The state row alone proves the flow started here, but not
				 * that it started in THIS browser. Without that, someone can
				 * begin a sign-in, keep the callback URL, and get a victim
				 * to open it — the victim's browser then receives a session
				 * for the attacker's GitHub account, and every subsequent
				 * created_by / updated_by / deleted_by records the wrong
				 * person.
				 *
				 * Pairing the state with a cookie ties the two halves of the
				 * flow to one browser. Ten minutes, matching the row's TTL.
				 */
				return new Response(null, {
					status: 302,
					headers: {
						Location: githubUrl.toString(),
						'Set-Cookie': oauthStateCookie(state, request),
					},
				});
			}

			/*
			 * GitHub OAuth callback
			 */

			if (request.method === 'GET' && url.pathname === '/auth/github/callback') {
				/*
				 * Same budget as the start of the flow — the callback burns
				 * a single-use state, but it also drives two GitHub API
				 * calls per hit.
				 */
				if (!(await withinRateLimit(env.AUTH_LIMITER, `auth:${clientIp(request)}`))) {
					return rateLimited(request, env);
				}

				const code = url.searchParams.get('code');

				const state = url.searchParams.get('state');

				/*
				 * GitHub sends the user back with ?error=access_denied when
				 * they press Cancel on the authorise screen. That arrives
				 * without a code, so it used to be reported as "missing
				 * code" — telling someone who deliberately cancelled that
				 * something was broken.
				 */
				if (url.searchParams.get('error')) {
					return authFailureRedirect(
						request,
						url.searchParams.get('error') === 'access_denied' ? 'denied' : 'github-error',
					);
				}

				if (!code || !state) {
					return authFailureRedirect(request, 'no-code');
				}

				/*
				 * Validate OAuth state
				 *
				 * Two halves. The cookie proves this browser is the one
				 * that started the flow; the row proves the flow started
				 * here at all and has not been used already. A state that
				 * satisfies only the row is a callback someone else began,
				 * which is how a victim ends up holding a session for the
				 * attacker's GitHub account.
				 */
				const statedCookie = getCookie(request, 'osc_oauth_state');

				if (!statedCookie || statedCookie !== state) {
					return authFailureRedirect(request, 'bad-state');
				}

				const oauthState = await env.DB.prepare(
					`
	            SELECT
	              state,
	              expires_at
	            FROM admin_oauth_states
	            WHERE state = ?
	              AND datetime(expires_at) > datetime('now')
	          `,
				)
					.bind(state)
					.first<{
						state: string;
						expires_at: string;
					}>();

				if (!oauthState) {
					return authFailureRedirect(request, 'bad-state');
				}

				/*
				 * OAuth states are single-use.
				 */

				await env.DB.prepare(
					`
	          DELETE FROM admin_oauth_states
	          WHERE state = ?
	        `,
				)
					.bind(state)
					.run();

				/*
				 * Exchange authorization code
				 * for GitHub access token.
				 */

				const tokenResponse = await fetch('https://github.com/login/oauth/access_token', {
					method: 'POST',
					headers: {
						Accept: 'application/json',
						'Content-Type': 'application/json',
					},
					body: JSON.stringify({
						client_id: env.GITHUB_CLIENT_ID,
						client_secret: env.GITHUB_CLIENT_SECRET,
						code,
						redirect_uri: `${url.origin}/auth/github/callback`,
					}),
				});

				if (!tokenResponse.ok) {
					return authFailureRedirect(request, 'github-error');
				}

				const tokenData = (await tokenResponse.json()) as {
					access_token?: string;
					token_type?: string;
					scope?: string;
					error?: string;
					error_description?: string;
				};

				if (!tokenData.access_token) {
					return authFailureRedirect(request, tokenData.error === 'access_denied' ? 'denied' : 'github-error');
				}

				const accessToken = tokenData.access_token;

				/*
				 * Get authenticated GitHub user.
				 */

				const githubUserResponse = await fetch('https://api.github.com/user', {
					headers: {
						Authorization: `Bearer ${accessToken}`,
						Accept: 'application/vnd.github+json',
						'X-GitHub-Api-Version': '2022-11-28',
						'User-Agent': 'OSC-VITAP-Events-Admin',
					},
				});

				if (!githubUserResponse.ok) {
					return authFailureRedirect(request, 'github-error');
				}

				const githubUser = (await githubUserResponse.json()) as {
					id: number;
					login: string;
				};

				/*
				 * ==========================================================
				 * ADMIN ALLOW LIST
				 * ==========================================================
				 *
				 * Checked before the team lookup so a handle that is not
				 * allowed is rejected without a second GitHub call.
				 */

				const githubUserId = String(githubUser.id);

				if (!(await isAllowedAdmin(githubUserId, githubUser.login, env))) {
					console.log('Admin allow list rejected:', githubUser.login);

					return authFailureRedirect(request, 'not-allowed');
				}

				/*
				 * ==========================================================
				 * OSC VIT-AP ORGANISATION AUTHORIZATION
				 * ==========================================================
				 *
				 * Membership of the osc-vitap organisation is the gate.
				 * This reads the signed-in user's own membership, so it
				 * works for private members too, which listing the
				 * organisation's members would not.
				 *
				 * An account whose id digest is in
				 * ADMIN_OUTSIDER_ID_HASHES skips the gate entirely. That
				 * is the whole point of the setting, and it is the only
				 * way into the dashboard that organisation membership does
				 * not vouch for — so it is logged every time it is used.
				 * The handle is in the log line for a human to read; the
				 * decision above it is the id's alone.
				 */

				if (await isOrgExempt(githubUserId, env)) {
					console.log('Admin allowed without organisation membership:', githubUser.login);
				} else {
					const membershipResponse = await fetch(`https://api.github.com/user/memberships/orgs/${GITHUB_ORG}`, {
						headers: {
							Authorization: `Bearer ${accessToken}`,
							Accept: 'application/vnd.github+json',
							'X-GitHub-Api-Version': '2022-11-28',
							'User-Agent': 'OSC-VITAP-Events-Admin',
						},
					});

					if (!membershipResponse.ok) {
						const githubError = await membershipResponse.text();

						console.log('GitHub org membership check:', githubUser.login, membershipResponse.status, githubError);

						return authFailureRedirect(request, 'not-a-member');
					}

					const membership = (await membershipResponse.json()) as {
						state?: string;
						role?: string;
					};

					/*
					 * An invitation that has not been accepted yet comes
					 * back as 'pending'.
					 */
					if (membership.state !== 'active') {
						return authFailureRedirect(request, 'pending-invite');
					}
				}

				/*
				 * ==========================================================
				 * SERVER-SIDE SESSION
				 * ==========================================================
				 */

				const sessionId = randomToken();

				const sessionExpiresAt = new Date(Date.now() + 8 * 60 * 60 * 1000).toISOString();

				await env.DB.prepare(
					`
	          INSERT INTO admin_sessions
	            (
	              id,
	              github_user_id,
	              github_username,
	              expires_at
	            )
	          VALUES (?, ?, ?, ?)
	        `,
				)
					.bind(sessionId, githubUserId, githubUser.login, sessionExpiresAt)
					.run();

				/*
				 * IMPORTANT:
				 * Do not return the authentication result as JSON here.
				 *
				 * The browser should be redirected back to the
				 * React admin dashboard after successful authentication.
				 */

				const successHeaders = new Headers({
					Location: `${siteOrigin(request)}/admin`,
				});

				successHeaders.append('Set-Cookie', sessionCookie(sessionId, request));

				/* The flow is finished; the state cookie has no further use. */
				successHeaders.append('Set-Cookie', clearedOauthStateCookie(request));

				return new Response(null, {
					status: 302,
					headers: successHeaders,
				});
			}

			/*
			 * ============================================================
			 * SIGN OUT
			 * ============================================================
			 *
			 * There was no way to end a session at all: the only
			 * terminator was expires_at, and that comparison was broken
			 * (see EXPIRY_NOTE), so a session on a shared club laptop
			 * outlived its owner's use of it by a day or more.
			 *
			 * The row is deleted rather than flagged, so the session is
			 * dead server-side even if the browser keeps the cookie.
			 * Unauthenticated callers get the same answer as authenticated
			 * ones — signing out something that is already signed out is
			 * not an error, and it stops this becoming a probe for whether
			 * a given session id is live.
			 */
			if (request.method === 'POST' && url.pathname === '/auth/logout') {
				const sessionId = getCookie(request, 'osc_admin_session');

				if (sessionId) {
					await env.DB.prepare(`DELETE FROM admin_sessions WHERE id = ?`).bind(sessionId).run();
				}

				return new Response(JSON.stringify({ success: true, signed_out: true }), {
					status: 200,
					headers: {
						...corsHeaders(request, env),
						'Content-Type': 'application/json',
						'Set-Cookie': clearedSessionCookie(request),
					},
				});
			}

			/*
			 * ============================================================
			 * REVOKE EVERY SESSION FOR A HANDLE
			 * ============================================================
			 *
			 * Organisation membership is checked once, during the OAuth
			 * callback, using an access token that migration 0004
			 * deliberately does not persist — so it cannot be rechecked
			 * per request. Removing someone from the GitHub organisation
			 * therefore does not, on its own, end a session they already
			 * hold.
			 *
			 * This is the lever that closes that gap without storing
			 * tokens: any current admin can kill every session belonging
			 * to a handle immediately.
			 */
			const revokeMatch = url.pathname.match(/^\/api\/admin\/sessions\/([^/]+)$/);

			if (request.method === 'DELETE' && revokeMatch) {
				const auth = await requireAdmin(request, env);

				if (!auth.authorized) {
					return auth.response;
				}

				const handle = decodeURIComponent(revokeMatch[1]).toLowerCase();

				const result = await env.DB.prepare(`DELETE FROM admin_sessions WHERE LOWER(github_username) = ?`)
					.bind(handle)
					.run();

				console.log('Admin sessions revoked:', handle, 'by', auth.session.github_username);

				return json(
					{
						success: true,
						github_username: handle,
						sessions_revoked: result.meta.changes,
						revoked_by: auth.session.github_username,
					},
					200,
					request,
					env,
				);
			}

			/*
			 * ============================================================
			 * CURRENT ADMIN SESSION
			 * ============================================================
			 */

			if (request.method === 'GET' && url.pathname === '/api/admin/me') {
				const session = await getAdminSession(request, env);

				if (!session) {
					return json(
						{
							authenticated: false,
						},
						401,
						request,
						env,
					);
				}

				return json(
					{
						authenticated: true,
						github_username: session.github_username,
						role: `${GITHUB_ORG}-member`,
						expires_at: session.expires_at,
					},
					200,
					request,
					env,
				);
			}

			/*
			 * ============================================================
			 * ADMIN EVENT REGISTRATIONS
			 * ============================================================
			 */

			if (request.method === 'GET' && url.pathname.match(/^\/api\/admin\/events\/[^/]+\/registrations$/)) {
				const auth = await requireAdmin(request, env);

				if (!auth.authorized) {
					return auth.response;
				}

				const slug = url.pathname.split('/')[4];

				if (!slug) {
					return json(
						{
							error: 'Event slug is required',
						},
						400,
						request,
						env,
					);
				}

				const event = await env.DB.prepare(
					`
	        SELECT
	          id,
	          slug,
	          title,
	          registration_type,
	          min_team_size,
	          max_team_size,
	          registration_deadline
	        FROM events
	        WHERE slug = ?
	      `,
				)
					.bind(slug)
					.first<{
						id: string;
						slug: string;
						title: string;
						registration_type: 'solo' | 'team' | 'workshop';
						min_team_size: number;
						max_team_size: number;
						registration_deadline: string | null;
					}>();

				if (!event) {
					return json(
						{
							error: 'Event not found',
						},
						404,
						request,
						env,
					);
				}

				const { results } = await env.DB.prepare(
					`
	        SELECT
	          r.id,
	          r.team_name,
	          r.team_size,
	          r.created_at,
	          rm.id AS member_id,
	          rm.name,
	          rm.year_of_study,
	          rm.college_registration_number,
	          rm.github,
	          rm.email,
	          rm.member_number
	        FROM registrations r
	        LEFT JOIN registration_members rm
	          ON rm.registration_id = r.id
	        WHERE r.event_id = ?
	        ORDER BY
	          r.created_at DESC,
	          rm.member_number ASC
	      `,
				)
					.bind(event.id)
					.all<{
						id: number;
						team_name: string | null;
						team_size: number;
						created_at: string;
						member_id: number | null;
						name: string | null;
						year_of_study: string | null;
						college_registration_number: string | null;
						github: string | null;
						email: string | null;
						member_number: number | null;
					}>();

				const registrationMap = new Map<
					number,
					{
						id: number;
						team_name: string | null;
						team_size: number;
						created_at: string;
						members: {
							id: number;
							name: string;
							year_of_study: string;
							college_registration_number: string;
							github: string | null;
							email: string;
							member_number: number;
						}[];
					}
				>();

				for (const row of results) {
					if (!registrationMap.has(row.id)) {
						registrationMap.set(row.id, {
							id: row.id,
							team_name: row.team_name,
							team_size: row.team_size,
							created_at: row.created_at,
							members: [],
						});
					}

					if (
						row.member_id !== null &&
						row.name !== null &&
						row.year_of_study !== null &&
						row.college_registration_number !== null &&
						row.email !== null &&
						row.member_number !== null
					) {
						registrationMap.get(row.id)!.members.push({
							id: row.member_id,
							name: row.name,
							year_of_study: row.year_of_study,
							college_registration_number: row.college_registration_number,
							github: row.github,
							email: row.email,
							member_number: row.member_number,
						});
					}
				}

				return json(
					{
						event,
						registrations: Array.from(registrationMap.values()),
					},
					200,
					request,
					env,
				);
			}

			/*
			 * ============================================================
			 * ADMIN EVENT REGISTRATIONS CSV
			 * ============================================================
			 */

			if (request.method === 'GET' && url.pathname.match(/^\/api\/admin\/events\/[^/]+\/registrations\.csv$/)) {
				const auth = await requireAdmin(request, env);

				if (!auth.authorized) {
					return auth.response;
				}

				const slug = url.pathname.split('/')[4];

				if (!slug) {
					return json({ error: 'Event slug is required' }, 400, request, env);
				}

				const registrationCsv = await buildRegistrationCsv(env, slug);

				if (!registrationCsv) {
					return json({ error: 'Event not found' }, 404, request, env);
				}

				const safeSlug = registrationCsv.event.slug.replace(/[^a-zA-Z0-9_-]/g, '-');

				return csvResponse(registrationCsv.csv, `${safeSlug}-registrations.csv`, request, env);
			}

			/*
			 * ============================================================
			 * ADMIN EVENT REGISTRATIONS R2 ARCHIVE
			 * ============================================================
			 *
			 * Creates a private gzip-compressed CSV archive in R2.
			 * This does NOT delete anything from D1.
			 */

			if (request.method === 'POST' && url.pathname.match(/^\/api\/admin\/events\/[^/]+\/registrations\/archive$/)) {
				const auth = await requireAdmin(request, env);

				if (!auth.authorized) {
					return auth.response;
				}

				const slug = url.pathname.split('/')[4];

				if (!slug) {
					return json({ error: 'Event slug is required' }, 400, request, env);
				}

				const registrationCsv = await buildRegistrationCsv(env, slug);

				if (!registrationCsv) {
					return json({ error: 'Event not found' }, 404, request, env);
				}

				/*
				 * This endpoint takes a snapshot; the cron takes the
				 * archive of record. Calling it after the cron has run used
				 * to rebuild the CSV from a table the cron had already
				 * emptied, and put that header-only result over the real
				 * archive at the same key — destroying the only remaining
				 * copy and answering {"success": true}.
				 *
				 * Two guards, either of which is enough on its own.
				 */
				if (registrationCsv.rowCount === 0) {
					return json(
						{
							error:
								'Refusing to archive: this event has no registrations in the database. If it has already been archived, the existing archive is the copy of record — download it instead.',
						},
						409,
						request,
						env,
					);
				}

				const existing = await env.DB.prepare(`SELECT archive_status, archive_key FROM events WHERE slug = ?`)
					.bind(registrationCsv.event.slug)
					.first<{ archive_status: string; archive_key: string | null }>();

				if (existing?.archive_status === 'archived' && url.searchParams.get('overwrite') !== '1') {
					return json(
						{
							error:
								'This event is already archived. Overwriting would replace the stored copy. Pass ?overwrite=1 if that is genuinely what you want.',
							archive_key: existing.archive_key,
						},
						409,
						request,
						env,
					);
				}

				const objectKey = archiveKeyFor(registrationCsv.event.id);

				const source = new Blob([registrationCsv.csv]).stream();

				const compressed = source.pipeThrough(new CompressionStream('gzip'));

				// R2 requires a body with a known length. Materialize the
				// compressed stream before uploading so local and remote R2
				// both receive a fixed-length body.
				const compressedBody = await new Response(compressed).arrayBuffer();

				await env.osc_events_archives.put(objectKey, compressedBody, {
					httpMetadata: {
						contentType: 'text/csv; charset=utf-8',
						contentEncoding: 'gzip',
					},
					customMetadata: {
						eventId: registrationCsv.event.id,
						eventSlug: registrationCsv.event.slug,
						eventTitle: registrationCsv.event.title,
						rowCount: String(registrationCsv.rowCount),
						archivedBy: auth.session.github_username,
						archivedAt: new Date().toISOString(),
					},
				});

				/*
				 * A snapshot records where the copy is, but it does not
				 * retire the event. Setting archive_status = 'archived'
				 * here hid a live event from the public list while the
				 * registration handler — which only reads is_open — kept
				 * accepting entries the cron would never preserve, because
				 * processCompletedEvents only selects 'pending'.
				 */
				await env.DB.prepare(
					`
	      UPDATE events
	      SET
	        archive_key = ?,
	        archived_at = ?
	      WHERE id = ?
	    `,
				)
					.bind(objectKey, new Date().toISOString(), registrationCsv.event.id)
					.run();

				return json(
					{
						success: true,
						message: 'Registration CSV archived successfully',
						event: registrationCsv.event.slug,
						object_key: objectKey,
						rows_archived: registrationCsv.rowCount,
						archived_by: auth.session.github_username,
					},
					200,
					request,
					env,
				);
			}

			/*
			 * ============================================================
			 * ADMIN EVENT REGISTRATIONS R2 ARCHIVE DOWNLOAD
			 * ============================================================
			 *
			 * Returns the private compressed registration archive from R2.
			 * Access is restricted to authenticated/authorized admins.
			 */

			if (request.method === 'GET' && url.pathname.match(/^\/api\/admin\/events\/[^/]+\/registrations\/archive$/)) {
				const auth = await requireAdmin(request, env);

				if (!auth.authorized) {
					return auth.response;
				}

				const slug = url.pathname.split('/')[4];

				if (!slug) {
					return json({ error: 'Event slug is required' }, 400, request, env);
				}

				const event = await env.DB.prepare(
					`SELECT id, slug, title, archive_key
	       FROM events
	       WHERE slug = ?`,
				)
					.bind(slug)
					.first<{
						id: string;
						slug: string;
						title: string;
						archive_key: string | null;
					}>();

				if (!event) {
					return json({ error: 'Event not found' }, 404, request, env);
				}

				const safeSlug = event.slug.replace(/[^a-zA-Z0-9_-]/g, '-');

				/*
				 * Prefer the stored key. Recomputing it from the current
				 * slug meant that renaming an archived event pointed the
				 * download at a key nothing had ever been written to, and
				 * the archive became unreachable through the API while
				 * still sitting in the bucket.
				 *
				 * The id-derived key is the fallback for events archived
				 * before archive_key was recorded ahead of the delete.
				 */
				const objectKey = event.archive_key ?? archiveKeyFor(event.id);

				const archive = await env.osc_events_archives.get(objectKey);

				if (!archive) {
					return json(
						{
							error: 'Registration archive not found',
						},
						404,
						request,
						env,
					);
				}

				return new Response(archive.body, {
					status: 200,
					headers: {
						...corsHeaders(request, env),
						'Content-Type': 'application/gzip',
						'Content-Disposition': `attachment; filename="${safeSlug}-registrations.csv.gz"`,
						'Content-Length': archive.size.toString(),
						'Access-Control-Expose-Headers': 'Content-Disposition',
					},
				});
			}

			/*
			 * ============================================================
			 * ADMIN SEAT RESERVATION CODES
			 * ============================================================
			 */

			if (request.method === 'GET' && url.pathname.match(/^\/api\/admin\/events\/[^/]+\/seat-codes$/)) {
				const auth = await requireAdmin(request, env);

				if (!auth.authorized) {
					return auth.response;
				}

				const slug = url.pathname.split('/')[4];

				if (!slug) {
					return json({ error: 'Event slug is required' }, 400, request, env);
				}

				const event = await env.DB.prepare(
					`
	            SELECT id
	            FROM events
	            WHERE slug = ?
	          `,
				)
					.bind(slug)
					.first<{ id: string }>();

				if (!event) {
					return json({ error: 'Event not found' }, 404, request, env);
				}

				const { results } = await env.DB.prepare(
					`
	            SELECT
	              c.code,
	              c.created_at,
	              c.revoked_at,
	              s.seat_id,
	              s.name,
	              s.college_registration_number,
	              s.email,
	              s.created_at AS used_at
	            FROM seat_reservation_codes c
	            LEFT JOIN seat_reservations s
	              ON s.code = c.code
	            WHERE c.event_id = ?
	            ORDER BY c.created_at DESC, c.code ASC
	          `,
				)
					.bind(event.id)
					.all<{
						code: string;
						created_at: string;
						revoked_at: string | null;
						seat_id: string | null;
						name: string | null;
						college_registration_number: string | null;
						email: string | null;
						used_at: string | null;
					}>();

				return json(
					{
						codes: results.map((row) => ({
							code: row.code,
							created_at: row.created_at,
							revoked_at: row.revoked_at,
							used_by:
								row.seat_id !== null
									? {
											seat_id: row.seat_id,
											name: row.name,
											college_registration_number: row.college_registration_number,
											email: row.email,
											created_at: row.used_at,
										}
									: null,
						})),
					},
					200,
					request,
					env,
				);
			}

			if (request.method === 'POST' && url.pathname.match(/^\/api\/admin\/events\/[^/]+\/seat-codes$/)) {
				const auth = await requireAdmin(request, env);

				if (!auth.authorized) {
					return auth.response;
				}

				const slug = url.pathname.split('/')[4];

				if (!slug) {
					return json({ error: 'Event slug is required' }, 400, request, env);
				}

				const event = await env.DB.prepare(
					`
	            SELECT id
	            FROM events
	            WHERE slug = ?
	          `,
				)
					.bind(slug)
					.first<{ id: string }>();

				if (!event) {
					return json({ error: 'Event not found' }, 404, request, env);
				}

				let codeBody: { count?: unknown };

				try {
					codeBody = await request.json();
				} catch {
					return json({ error: 'Invalid JSON body' }, 400, request, env);
				}

				const count = typeof codeBody.count === 'number' ? codeBody.count : Number.NaN;

				if (!Number.isInteger(count) || count < 1 || count > MAX_SEAT_CODES_PER_BATCH) {
					return json({ error: `Ask for between 1 and ${MAX_SEAT_CODES_PER_BATCH} codes` }, 400, request, env);
				}

				const fresh = new Set<string>();

				/*
				 * A collision is very unlikely, so a few rounds are plenty.
				 * Each round asks the database once, not once per code.
				 */
				for (let round = 0; round < 5 && fresh.size < count; round++) {
					const candidates = new Set<string>();

					while (candidates.size < count - fresh.size) {
						const candidate = generateSeatCode();

						if (!fresh.has(candidate)) {
							candidates.add(candidate);
						}
					}

					const list = [...candidates];

					const existing = await env.DB.prepare(
						`
	                SELECT code
	                FROM seat_reservation_codes
	                WHERE code IN (${list.map(() => '?').join(', ')})
	              `,
					)
						.bind(...list)
						.all<{ code: string }>();

					const taken = new Set(existing.results.map((row) => row.code));

					for (const candidate of list) {
						if (!taken.has(candidate)) {
							fresh.add(candidate);
						}
					}
				}

				if (fresh.size < count) {
					return json({ error: 'Could not generate that many codes. Try again.' }, 503, request, env);
				}

				const codes = [...fresh];

				const codeStatements = codes.map((code) =>
					env.DB.prepare(
						`
	                INSERT INTO seat_reservation_codes
	                  (code, event_id, created_by)
	                VALUES (?, ?, ?)
	              `,
					).bind(code, event.id, auth.session.github_username),
				);

				try {
					await env.DB.batch(codeStatements);
				} catch (error) {
					console.error('Seat code insert failed:', error);

					return json({ error: 'Could not save the new codes. Try again.' }, 500, request, env);
				}

				return json({ codes }, 201, request, env);
			}

			const seatCodeMatch = url.pathname.match(/^\/api\/admin\/events\/([^/]+)\/seat-codes\/([^/]+)$/);

			if (request.method === 'DELETE' && seatCodeMatch) {
				const auth = await requireAdmin(request, env);

				if (!auth.authorized) {
					return auth.response;
				}

				const slug = decodeURIComponent(seatCodeMatch[1]);

				const code = decodeURIComponent(seatCodeMatch[2]).trim().toUpperCase();

				if (!SEAT_CODE_PATTERN.test(code)) {
					return json({ error: 'That is not a reservation code' }, 400, request, env);
				}

				const event = await env.DB.prepare(
					`
	            SELECT id
	            FROM events
	            WHERE slug = ?
	          `,
				)
					.bind(slug)
					.first<{ id: string }>();

				if (!event) {
					return json({ error: 'Event not found' }, 404, request, env);
				}

				const codeRow = await env.DB.prepare(
					`
	            SELECT code
	            FROM seat_reservation_codes
	            WHERE event_id = ?
	              AND code = ?
	          `,
				)
					.bind(event.id, code)
					.first<{ code: string }>();

				if (!codeRow) {
					return json({ error: 'Code not found' }, 404, request, env);
				}

				/*
				 * A used code stays as it is. Revoking it would leave the
				 * seat reserved with no code behind it.
				 */
				const used = await env.DB.prepare(
					`
	            SELECT id
	            FROM seat_reservations
	            WHERE code = ?
	          `,
				)
					.bind(code)
					.first<{ id: number }>();

				if (used) {
					return json({ error: 'That code has already been used' }, 409, request, env);
				}

				await env.DB.prepare(
					`
	            UPDATE seat_reservation_codes
	            SET revoked_at = CURRENT_TIMESTAMP
	            WHERE event_id = ?
	              AND code = ?
	              AND revoked_at IS NULL
	          `,
				)
					.bind(event.id, code)
					.run();

				return json({ ok: true }, 200, request, env);
			}

			/*
			 * ============================================================
			 * ADMIN SEAT RESERVATIONS
			 * ============================================================
			 */

			if (request.method === 'GET' && url.pathname.match(/^\/api\/admin\/events\/[^/]+\/seats\.csv$/)) {
				const auth = await requireAdmin(request, env);

				if (!auth.authorized) {
					return auth.response;
				}

				const slug = url.pathname.split('/')[4];

				if (!slug) {
					return json({ error: 'Event slug is required' }, 400, request, env);
				}

				const event = await env.DB.prepare(
					`
	            SELECT id, slug
	            FROM events
	            WHERE slug = ?
	          `,
				)
					.bind(slug)
					.first<{ id: string; slug: string }>();

				if (!event) {
					return json({ error: 'Event not found' }, 404, request, env);
				}

				const { results } = await env.DB.prepare(
					`
	            SELECT
	              id,
	              seat_id,
	              code,
	              name,
	              college_registration_number,
	              email,
	              email_status,
	              created_at
	            FROM seat_reservations
	            WHERE event_id = ?
	            ORDER BY created_at ASC
	          `,
				)
					.bind(event.id)
					.all<{
						id: number;
						seat_id: string;
						code: string;
						name: string;
						college_registration_number: string;
						email: string;
						email_status: string;
						created_at: string;
					}>();

				const seatHeaders = [
					'Reservation ID',
					'Seat ID',
					'Seat',
					'Code',
					'Name',
					'College Registration Number',
					'Email',
					'Email Status',
					'Reserved At',
				];

				const seatLines = [
					seatHeaders.map(csvEscape).join(','),
					...results.map((row) =>
						[
							row.id,
							row.seat_id,
							seatLabel(row.seat_id),
							row.code,
							row.name,
							row.college_registration_number,
							row.email,
							row.email_status,
							row.created_at,
						]
							.map(csvEscape)
							.join(','),
					),
				];

				const safeSeatSlug = event.slug.replace(/[^a-zA-Z0-9_-]/g, '-');

				return csvResponse(`\uFEFF${seatLines.join('\r\n')}\r\n`, `${safeSeatSlug}-seats.csv`, request, env);
			}

			if (request.method === 'GET' && url.pathname.match(/^\/api\/admin\/events\/[^/]+\/seats$/)) {
				const auth = await requireAdmin(request, env);

				if (!auth.authorized) {
					return auth.response;
				}

				const slug = url.pathname.split('/')[4];

				if (!slug) {
					return json({ error: 'Event slug is required' }, 400, request, env);
				}

				const event = await env.DB.prepare(
					`
	            SELECT id
	            FROM events
	            WHERE slug = ?
	          `,
				)
					.bind(slug)
					.first<{ id: string }>();

				if (!event) {
					return json({ error: 'Event not found' }, 404, request, env);
				}

				const { results } = await env.DB.prepare(
					`
	            SELECT
	              id,
	              seat_id,
	              code,
	              name,
	              college_registration_number,
	              email,
	              email_status,
	              created_at
	            FROM seat_reservations
	            WHERE event_id = ?
	            ORDER BY created_at DESC
	          `,
				)
					.bind(event.id)
					.all<{
						id: number;
						seat_id: string;
						code: string;
						name: string;
						college_registration_number: string;
						email: string;
						email_status: string;
						created_at: string;
					}>();

				return json({ reservations: results }, 200, request, env);
			}

			const seatReservationMatch = url.pathname.match(/^\/api\/admin\/events\/([^/]+)\/seats\/([^/]+)$/);

			if (request.method === 'DELETE' && seatReservationMatch) {
				const auth = await requireAdmin(request, env);

				if (!auth.authorized) {
					return auth.response;
				}

				const slug = decodeURIComponent(seatReservationMatch[1]);

				const reservationId = Number(decodeURIComponent(seatReservationMatch[2]));

				if (!Number.isInteger(reservationId) || reservationId <= 0) {
					return json({ error: 'That is not a reservation id' }, 400, request, env);
				}

				const event = await env.DB.prepare(
					`
	            SELECT id, title, event_date, venue
	            FROM events
	            WHERE slug = ?
	          `,
				)
					.bind(slug)
					.first<{ id: string; title: string; event_date: string; venue: string | null }>();

				if (!event) {
					return json({ error: 'Event not found' }, 404, request, env);
				}

				/* Read before the delete, because the row carries the only
				   copy of who to tell */
				const seated = await env.DB.prepare(
					`
	            SELECT id, seat_id, name, email, college_registration_number
	            FROM seat_reservations
	            WHERE id = ?
	              AND event_id = ?
	          `,
				)
					.bind(reservationId, event.id)
					.first<{
						id: number;
						seat_id: string;
						name: string;
						email: string;
						college_registration_number: string;
					}>();

				if (!seated) {
					return json({ error: 'Reservation not found' }, 404, request, env);
				}

				/*
				 * Deleting the row frees the seat and the code again, which
				 * is the only way back from a wrong or disputed booking.
				 */
				const removed = await env.DB.prepare(
					`
	            DELETE FROM seat_reservations
	            WHERE id = ?
	              AND event_id = ?
	          `,
				)
					.bind(reservationId, event.id)
					.run();

				if (!removed.meta.changes) {
					return json({ error: 'Reservation not found' }, 404, request, env);
				}

				/* A test row or a duplicate should not mail a student, so
				   the admin can turn the notice off */
				const notify = url.searchParams.get('notify') !== 'false';

				if (notify) {
					sendSeatCancellationMail(env, ctx, event, seated);
				}

				return json({ ok: true, notified: notify }, 200, request, env);
			}

			/*
			 * ============================================================
			 * UPDATE ADMIN EVENT
			 * ============================================================
			 */

			if (request.method === 'PATCH' && url.pathname.match(/^\/api\/admin\/events\/[^/]+$/)) {
				const auth = await requireAdmin(request, env);

				if (!auth.authorized) {
					return auth.response;
				}

				const currentSlug = url.pathname.split('/')[4];

				if (!currentSlug) {
					return json(
						{
							error: 'Event slug is required',
						},
						400,
						request,
						env,
					);
				}

				const existingEvent = await env.DB.prepare(
					`
	        SELECT
	          id,
	          slug,
	          title,
	          sub_title,
	          description,
	          venue,
	          event_date,
	          event_end_at,
	          image,
	          is_open,
	          registration_type,
	          min_team_size,
	          max_team_size,
	          registration_deadline
	        FROM events
	        WHERE slug = ?
	      `,
				)
					.bind(currentSlug)
					.first<{
						id: string;
						slug: string;
						title: string;
						sub_title: string | null;
						description: string | null;
						venue: string | null;
						event_date: string;
						event_end_at: string | null;
						image: string | null;
						is_open: number;
						registration_type: 'solo' | 'team' | 'workshop';
						min_team_size: number;
						max_team_size: number;
						registration_deadline: string | null;
					}>();

				if (!existingEvent) {
					return json(
						{
							error: 'Event not found',
						},
						404,
						request,
						env,
					);
				}

				let body: {
					title?: string;
					slug?: string;
					sub_title?: string;
					description?: string;
					venue?: string;
					event_date?: string;
					event_end_at?: string | null;
					image?: string;
					registration_type?: 'solo' | 'team' | 'workshop';
					min_team_size?: number;
					max_team_size?: number;
					is_open?: boolean;
					registration_deadline?: string | null;
				};

				try {
					body = await request.json();
				} catch {
					return json(
						{
							error: 'Invalid JSON body',
						},
						400,
						request,
						env,
					);
				}

				const title = body.title !== undefined ? body.title.trim() : existingEvent.title;

				const slug = body.slug !== undefined ? normalizeSlug(body.slug) : existingEvent.slug;

				const eventDate = body.event_date ?? existingEvent.event_date;

				const registrationDeadline =
					body.registration_deadline !== undefined ? body.registration_deadline : existingEvent.registration_deadline;

				const registrationType = body.registration_type ?? existingEvent.registration_type;

				if (!title || !slug || !eventDate) {
					return json(
						{
							error: 'Title, slug and event date are required.',
						},
						400,
						request,
						env,
					);
				}

				if (!SLUG_PATTERN.test(slug)) {
					return json(
						{
							error: 'Slug must be lowercase letters, numbers and single hyphens, e.g. gittyup26.',
						},
						400,
						request,
						env,
					);
				}

				if (registrationDeadline && Number.isNaN(Date.parse(registrationDeadline))) {
					return json({ error: 'Invalid registration deadline.' }, 400, request, env);
				}

				if (registrationDeadline && Date.parse(registrationDeadline) > Date.parse(eventDate)) {
					return json({ error: 'Registration deadline cannot be after the event date.' }, 400, request, env);
				}

				/*
				 * Omitting event_end_at leaves the stored value alone;
				 * sending null or an empty string clears it.
				 */
				const eventEnd =
					body.event_end_at === undefined
						? { ok: true as const, value: existingEvent.event_end_at }
						: normalizeEventEnd(body.event_end_at);

				if (!eventEnd.ok) {
					return json({ error: 'Invalid event end date.' }, 400, request, env);
				}

				if (eventEnd.value && Date.parse(eventEnd.value) < Date.parse(eventDate)) {
					return json({ error: 'Event end cannot be before the event date.' }, 400, request, env);
				}

				if (!['solo', 'team', 'workshop'].includes(registrationType)) {
					return json(
						{
							error: 'Invalid registration type.',
						},
						400,
						request,
						env,
					);
				}

				let minTeamSize = existingEvent.min_team_size;

				let maxTeamSize = existingEvent.max_team_size;

				if (registrationType === 'team') {
					minTeamSize = body.min_team_size ?? existingEvent.min_team_size;

					maxTeamSize = body.max_team_size ?? existingEvent.max_team_size;

					if (!Number.isInteger(minTeamSize) || !Number.isInteger(maxTeamSize) || minTeamSize < 1 || maxTeamSize < minTeamSize) {
						return json(
							{
								error: 'Invalid team size configuration.',
							},
							400,
							request,
							env,
						);
					}
				} else {
					minTeamSize = 1;
					maxTeamSize = 1;
				}

				try {
					await env.DB.prepare(
						`
	        UPDATE events
	        SET
	          slug = ?,
	          title = ?,
	          sub_title = ?,
	          description = ?,
	          venue = ?,
	          event_date = ?,
	          event_end_at = ?,
	          image = ?,
	          is_open = ?,
	          registration_deadline = ?,
	          registration_type = ?,
	          min_team_size = ?,
	          max_team_size = ?
	        WHERE id = ?
	      `,
					)
						.bind(
							slug,
							title,
							body.sub_title !== undefined ? body.sub_title.trim() : existingEvent.sub_title,
							body.description !== undefined ? body.description.trim() : existingEvent.description,
							body.venue !== undefined ? body.venue.trim() : existingEvent.venue,
							eventDate,
							eventEnd.value,
							body.image !== undefined ? body.image.trim() : existingEvent.image,
							body.is_open !== undefined ? (body.is_open ? 1 : 0) : existingEvent.is_open,
							registrationDeadline,
							registrationType,
							minTeamSize,
							maxTeamSize,
							existingEvent.id,
						)
						.run();
				} catch (error) {
					console.error('Update event failed:', error);

					return json(
						{
							error: 'Unable to update event. The slug may already exist.',
						},
						400,
						request,
						env,
					);
				}

				return json(
					{
						success: true,
						message: 'Event updated',
						updated_by: auth.session.github_username,
					},
					200,
					request,
					env,
				);
			}

			/*
			 * ============================================================
			 * PROTECTED ADMIN EVENTS API
			 * ============================================================
			 */

			/*
			 * ============================================================
			 * PRINT POSTERS
			 * ============================================================
			 *
			 * The thirty-six printed sheets, at A3 300dpi — the numbered
			 * run of thirty plus the six named ones that encode pages 31
			 * to 36. They live in R2 rather than in the site's public
			 * folder because they total near half a gigabyte: putting
			 * that in git would make every clone of this repo carry it
			 * forever, and Vercel would ship it on every deploy.
			 *
			 * Behind the admin gate, not because the artwork is secret —
			 * it is on walls — but because these are the print masters and
			 * the people who need them are the people who print them.
			 */
			if (request.method === 'GET' && url.pathname === '/api/admin/posters') {
				const auth = await requireAdmin(request, env);

				if (!auth.authorized) {
					return auth.response;
				}

				const listing = await env.osc_events_archives.list({
					prefix: 'posters/',
				});

				/*
				 * Only the print masters, which sit directly under the
				 * prefix. The thumbnails and previews live in posters/thumb/
				 * and posters/preview/ and would otherwise arrive here as
				 * ninety sheets, two thirds of them 16KB and undownloadable
				 * as print files.
				 *
				 * Sorted by name, which is the page order — a listing that
				 * comes back in whatever order R2 walked its index reads as
				 * a bug to anyone looking for sheet 14.
				 */
				const posters = listing.objects
					.map((object) => ({
						name: object.key.replace('posters/', ''),
						key: object.key,
						size: object.size,
						uploaded: object.uploaded,
					}))
					.filter((poster) => !poster.name.includes('/'))
					.sort((a, b) => a.name.localeCompare(b.name));

				return json({ posters }, 200, request, env);
			}

			/*
			 * The small renders, shown in the panel before anyone commits
			 * to a download. Inline rather than attachment, and the variant
			 * is a fixed alternation rather than anything taken from the
			 * request, so this cannot be pointed at another prefix.
			 */
			const previewMatch = url.pathname.match(
				/^\/api\/admin\/posters\/(thumb|preview)\/([A-Za-z0-9._-]+)$/,
			);

			if (request.method === 'GET' && previewMatch) {
				const auth = await requireAdmin(request, env);

				if (!auth.authorized) {
					return auth.response;
				}

				const object = await env.osc_events_archives.get(
					`posters/${previewMatch[1]}/${previewMatch[2]}`,
				);

				if (!object) {
					return json({ error: 'Poster not found' }, 404, request, env);
				}

				const headers = new Headers(corsHeaders(request, env));

				headers.set('Content-Type', 'image/webp');
				headers.set('Content-Length', String(object.size));

				/*
				 * Private, because it is behind the admin gate and must not
				 * be held by anything between here and the browser. Cached
				 * for a day all the same: the artwork for a printed sheet
				 * does not change, and the grid asks for thirty-six of
				 * these every time the section is opened.
				 */
				headers.set('Cache-Control', 'private, max-age=86400');

				return new Response(object.body, { headers });
			}

			/*
			 * The whole run as one A3 PDF.
			 *
			 * Declared before the single-sheet route below, which would
			 * otherwise match "bundle" as a filename and go looking for
			 * an object called posters/bundle.
			 *
			 * It is the same thirty-six sheets at the same 300dpi, bound
			 * in page order, and it exists because handing a print shop
			 * thirty-six separate downloads is how a sheet goes missing.
			 * Built by scripts/make-poster-pdf.mjs.
			 */
			if (request.method === 'GET' && url.pathname === '/api/admin/posters/bundle') {
				const auth = await requireAdmin(request, env);

				if (!auth.authorized) {
					return auth.response;
				}

				const object = await env.osc_events_archives.get(
					'posters/bundle/gittyup26-posters.pdf',
				);

				if (!object) {
					return json({ error: 'Poster bundle not found' }, 404, request, env);
				}

				const headers = new Headers(corsHeaders(request, env));

				headers.set('Content-Type', 'application/pdf');
				headers.set('Content-Length', String(object.size));

				headers.set(
					'Content-Disposition',
					'attachment; filename="gittyup26-posters.pdf"',
				);

				/*
				 * Private and briefer than the sheets. The bundle is
				 * rebuilt whenever any one of the thirty-six is, so a
				 * day of caching would hand back yesterday's run to the
				 * person who just rebuilt it.
				 */
				headers.set('Cache-Control', 'private, max-age=300');

				return new Response(object.body, { headers });
			}

			const posterMatch = url.pathname.match(/^\/api\/admin\/posters\/([A-Za-z0-9._-]+)$/);

			if (request.method === 'GET' && posterMatch) {
				const auth = await requireAdmin(request, env);

				if (!auth.authorized) {
					return auth.response;
				}

				/*
				 * The name is matched against a strict character class
				 * above rather than sanitised here, so nothing containing
				 * a slash or a dot-dot ever reaches the bucket. The prefix
				 * is added on this side, so a caller cannot reach an
				 * archive object by asking for one.
				 */
				const object = await env.osc_events_archives.get(
					`posters/${posterMatch[1]}`,
				);

				if (!object) {
					return json({ error: 'Poster not found' }, 404, request, env);
				}

				const headers = new Headers(corsHeaders(request, env));

				headers.set('Content-Type', 'image/png');
				headers.set('Content-Length', String(object.size));

				/*
				 * Attachment, with the sheet's own name: these are opened
				 * to be sent to a printer, and a 20MB PNG rendered inline
				 * in a browser tab helps nobody.
				 */
				headers.set(
					'Content-Disposition',
					`attachment; filename="${posterMatch[1]}"`,
				);

				return new Response(object.body, { headers });
			}

			/*
			 * ============================================================
			 * THE DOOR, FROM THE ADMIN SIDE
			 * ============================================================
			 *
			 * Behind the normal GitHub gate, unlike /api/scan. Changing
			 * how many people fit in a room, or closing the door on a
			 * queue, is not something a borrowed phone should be able to
			 * do.
			 */
			/*
			 * A throwaway door, for trying the scanner before the day.
			 *
			 * Everything it makes belongs to its own event, not to
			 * gittyup26. That is the whole safety argument: a test pass
			 * cannot be admitted against the real auditorium because the
			 * claim joins the gate on the pass's own event_id, so there
			 * is no flag anyone has to remember to check and no way to
			 * leak a test admission into the real count.
			 *
			 * The event is archived on creation so it never appears in
			 * the public listing, and is_open is 0 so nobody can
			 * register for it.
			 */
			if (url.pathname === '/api/admin/entry-test' && (request.method === 'POST' || request.method === 'DELETE')) {
				const auth = await requireAdmin(request, env);

				if (!auth.authorized) {
					return auth.response;
				}

				if (request.method === 'DELETE') {
					/* The event cascades to its gate, passes, devices and
					   scans, so this is the whole teardown. */
					const gone = await env.DB.prepare(`DELETE FROM events WHERE slug = ?`)
						.bind(TEST_DOOR_SLUG)
						.run();

					console.log('Entry test door removed by', auth.session.github_username);

					return json({ removed: gone.meta.changes > 0 }, 200, request, env);
				}

				const pepper = env.ADMIN_HANDLE_PEPPER?.trim();

				if (!pepper) {
					return json(
						{ error: 'ADMIN_HANDLE_PEPPER is not set, so no scanner device can be made' },
						503,
						request,
						env,
					);
				}

				let body: { capacity?: unknown; reserved?: unknown; registered?: unknown };

				try {
					body = await request.json();
				} catch {
					body = {};
				}

				const count = (value: unknown, fallback: number) => {
					const n = Number(value ?? fallback);
					return Number.isInteger(n) && n >= 0 && n <= 40 ? n : fallback;
				};

				/*
				 * Defaults chosen so one run exercises every branch:
				 * three reserved always get in, general admission is
				 * five less three, so two of the three registered get in
				 * and the third is refused as full.
				 */
				const capacity = count(body.capacity, 5) || 5;
				const reserved = count(body.reserved, 3);
				const registered = count(body.registered, 3);

				/* Rebuilt from scratch each time, so a second press is a
				   reset rather than a pile of stale passes. */
				await env.DB.prepare(`DELETE FROM events WHERE slug = ?`).bind(TEST_DOOR_SLUG).run();

				const testEventId = crypto.randomUUID();

				const statements = [
					env.DB.prepare(
						`
              INSERT INTO events (
                id, slug, title, event_date, event_end_at, is_open,
                archive_status, registration_type, min_team_size, max_team_size, venue
              )
              VALUES (?, ?, 'Door scanner test', '2099-01-01', NULL, 0,
                      'archived', 'solo', 1, 1, 'Test')
            `,
					).bind(testEventId, TEST_DOOR_SLUG),

					env.DB.prepare(`INSERT INTO entry_gate (event_id, capacity) VALUES (?, ?)`).bind(
						testEventId,
						capacity,
					),
				];

				const passes: { token: string; kind: string; name: string; seat_id: string | null }[] = [];

				for (let n = 1; n <= reserved; n += 1) {
					passes.push({
						token: hexToken(),
						kind: 'reserved',
						name: `Test Reserved ${n}`,
						seat_id: `R3-S${n}`,
					});
				}

				for (let n = 1; n <= registered; n += 1) {
					passes.push({
						token: hexToken(),
						kind: 'registered',
						name: `Test Registered ${n}`,
						seat_id: null,
					});
				}

				passes.forEach((pass, index) => {
					statements.push(
						env.DB.prepare(
							`
                INSERT INTO entry_passes (
                  token, event_id, kind, name, email, college_registration_number, seat_id
                )
                VALUES (?, ?, ?, ?, ?, ?, ?)
              `,
						).bind(
							pass.token,
							testEventId,
							pass.kind,
							pass.name,
							`door.test${index + 1}@vitapstudent.ac.in`,
							`00TEST${String(index + 1).padStart(4, '0')}`,
							pass.seat_id,
						),
					);
				});

				const deviceToken = hexToken();

				statements.push(
					env.DB.prepare(
						`INSERT INTO scanner_devices (id, event_id, label, token_hash) VALUES (?, ?, ?, ?)`,
					).bind('test-queue', testEventId, 'Test queue', await hmacHex(deviceToken, pepper)),
				);

				await env.DB.batch(statements);

				console.log(
					'Entry test door created by',
					auth.session.github_username,
					`${passes.length} passes, capacity ${capacity}`,
				);

				const base = siteOrigin(request);

				return json(
					{
						event_slug: TEST_DOOR_SLUG,
						capacity,
						/*
						 * The only time this is ever readable. It is a
						 * credential for a throwaway door on a throwaway
						 * event, so handing it back once is the point.
						 */
						device_token: deviceToken,
						device_id: 'test-queue',
						passes: passes.map((pass) => ({
							...pass,
							url: `${base}/e/${pass.token}`,
						})),
						expected: `${reserved} reserved in, ${Math.max(
							0,
							Math.min(registered, capacity - reserved),
						)} registered in, ${Math.max(
							0,
							registered - Math.max(0, capacity - reserved),
						)} refused as full`,
					},
					200,
					request,
					env,
				);
			}

			/*
			 * Every outcome at the door, newest first.
			 *
			 * entry_scans only holds admissions, so the refusals live in
			 * entry_events and this is the only way to see them. Workers
			 * logs are sampled and cannot be queried after the fact,
			 * which makes them useless for "what happened at 10:40".
			 */
			const entryLogMatch = url.pathname.match(/^\/api\/admin\/events\/([^/]+)\/entry\/log$/);

			if (request.method === 'GET' && entryLogMatch) {
				const auth = await requireAdmin(request, env);

				if (!auth.authorized) {
					return auth.response;
				}

				const event = await env.DB.prepare(`SELECT id FROM events WHERE slug = ?`)
					.bind(entryLogMatch[1])
					.first<{ id: string }>();

				if (!event) {
					return json({ error: 'Event not found' }, 404, request, env);
				}

				const limit = Math.min(Number(url.searchParams.get('limit') ?? 100) || 100, 500);

				const { results } = await env.DB.prepare(
					`
            SELECT
              e.at,
              e.result,
              e.device_id,
              e.actor,
              e.reason,
              /* The holder's name, so a line is readable without
                 anyone having to look a token up by hand. */
              p.name,
              p.kind,
              /* Never the whole token. It is a credential, and a log
                 that leaks one is a log that lets somebody walk in. */
              substr(e.token, 1, 8) AS token_prefix
            FROM entry_events e
            LEFT JOIN entry_passes p ON p.token = e.token
            WHERE e.event_id = ?
            ORDER BY e.id DESC
            LIMIT ?
          `,
				)
					.bind(event.id, limit)
					.all();

				return json({ entries: results }, 200, request, env);
			}

			const entryGateMatch = url.pathname.match(/^\/api\/admin\/events\/([^/]+)\/entry$/);

			if (entryGateMatch && (request.method === 'GET' || request.method === 'PATCH')) {
				const auth = await requireAdmin(request, env);

				if (!auth.authorized) {
					return auth.response;
				}

				const event = await env.DB.prepare(`SELECT id FROM events WHERE slug = ?`)
					.bind(entryGateMatch[1])
					.first<{ id: string }>();

				if (!event) {
					return json({ error: 'Event not found' }, 404, request, env);
				}

				if (request.method === 'GET') {
					return json(await gateState(env, event.id), 200, request, env);
				}

				let body: { capacity?: unknown; is_open?: unknown };

				try {
					body = await request.json();
				} catch {
					return json({ error: 'Invalid JSON body' }, 400, request, env);
				}

				const updates: string[] = [];
				const values: unknown[] = [];

				if (body.capacity !== undefined) {
					const capacity = Number(body.capacity);

					/*
					 * An upper bound as well as a lower one. A fat finger
					 * turning 520 into 5200 would silently uncap the room,
					 * and the failure only shows up as too many people in
					 * it.
					 */
					if (!Number.isInteger(capacity) || capacity < 1 || capacity > 5000) {
						return json(
							{ error: 'Capacity must be a whole number between 1 and 5000' },
							400,
							request,
							env,
						);
					}

					/*
					 * Lowering below the number already inside is allowed:
					 * it stops new admissions without pretending the people
					 * in the room are not there. Refusing it would mean an
					 * admin who over-set capacity could not correct it.
					 */
					updates.push('capacity = ?');
					values.push(capacity);
				}

				if (body.is_open !== undefined) {
					updates.push('is_open = ?');
					values.push(body.is_open ? 1 : 0);
				}

				if (updates.length === 0) {
					return json({ error: 'Nothing to change' }, 400, request, env);
				}

				updates.push("updated_at = datetime('now')");

				/*
				 * INSERT first so a gate that was never seeded can still be
				 * configured from the panel, rather than needing a
				 * migration re-run on the day.
				 */
				await env.DB.prepare(
					`INSERT OR IGNORE INTO entry_gate (event_id, capacity) VALUES (?, 0)`,
				)
					.bind(event.id)
					.run();

				await env.DB.prepare(`UPDATE entry_gate SET ${updates.join(', ')} WHERE event_id = ?`)
					.bind(...values, event.id)
					.run();

				console.log(
					'Entry gate changed:',
					entryGateMatch[1],
					JSON.stringify({ capacity: body.capacity, is_open: body.is_open }),
					'by',
					auth.session.github_username,
				);

				ctx.waitUntil(
					recordEntryEvent(
						env,
						event.id,
						null,
						null,
						'gate-changed',
						auth.session.github_username,
						JSON.stringify({ capacity: body.capacity, is_open: body.is_open }),
					),
				);

				return json(await gateState(env, event.id), 200, request, env);
			}

			if (request.method === 'GET' && (url.pathname === '/api/admin/events' || url.pathname === '/api/admin/events/')) {
				const auth = await requireAdmin(request, env);

				if (!auth.authorized) {
					return auth.response;
				}

				const { results } = await env.DB.prepare(
					`
	            SELECT
	              e.id,
	              e.slug,
	              e.title,
	              e.sub_title,
	              e.description,
	              e.venue,
	              e.event_date,
	              e.event_end_at,
	              e.image,
	              e.is_open,
	              e.registration_type,
	              e.min_team_size,
	              e.max_team_size,
	              e.registration_deadline,
	              e.archive_status,
	              e.archived_at,
	              e.created_at,
	              (
	                SELECT COUNT(*)
	                FROM registrations r
	                WHERE r.event_id = e.id
	              ) AS registration_count,
	              (
	                SELECT COUNT(*)
	                FROM registration_members m
	                WHERE m.event_id = e.id
	              ) AS participant_count
	            FROM events e
	            /*
	             * Newest posted first. created_at defaults to
	             * CURRENT_TIMESTAMP, which has one-second resolution and is
	             * never written explicitly, so events seeded in one batch
	             * all share a timestamp — ten of them do in production.
	             * Without the tiebreakers their relative order is arbitrary
	             * and the list reshuffles between refreshes.
	             */
	            ORDER BY e.created_at DESC, e.event_date DESC, e.id DESC
	          `,
				).all();

				return json(
					{
						events: results,
					},
					200,
					request,
					env,
				);
			}

			/*
			 * Create event
			 */

			if (request.method === 'POST' && (url.pathname === '/api/admin/events' || url.pathname === '/api/admin/events/')) {
				const auth = await requireAdmin(request, env);

				if (!auth.authorized) {
					return auth.response;
				}

				let body: {
					slug?: string;
					title?: string;
					sub_title?: string;
					description?: string;
					venue?: string;
					event_date?: string;
					event_end_at?: string | null;
					image?: string;
					is_open?: boolean;
					registration_type?: 'solo' | 'team' | 'workshop';
					min_team_size?: number;
					max_team_size?: number;
					registration_deadline?: string | null;
				};

				try {
					body = await request.json();
				} catch {
					return json(
						{
							error: 'Invalid JSON body',
						},
						400,
						request,
						env,
					);
				}

				const slug = body.slug === undefined ? undefined : normalizeSlug(body.slug);

				const title = body.title?.trim();

				const registrationType = body.registration_type ?? 'solo';

				if (!slug || !title || !body.event_date) {
					return json(
						{
							error: 'slug, title and event_date are required',
						},
						400,
						request,
						env,
					);
				}

				if (!SLUG_PATTERN.test(slug)) {
					return json(
						{
							error: 'Slug must be lowercase letters, numbers and single hyphens, e.g. gittyup26.',
						},
						400,
						request,
						env,
					);
				}

				if (body.registration_deadline && Number.isNaN(Date.parse(body.registration_deadline))) {
					return json({ error: 'Invalid registration deadline.' }, 400, request, env);
				}

				if (body.registration_deadline && Date.parse(body.registration_deadline) > Date.parse(body.event_date)) {
					return json({ error: 'Registration deadline cannot be after the event date.' }, 400, request, env);
				}

				const eventEnd = normalizeEventEnd(body.event_end_at);

				if (!eventEnd.ok) {
					return json({ error: 'Invalid event end date.' }, 400, request, env);
				}

				if (eventEnd.value && Date.parse(eventEnd.value) < Date.parse(body.event_date)) {
					return json({ error: 'Event end cannot be before the event date.' }, 400, request, env);
				}

				if (!['solo', 'team', 'workshop'].includes(registrationType)) {
					return json(
						{
							error: 'registration_type must be solo, team or workshop',
						},
						400,
						request,
						env,
					);
				}

				let minTeamSize = 1;
				let maxTeamSize = 1;

				if (registrationType === 'team') {
					minTeamSize = Math.max(1, body.min_team_size ?? 2);

					maxTeamSize = Math.max(minTeamSize, body.max_team_size ?? minTeamSize);
				}

				try {
					await env.DB.prepare(
						`
	            INSERT INTO events (
	              id,
	              slug,
	              title,
	              sub_title,
	              description,
	              venue,
	              event_date,
	              event_end_at,
	              image,
	              is_open,
	              registration_deadline,
	              registration_type,
	              min_team_size,
	              max_team_size
	            )
	            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
	          `,
					)
						.bind(
							crypto.randomUUID(),
							slug,
							title,
							body.sub_title?.trim() ?? null,
							body.description?.trim() ?? null,
							body.venue?.trim() ?? null,
							body.event_date,
							eventEnd.value,
							body.image?.trim() ?? null,
							body.is_open === false ? 0 : 1,
							body.registration_deadline ?? null,
							registrationType,
							minTeamSize,
							maxTeamSize,
						)
						.run();
				} catch (error) {
					console.error('Create event failed:', error);

					return json(
						{
							error: 'Unable to create event. The slug may already exist.',
						},
						400,
						request,
						env,
					);
				}

				return json(
					{
						success: true,
						message: 'Event created',
						created_by: auth.session.github_username,
					},
					201,
					request,
					env,
				);
			}

			/*
			 * Delete event
			 */

			const adminEventMatch = url.pathname.match(/^\/api\/admin\/events\/([^/]+)$/);

			if (request.method === 'DELETE' && adminEventMatch) {
				const auth = await requireAdmin(request, env);

				if (!auth.authorized) {
					return auth.response;
				}

				const slug = adminEventMatch[1];

				/*
				 * Look the event up first so its R2 archive can be removed
				 * too. Deleting only the D1 row would leave the archived CSV
				 * in the bucket with nothing pointing at it.
				 */
				const existingEvent = await env.DB.prepare(
					`
	            SELECT id, slug, archive_key
	            FROM events
	            WHERE slug = ?
	          `,
				)
					.bind(slug)
					.first<{
						id: string;
						slug: string;
						archive_key: string | null;
					}>();

				if (!existingEvent) {
					return json(
						{
							error: 'Event not found',
						},
						404,
						request,
						env,
					);
				}

				/*
				 * Members must go before registrations and registrations
				 * before the event: registration_members references
				 * registrations without ON DELETE CASCADE, so deleting the
				 * event alone trips the foreign key the moment an event has
				 * a single registration.
				 */
				await env.DB.batch([
					env.DB.prepare(`DELETE FROM registration_members WHERE event_id = ?`).bind(existingEvent.id),
					env.DB.prepare(`DELETE FROM registrations WHERE event_id = ?`).bind(existingEvent.id),
					env.DB.prepare(`DELETE FROM events WHERE id = ?`).bind(existingEvent.id),
				]);

				/*
				 * The D1 row is gone, so a failure here only leaves an
				 * unreferenced object in R2. Log it and still report success.
				 */
				let archiveDeleted = false;

				if (existingEvent?.archive_key) {
					try {
						await env.osc_events_archives.delete(existingEvent.archive_key);

						archiveDeleted = true;
					} catch (error) {
						console.error('Archive delete failed for event:', slug, error);
					}
				}

				return json(
					{
						success: true,
						message: 'Event deleted',
						archive_deleted: archiveDeleted,
						deleted_by: auth.session.github_username,
					},
					200,
					request,
					env,
				);
			}

			/*
			 * ============================================================
			 * PUBLIC EVENTS API
			 * ============================================================
			 */

			if (request.method === 'GET' && (url.pathname === '/api/events' || url.pathname === '/api/events/')) {
				/*
				 * Archived events are hidden from the public list unless
				 * they are explicitly requested with ?include_archived=1.
				 */
				const includeArchived = url.searchParams.get('include_archived') === '1';

				const { results } = await env.DB.prepare(
					`
	            SELECT
	              id,
	              slug,
	              title,
	              sub_title,
	              description,
	              venue,
	              event_date,
	              event_end_at,
	              image,
	              is_open,
	              registration_type,
	              min_team_size,
	              max_team_size,
	              registration_deadline,
	              archive_status
	            FROM events
	            ${includeArchived ? '' : "WHERE archive_status != 'archived'"}
	            ORDER BY event_date ASC
	          `,
				).all();

				return json(
					{
						events: results,
					},
					200,
					request,
					env,
				);
			}

			/*
			 * Get individual event
			 */

			const publicEventMatch = url.pathname.match(/^\/api\/events\/([^/]+)$/);

			if (request.method === 'GET' && publicEventMatch) {
				const slug = publicEventMatch[1];

				const event = await env.DB.prepare(
					`
	            SELECT
	              id,
	              slug,
	              title,
	              sub_title,
	              description,
	              venue,
	              event_date,
	              event_end_at,
	              image,
	              is_open,
	              registration_type,
	              min_team_size,
	              max_team_size,
	              registration_deadline,
	              archive_status
	            FROM events
	            WHERE slug = ?
	          `,
				)
					.bind(slug)
					.first();

				if (!event) {
					return json(
						{
							error: 'Event not found',
						},
						404,
						request,
						env,
					);
				}

				return json(
					{
						event,
					},
					200,
					request,
					env,
				);
			}

			/*
			 * ============================================================
			 * PUBLIC REGISTRATION API
			 * ============================================================
			 */

			const registerMatch = url.pathname.match(/^\/api\/events\/([^/]+)\/register$/);

			if (request.method === 'POST' && registerMatch) {
				const slug = registerMatch[1];

				/*
				 * Per-IP ceiling first, before any database work. It is
				 * deliberately generous — the whole campus shares a few NAT
				 * IPs — and only exists to stop scripted floods.
				 */
				if (!(await withinRateLimit(env.REGISTRATION_IP_LIMITER, `reg-ip:${clientIp(request)}`))) {
					return rateLimited(request, env);
				}

				const event = await env.DB.prepare(
					`
	            SELECT
	              id,
	              slug,
	              title,
	              is_open,
	              registration_type,
	              min_team_size,
	              max_team_size,
	              registration_deadline,
	              event_end_at
	            FROM events
	            WHERE slug = ?
	          `,
				)
					.bind(slug)
					.first<{
						id: string;
						slug: string;
						title: string;
						is_open: number;
						registration_type: string;
						min_team_size: number;
						max_team_size: number;
						registration_deadline: string | null;
						event_end_at: string | null;
					}>();

				if (!event) {
					return json(
						{
							error: 'Event not found',
						},
						404,
						request,
						env,
					);
				}

				if (!event.is_open) {
					return json(
						{
							error: 'Registration is closed',
						},
						400,
						request,
						env,
					);
				}

				if (event.registration_deadline && Date.now() >= Date.parse(event.registration_deadline)) {
					return json(
						{
							error: 'Registration deadline has passed',
						},
						400,
						request,
						env,
					);
				}

				/*
				 * An event that has already finished cannot be registered
				 * for, even if the scheduled archive job has not run yet.
				 */
				const eventEndsAt = event.event_end_at ? Date.parse(event.event_end_at) : Number.NaN;

				if (!Number.isNaN(eventEndsAt) && Date.now() >= eventEndsAt) {
					return json(
						{
							error: 'This event has already ended',
						},
						409,
						request,
						env,
					);
				}

				let body: {
					team_name?: string;
					/* Which page the form was on. Validated, never trusted. */
					source?: unknown;
					members?: {
						name: string;
						year_of_study: string;
						college_registration_number: string;
						github?: string;
						email: string;
					}[];
				};

				try {
					body = await request.json();
				} catch {
					return json(
						{
							error: 'Invalid JSON body',
						},
						400,
						request,
						env,
					);
				}

				/*
				 * Normalised once, here, rather than re-derived at the
				 * INSERT and again at the Discord announcement — two
				 * expressions producing "the same" string is how the
				 * stored value and the announced value drift apart.
				 */
				const teamName = collapseWhitespace(body.team_name ?? '').slice(0, LIMITS.teamName) || null;

				if (teamName !== null && FORBIDDEN_FIELD_CHARACTERS.test(teamName)) {
					return json(
						{
							error: 'Team name contains characters that are not allowed',
						},
						400,
						request,
						env,
					);
				}

				const rawMembers = body.members ?? [];

				/*
				 * Hard ceiling before any per-member work, so an oversized
				 * array cannot drive the validation loop or the insert batch.
				 * Real team sizes are validated against the event below.
				 */
				if (!Array.isArray(rawMembers) || rawMembers.length > LIMITS.members) {
					return json(
						{
							error: 'Invalid members list',
						},
						400,
						request,
						env,
					);
				}

				if (event.registration_type === 'solo' || event.registration_type === 'workshop') {
					if (rawMembers.length !== 1) {
						return json(
							{
								error: 'This event requires exactly 1 participant',
							},
							400,
							request,
							env,
						);
					}
				}

				if (event.registration_type === 'team') {
					if (rawMembers.length < event.min_team_size || rawMembers.length > event.max_team_size) {
						return json(
							{
								error: `Team size must be between ${event.min_team_size} and ${event.max_team_size}`,
							},
							400,
							request,
							env,
						);
					}
				}

				const members: {
					name: string;
					year_of_study: string;
					college_registration_number: string;
					github: string | null;
					email: string;
				}[] = [];

				for (const [index, member] of rawMembers.entries()) {
					/*
					 * `[null]` and `["hello"]` are valid JSON arrays, and
					 * reading .name off either threw a TypeError that
					 * surfaced as a 500 — an input problem reported as a
					 * server fault.
					 */
					if (typeof member !== 'object' || member === null) {
						return json(
							{
								error: `Missing required information for member ${index + 1}`,
							},
							400,
							request,
							env,
						);
					}

					const name = collapseWhitespace(asString(member.name));
					const yearOfStudy = collapseWhitespace(asString(member.year_of_study));
					const email = collapseWhitespace(asString(member.email)).toLowerCase();
					const githubInput = collapseWhitespace(asString(member.github)) || null;
					const registrationNumber = normalizeRegistrationNumber(asString(member.college_registration_number));

					if (!name || !yearOfStudy || !registrationNumber || !email) {
						return json(
							{
								error: `Missing required information for member ${index + 1}`,
							},
							400,
							request,
							env,
						);
					}

					if (
						name.length > LIMITS.name ||
						yearOfStudy.length > LIMITS.yearOfStudy ||
						email.length > LIMITS.email ||
						(githubInput !== null && githubInput.length > LIMITS.github)
					) {
						return json(
							{
								error: `One of the fields for member ${index + 1} is too long`,
							},
							400,
							request,
							env,
						);
					}

					/*
					 * See FORBIDDEN_FIELD_CHARACTERS: one of these in a name
					 * or a year of study forges extra participant rows in
					 * the Discord announcement and splits the CSV export.
					 */
					if (
						FORBIDDEN_FIELD_CHARACTERS.test(name) ||
						FORBIDDEN_FIELD_CHARACTERS.test(yearOfStudy) ||
						FORBIDDEN_FIELD_CHARACTERS.test(email) ||
						(githubInput !== null && FORBIDDEN_FIELD_CHARACTERS.test(githubInput))
					) {
						return json(
							{
								error: `One of the fields for member ${index + 1} contains characters that are not allowed`,
							},
							400,
							request,
							env,
						);
					}

					const year = normalizeYearOfStudy(yearOfStudy);

					if (year === null) {
						return json(
							{
								error: `Year of study for member ${index + 1} looks invalid. Enter the year you are in as a number from 1 to ${MAX_YEAR_OF_STUDY}.`,
							},
							400,
							request,
							env,
						);
					}

					if (!REGISTRATION_NUMBER_PATTERN.test(registrationNumber)) {
						return json(
							{
								error: `Registration number for member ${index + 1} looks invalid. Use the university format, e.g. 22BCE1234.`,
							},
							400,
							request,
							env,
						);
					}

					if (!EMAIL_PATTERN.test(email)) {
						return json(
							{
								error: `Email address for member ${index + 1} looks invalid`,
							},
							400,
							request,
							env,
						);
					}

					if (!hasAllowedEmailDomain(email)) {
						return json(
							{
								error: `Use your university email for member ${index + 1} — ${ALLOWED_EMAIL_DOMAINS.map((d) => `@${d}`).join(' or ')}.`,
							},
							400,
							request,
							env,
						);
					}

					/*
					 * Optional, so an absent handle is not an error — but a
					 * handle that was typed and does not name anybody is.
					 */
					const github = githubInput === null ? null : normalizeGithub(githubInput);

					if (githubInput !== null && github === null) {
						return json(
							{
								error: `GitHub for member ${index + 1} looks invalid. Use your username, e.g. adalovelace, or a link to your profile.`,
							},
							400,
							request,
							env,
						);
					}

					members.push({
						name,
						year_of_study: year,
						college_registration_number: registrationNumber,
						github,
						email,
					});
				}

				/*
				 * The same registration number twice in one submission is a
				 * mistake in the form, not a returning registrant — report
				 * it as one instead of a confusing conflict.
				 */
				const registrationNumbers = members.map((member) => member.college_registration_number);

				const duplicateInTeam = registrationNumbers.find((value, index) => registrationNumbers.indexOf(value) !== index);

				if (duplicateInTeam) {
					return json(
						{
							error: `Registration number ${duplicateInTeam} appears more than once in this registration`,
						},
						400,
						request,
						env,
					);
				}

				/*
				 * Retry throttle, keyed on the identity being registered
				 * rather than the IP — the whole campus shares a few NAT
				 * IPs, but no two students share a registration number.
				 */
				if (!(await withinRateLimit(env.REGISTRATION_ID_LIMITER, `reg-id:${event.id}:${registrationNumbers[0]}`))) {
					return rateLimited(request, env);
				}

				/*
				 * Friendly duplicate check before inserting anything. The
				 * unique index below remains the authority — two identical
				 * submissions racing past this SELECT are still caught by
				 * the constraint — but the index cannot say WHO collided,
				 * and the error should.
				 */
				const existing = await env.DB.prepare(
					`
	            SELECT college_registration_number
	            FROM registration_members
	            WHERE event_id = ?
	              AND UPPER(TRIM(college_registration_number)) IN (${registrationNumbers.map(() => '?').join(', ')})
	          `,
				)
					.bind(event.id, ...registrationNumbers)
					.all<{ college_registration_number: string }>();

				/*
				 * Naming the clashing registration number tells an
				 * unauthenticated caller that it is registered, which makes
				 * this endpoint an oracle over a bounded id space.
				 *
				 * Kept deliberately: a student who mistypes one digit and
				 * is told only "already registered" cannot tell whether
				 * they are looking at their own earlier entry or somebody
				 * else's, and the whole point of the message is to answer
				 * that. The exposure is bounded instead — REGISTRATION_ID_
				 * LIMITER caps attempts per number and REGISTRATION_IP_
				 * LIMITER caps a sweep of fabricated ones — and what leaks
				 * is only that a registration number is registered, not any
				 * name, email or handle attached to it.
				 */
				if (existing.results.length > 0) {
					const already = existing.results.map((row) => row.college_registration_number);

					return json(
						{
							error:
								already.length === 1
									? `${already[0]} is already registered for this event`
									: `Already registered for this event: ${already.join(', ')}`,
							already_registered: already,
						},
						409,
						request,
						env,
					);
				}

				const firstMember = members[0];

				const registration = await env.DB.prepare(
					`
	            INSERT INTO registrations
	              (
	                event_id,
	                name,
	                year_of_study,
	                github,
	                email,
	                team_name,
	                team_size
	              )
	            VALUES (?, ?, ?, ?, ?, ?, ?)
	          `,
				)
					.bind(
						event.id,
						firstMember.name,
						firstMember.year_of_study,
						firstMember.github ?? null,
						firstMember.email,
						teamName,
						members.length,
					)
					.run();

				const registrationId = registration.meta.last_row_id;

				const memberStatements = members.map((member, index) =>
					env.DB.prepare(
						`
	                INSERT INTO registration_members
	                  (
	                    registration_id,
	                    event_id,
	                    name,
	                    year_of_study,
	                    college_registration_number,
	                    github,
	                    email,
	                    member_number
	                  )
	                VALUES (?, ?, ?, ?, ?, ?, ?, ?)
	              `,
					).bind(
						registrationId,
						event.id,
						member.name,
						member.year_of_study,
						member.college_registration_number,
						member.github ?? null,
						member.email,
						index + 1,
					),
				);

				try {
					await env.DB.batch(memberStatements);
				} catch (error) {
					console.error('Registration member insert failed:', error);

					/*
					 * The parent registration row was inserted before the
					 * members, so it has to be removed again. Otherwise a
					 * rejected registration is left behind as a member-less
					 * row in the admin dashboard.
					 */
					await env.DB.prepare(
						`
              DELETE FROM registrations
              WHERE id = ?
            `,
					)
						.bind(registrationId)
						.run();

					/*
					 * Reaching this means the SELECT above raced another
					 * identical submission and the unique index caught it —
					 * so "already registered" is exactly what happened.
					 */
					return json(
						{
							error: 'One or more members are already registered for this event',
						},
						409,
						request,
						env,
					);
				}

				/*
				 * After the write, so the channel only ever sees
				 * registrations that actually landed in D1, and through
				 * waitUntil so it cannot delay the response.
				 */
				announceRegistration(env, ctx, {
					eventTitle: event.title,
					eventSlug: event.slug,
					registrationId,
					teamName,
					source: normalizeSource(body.source),
					members,
				});

				return json(
					{
						success: true,
						registration_id: registrationId,
						event: event.title,
						members_registered: members.length,
					},
					201,
					request,
					env,
				);
			}

			/*
			 * ============================================================
			 * PUBLIC SEAT RESERVATION API
			 * ============================================================
			 */

			const seatsMatch = url.pathname.match(/^\/api\/events\/([^/]+)\/seats$/);

			if (request.method === 'GET' && seatsMatch) {
				const slug = seatsMatch[1];

				const event = await env.DB.prepare(
					`
	            SELECT id
	            FROM events
	            WHERE slug = ?
	          `,
				)
					.bind(slug)
					.first<{ id: string }>();

				if (!event) {
					return json(
						{
							error: 'Event not found',
						},
						404,
						request,
						env,
					);
				}

				/*
				 * Seat ids only. This response is public, so no name or email
				 * or registration number may appear in it.
				 */
				const { results } = await env.DB.prepare(
					`
	            SELECT seat_id
	            FROM seat_reservations
	            WHERE event_id = ?
	            ORDER BY seat_id
	          `,
				)
					.bind(event.id)
					.all<{ seat_id: string }>();

				return json(
					{
						seats: results.map((row) => row.seat_id),
						max_per_reservation: MAX_SEATS_PER_RESERVATION,
					},
					200,
					request,
					env,
				);
			}

			const seatReserveMatch = url.pathname.match(/^\/api\/events\/([^/]+)\/seats\/reserve$/);

			if (request.method === 'POST' && seatReserveMatch) {
				const slug = seatReserveMatch[1];

				/*
				 * Per-IP ceiling first, before any database work, the same
				 * way the registration endpoint does it.
				 */
				if (!(await withinRateLimit(env.REGISTRATION_IP_LIMITER, `seat-ip:${clientIp(request)}`))) {
					return rateLimited(request, env);
				}

				const event = await env.DB.prepare(
					`
	            SELECT
	              id,
	              slug,
	              title,
	              venue,
	              event_date,
	              event_end_at,
	              is_open
	            FROM events
	            WHERE slug = ?
	          `,
				)
					.bind(slug)
					.first<{
						id: string;
						slug: string;
						title: string;
						venue: string | null;
						event_date: string | null;
						event_end_at: string | null;
						is_open: number;
					}>();

				if (!event) {
					return json(
						{
							error: 'Event not found',
							field_errors: [],
						},
						404,
						request,
						env,
					);
				}

				/*
				 * Closing the event is the kill switch for seating too,
				 * and it is the only stop when there is no end time set.
				 */
				if (!event.is_open) {
					return json(
						{
							error: 'Seat reservations are closed',
							field_errors: [],
						},
						409,
						request,
						env,
					);
				}

				const seatEventEndsAt = event.event_end_at ? Date.parse(event.event_end_at) : Number.NaN;

				if (!Number.isNaN(seatEventEndsAt) && Date.now() >= seatEventEndsAt) {
					return json(
						{
							error: 'This event has already ended',
							field_errors: [],
						},
						409,
						request,
						env,
					);
				}

				let seatBody: { seats?: unknown };

				try {
					seatBody = await request.json();
				} catch {
					return json(
						{
							error: 'Invalid JSON body',
							field_errors: [],
						},
						400,
						request,
						env,
					);
				}

				const rawSeats = Array.isArray(seatBody.seats) ? seatBody.seats : null;

				if (!rawSeats || rawSeats.length === 0) {
					return json(
						{
							error: 'Pick at least one seat',
							field_errors: [],
						},
						400,
						request,
						env,
					);
				}

				if (rawSeats.length > MAX_SEATS_PER_RESERVATION) {
					return json(
						{
							error: `You can reserve at most ${MAX_SEATS_PER_RESERVATION} seats in one request`,
							field_errors: [],
						},
						400,
						request,
						env,
					);
				}

				interface SeatFieldError {
					index: number;
					field: 'code' | 'seat_id' | 'college_registration_number';
					message: string;
				}

				const fieldErrors: SeatFieldError[] = [];

				/*
				 * A conflict is somebody else holding the seat or the code,
				 * which is a 409. A malformed or unknown value is a 400.
				 */
				let hasConflict = false;

				const shaped: {
					index: number;
					seat_id: string;
					code: string;
					registration_number: string;
				}[] = [];

				for (const [index, raw] of rawSeats.entries()) {
					if (typeof raw !== 'object' || raw === null) {
						fieldErrors.push({
							index,
							field: 'seat_id',
							message: 'This seat request is missing its details.',
						});

						continue;
					}

					const row = raw as {
						seat_id?: unknown;
						code?: unknown;
						college_registration_number?: unknown;
					};

					const seatId = asString(row.seat_id).trim().toUpperCase();
					const code = asString(row.code).trim().toUpperCase();
					const registrationNumber = normalizeRegistrationNumber(asString(row.college_registration_number));

					let shapeOk = true;

					if (!SEAT_ID_PATTERN.test(seatId)) {
						fieldErrors.push({
							index,
							field: 'seat_id',
							message: 'That is not a seat on this map.',
						});

						shapeOk = false;
					} else if (isTeamSeat(seatId)) {
						fieldErrors.push({
							index,
							field: 'seat_id',
							message: 'The first two rows are held for the OSC team and cannot be reserved.',
						});

						shapeOk = false;
					}

					if (!SEAT_CODE_PATTERN.test(code)) {
						fieldErrors.push({
							index,
							field: 'code',
							message: 'Enter the reservation code exactly as it was given to you, like ABCD-2345.',
						});

						shapeOk = false;
					}

					if (!REGISTRATION_NUMBER_PATTERN.test(registrationNumber)) {
						fieldErrors.push({
							index,
							field: 'college_registration_number',
							message: 'Registration number looks invalid. Use the university format, e.g. 22BCE1234.',
						});

						shapeOk = false;
					}

					if (shapeOk) {
						shaped.push({ index, seat_id: seatId, code, registration_number: registrationNumber });
					}
				}

				/*
				 * The same seat or code or number twice in one request is a
				 * mistake in the form, so it is caught before any lookup.
				 */
				const seatCounts = new Map<string, number>();
				const codeCounts = new Map<string, number>();
				const numberCounts = new Map<string, number>();

				for (const row of shaped) {
					seatCounts.set(row.seat_id, (seatCounts.get(row.seat_id) ?? 0) + 1);
					codeCounts.set(row.code, (codeCounts.get(row.code) ?? 0) + 1);
					numberCounts.set(row.registration_number, (numberCounts.get(row.registration_number) ?? 0) + 1);
				}

				const candidates = shaped.filter((row) => {
					let unique = true;

					if ((seatCounts.get(row.seat_id) ?? 0) > 1) {
						fieldErrors.push({
							index: row.index,
							field: 'seat_id',
							message: 'That seat is picked more than once in this request.',
						});

						unique = false;
					}

					if ((codeCounts.get(row.code) ?? 0) > 1) {
						fieldErrors.push({
							index: row.index,
							field: 'code',
							message: 'That reservation code is used more than once in this request.',
						});

						unique = false;
					}

					if ((numberCounts.get(row.registration_number) ?? 0) > 1) {
						fieldErrors.push({
							index: row.index,
							field: 'college_registration_number',
							message: 'That registration number is used more than once in this request.',
						});

						unique = false;
					}

					return unique;
				});

				const accepted: {
					index: number;
					seat_id: string;
					code: string;
					registration_number: string;
					name: string;
					email: string;
					member_id: number;
				}[] = [];

				/*
				 * Throttle every identity in the request the way registration
				 * does, so guessing numbers costs a token per number.
				 */
				const throttledNumbers = [...new Set(candidates.map((row) => row.registration_number))];

				const throttleChecks = await Promise.all(
					throttledNumbers.map((number) =>
						withinRateLimit(env.REGISTRATION_ID_LIMITER, `seat-regno:${event.id}:${number}`),
					),
				);

				if (throttleChecks.some((allowed) => !allowed)) {
					return rateLimited(request, env);
				}

				if (candidates.length > 0) {
					const seatIds = candidates.map((row) => row.seat_id);
					const codes = candidates.map((row) => row.code);
					const numbers = candidates.map((row) => row.registration_number);

					const knownCodes = await env.DB.prepare(
						`
	                SELECT code, revoked_at
	                FROM seat_reservation_codes
	                WHERE event_id = ?
	                  AND code IN (${codes.map(() => '?').join(', ')})
	              `,
					)
						.bind(event.id, ...codes)
						.all<{ code: string; revoked_at: string | null }>();

					const codeRows = new Map(knownCodes.results.map((row) => [row.code, row]));

					const usedCodes = await env.DB.prepare(
						`
	                SELECT code
	                FROM seat_reservations
	                WHERE code IN (${codes.map(() => '?').join(', ')})
	              `,
					)
						.bind(...codes)
						.all<{ code: string }>();

					const spentCodes = new Set(usedCodes.results.map((row) => row.code));

					const takenSeats = await env.DB.prepare(
						`
	                SELECT seat_id
	                FROM seat_reservations
	                WHERE event_id = ?
	                  AND seat_id IN (${seatIds.map(() => '?').join(', ')})
	              `,
					)
						.bind(event.id, ...seatIds)
						.all<{ seat_id: string }>();

					const seatsGone = new Set(takenSeats.results.map((row) => row.seat_id));

					/*
					 * Name and email are read from the registration the
					 * student already made, never from the request body.
					 */
					const memberRows = await env.DB.prepare(
						`
	                SELECT
	                  id,
	                  name,
	                  email,
	                  UPPER(TRIM(college_registration_number)) AS registration_number
	                FROM registration_members
	                WHERE event_id = ?
	                  AND UPPER(TRIM(college_registration_number)) IN (${numbers.map(() => '?').join(', ')})
	              `,
					)
						.bind(event.id, ...numbers)
						.all<{
							id: number;
							name: string;
							email: string;
							registration_number: string;
						}>();

					const members = new Map(memberRows.results.map((row) => [row.registration_number, row]));

					const seatedRows = await env.DB.prepare(
						`
	                SELECT UPPER(TRIM(college_registration_number)) AS registration_number
	                FROM seat_reservations
	                WHERE event_id = ?
	                  AND UPPER(TRIM(college_registration_number)) IN (${numbers.map(() => '?').join(', ')})
	              `,
					)
						.bind(event.id, ...numbers)
						.all<{ registration_number: string }>();

					const alreadySeated = new Set(seatedRows.results.map((row) => row.registration_number));

					for (const row of candidates) {
						let rowOk = true;

						const codeRow = codeRows.get(row.code);

						if (!codeRow) {
							fieldErrors.push({
								index: row.index,
								field: 'code',
								message: 'That reservation code is not valid for this event.',
							});

							rowOk = false;
						} else if (codeRow.revoked_at !== null) {
							fieldErrors.push({
								index: row.index,
								field: 'code',
								message: 'That reservation code has been revoked.',
							});

							rowOk = false;
						} else if (spentCodes.has(row.code)) {
							fieldErrors.push({
								index: row.index,
								field: 'code',
								message: 'That reservation code has already been used.',
							});

							hasConflict = true;

							rowOk = false;
						}

						if (seatsGone.has(row.seat_id)) {
							fieldErrors.push({
								index: row.index,
								field: 'seat_id',
								message: 'That seat has already been taken.',
							});

							hasConflict = true;

							rowOk = false;
						}

						/*
						 * A row that failed on its code or its seat never
						 * reaches the identity lookup below.
						 */
						if (!rowOk) {
							continue;
						}

						const member = members.get(row.registration_number);

						if (!member) {
							fieldErrors.push({
								index: row.index,
								field: 'college_registration_number',
								message: SEAT_REGISTRATION_REQUIRED,
							});

							rowOk = false;
						} else if (alreadySeated.has(row.registration_number)) {
							fieldErrors.push({
								index: row.index,
								field: 'college_registration_number',
								message: 'That registration number already has a seat for this event.',
							});

							hasConflict = true;

							rowOk = false;
						}

						if (rowOk && member) {
							accepted.push({
								index: row.index,
								seat_id: row.seat_id,
								code: row.code,
								registration_number: row.registration_number,
								name: member.name,
								email: member.email,
								member_id: member.id,
							});
						}
					}
				}

				/*
				 * Every bad row is reported together, and nothing is written
				 * unless the whole request is good.
				 */
				if (fieldErrors.length > 0) {
					return json(
						{
							error: hasConflict
								? 'Some of those seats are no longer available. Reload the map and pick again.'
								: 'Some of those seats could not be reserved. Check the highlighted rows.',
							field_errors: fieldErrors,
						},
						hasConflict ? 409 : 400,
						request,
						env,
					);
				}

				const seatStatements = accepted.map((row) =>
					env.DB.prepare(
						`
	                INSERT INTO seat_reservations
	                  (
	                    event_id,
	                    seat_id,
	                    code,
	                    college_registration_number,
	                    name,
	                    email,
	                    registration_member_id
	                  )
	                VALUES (?, ?, ?, ?, ?, ?, ?)
	              `,
					).bind(event.id, row.seat_id, row.code, row.registration_number, row.name, row.email, row.member_id),
				);

				let seatInserts;

				try {
					seatInserts = await env.DB.batch(seatStatements);
				} catch (error) {
					console.error('Seat reservation insert failed:', error);

					/*
					 * The checks above raced another request and a unique
					 * index caught it, so somebody got there first.
					 */
					return json(
						{
							error: 'Someone took one of those seats first. Reload the map and pick again.',
							field_errors: [],
						},
						409,
						request,
						env,
					);
				}

				const mailRows = accepted
					.map((row, position) => ({
						id: Number(seatInserts[position]?.meta?.last_row_id ?? 0),
						seat_id: row.seat_id,
						name: row.name,
						email: row.email,
						college_registration_number: row.registration_number,
					}))
					.filter((row) => row.id > 0);

				sendSeatReservationMails(env, ctx, event, mailRows);

				return json(
					{
						ok: true,
						reserved: accepted.map((row) => ({ seat_id: row.seat_id, name: row.name })),
					},
					200,
					request,
					env,
				);
			}

			/*
			 * ============================================================
			 * TEAM MEMBERS (public read)
			 * ============================================================
			 *
			 * The /team roster. Public because it exposes only what that page
			 * already shows — names, roles, bios and social links.
			 */
			if (
				request.method === 'GET' &&
				(url.pathname === '/api/team/members' || url.pathname === '/api/team/members/')
			) {
				const { results } = await env.DB.prepare(
					`SELECT ${TEAM_MEMBER_COLUMNS} FROM team_members ORDER BY sort_order ASC, id ASC`,
				).all<TeamMemberRow>();

				return json({ members: results.map(serializeTeamMember) }, 200, request, env);
			}

			/*
			 * An uploaded member photo, streamed from R2. Public and cached
			 * hard: the key is unique per upload, so a changed photo is a new
			 * URL and never a stale cache hit. Seeded members use the
			 * /team/*.webp files in the site's public folder and never reach
			 * this route. The key is matched against a strict character class,
			 * so nothing with a slash or a dot-dot reaches the bucket, and the
			 * team/ prefix is added here rather than taken from the request.
			 */
			const teamImageMatch = url.pathname.match(/^\/api\/team\/image\/([A-Za-z0-9._-]+)$/);

			if (request.method === 'GET' && teamImageMatch) {
				const object = await env.osc_events_archives.get(`team/${teamImageMatch[1]}`);

				if (!object) {
					return json({ error: 'Image not found' }, 404, request, env);
				}

				const headers = new Headers(corsHeaders(request, env));

				object.writeHttpMetadata(headers);
				headers.set('Content-Length', String(object.size));
				headers.set('Cache-Control', 'public, max-age=31536000, immutable');

				return new Response(object.body, { headers });
			}

			/*
			 * ============================================================
			 * TEAM MEMBERS (admin management)
			 * ============================================================
			 */
			if (
				request.method === 'GET' &&
				(url.pathname === '/api/admin/team/members' || url.pathname === '/api/admin/team/members/')
			) {
				const auth = await requireAdmin(request, env);

				if (!auth.authorized) {
					return auth.response;
				}

				const { results } = await env.DB.prepare(
					`SELECT ${TEAM_MEMBER_COLUMNS} FROM team_members ORDER BY sort_order ASC, id ASC`,
				).all<TeamMemberRow>();

				return json({ members: results.map(serializeTeamMember) }, 200, request, env);
			}

			if (
				request.method === 'POST' &&
				(url.pathname === '/api/admin/team/members' || url.pathname === '/api/admin/team/members/')
			) {
				const auth = await requireAdmin(request, env);

				if (!auth.authorized) {
					return auth.response;
				}

				let body: {
					name?: string;
					role?: string;
					tier?: string;
					bio?: string;
					image?: string;
					socials?: { github?: string; linkedin?: string; instagram?: string; website?: string };
				};

				try {
					body = await request.json();
				} catch {
					return json({ error: 'Invalid JSON body' }, 400, request, env);
				}

				const name = (body.name ?? '').trim();
				const role = (body.role ?? '').trim();
				const tier = (body.tier ?? '').trim();

				if (!name || !role || !tier) {
					return json({ error: 'Name, role and tier are required.' }, 400, request, env);
				}

				if (!TEAM_TIERS.includes(tier)) {
					return json({ error: 'Unknown tier.' }, 400, request, env);
				}

				const socials = body.socials ?? {};

				/*
				 * New members sort after everyone else. Grouped by tier on the
				 * page, that puts them at the end of their own tier.
				 */
				const next = await env.DB.prepare(
					`SELECT COALESCE(MAX(sort_order), 0) + 1 AS next FROM team_members`,
				).first<{ next: number }>();

				const created = await env.DB.prepare(
					`
			      INSERT INTO team_members
			        (name, role, tier, bio, image_url, github, linkedin, instagram, website, sort_order)
			      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
			      RETURNING ${TEAM_MEMBER_COLUMNS}
			    `,
				)
					.bind(
						name,
						role,
						tier,
						typeof body.bio === 'string' ? body.bio.trim() : '',
						cleanSocial(body.image) ?? '',
						cleanSocial(socials.github),
						cleanSocial(socials.linkedin),
						cleanSocial(socials.instagram),
						cleanSocial(socials.website),
						next?.next ?? 1,
					)
					.first<TeamMemberRow>();

				return json({ member: created ? serializeTeamMember(created) : null }, 201, request, env);
			}

			const teamImageUploadMatch = url.pathname.match(
				/^\/api\/admin\/team\/members\/(\d+)\/image$/,
			);

			if (request.method === 'POST' && teamImageUploadMatch) {
				const auth = await requireAdmin(request, env);

				if (!auth.authorized) {
					return auth.response;
				}

				const id = Number(teamImageUploadMatch[1]);

				const existing = await env.DB.prepare(
					`SELECT image_url FROM team_members WHERE id = ?`,
				)
					.bind(id)
					.first<{ image_url: string }>();

				if (!existing) {
					return json({ error: 'Member not found' }, 404, request, env);
				}

				let form: FormData;

				try {
					form = await request.formData();
				} catch {
					return json({ error: 'Expected a multipart form upload.' }, 400, request, env);
				}

				const file = form.get('image');

				if (!(file instanceof File)) {
					return json({ error: 'No image file was sent.' }, 400, request, env);
				}

				const ext = TEAM_IMAGE_EXT[file.type];

				if (!ext) {
					return json({ error: 'Image must be a PNG, JPEG or WebP.' }, 400, request, env);
				}

				if (file.size > TEAM_IMAGE_MAX_BYTES) {
					return json({ error: 'Image must be 5 MB or smaller.' }, 400, request, env);
				}

				const key = `team/${crypto.randomUUID()}.${ext}`;

				await env.osc_events_archives.put(key, await file.arrayBuffer(), {
					httpMetadata: {
						contentType: file.type,
						cacheControl: 'public, max-age=31536000, immutable',
					},
				});

				/*
				 * Absolute, against this Worker's own origin, because the photo
				 * is served from here (events.oscvitap.com) while the seeded
				 * paths are relative to the site. A relative URL would send the
				 * browser to the site origin, which has no such file.
				 */
				const imageUrl = `${url.origin}/api/team/image/${key.slice('team/'.length)}`;

				const updated = await env.DB.prepare(
					`
			      UPDATE team_members
			      SET image_url = ?, updated_at = CURRENT_TIMESTAMP
			      WHERE id = ?
			      RETURNING ${TEAM_MEMBER_COLUMNS}
			    `,
				)
					.bind(imageUrl, id)
					.first<TeamMemberRow>();

				/*
				 * Free the photo this one replaced, once the row points at the
				 * new object. A seeded /team/*.webp returns null and is kept.
				 */
				const oldKey = teamImageKey(existing.image_url);

				if (oldKey && oldKey !== key) {
					await env.osc_events_archives.delete(oldKey);
				}

				return json({ member: updated ? serializeTeamMember(updated) : null }, 200, request, env);
			}

			const teamMemberMatch = url.pathname.match(/^\/api\/admin\/team\/members\/(\d+)$/);

			if (request.method === 'PATCH' && teamMemberMatch) {
				const auth = await requireAdmin(request, env);

				if (!auth.authorized) {
					return auth.response;
				}

				const id = Number(teamMemberMatch[1]);

				const existing = await env.DB.prepare(
					`SELECT ${TEAM_MEMBER_COLUMNS} FROM team_members WHERE id = ?`,
				)
					.bind(id)
					.first<TeamMemberRow>();

				if (!existing) {
					return json({ error: 'Member not found' }, 404, request, env);
				}

				let body: {
					name?: string;
					role?: string;
					tier?: string;
					bio?: string;
					image?: string;
					socials?: { github?: string; linkedin?: string; instagram?: string; website?: string };
				};

				try {
					body = await request.json();
				} catch {
					return json({ error: 'Invalid JSON body' }, 400, request, env);
				}

				const name = body.name !== undefined ? body.name.trim() : existing.name;
				const role = body.role !== undefined ? body.role.trim() : existing.role;
				const tier = body.tier !== undefined ? body.tier.trim() : existing.tier;

				if (!name || !role || !tier) {
					return json({ error: 'Name, role and tier are required.' }, 400, request, env);
				}

				if (!TEAM_TIERS.includes(tier)) {
					return json({ error: 'Unknown tier.' }, 400, request, env);
				}

				const bio = body.bio !== undefined ? body.bio.trim() : existing.bio;

				const image =
					body.image !== undefined ? cleanSocial(body.image) ?? '' : existing.image_url;

				/*
				 * A social is only touched when its key is present in the body,
				 * so a PATCH that sends none of them leaves the links alone.
				 */
				const socials = body.socials ?? {};

				const github =
					socials.github !== undefined ? cleanSocial(socials.github) : existing.github;
				const linkedin =
					socials.linkedin !== undefined ? cleanSocial(socials.linkedin) : existing.linkedin;
				const instagram =
					socials.instagram !== undefined ? cleanSocial(socials.instagram) : existing.instagram;
				const website =
					socials.website !== undefined ? cleanSocial(socials.website) : existing.website;

				const updated = await env.DB.prepare(
					`
			      UPDATE team_members
			      SET name = ?, role = ?, tier = ?, bio = ?, image_url = ?,
			          github = ?, linkedin = ?, instagram = ?, website = ?,
			          updated_at = CURRENT_TIMESTAMP
			      WHERE id = ?
			      RETURNING ${TEAM_MEMBER_COLUMNS}
			    `,
				)
					.bind(name, role, tier, bio, image, github, linkedin, instagram, website, id)
					.first<TeamMemberRow>();

				return json({ member: updated ? serializeTeamMember(updated) : null }, 200, request, env);
			}

			if (request.method === 'DELETE' && teamMemberMatch) {
				const auth = await requireAdmin(request, env);

				if (!auth.authorized) {
					return auth.response;
				}

				const id = Number(teamMemberMatch[1]);

				const existing = await env.DB.prepare(
					`SELECT image_url FROM team_members WHERE id = ?`,
				)
					.bind(id)
					.first<{ image_url: string }>();

				if (!existing) {
					return json({ error: 'Member not found' }, 404, request, env);
				}

				await env.DB.prepare(`DELETE FROM team_members WHERE id = ?`).bind(id).run();

				/*
				 * Free the uploaded photo, if any. Seeded /team/*.webp paths
				 * return null here and are left in the public folder.
				 */
				const key = teamImageKey(existing.image_url);

				if (key) {
					await env.osc_events_archives.delete(key);
				}

				return json({ ok: true }, 200, request, env);
			}

			/*
			 * ============================================================
			 * NOT FOUND
			 * ============================================================
			 */

			return json(
				{
					error: 'Not Found',
				},
				404,
				request,
				env,
			);
		} catch (error) {
			console.error('Unhandled worker error:', request.method, new URL(request.url).pathname, error);

			/*
			 * A thrown error must still produce a CORS-enabled response,
			 * otherwise the browser reports an opaque network failure
			 * instead of the actual status.
			 */
			return json({ error: 'Internal Server Error' }, 500, request, env);
		}
	},
} satisfies ExportedHandler<Env>;
