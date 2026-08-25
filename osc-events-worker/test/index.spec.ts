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
        archive_status
      )
      VALUES (?, ?, ?, ?, ?, ?, ?)
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
		)
		.run();
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
