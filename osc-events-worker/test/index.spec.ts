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

	/*
	 * The format exactly: admission year 22–26, three letters, four
	 * digits. One case per way of getting it wrong, so a regex edit
	 * that loosens any segment fails a named test.
	 */
	it.each([
		["21BCE1234", "an admission year before 22"],
		["27BCE1234", "an admission year after 26"],
		["22BC1234", "a two-letter programme code"],
		["22BCEE1234", "a four-letter programme code"],
		["22BCE123", "a three-digit roll"],
		["22BCE12345", "a five-digit roll"],
		["22BCE12A4", "a letter inside the roll"],
		["2BCE1234", "a one-digit year"],
	])("rejects %s (%s)", async (registrationNumber) => {
		await seedEvent({ slug: `bad-${registrationNumber.toLowerCase()}`, title: "Format Event" });

		const response = await register(`bad-${registrationNumber.toLowerCase()}`, [student(registrationNumber)]);

		expect(response.status).toBe(400);
		expect(((await response.json()) as { error: string }).error).toContain("22BCE1234");
	});

	it.each(["22BCE0001", "26MIS9999", "24bce 1234"])("accepts %s", async (registrationNumber) => {
		const slug = `good-${registrationNumber.replace(/\s+/g, "").toLowerCase()}`;

		await seedEvent({ slug, title: "Format Event" });

		expect((await register(slug, [student(registrationNumber)])).status).toBe(201);
	});

	it("reports a null member as bad input rather than crashing", async () => {
		await seedEvent({ slug: "null-member-event", title: "Null Member Event" });

		/*
		 * [null] is a valid JSON array, and reading .name off it threw a
		 * TypeError that surfaced as a 500 — an input problem reported as
		 * a server fault.
		 */
		for (const members of [[null], ["not an object"], [42]]) {
			const response = await register("null-member-event", members as never);

			expect(response.status).toBe(400);
		}
	});

	it("rejects oversized fields instead of storing them", async () => {
		await seedEvent({ slug: "bloat-event", title: "Bloat Event" });

		const response = await register("bloat-event", [student("22BCE7007", { name: "x".repeat(500) })]);

		expect(response.status).toBe(400);
	});
});

/*
 * The archive path is where irreversible loss lives: once the cron has
 * written R2 and purged D1, that object is the only copy of every
 * participant's name, registration number and email. It had no test
 * coverage at all, and an audit found four separate ways to destroy it.
 */
