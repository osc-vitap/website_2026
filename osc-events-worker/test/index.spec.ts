import { env, createExecutionContext, waitOnExecutionContext, SELF } from "cloudflare:test";
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import worker from "../src/index";

// For now, you'll need to do something like this to get a correctly-typed
// `Request` to pass to `worker.fetch()`.
const IncomingRequest = Request<unknown, IncomingRequestCfProperties>;

const PROD_ORIGIN = "https://www.oscvitap.com";
const WORKER_ORIGIN = "https://events.oscvitap.com";

interface SeedEvent {
	slug: string;
	title: string;
	event_date?: string;
	event_end_at?: string | null;
	archive_status?: string;
	is_open?: number;
	registration_type?: "solo" | "team" | "workshop";
	min_team_size?: number;
	max_team_size?: number;
}

async function seedEvent(event: SeedEvent): Promise<void> {
	await env.DB.prepare(
		`
      INSERT INTO events (
        id,
        slug,
        title,
        event_date,
        event_end_at,
        is_open,
        archive_status,
        registration_type,
        min_team_size,
        max_team_size
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `,
	)
		.bind(
			crypto.randomUUID(),
			event.slug,
			event.title,
			event.event_date ?? "2099-01-01",
			event.event_end_at ?? null,
			event.is_open ?? 1,
			event.archive_status ?? "pending",
			event.registration_type ?? "solo",
			event.min_team_size ?? 1,
			event.max_team_size ?? 1,
		)
		.run();
}

interface SeedMember {
	name: string;
	college_registration_number: string;
	email: string;
}

/*
 * Adds one registration to an already seeded event, with one
 * registration_members row per member — so a three-person team is
 * one registration and three participants.
 */
async function seedRegistration(slug: string, members: SeedMember[]): Promise<void> {
	const event = await env.DB.prepare(`SELECT id FROM events WHERE slug = ?`)
		.bind(slug)
		.first<{ id: string }>();

	if (!event) {
		throw new Error(`seedRegistration: no event seeded for slug "${slug}"`);
	}

	const registration = await env.DB.prepare(
		`
      INSERT INTO registrations (event_id, name, year_of_study, email, team_size)
      VALUES (?, ?, ?, ?, ?)
    `,
	)
		.bind(event.id, members[0].name, "2", members[0].email, members.length)
		.run();

	await env.DB.batch(
		members.map((member, index) =>
			env.DB.prepare(
				`
          INSERT INTO registration_members (
            registration_id,
            event_id,
            name,
            year_of_study,
            college_registration_number,
            email,
            member_number
          )
          VALUES (?, ?, ?, ?, ?, ?, ?)
        `,
			).bind(
				registration.meta.last_row_id,
				event.id,
				member.name,
				"2",
				member.college_registration_number,
				member.email,
				index + 1,
			),
		),
	);
}

/*
 * Every test starts from an empty events table so that seeded
 * slugs cannot collide with the previous test.
 */
beforeEach(async () => {
	await env.DB.batch([
		env.DB.prepare(`DELETE FROM registration_members`),
		env.DB.prepare(`DELETE FROM registrations`),
		env.DB.prepare(`DELETE FROM events`),
	]);
});

async function fetchWorker(path: string, init?: RequestInit): Promise<Response> {
	const request = new IncomingRequest(`${WORKER_ORIGIN}${path}`, init);
	const ctx = createExecutionContext();
	const response = await worker.fetch(request, env, ctx);
	await waitOnExecutionContext(ctx);
	return response;
}

