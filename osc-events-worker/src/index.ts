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

function isAllowedAdmin(username: string, env?: Env): boolean {
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
 * Not a full RFC 5322 validator — just enough to reject values that
 * cannot possibly receive mail, without locking out unusual real
 * addresses.
 */
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

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
	return new Response(null, {
		status: 302,
		headers: {
			Location: `${siteOrigin(request)}/admin/restricted?reason=${reason}`,
			/* A failure must not leave a half-made session behind. */
			'Set-Cookie': clearedSessionCookie(request),
		},
	});
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
	if (!isAllowedAdmin(session.github_username, env)) {
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
	]);
}

export default {
	async scheduled(_controller: ScheduledController, env: Env, _ctx: ExecutionContext): Promise<void> {
		await processCompletedEvents(env);

		await purgeExpiredAuthRows(env);
	},

	async fetch(request: Request, env: Env): Promise<Response> {
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

				return Response.redirect(githubUrl.toString(), 302);
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
				 */

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

				if (!isAllowedAdmin(githubUser.login, env)) {
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
				 */

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
				 * An invitation that has not been accepted yet comes back
				 * as 'pending'.
				 */
				if (membership.state !== 'active') {
					return authFailureRedirect(request, 'pending-invite');
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
					.bind(sessionId, String(githubUser.id), githubUser.login, sessionExpiresAt)
					.run();

				/*
				 * IMPORTANT:
				 * Do not return the authentication result as JSON here.
				 *
				 * The browser should be redirected back to the
				 * React admin dashboard after successful authentication.
				 */

				const redirectUrl = isLocalRequest(request) ? 'http://localhost:5173/admin' : 'https://www.oscvitap.com/admin';

				return new Response(null, {
					status: 302,
					headers: {
						Location: redirectUrl,
						'Set-Cookie': sessionCookie(sessionId, request),
					},
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

				const slug = body.slug !== undefined ? body.slug.trim().toLowerCase().replace(/\s+/g, '-') : existingEvent.slug;

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

				const slug = body.slug?.trim();

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
					const name = member.name?.trim() ?? '';
					const yearOfStudy = member.year_of_study?.trim() ?? '';
					const email = member.email?.trim().toLowerCase() ?? '';
					const github = member.github?.trim() || null;
					const registrationNumber = normalizeRegistrationNumber(member.college_registration_number ?? '');

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
						(github !== null && github.length > LIMITS.github)
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

					members.push({
						name,
						year_of_study: yearOfStudy,
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
						body.team_name?.trim().slice(0, LIMITS.teamName) || null,
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