describe("registration archive", () => {
	const ARCHIVE_SESSION = "archive-session";

	async function asArchiveAdmin(path: string, init?: RequestInit): Promise<Response> {
		return fetchWorker(path, {
			...init,
			headers: {
				...(init?.headers ?? {}),
				Cookie: `osc_admin_session=${ARCHIVE_SESSION}`,
			},
		});
	}

	beforeEach(async () => {
		env.ADMIN_GITHUB_USERS = "";

		await env.DB.prepare(
			`
        INSERT INTO admin_sessions (id, github_user_id, github_username, expires_at)
        VALUES (?, ?, ?, ?)
      `,
		)
			.bind(ARCHIVE_SESSION, "1", "archivist", new Date(Date.now() + 3600_000).toISOString())
			.run();
	});

	afterEach(async () => {
		await env.DB.prepare(`DELETE FROM admin_sessions`).run();

		const listed = await env.osc_events_archives.list();

		for (const object of listed.objects) {
			await env.osc_events_archives.delete(object.key);
		}
	});

	async function eventIdFor(slug: string): Promise<string> {
		const row = await env.DB.prepare(`SELECT id FROM events WHERE slug = ?`).bind(slug).first<{ id: string }>();

		if (!row) throw new Error(`no event seeded for ${slug}`);

		return row.id;
	}

	async function runCron(): Promise<void> {
		const ctx = createExecutionContext();
		await worker.scheduled({ scheduledTime: Date.now(), cron: "0 * * * *", noRetry() {} }, env, ctx);
		await waitOnExecutionContext(ctx);
	}

	const ENDED = {
		event_date: "2020-01-01",
		event_end_at: "2020-01-02T10:00:00Z",
	};

	it("keys the archive on the event id, not on its slug", async () => {
		/*
		 * The key used to be the slug through
		 * replace(/[^a-zA-Z0-9_-]/g,'-'), which is many-to-one: these two
		 * slugs both became "clash-2-0", so the second archive overwrote
		 * the first and the cron then deleted the first event's rows
		 * having "verified" that an object existed at that key.
		 */
		await seedEvent({ slug: "clash-2.0", title: "Clash Dot", ...ENDED });
		await seedEvent({ slug: "clash-2-0", title: "Clash Dash", ...ENDED });

		await seedRegistration("clash-2.0", [
			{ name: "Dot Person", college_registration_number: "22BCE5001", email: "dot@example.com" },
		]);
		await seedRegistration("clash-2-0", [
			{ name: "Dash Person", college_registration_number: "22BCE5002", email: "dash@example.com" },
		]);

		const dotId = await eventIdFor("clash-2.0");
		const dashId = await eventIdFor("clash-2-0");

		await runCron();

		/* Two events, two distinct objects — neither overwrote the other. */
		const dot = await env.osc_events_archives.head(`events/${dotId}/registrations.csv.gz`);
		const dash = await env.osc_events_archives.head(`events/${dashId}/registrations.csv.gz`);

		expect(dot).not.toBeNull();
		expect(dash).not.toBeNull();
		expect(dot?.customMetadata?.eventId).toBe(dotId);
		expect(dash?.customMetadata?.eventId).toBe(dashId);
	});

	it("records archive_key before deleting the rows it replaces", async () => {
		await seedEvent({ slug: "keyed-event", title: "Keyed Event", ...ENDED });
		await seedRegistration("keyed-event", [
			{ name: "Someone", college_registration_number: "22BCE5003", email: "someone@example.com" },
		]);

		const id = await eventIdFor("keyed-event");

		await runCron();

		const row = await env.DB.prepare(`SELECT archive_status, archive_key, is_open FROM events WHERE slug = ?`)
			.bind("keyed-event")
			.first<{ archive_status: string; archive_key: string | null; is_open: number }>();

		expect(row).toMatchObject({
			archive_status: "archived",
			archive_key: `events/${id}/registrations.csv.gz`,
			is_open: 0,
		});
	});

	it("does not write an archive for an event nobody registered for", async () => {
		await seedEvent({ slug: "empty-event", title: "Empty Event", ...ENDED });

		await runCron();

		const listed = await env.osc_events_archives.list();

		expect(listed.objects).toHaveLength(0);

		const row = await env.DB.prepare(`SELECT archive_status FROM events WHERE slug = ?`)
			.bind("empty-event")
			.first<{ archive_status: string }>();

		expect(row?.archive_status).toBe("archived");
	});

	it("refuses a manual archive that would write a header-only file", async () => {
		/*
		 * The scenario that destroyed data: the cron archives and purges,
		 * then an admin runs the manual endpoint to "take a fresh
		 * backup". The rebuild finds zero rows and used to put a ~22 byte
		 * gzip over the real archive, answering {"success": true}.
		 */
		await seedEvent({ slug: "purged-event", title: "Purged Event", ...ENDED });
		await seedRegistration("purged-event", [
			{ name: "Archived Soul", college_registration_number: "22BCE5004", email: "soul@example.com" },
		]);

		const id = await eventIdFor("purged-event");

		await runCron();

		const before = await env.osc_events_archives.head(`events/${id}/registrations.csv.gz`);

		expect(before).not.toBeNull();

		const response = await asArchiveAdmin("/api/admin/events/purged-event/registrations/archive", {
			method: "POST",
		});

		expect(response.status).toBe(409);

		/* The good archive is untouched, byte for byte. */
		const after = await env.osc_events_archives.head(`events/${id}/registrations.csv.gz`);

		expect(after?.size).toBe(before?.size);
	});

	it("refuses to overwrite an archived event without an explicit opt-in", async () => {
		await seedEvent({ slug: "guarded-event", title: "Guarded Event" });
		await seedRegistration("guarded-event", [
			{ name: "Still Here", college_registration_number: "22BCE5005", email: "here@example.com" },
		]);

		await env.DB.prepare(`UPDATE events SET archive_status = 'archived' WHERE slug = ?`)
			.bind("guarded-event")
			.run();

		const blocked = await asArchiveAdmin("/api/admin/events/guarded-event/registrations/archive", {
			method: "POST",
		});

		expect(blocked.status).toBe(409);

		const allowed = await asArchiveAdmin(
			"/api/admin/events/guarded-event/registrations/archive?overwrite=1",
			{ method: "POST" },
		);

		expect(allowed.status).toBe(200);
	});

	it("does not retire a live event when an admin takes a snapshot", async () => {
		/*
		 * The manual endpoint used to set archive_status='archived',
		 * which hides the event from the public list — while the register
		 * handler, which reads only is_open, kept accepting entries the
		 * cron would never preserve because it only selects 'pending'.
		 */
		await seedEvent({ slug: "live-event", title: "Live Event" });
		await seedRegistration("live-event", [
			{ name: "Early Bird", college_registration_number: "22BCE5006", email: "early@example.com" },
		]);

		const response = await asArchiveAdmin("/api/admin/events/live-event/registrations/archive", {
			method: "POST",
		});

		expect(response.status).toBe(200);

		const row = await env.DB.prepare(`SELECT archive_status, is_open, archive_key FROM events WHERE slug = ?`)
			.bind("live-event")
			.first<{ archive_status: string; is_open: number; archive_key: string | null }>();

		/* Snapshot recorded, event still live and still visible. */
		expect(row?.archive_status).toBe("pending");
		expect(row?.is_open).toBe(1);
		expect(row?.archive_key).not.toBeNull();

		const publicList = await fetchWorker("/api/events");
		const { events } = (await publicList.json()) as { events: { slug: string }[] };

		expect(events.map((e) => e.slug)).toContain("live-event");
	});

	it("serves the archive from the stored key after the event is renamed", async () => {
		/*
		 * The download used to recompute the key from the CURRENT slug,
		 * so renaming an archived event pointed it at a key nothing had
		 * been written to and the archive became unreachable.
		 */
		await seedEvent({ slug: "old-name", title: "Old Name", ...ENDED });
		await seedRegistration("old-name", [
			{ name: "Renamed", college_registration_number: "22BCE5007", email: "renamed@example.com" },
		]);

		await runCron();

		await env.DB.prepare(`UPDATE events SET slug = ? WHERE slug = ?`).bind("new-name", "old-name").run();

		const response = await asArchiveAdmin("/api/admin/events/new-name/registrations/archive");

		expect(response.status).toBe(200);
		expect(response.headers.get("Content-Type")).toBe("application/gzip");
	});

	it("archives an event exactly once even if the cron runs again", async () => {
		await seedEvent({ slug: "twice-event", title: "Twice Event", ...ENDED });
		await seedRegistration("twice-event", [
			{ name: "Only Once", college_registration_number: "22BCE5008", email: "once@example.com" },
		]);

		const id = await eventIdFor("twice-event");

		await runCron();

		const first = await env.osc_events_archives.head(`events/${id}/registrations.csv.gz`);

		/* A second tick must not rebuild an empty CSV over the good one. */
		await runCron();

		const second = await env.osc_events_archives.head(`events/${id}/registrations.csv.gz`);

		expect(second?.size).toBe(first?.size);
		expect(second?.customMetadata?.rowCount).toBe("1");
	});
});