describe("CORS", () => {
	it("reflects an allowed production origin on GET /api/events", async () => {
		const response = await fetchWorker("/api/events", {
			headers: { Origin: PROD_ORIGIN },
		});

		expect(response.status).toBe(200);
		expect(response.headers.get("Access-Control-Allow-Origin")).toBe(PROD_ORIGIN);
		expect(response.headers.get("Access-Control-Allow-Credentials")).toBe("true");
		expect(response.headers.get("Vary")).toBe("Origin");
	});

	it("reflects the local development origin", async () => {
		const response = await fetchWorker("/api/events", {
			headers: { Origin: "http://localhost:5173" },
		});

		expect(response.headers.get("Access-Control-Allow-Origin")).toBe("http://localhost:5173");
	});

	it("omits Access-Control-Allow-Origin for an unknown origin", async () => {
		const response = await fetchWorker("/api/events", {
			headers: { Origin: "https://evil.example.com" },
		});

		expect(response.status).toBe(200);
		expect(response.headers.get("Access-Control-Allow-Origin")).toBeNull();
		expect(response.headers.get("Vary")).toBe("Origin");
	});

	it("answers an OPTIONS preflight from an allowed origin", async () => {
		const response = await fetchWorker("/api/events", {
			method: "OPTIONS",
			headers: {
				Origin: PROD_ORIGIN,
				"Access-Control-Request-Method": "POST",
				"Access-Control-Request-Headers": "Content-Type",
			},
		});

		expect(response.status).toBe(204);
		expect(response.headers.get("Access-Control-Allow-Origin")).toBe(PROD_ORIGIN);
		expect(response.headers.get("Access-Control-Allow-Methods")).toContain("POST");
		expect(response.headers.get("Access-Control-Allow-Headers")).toBe("Content-Type");
	});

	it("answers an OPTIONS preflight from an unknown origin without ACAO", async () => {
		const response = await fetchWorker("/api/events", {
			method: "OPTIONS",
			headers: { Origin: "https://evil.example.com" },
		});

		expect(response.status).toBe(204);
		expect(response.headers.get("Access-Control-Allow-Origin")).toBeNull();
	});
});

describe("public events API", () => {
	beforeEach(async () => {
		await seedEvent({ slug: "live-event", title: "Live Event" });
		await seedEvent({
			slug: "archived-event",
			title: "Archived Event",
			archive_status: "archived",
			is_open: 0,
		});
	});

	it("excludes archived events from the public list", async () => {
		const response = await fetchWorker("/api/events");

		expect(response.status).toBe(200);

		const data = (await response.json()) as {
			events: { slug: string; event_end_at: string | null; archive_status: string }[];
		};

		expect(data.events.map((event) => event.slug)).toEqual(["live-event"]);
		expect(data.events[0]).toHaveProperty("event_end_at");
		expect(data.events[0]).toHaveProperty("archive_status", "pending");
	});

	it("includes archived events with ?include_archived=1", async () => {
		const response = await fetchWorker("/api/events?include_archived=1");

		const data = (await response.json()) as { events: { slug: string }[] };

		expect(data.events.map((event) => event.slug).sort()).toEqual(["archived-event", "live-event"]);
	});

	it("returns a single event by slug", async () => {
		const response = await fetchWorker("/api/events/live-event");

		expect(response.status).toBe(200);

		const data = (await response.json()) as {
			event: { slug: string; event_end_at: string | null; archive_status: string };
		};

		expect(data.event.slug).toBe("live-event");
		expect(data.event.archive_status).toBe("pending");
		expect(data.event.event_end_at).toBeNull();
	});

	it("returns 404 for an unknown slug", async () => {
		const response = await fetchWorker("/api/events/does-not-exist", {
			headers: { Origin: PROD_ORIGIN },
		});

		expect(response.status).toBe(404);
		expect(await response.json()).toEqual({ error: "Event not found" });
		expect(response.headers.get("Access-Control-Allow-Origin")).toBe(PROD_ORIGIN);
	});

	it("returns 404 for a nested path under /api/events", async () => {
		const response = await fetchWorker("/api/events/a/b/c");

		expect(response.status).toBe(404);
		expect(await response.json()).toEqual({ error: "Not Found" });
	});

	it("serves the public list over the integration-style fetcher too", async () => {
		const response = await SELF.fetch(`${WORKER_ORIGIN}/api/events`, {
			headers: { Origin: PROD_ORIGIN },
		});

		expect(response.status).toBe(200);
		expect(response.headers.get("Access-Control-Allow-Origin")).toBe(PROD_ORIGIN);
	});
});

describe("registration lifecycle", () => {
	const member = {
		name: "Test User",
		year_of_study: "2",
		college_registration_number: "22BCE0001",
		email: "test@example.com",
	};

	it("rejects registration for an event that has already ended", async () => {
		await seedEvent({
			slug: "finished-event",
			title: "Finished Event",
			event_date: "2020-01-01",
			event_end_at: "2020-01-02T10:00:00Z",
		});

		const response = await fetchWorker("/api/events/finished-event/register", {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({ members: [member] }),
		});

		expect(response.status).toBe(409);
		expect(await response.json()).toEqual({ error: "This event has already ended" });
	});

	it("accepts registration while the event is still running", async () => {
		await seedEvent({
			slug: "open-event",
			title: "Open Event",
			event_end_at: "2099-01-02T10:00:00Z",
		});

		const response = await fetchWorker("/api/events/open-event/register", {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({ members: [member] }),
		});

		expect(response.status).toBe(201);
	});

	it("leaves no member-less registration behind when a duplicate is rejected", async () => {
		await seedEvent({ slug: "dupe-event", title: "Dupe Event" });

		const body = JSON.stringify({ members: [member] });

		const first = await fetchWorker("/api/events/dupe-event/register", {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body,
		});

		const second = await fetchWorker("/api/events/dupe-event/register", {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body,
		});

		expect(first.status).toBe(201);
		expect(second.status).toBe(409);

		const counts = await env.DB.prepare(
			`
        SELECT
          (SELECT COUNT(*) FROM registrations) AS registrations,
          (SELECT COUNT(*) FROM registration_members) AS members
      `,
		).first<{ registrations: number; members: number }>();

		expect(counts).toEqual({ registrations: 1, members: 1 });
	});

	it("closes registration when the scheduled job archives a finished event", async () => {
		await seedEvent({
			slug: "ending-event",
			title: "Ending Event",
			event_date: "2020-01-01",
			event_end_at: "2020-01-02T10:00:00Z",
		});

		const ctx = createExecutionContext();
		await worker.scheduled({ scheduledTime: Date.now(), cron: "0 * * * *", noRetry() {} }, env, ctx);
		await waitOnExecutionContext(ctx);

		const event = await env.DB.prepare(`SELECT is_open, archive_status FROM events WHERE slug = ?`)
			.bind("ending-event")
			.first<{ is_open: number; archive_status: string }>();

		expect(event).toMatchObject({ is_open: 0, archive_status: "archived" });
	});
});