describe("OAuth failure handling", () => {
	/*
	 * Every one of these used to answer a top-level browser navigation
	 * with a JSON body on the Worker's own domain, leaving the person on
	 * a white page at events.oscvitap.com with no way back.
	 */
	it("sends a cancelled sign-in to the restricted page", async () => {
		const response = await fetchWorker("/auth/github/callback?error=access_denied&state=x");

		expect(response.status).toBe(302);
		expect(response.headers.get("Location")).toBe("https://www.oscvitap.com/admin/restricted?reason=denied");
	});

	it("sends a callback with no code to the restricted page", async () => {
		const response = await fetchWorker("/auth/github/callback");

		expect(response.status).toBe(302);
		expect(response.headers.get("Location")).toContain("reason=no-code");
	});

	it("rejects a state that this browser did not start the flow with", async () => {
		/*
		 * The row alone only proves the flow started here, not that it
		 * started in THIS browser. Without the cookie half, someone can
		 * begin a sign-in and get a victim to open the callback, leaving
		 * the victim holding a session for the attacker's GitHub account.
		 */
		await env.DB.prepare(
			`
        INSERT INTO admin_oauth_states (state, expires_at)
        VALUES (?, ?)
      `,
		)
			.bind("issued-to-someone-else", new Date(Date.now() + 600_000).toISOString())
			.run();

		const response = await fetchWorker("/auth/github/callback?code=abc&state=issued-to-someone-else");

		expect(response.status).toBe(302);
		expect(response.headers.get("Location")).toContain("reason=bad-state");

		/* The state row survives, so the real owner can still use it. */
		const still = await env.DB.prepare(`SELECT COUNT(*) AS n FROM admin_oauth_states`).first<{ n: number }>();

		expect(still?.n).toBe(1);

		await env.DB.prepare(`DELETE FROM admin_oauth_states`).run();
	});

	it("rejects a cookie that does not match the state in the URL", async () => {
		await env.DB.prepare(
			`
        INSERT INTO admin_oauth_states (state, expires_at)
        VALUES (?, ?)
      `,
		)
			.bind("real-state", new Date(Date.now() + 600_000).toISOString())
			.run();

		const response = await fetchWorker("/auth/github/callback?code=abc&state=real-state", {
			headers: { Cookie: "osc_oauth_state=a-different-state" },
		});

		expect(response.headers.get("Location")).toContain("reason=bad-state");

		await env.DB.prepare(`DELETE FROM admin_oauth_states`).run();
	});

	it("sends an unknown OAuth state to the restricted page", async () => {
		const response = await fetchWorker("/auth/github/callback?code=abc&state=never-issued");

		expect(response.status).toBe(302);
		expect(response.headers.get("Location")).toContain("reason=bad-state");
	});

	it("clears any session cookie on a failed sign-in", async () => {
		const response = await fetchWorker("/auth/github/callback?error=access_denied&state=x");

		expect(response.headers.get("Set-Cookie")).toContain("Max-Age=0");
	});

	it("never sends the browser off this site", async () => {
		for (const query of ["?error=access_denied&state=x", "", "?code=a&state=b"]) {
			const response = await fetchWorker(`/auth/github/callback${query}`);

			expect(response.headers.get("Location")).toMatch(
				/^https:\/\/www\.oscvitap\.com\/admin\/restricted\?reason=[a-z-]+$/,
			);
		}
	});
});