describe("registration identity", () => {
	function register(
		slug: string,
		members: Record<string, unknown>[],
		options?: { ip?: string; team_name?: string },
	): Promise<Response> {
		return fetchWorker(`/api/events/${slug}/register`, {
			method: "POST",
			headers: {
				"Content-Type": "application/json",
				...(options?.ip ? { "CF-Connecting-IP": options.ip } : {}),
			},
			body: JSON.stringify({ members, team_name: options?.team_name }),
		});
	}

	const student = (registrationNumber: string, overrides?: Record<string, unknown>) => ({
		name: "Test Student",
		year_of_study: "2",
		college_registration_number: registrationNumber,
		email: "student@example.com",
		...overrides,
	});

	it("rejects a second registration and names who is already registered", async () => {
		await seedEvent({ slug: "identity-event", title: "Identity Event" });

		expect((await register("identity-event", [student("22BCE7001")])).status).toBe(201);

		const response = await register("identity-event", [
			student("22BCE7001", { name: "Different Name", email: "other@example.com" }),
		]);

		expect(response.status).toBe(409);
		expect(await response.json()).toEqual({
			error: "22BCE7001 is already registered for this event",
			already_registered: ["22BCE7001"],
		});
	});

	it("treats casing and whitespace as the same registration number", async () => {
		await seedEvent({ slug: "casing-event", title: "Casing Event" });

		expect((await register("casing-event", [student("22BCE7002")])).status).toBe(201);

		const response = await register("casing-event", [student("  22bce 7002 ")]);

		expect(response.status).toBe(409);
	});

	it("stores registration numbers in canonical form", async () => {
		await seedEvent({ slug: "canonical-event", title: "Canonical Event" });

		expect((await register("canonical-event", [student(" 22bce7003 ")])).status).toBe(201);

		const row = await env.DB.prepare(`SELECT college_registration_number FROM registration_members`).first<{
			college_registration_number: string;
		}>();

		expect(row?.college_registration_number).toBe("22BCE7003");
	});

	it("still allows the same student to register for a different event", async () => {
		await seedEvent({ slug: "first-event", title: "First Event" });
		await seedEvent({ slug: "second-event", title: "Second Event" });

		expect((await register("first-event", [student("22BCE7004")])).status).toBe(201);
		expect((await register("second-event", [student("22BCE7004")])).status).toBe(201);
	});

	it("rejects a team that lists the same member twice", async () => {
		await seedEvent({
			slug: "team-dupe-event",
			title: "Team Dupe Event",
			registration_type: "team",
			min_team_size: 2,
			max_team_size: 4,
		});

		const response = await register(
			"team-dupe-event",
			[student("22BCE7005"), student("22bce7005", { email: "twin@example.com" })],
			{ team_name: "The Twins" },
		);

		expect(response.status).toBe(400);
		expect(((await response.json()) as { error: string }).error).toContain("22BCE7005");
	});

	it("rejects an email address that cannot receive mail", async () => {
		await seedEvent({ slug: "email-event", title: "Email Event" });

		const response = await register("email-event", [student("22BCE7006", { email: "not-an-email" })]);

		expect(response.status).toBe(400);
	});

	it("rejects a registration number that does not look like one", async () => {
		await seedEvent({ slug: "format-event", title: "Format Event" });

		const response = await register("format-event", [student("no!")]);

		expect(response.status).toBe(400);
	});

	it("rejects oversized fields instead of storing them", async () => {
		await seedEvent({ slug: "bloat-event", title: "Bloat Event" });

		const response = await register("bloat-event", [student("22BCE7007", { name: "x".repeat(500) })]);

		expect(response.status).toBe(400);
	});
});

describe("rate limiting", () => {
	function register(slug: string, registrationNumber: string, ip: string): Promise<Response> {
		return fetchWorker(`/api/events/${slug}/register`, {
			method: "POST",
			headers: {
				"Content-Type": "application/json",
				"CF-Connecting-IP": ip,
			},
			body: JSON.stringify({
				members: [
					{
						name: "Rate Test",
						year_of_study: "2",
						college_registration_number: registrationNumber,
						email: "rate@example.com",
					},
				],
			}),
		});
	}

	it("throttles repeated attempts for one registration number without punishing the shared IP", async () => {
		await seedEvent({ slug: "retry-event", title: "Retry Event" });

		/*
		 * Six attempts for the same identity: the first registers, the
		 * next four are duplicate conflicts, the sixth hits the identity
		 * limiter. A different student on the SAME IP must still get
		 * through — that is the campus NAT scenario.
		 */
		const statuses: number[] = [];

		for (let attempt = 0; attempt < 6; attempt++) {
			statuses.push((await register("retry-event", "22BCE8001", "203.0.113.10")).status);
		}

		expect(statuses.slice(0, 5)).toEqual([201, 409, 409, 409, 409]);
		expect(statuses[5]).toBe(429);

		const sameIpDifferentStudent = await register("retry-event", "22BCE8002", "203.0.113.10");

		expect(sameIpDifferentStudent.status).toBe(201);
	});

	it("sends Retry-After with a throttled response", async () => {
		await seedEvent({ slug: "retry-after-event", title: "Retry After Event" });

		let last: Response | null = null;

		for (let attempt = 0; attempt < 6; attempt++) {
			last = await register("retry-after-event", "22BCE8003", "203.0.113.11");
		}

		expect(last?.status).toBe(429);
		expect(last?.headers.get("Retry-After")).toBe("60");
	});

	it("stops a flood of fabricated registration numbers from one IP", async () => {
		await seedEvent({ slug: "flood-event", title: "Flood Event" });

		let throttled = 0;

		for (let attempt = 0; attempt < 61; attempt++) {
			const response = await register("flood-event", `22BCE${String(1000 + attempt)}`, "203.0.113.12");

			if (response.status === 429) {
				throttled++;
			}
		}

		expect(throttled).toBeGreaterThan(0);
	});

	it("throttles the OAuth entry point", async () => {
		let last: Response | null = null;

		for (let attempt = 0; attempt < 11; attempt++) {
			last = await fetchWorker("/auth/github", {
				headers: { "CF-Connecting-IP": "203.0.113.13" },
			});
		}

		expect(last?.status).toBe(429);
	});
});

describe("admin access", () => {
	const SESSION_ID = "test-admin-session";

	const originalAllowList = env.ADMIN_GITHUB_USERS;

	async function seedSession(username: string): Promise<void> {
		await env.DB.prepare(
			`
        INSERT INTO admin_sessions (id, github_user_id, github_username, expires_at)
        VALUES (?, ?, ?, datetime('now', '+1 hour'))
      `,
		)
			.bind(SESSION_ID, "1", username)
			.run();
	}

	function asAdmin(path: string, init?: RequestInit): Promise<Response> {
		return fetchWorker(path, {
			...init,
			headers: {
				...(init?.headers ?? {}),
				Cookie: `osc_admin_session=${SESSION_ID}`,
			},
		});
	}

	afterEach(async () => {
		env.ADMIN_GITHUB_USERS = originalAllowList;

		await env.DB.prepare(`DELETE FROM admin_sessions`).run();
	});

	it("allows any signed-in admin when the allow list is empty", async () => {
		env.ADMIN_GITHUB_USERS = "";

		await seedSession("someone-on-the-team");

		const response = await asAdmin("/api/admin/events");

		expect(response.status).toBe(200);
	});

	it("allows a handle that is on the allow list, case-insensitively", async () => {
		env.ADMIN_GITHUB_USERS = "Izhaan-Raza, someone-else";

		await seedSession("izhaan-raza");

		const response = await asAdmin("/api/admin/events");

		expect(response.status).toBe(200);
	});

	it("rejects a handle that is not on the allow list", async () => {
		env.ADMIN_GITHUB_USERS = "izhaan-raza";

		await seedSession("not-invited");

		const response = await asAdmin("/api/admin/events");

		expect(response.status).toBe(401);
		expect(await response.json()).toEqual({ error: "Authentication required" });
	});

	it("revokes an existing session as soon as the handle leaves the allow list", async () => {
		env.ADMIN_GITHUB_USERS = "leaving-soon";

		await seedSession("leaving-soon");

		expect((await asAdmin("/api/admin/me")).status).toBe(200);

		env.ADMIN_GITHUB_USERS = "someone-else";

		expect((await asAdmin("/api/admin/me")).status).toBe(401);
	});

	interface AdminEvent {
		slug: string;
		created_at: string;
		registration_count: number;
		participant_count: number;
	}

	async function listEvents(): Promise<AdminEvent[]> {
		const response = await asAdmin("/api/admin/events");

		expect(response.status).toBe(200);

		return ((await response.json()) as { events: AdminEvent[] }).events;
	}

	it("reports zero counts for an event nobody has registered for", async () => {
		env.ADMIN_GITHUB_USERS = "";

		await seedSession("admin");
		await seedEvent({ slug: "lonely-event", title: "Lonely Event" });

		const events = await listEvents();

		expect(events).toHaveLength(1);
		expect(events[0]).toMatchObject({
			slug: "lonely-event",
			registration_count: 0,
			participant_count: 0,
		});
	});

	it("counts registrations and participants separately for a team event", async () => {
		env.ADMIN_GITHUB_USERS = "";

		await seedSession("admin");
		await seedEvent({ slug: "team-event", title: "Team Event" });
		await seedEvent({ slug: "solo-event", title: "Solo Event" });

		// One registration, three people on the team.
		await seedRegistration("team-event", [
			{ name: "Captain", college_registration_number: "22BCE0001", email: "captain@example.com" },
			{ name: "Second", college_registration_number: "22BCE0002", email: "second@example.com" },
			{ name: "Third", college_registration_number: "22BCE0003", email: "third@example.com" },
		]);

		// Two registrations of one person each.
		await seedRegistration("solo-event", [
			{ name: "Alone", college_registration_number: "22BCE0004", email: "alone@example.com" },
		]);
		await seedRegistration("solo-event", [
			{ name: "Also Alone", college_registration_number: "22BCE0005", email: "also@example.com" },
		]);

		const events = await listEvents();
		const bySlug = Object.fromEntries(events.map((event) => [event.slug, event]));

		expect(bySlug["team-event"]).toMatchObject({
			registration_count: 1,
			participant_count: 3,
		});

		expect(bySlug["solo-event"]).toMatchObject({
			registration_count: 2,
			participant_count: 2,
		});
	});

	it("deletes an event together with its registrations", async () => {
		env.ADMIN_GITHUB_USERS = "";

		await seedSession("admin");
		await seedEvent({ slug: "doomed-event", title: "Doomed Event" });

		/*
		 * registration_members references registrations without ON DELETE
		 * CASCADE, so deleting only the event row used to trip the foreign
		 * key for any event that had a single registration.
		 */
		await seedRegistration("doomed-event", [
			{ name: "Attendee", college_registration_number: "22BCE0009", email: "attendee@example.com" },
		]);

		const response = await asAdmin("/api/admin/events/doomed-event", { method: "DELETE" });

		expect(response.status).toBe(200);

		const counts = await env.DB.prepare(
			`
        SELECT
          (SELECT COUNT(*) FROM events) AS events,
          (SELECT COUNT(*) FROM registrations) AS registrations,
          (SELECT COUNT(*) FROM registration_members) AS members
      `,
		).first<{ events: number; registrations: number; members: number }>();

		expect(counts).toEqual({ events: 0, registrations: 0, members: 0 });
	});

	it("orders the admin list by created_at descending", async () => {
		env.ADMIN_GITHUB_USERS = "";

		await seedSession("admin");

		/*
		 * seedEvent leans on CURRENT_TIMESTAMP, which only has
		 * one-second resolution, so pin created_at by hand.
		 */
		const posted = [
			// Event dates rise with created_at, so the old
			// event_date ASC ordering would come back reversed.
			{ slug: "posted-first", event_date: "2099-01-01", created_at: "2026-01-01 09:00:00" },
			{ slug: "posted-second", event_date: "2099-02-01", created_at: "2026-02-01 09:00:00" },
			{ slug: "posted-third", event_date: "2099-03-01", created_at: "2026-03-01 09:00:00" },
		];

		for (const event of posted) {
			await seedEvent({ slug: event.slug, title: event.slug, event_date: event.event_date });

			await env.DB.prepare(`UPDATE events SET created_at = ? WHERE slug = ?`)
				.bind(event.created_at, event.slug)
				.run();
		}

		const events = await listEvents();

		expect(events.map((event) => event.slug)).toEqual(["posted-third", "posted-second", "posted-first"]);
	});

	it("orders events posted in the same second deterministically", async () => {
		env.ADMIN_GITHUB_USERS = "";

		await seedSession("admin");

		/*
		 * created_at defaults to CURRENT_TIMESTAMP, so a batch of events
		 * seeded together all share one timestamp — ten of them do in
		 * production. Without a tiebreaker their order is arbitrary and
		 * the admin list reshuffles between refreshes.
		 */
		const sameSecond = "2026-05-05 12:00:00";

		for (const event of [
			{ slug: "batch-early", event_date: "2026-01-01" },
			{ slug: "batch-late", event_date: "2026-12-01" },
			{ slug: "batch-middle", event_date: "2026-06-01" },
		]) {
			await seedEvent({ slug: event.slug, title: event.slug, event_date: event.event_date });

			await env.DB.prepare(`UPDATE events SET created_at = ? WHERE slug = ?`)
				.bind(sameSecond, event.slug)
				.run();
		}

		const first = await listEvents();
		const second = await listEvents();

		// Newest event_date first among the tie, and stable across requests.
		expect(first.map((event) => event.slug)).toEqual(["batch-late", "batch-middle", "batch-early"]);
		expect(second.map((event) => event.slug)).toEqual(first.map((event) => event.slug));
	});

	it("deletes an event and reports whether an archive was removed", async () => {
		env.ADMIN_GITHUB_USERS = "";

		await seedSession("admin");
		await seedEvent({ slug: "doomed-event", title: "Doomed Event" });

		const response = await asAdmin("/api/admin/events/doomed-event", { method: "DELETE" });

		expect(response.status).toBe(200);
		expect(await response.json()).toMatchObject({
			success: true,
			message: "Event deleted",
			archive_deleted: false,
		});

		const remaining = await env.DB.prepare(`SELECT COUNT(*) AS n FROM events`).first<{ n: number }>();

		expect(remaining?.n).toBe(0);
	});

	it("persists event_end_at when creating an event", async () => {
		env.ADMIN_GITHUB_USERS = "";

		await seedSession("admin");

		const response = await asAdmin("/api/admin/events", {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({
				slug: "ends-later",
				title: "Ends Later",
				event_date: "2026-08-29",
				event_end_at: "2026-08-29T10:30:00.000Z",
			}),
		});

		expect(response.status).toBe(201);

		const event = await env.DB.prepare(`SELECT event_end_at FROM events WHERE slug = ?`)
			.bind("ends-later")
			.first<{ event_end_at: string }>();

		expect(event?.event_end_at).toBe("2026-08-29T10:30:00.000Z");
	});

	it("updates and clears event_end_at", async () => {
		env.ADMIN_GITHUB_USERS = "";

		await seedSession("admin");
		await seedEvent({ slug: "movable", title: "Movable", event_date: "2026-08-29" });

		const patch = (body: unknown) =>
			asAdmin("/api/admin/events/movable", {
				method: "PATCH",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify(body),
			});

		expect((await patch({ event_end_at: "2026-08-29T12:00:00.000Z" })).status).toBe(200);

		const set = await env.DB.prepare(`SELECT event_end_at FROM events WHERE slug = ?`)
			.bind("movable")
			.first<{ event_end_at: string | null }>();

		expect(set?.event_end_at).toBe("2026-08-29T12:00:00.000Z");

		// Omitting the field leaves it alone.
		expect((await patch({ venue: "Somewhere" })).status).toBe(200);

		const untouched = await env.DB.prepare(`SELECT event_end_at FROM events WHERE slug = ?`)
			.bind("movable")
			.first<{ event_end_at: string | null }>();

		expect(untouched?.event_end_at).toBe("2026-08-29T12:00:00.000Z");

		// An empty string clears it.
		expect((await patch({ event_end_at: "" })).status).toBe(200);

		const cleared = await env.DB.prepare(`SELECT event_end_at FROM events WHERE slug = ?`)
			.bind("movable")
			.first<{ event_end_at: string | null }>();

		expect(cleared?.event_end_at).toBeNull();
	});

	it("rejects an event end that is invalid or before the event date", async () => {
		env.ADMIN_GITHUB_USERS = "";

		await seedSession("admin");

		const create = (body: unknown) =>
			asAdmin("/api/admin/events", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify(body),
			});

		const invalid = await create({
			slug: "bad-end",
			title: "Bad End",
			event_date: "2026-08-29",
			event_end_at: "not a date",
		});

		expect(invalid.status).toBe(400);
		expect(await invalid.json()).toEqual({ error: "Invalid event end date." });

		const backwards = await create({
			slug: "backwards",
			title: "Backwards",
			event_date: "2026-08-29",
			event_end_at: "2026-08-01T10:00:00.000Z",
		});

		expect(backwards.status).toBe(400);
		expect(await backwards.json()).toEqual({ error: "Event end cannot be before the event date." });

		const count = await env.DB.prepare(`SELECT COUNT(*) AS n FROM events`).first<{ n: number }>();

		expect(count?.n).toBe(0);
	});

	it("does not treat a nested admin path as a delete", async () => {
		env.ADMIN_GITHUB_USERS = "";

		await seedSession("admin");
		await seedEvent({ slug: "safe-event", title: "Safe Event" });

		const response = await asAdmin("/api/admin/events/safe-event/registrations", { method: "DELETE" });

		expect(response.status).toBe(404);

		const remaining = await env.DB.prepare(`SELECT COUNT(*) AS n FROM events`).first<{ n: number }>();

		expect(remaining?.n).toBe(1);
	});
});