describe("CSV export safety", () => {
	it("neutralises spreadsheet formulas coming from registration input", async () => {
		env.ADMIN_GITHUB_USERS = "";

		await env.DB.prepare(
			`
        INSERT INTO admin_sessions (id, github_user_id, github_username, expires_at)
        VALUES (?, ?, ?, ?)
      `,
		)
			.bind("csv-session", "1", "admin", new Date(Date.now() + 3600_000).toISOString())
			.run();

		await seedEvent({ slug: "csv-event", title: "CSV Event" });

		/*
		 * A name Excel would otherwise execute. It reaches the database
		 * through the unauthenticated registration endpoint, and the
		 * export is written with a BOM so Excel is the expected reader.
		 */
		await seedRegistration("csv-event", [
			{
				name: "=cmd|'/c calc'!A1",
				college_registration_number: "22BCE4321",
				email: "formula@example.com",
			},
		]);

		const response = await fetchWorker("/api/admin/events/csv-event/registrations.csv", {
			headers: { Cookie: "osc_admin_session=csv-session" },
		});

		expect(response.status).toBe(200);

		const csv = await response.text();

		/*
		 * Prefixed with an apostrophe so the cell reads as text. No
		 * quoting here because the value happens to contain no comma —
		 * quoting is a separate concern from formula neutralisation.
		 */
		expect(csv).toContain(`,'=cmd|'/c calc'!A1,`);
		expect(csv).not.toContain(`,=cmd`);

		await env.DB.prepare(`DELETE FROM admin_sessions`).run();
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

	/*
	 * expires_at is written by the Worker with toISOString(), so a test
	 * that seeds SQLite's own datetime() format cannot see the
	 * string-comparison bug described at EXPIRY_NOTE. These seed the real
	 * format.
	 */
	async function seedSessionExpiring(username: string, expiresAt: string): Promise<void> {
		await env.DB.prepare(
			`
        INSERT INTO admin_sessions (id, github_user_id, github_username, expires_at)
        VALUES (?, ?, ?, ?)
      `,
		)
			.bind(SESSION_ID, "1", username, expiresAt)
			.run();
	}

	it("rejects a session that expired earlier today", async () => {
		env.ADMIN_GITHUB_USERS = "";

		/*
		 * Expired an hour ago, but with today's date. The old comparison
		 * matched "2026-08-26T..." against "2026-08-26 ..." as raw
		 * strings, where "T" sorts after " ", so this passed as valid
		 * until the date rolled over — eight-hour sessions lived up to
		 * thirty-two hours.
		 */
		await seedSessionExpiring("admin", new Date(Date.now() - 60 * 60 * 1000).toISOString());

		expect((await asAdmin("/api/admin/events")).status).toBe(401);
	});

	it("accepts a session that has not expired yet", async () => {
		env.ADMIN_GITHUB_USERS = "";

		await seedSessionExpiring("admin", new Date(Date.now() + 60 * 60 * 1000).toISOString());

		expect((await asAdmin("/api/admin/events")).status).toBe(200);
	});

	it("signs out by deleting the session row, not just the cookie", async () => {
		env.ADMIN_GITHUB_USERS = "";

		await seedSession("admin");

		expect((await asAdmin("/api/admin/me")).status).toBe(200);

		const response = await asAdmin("/auth/logout", { method: "POST" });

		expect(response.status).toBe(200);
		expect(response.headers.get("Set-Cookie")).toContain("Max-Age=0");

		const rows = await env.DB.prepare(`SELECT COUNT(*) AS n FROM admin_sessions`).first<{ n: number }>();

		expect(rows?.n).toBe(0);

		/* The cookie value is now useless even if the browser kept it. */
		expect((await asAdmin("/api/admin/me")).status).toBe(401);
	});

	it("treats signing out without a session as a no-op rather than an error", async () => {
		const response = await fetchWorker("/auth/logout", { method: "POST" });

		expect(response.status).toBe(200);
	});

	it("revokes every session belonging to a handle", async () => {
		env.ADMIN_GITHUB_USERS = "";

		await seedSession("admin");

		/* A second session for someone who has left the organisation. */
		await env.DB.prepare(
			`
        INSERT INTO admin_sessions (id, github_user_id, github_username, expires_at)
        VALUES (?, ?, ?, ?)
      `,
		)
			.bind("departed-session", "2", "Departed-Member", new Date(Date.now() + 3600_000).toISOString())
			.run();

		const response = await asAdmin("/api/admin/sessions/departed-member", { method: "DELETE" });

		expect(response.status).toBe(200);
		expect(await response.json()).toMatchObject({ sessions_revoked: 1 });

		const left = await env.DB.prepare(`SELECT github_username FROM admin_sessions`).all<{ github_username: string }>();

		expect(left.results.map((r) => r.github_username)).toEqual(["admin"]);
	});

	it("requires a session to revoke sessions", async () => {
		const response = await fetchWorker("/api/admin/sessions/someone", { method: "DELETE" });

		expect(response.status).toBe(401);
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

	it("does not change an event's public URL on an unrelated save", async () => {
		env.ADMIN_GITHUB_USERS = "";

		await seedSession("admin");
		await seedEvent({ slug: "stable-slug-26", title: "Stable Slug" });

		/*
		 * The admin form round-trips the stored slug on every save. Create
		 * kept it verbatim while update lowercased and hyphenated it, so
		 * the first unrelated edit could rewrite a published URL and break
		 * every printed QR code pointing at it. Both normalise now, which
		 * makes a re-save idempotent.
		 */
		const response = await asAdmin("/api/admin/events/stable-slug-26", {
			method: "PATCH",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({ slug: "stable-slug-26", venue: "A new room" }),
		});

		expect(response.status).toBe(200);

		const row = await env.DB.prepare(`SELECT slug, venue FROM events WHERE id IS NOT NULL`).first<{
			slug: string;
			venue: string;
		}>();

		expect(row).toMatchObject({ slug: "stable-slug-26", venue: "A new room" });
	});

	it("rejects a slug that is not in canonical form", async () => {
		env.ADMIN_GITHUB_USERS = "";

		await seedSession("admin");

		const response = await asAdmin("/api/admin/events", {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({ slug: "!!!", title: "Bad Slug", event_date: "2099-01-01" }),
		});

		expect(response.status).toBe(400);
	});

	it("normalises a slug on create so later saves cannot rewrite it", async () => {
		env.ADMIN_GITHUB_USERS = "";

		await seedSession("admin");

		const created = await asAdmin("/api/admin/events", {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({ slug: "GittyUp 26", title: "Mixed Case", event_date: "2099-01-01" }),
		});

		expect(created.status).toBe(201);

		const row = await env.DB.prepare(`SELECT slug FROM events WHERE title = ?`)
			.bind("Mixed Case")
			.first<{ slug: string }>();

		expect(row?.slug).toBe("gittyup-26");
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
