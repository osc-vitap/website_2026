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
	registration_cap?: number | null;
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
        max_team_size,
        registration_cap
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
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
			event.registration_cap ?? null,
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

/*
 * The tests below replace globalThis.fetch, so their stubs are typed
 * against the real signature — the first argument is the full
 * RequestInfo | URL union even though the Worker only ever passes a
 * string to the endpoints being stubbed.
 */
function stubbedUrl(input: RequestInfo | URL): string {
	if (typeof input === "string") {
		return input;
	}

	return input instanceof URL ? input.href : input.url;
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
		email: "test@vitapstudent.ac.in",
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

/*
 * The hourly job that closes a form at its registration_cap — GittyUp
 * '26 at 1050 in production, small numbers here.
 */
describe("registration cap", () => {
	function runCron(): Promise<void> {
		const ctx = createExecutionContext();

		return worker
			.scheduled({ scheduledTime: Date.now(), cron: "0 * * * *", noRetry() {} }, env, ctx)
			.then(() => waitOnExecutionContext(ctx));
	}

	function isOpen(slug: string): Promise<{ is_open: number } | null> {
		return env.DB.prepare(`SELECT is_open FROM events WHERE slug = ?`)
			.bind(slug)
			.first<{ is_open: number }>();
	}

	async function fill(slug: string, count: number): Promise<void> {
		for (let i = 0; i < count; i += 1) {
			await seedRegistration(slug, [
				{
					name: `Student ${i}`,
					college_registration_number: `22BCE7${String(i).padStart(3, "0")}`,
					email: `student${i}@vitapstudent.ac.in`,
				},
			]);
		}
	}

	it("closes the form once the count reaches the cap", async () => {
		await seedEvent({ slug: "capped-event", title: "Capped Event", registration_cap: 3 });
		await fill("capped-event", 3);

		await runCron();

		expect(await isOpen("capped-event")).toMatchObject({ is_open: 0 });
	});

	it("leaves the form open below the cap", async () => {
		await seedEvent({ slug: "roomy-event", title: "Roomy Event", registration_cap: 3 });
		await fill("roomy-event", 2);

		await runCron();

		expect(await isOpen("roomy-event")).toMatchObject({ is_open: 1 });
	});

	it("leaves an uncapped event alone however many have registered", async () => {
		await seedEvent({ slug: "uncapped-event", title: "Uncapped Event" });
		await fill("uncapped-event", 4);

		await runCron();

		expect(await isOpen("uncapped-event")).toMatchObject({ is_open: 1 });
	});

	/*
	 * The unit is registrations, not participants: two three-person teams
	 * are two against a cap of two, not six.
	 */
	it("counts registrations rather than participants on a team event", async () => {
		await seedEvent({
			slug: "team-capped",
			title: "Team Capped",
			registration_type: "team",
			min_team_size: 1,
			max_team_size: 3,
			registration_cap: 2,
		});

		await seedRegistration("team-capped", [
			{ name: "A", college_registration_number: "22BCE8001", email: "a@vitapstudent.ac.in" },
			{ name: "B", college_registration_number: "22BCE8002", email: "b@vitapstudent.ac.in" },
			{ name: "C", college_registration_number: "22BCE8003", email: "c@vitapstudent.ac.in" },
		]);

		await runCron();

		expect(await isOpen("team-capped")).toMatchObject({ is_open: 1 });

		await seedRegistration("team-capped", [
			{ name: "D", college_registration_number: "22BCE8004", email: "d@vitapstudent.ac.in" },
			{ name: "E", college_registration_number: "22BCE8005", email: "e@vitapstudent.ac.in" },
			{ name: "F", college_registration_number: "22BCE8006", email: "f@vitapstudent.ac.in" },
		]);

		await runCron();

		expect(await isOpen("team-capped")).toMatchObject({ is_open: 0 });
	});

	/*
	 * What the "N seats left" notice on the form reads.
	 */
	it("serves the seats left on the public event endpoints", async () => {
		await seedEvent({ slug: "seats-event", title: "Seats Event", registration_cap: 5 });
		await fill("seats-event", 2);

		const one = await (await fetchWorker("/api/events/seats-event")).json<{
			event: { registration_cap: number | null; seats_left: number | null };
		}>();

		expect(one.event).toMatchObject({ registration_cap: 5, seats_left: 3 });

		const listed = await (await fetchWorker("/api/events")).json<{
			events: { slug: string; seats_left: number | null }[];
		}>();

		expect(listed.events.find((event) => event.slug === "seats-event")).toMatchObject({
			seats_left: 3,
		});
	});

	it("reports no seats rather than a negative count when the cap is overshot", async () => {
		await seedEvent({ slug: "overshot-event", title: "Overshot Event", registration_cap: 2 });
		await fill("overshot-event", 4);

		const body = await (await fetchWorker("/api/events/overshot-event")).json<{
			event: { seats_left: number | null };
		}>();

		expect(body.event.seats_left).toBe(0);
	});

	it("leaves seats_left null on an uncapped event", async () => {
		await seedEvent({ slug: "no-cap-event", title: "No Cap Event" });
		await fill("no-cap-event", 2);

		const body = await (await fetchWorker("/api/events/no-cap-event")).json<{
			event: { registration_cap: number | null; seats_left: number | null };
		}>();

		expect(body.event).toMatchObject({ registration_cap: null, seats_left: null });
	});

	it("refuses the next registration once the cap has closed the form", async () => {
		await seedEvent({ slug: "full-event", title: "Full Event", registration_cap: 1 });
		await fill("full-event", 1);

		await runCron();

		const response = await fetchWorker("/api/events/full-event/register", {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({
				members: [
					{
						name: "Late Student",
						year_of_study: "2",
						college_registration_number: "22BCE9999",
						email: "late@vitapstudent.ac.in",
					},
				],
			}),
		});

		expect(response.status).toBe(400);
		expect(await response.json()).toEqual({ error: "Registration is closed" });
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
		email: "student@vitapstudent.ac.in",
		...overrides,
	});

	it("rejects a second registration and names who is already registered", async () => {
		await seedEvent({ slug: "identity-event", title: "Identity Event" });

		expect((await register("identity-event", [student("22BCE7001")])).status).toBe(201);

		const response = await register("identity-event", [
			student("22BCE7001", { name: "Different Name", email: "other@vitapstudent.ac.in" }),
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
			[student("22BCE7005"), student("22bce7005", { email: "twin@vitapstudent.ac.in" })],
			{ team_name: "The Twins" },
		);

		expect(response.status).toBe(400);
		expect(((await response.json()) as { error: string }).error).toContain("22BCE7005");
	});

	/*
	 * Registration is for VIT-AP, so the address has to be a university
	 * one. Enforced server-side because the form is only a convenience —
	 * anyone can post to this endpoint directly.
	 */
	it.each([
		"ada@gmail.com",
		"ada@vitap.ac.in.attacker.com",
		"ada@notvitap.ac.in",
		"ada@student.vitap.ac.in",
	])("rejects %s", async (email) => {
		const slug = `domain-${email.replace(/[^a-z0-9]/gi, "-").toLowerCase()}`;

		await seedEvent({ slug, title: "Domain Event" });

		const response = await register(slug, [student("22BCE9101", { email })]);

		expect(response.status).toBe(400);
		expect(((await response.json()) as { error: string }).error).toContain("university email");
	});

	it.each(["ada.22bce1234@vitapstudent.ac.in", "STAFF@VITAP.AC.IN"])("accepts %s", async (email) => {
		const slug = `ok-${email.replace(/[^a-z0-9]/gi, "-").toLowerCase()}`;

		await seedEvent({ slug, title: "Domain Event" });

		expect((await register(slug, [student("22BCE9102", { email })])).status).toBe(201);
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
 * Both rules below come from reading the first 239 participants. Six
 * of them answered "Year of Study" with the calendar year they joined,
 * and the GitHub column holds everything from a bare handle to a full
 * URL — so the Worker now reads all of it and stores one form.
 */
/*
 * REGISTRATION_IP_LIMITER allows 60 registrations a minute per client
 * IP, and every request in a test run that sends no CF-Connecting-IP
 * shares the key "unknown". The two blocks below post more than sixty
 * between them, so each request gets its own IP — otherwise these
 * tests start returning 429 and take the tests that follow with them.
 */
let registrationIp = 0;

function fromFreshIp(): Record<string, string> {
	registrationIp += 1;

	return { "CF-Connecting-IP": `203.0.113.${registrationIp}` };
}

describe("year of study", () => {
	function registerYear(slug: string, yearOfStudy: unknown): Promise<Response> {
		return fetchWorker(`/api/events/${slug}/register`, {
			method: "POST",
			headers: { "Content-Type": "application/json", ...fromFreshIp() },
			body: JSON.stringify({
				members: [
					{
						name: "Test Student",
						year_of_study: yearOfStudy,
						college_registration_number: "22BCE8001",
						email: "student@vitapstudent.ac.in",
					},
				],
			}),
		});
	}

	async function storedYear(slug: string, yearOfStudy: string): Promise<string | undefined> {
		await seedEvent({ slug, title: "Year Event" });

		expect((await registerYear(slug, yearOfStudy)).status).toBe(201);

		const row = await env.DB.prepare(`SELECT year_of_study FROM registration_members`).first<{
			year_of_study: string;
		}>();

		return row?.year_of_study;
	}

	/*
	 * The owner's rule: an integer above ten is the year they joined,
	 * so 2027 minus it is the year they are in.
	 */
	it.each([
		["2026", "1"],
		["2025", "2"],
		["2024", "3"],
		["2023", "4"],
		["2022", "5"],
	])("reads the calendar year %s as year %s", async (entered, expected) => {
		expect(await storedYear(`calendar-${entered}`, entered)).toBe(expected);
	});

	it.each(["1", "2", "3", "4", "5"])("stores a plain %s unchanged", async (entered) => {
		expect(await storedYear(`plain-${entered}`, entered)).toBe(entered);
	});

	it("stores one canonical form, so a padded 02 is the same year as 2", async () => {
		expect(await storedYear("padded-year", "02")).toBe("2");
	});

	/*
	 * One case per way the subtraction goes wrong, so loosening the
	 * range check fails a named test rather than quietly filing
	 * somebody under year 2002.
	 */
	it.each([
		["2027", "the subtraction gives 0"],
		["2028", "the subtraction gives -1"],
		["25", "the subtraction gives 2002"],
		["11", "the subtraction gives 2016"],
		["0", "nobody is in year zero"],
		["6", "no VIT-AP degree runs to six years"],
		["10", "ten is below the calendar-year threshold and still not a year"],
		["abc", "not a number at all"],
		["1st year", "an ordinal the rule was not written for"],
		["2025-2026", "an academic year span"],
		["-1", "negative"],
		["2.5", "not an integer"],
	])("rejects %s (%s)", async (entered) => {
		const slug = `bad-year-${entered.replace(/[^a-z0-9]/gi, "-").toLowerCase()}`;

		await seedEvent({ slug, title: "Year Event" });

		const response = await registerYear(slug, entered);

		expect(response.status).toBe(400);
		expect(((await response.json()) as { error: string }).error).toContain("Year of study");

		const stored = await env.DB.prepare(`SELECT COUNT(*) AS n FROM registration_members`).first<{ n: number }>();

		expect(stored?.n).toBe(0);
	});

	/*
	 * An empty year is caught one check earlier, as missing
	 * information, so it gets its own case rather than the
	 * "looks invalid" wording.
	 */
	/*
	 * A client that runs Number(input) before POSTing sends 2026, not
	 * "2026" — and that used to reach collapseWhitespace as a number
	 * and come back a 500, from the one field the calendar-year rule
	 * exists to forgive.
	 */
	it("rejects a year of study sent as a JSON number", async () => {
		await seedEvent({ slug: "numeric-year", title: "Year Event" });

		const response = await registerYear("numeric-year", 2026);

		expect(response.status).toBe(400);
		expect(((await response.json()) as { error: string }).error).toContain("Missing required information");
	});

	it.each(["", "   "])("rejects an empty year of study as missing information", async (entered) => {
		await seedEvent({ slug: "empty-year", title: "Year Event" });

		const response = await registerYear("empty-year", entered);

		expect(response.status).toBe(400);
		expect(((await response.json()) as { error: string }).error).toContain("Missing required information");
	});
});

describe("github handle", () => {
	function registerGithub(slug: string, github?: unknown): Promise<Response> {
		return fetchWorker(`/api/events/${slug}/register`, {
			method: "POST",
			headers: { "Content-Type": "application/json", ...fromFreshIp() },
			body: JSON.stringify({
				members: [
					{
						name: "Test Student",
						year_of_study: "2",
						college_registration_number: "22BCE8101",
						email: "student@vitapstudent.ac.in",
						github,
					},
				],
			}),
		});
	}

	function slugFor(prefix: string, value: string): string {
		return `${prefix}-${value.replace(/[^a-z0-9]/gi, "-").toLowerCase()}`;
	}

	/*
	 * Every shape the address bar hands out names the same person, and
	 * the handle is what the Discord roster renders — escapeDiscord
	 * backslashes the ':' in a URL, so a stored URL reaches the channel
	 * as "https\://github.com/ada".
	 */
	it.each([
		["adalovelace", "adalovelace"],
		["https://github.com/adalovelace", "adalovelace"],
		["github.com/adalovelace", "adalovelace"],
		["https://www.github.com/adalovelace/", "adalovelace"],
		["http://github.com/adalovelace", "adalovelace"],
		["www.github.com/adalovelace", "adalovelace"],
		["HTTPS://GitHub.COM/AdaLovelace", "AdaLovelace"],
		/*
		 * What the address bar actually holds for someone who copied
		 * the link from their own Repositories tab.
		 */
		["https://github.com/adalovelace?tab=repositories", "adalovelace"],
		["https://github.com/adalovelace#top", "adalovelace"],
		["a", "a"],
		["a-b-c", "a-b-c"],
		["a1-2b", "a1-2b"],
		["a".repeat(39), "a".repeat(39)],
	])("accepts %s and stores the bare handle", async (entered, expected) => {
		const slug = slugFor("gh", entered);

		await seedEvent({ slug, title: "GitHub Event" });

		expect((await registerGithub(slug, entered)).status).toBe(201);

		const row = await env.DB.prepare(`SELECT github FROM registration_members`).first<{ github: string | null }>();

		expect(row?.github).toBe(expected);
	});

	/*
	 * GitHub's own username rule, not \w+ — a loose pattern accepts
	 * "-" and "--" as handles and the roster then names profiles that
	 * cannot exist.
	 *
	 * FLAGGED FOR THE OWNER: git.meowda.xyz is a real participant's
	 * self-hosted Git instance, and this is a workshop that closes on
	 * self-hosting your own Git server. The strict github.com rule is
	 * what was asked for, and it turns that answer away.
	 */
	it.each([
		["https://github.com/", "a URL with no username after the slash"],
		["https://github.com", "the bare host"],
		["github.com/", "the bare host without a scheme"],
		["-bad", "a leading hyphen"],
		["bad-", "a trailing hyphen"],
		["a--b", "two hyphens in a row"],
		["--", "hyphens only"],
		["a".repeat(40), "forty characters"],
		["ada lovelace", "a space inside the handle"],
		["ada_lovelace", "an underscore"],
		["adalovelace?tab=repositories", "a query string with no profile URL in front of it"],
		["https://github.com/adalovelace/some-project", "a repository, not a profile"],
		["https://gitlab.com/adalovelace", "another host"],
		["https://git.meowda.xyz/meowda", "a self-hosted Git instance"],
		/*
		 * The three below all contain "github.com/" as a substring, so
		 * they are the only cases that can catch a profile pattern that
		 * stops being anchored at a host spelled exactly github.com —
		 * the one thing standing between a stranger's handle and the
		 * roster. gitlab.com and git.meowda.xyz above pass an unanchored
		 * or dot-unescaped pattern just as happily as the real one.
		 */
		["https://notgithub.com/adalovelace", "a host that merely ends in github.com"],
		["https://evil.com/github.com/adalovelace", "github.com inside someone else's path"],
		["githubXcom/adalovelace", "a host with any character where the dot should be"],
	])("rejects %s (%s)", async (entered, reason) => {
		const slug = slugFor("bad-gh", reason);

		await seedEvent({ slug, title: "GitHub Event" });

		const response = await registerGithub(slug, entered);

		expect(response.status).toBe(400);
		expect(((await response.json()) as { error: string }).error).toContain("GitHub");

		const stored = await env.DB.prepare(`SELECT COUNT(*) AS n FROM registration_members`).first<{ n: number }>();

		expect(stored?.n).toBe(0);
	});

	/*
	 * The field is optional — 177 of the first 239 participants left it
	 * blank, so an absent handle can never be an error.
	 */
	/*
	 * A github that is not a string used to throw "value.replace is
	 * not a function" and come back a 500. The field is optional, so
	 * it is read as nothing rather than refused — but the registration
	 * has to survive it.
	 */
	it("stores no github when the field arrives as a JSON number", async () => {
		await seedEvent({ slug: "numeric-github", title: "GitHub Event" });

		expect((await registerGithub("numeric-github", 12345)).status).toBe(201);

		const row = await env.DB.prepare(`SELECT github FROM registration_members`).first<{ github: string | null }>();

		expect(row?.github).toBeNull();
	});

	it.each([undefined, "", "   "])("accepts a registration with no github (%s)", async (entered) => {
		await seedEvent({ slug: "no-github", title: "GitHub Event" });

		expect((await registerGithub("no-github", entered)).status).toBe(201);

		const row = await env.DB.prepare(`SELECT github FROM registration_members`).first<{ github: string | null }>();

		expect(row?.github).toBeNull();
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
			{ name: "Dot Person", college_registration_number: "22BCE5001", email: "dot@vitapstudent.ac.in" },
		]);
		await seedRegistration("clash-2-0", [
			{ name: "Dash Person", college_registration_number: "22BCE5002", email: "dash@vitapstudent.ac.in" },
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
			{ name: "Someone", college_registration_number: "22BCE5003", email: "someone@vitapstudent.ac.in" },
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
			{ name: "Archived Soul", college_registration_number: "22BCE5004", email: "soul@vitapstudent.ac.in" },
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
			{ name: "Still Here", college_registration_number: "22BCE5005", email: "here@vitapstudent.ac.in" },
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
			{ name: "Early Bird", college_registration_number: "22BCE5006", email: "early@vitapstudent.ac.in" },
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
			{ name: "Renamed", college_registration_number: "22BCE5007", email: "renamed@vitapstudent.ac.in" },
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
			{ name: "Only Once", college_registration_number: "22BCE5008", email: "once@vitapstudent.ac.in" },
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
				email: "formula@vitapstudent.ac.in",
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
						email: "rate@vitapstudent.ac.in",
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

	/*
	 * Given its own timeout because it is the only test here that is a
	 * small load test.
	 *
	 * Sixty one registrations at once, each a rate limit check and a
	 * write, is about half a second on a developer machine and well over
	 * five on a two core CI runner, where they stop being concurrent and
	 * queue instead. It failed on a commit that changed one line of JSX
	 * and nothing in this Worker, which is the shape of a timeout that
	 * depends on the machine rather than the code.
	 *
	 * Raising the ceiling for this one test rather than globally: every
	 * other test here finishes in milliseconds, and a suite-wide timeout
	 * would hide a real hang somewhere else.
	 */
	it("stops a flood of fabricated registration numbers from one IP", async () => {
		await seedEvent({ slug: "flood-event", title: "Flood Event" });

		const promises = [];

		for (let attempt = 0; attempt < 61; attempt++) {
			promises.push(register("flood-event", `22BCE${String(1000 + attempt)}`, "203.0.113.12"));
		}

		const responses = await Promise.all(promises);
		const throttled = responses.filter(r => r.status === 429).length;

		expect(throttled).toBeGreaterThan(0);
	}, 30_000);

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

	/*
	 * The panel shows the artwork before anyone downloads a 20MB print
	 * master, which means small renders served from the same bucket
	 * behind the same gate.
	 */
	describe("poster previews", () => {
		beforeEach(async () => {
			env.ADMIN_GITHUB_USERS = "";
			await seedSession("poster-admin");

			await env.osc_events_archives.put("posters/gittyup26-pg01.png", "print-master");
			await env.osc_events_archives.put("posters/thumb/gittyup26-pg01.webp", "small");
			await env.osc_events_archives.put("posters/preview/gittyup26-pg01.webp", "medium");
		});

		afterEach(async () => {
			const listed = await env.osc_events_archives.list();

			for (const object of listed.objects) {
				await env.osc_events_archives.delete(object.key);
			}
		});

		it("serves a thumbnail inline, not as a download", async () => {
			const response = await asAdmin("/api/admin/posters/thumb/gittyup26-pg01.webp");

			expect(response.status).toBe(200);
			expect(response.headers.get("Content-Type")).toBe("image/webp");
			expect(response.headers.get("Content-Disposition")).toBeNull();
			expect(await response.text()).toBe("small");
		});

		it("keeps previews behind the admin gate", async () => {
			const response = await fetchWorker("/api/admin/posters/preview/gittyup26-pg01.webp");

			expect(response.status).toBe(401);
		});

		/*
		 * The variant is a fixed alternation in the route, so a request
		 * cannot name its own prefix and walk out of posters/.
		 */
		it("refuses a variant it does not know", async () => {
			await env.osc_events_archives.put("posters/secret/leak.webp", "nope");

			const response = await asAdmin("/api/admin/posters/secret/leak.webp");

			expect(response.status).toBe(404);
		});

		/*
		 * Ninety objects live under posters/ now and only thirty of them
		 * are sheets anyone can send to a printer.
		 */
		it("lists only the print masters, not their derivatives", async () => {
			const response = await asAdmin("/api/admin/posters");

			expect(response.status).toBe(200);

			const body = await response.json<{ posters: Array<{ name: string }> }>();

			expect(body.posters.map((poster) => poster.name)).toEqual(["gittyup26-pg01.png"]);
		});

		it("404s a sheet that is not in the bucket", async () => {
			const response = await asAdmin("/api/admin/posters/thumb/gittyup26-pg99.webp");

			expect(response.status).toBe(404);
		});
	});

	describe("the poster bundle", () => {
		beforeEach(async () => {
			env.ADMIN_GITHUB_USERS = "";
			await seedSession("poster-admin");

			await env.osc_events_archives.put("posters/gittyup26-pg01.png", "print-master");
			await env.osc_events_archives.put(
				"posters/bundle/gittyup26-posters.pdf",
				"%PDF-1.4 the whole run",
			);
		});

		afterEach(async () => {
			const listed = await env.osc_events_archives.list();

			for (const object of listed.objects) {
				await env.osc_events_archives.delete(object.key);
			}
		});

		it("serves the run as one PDF download", async () => {
			const response = await asAdmin("/api/admin/posters/bundle");

			expect(response.status).toBe(200);
			expect(response.headers.get("Content-Type")).toBe("application/pdf");
			expect(response.headers.get("Content-Disposition")).toBe(
				'attachment; filename="gittyup26-posters.pdf"',
			);
			expect(await response.text()).toBe("%PDF-1.4 the whole run");
		});

		it("keeps the bundle behind the admin gate", async () => {
			const response = await fetchWorker("/api/admin/posters/bundle");

			expect(response.status).toBe(401);
		});

		/*
		 * The single-sheet route matches any name in the same character
		 * class, so without the bundle route being declared first this
		 * would go looking for an object literally called posters/bundle
		 * and 404 — which is how the download quietly stops working the
		 * next time these routes are reordered.
		 */
		it("is not shadowed by the single-sheet route", async () => {
			const response = await asAdmin("/api/admin/posters/bundle");

			expect(response.status).toBe(200);
			expect(response.headers.get("Content-Type")).not.toBe("image/png");
		});

		/*
		 * It sits under a prefix with a slash in it, so the listing's
		 * derivative filter already excludes it — the panel must not
		 * offer a PDF among thirty-six PNG sheets.
		 */
		it("does not appear in the sheet listing", async () => {
			const response = await asAdmin("/api/admin/posters");

			expect(response.status).toBe(200);

			const body = await response.json<{ posters: Array<{ name: string }> }>();

			expect(body.posters.map((poster) => poster.name)).toEqual(["gittyup26-pg01.png"]);
		});

		it("404s when the bundle has not been built yet", async () => {
			await env.osc_events_archives.delete("posters/bundle/gittyup26-posters.pdf");

			const response = await asAdmin("/api/admin/posters/bundle");

			expect(response.status).toBe(404);
		});
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
			{ name: "Captain", college_registration_number: "22BCE0001", email: "captain@vitapstudent.ac.in" },
			{ name: "Second", college_registration_number: "22BCE0002", email: "second@vitapstudent.ac.in" },
			{ name: "Third", college_registration_number: "22BCE0003", email: "third@vitapstudent.ac.in" },
		]);

		// Two registrations of one person each.
		await seedRegistration("solo-event", [
			{ name: "Alone", college_registration_number: "22BCE0004", email: "alone@vitapstudent.ac.in" },
		]);
		await seedRegistration("solo-event", [
			{ name: "Also Alone", college_registration_number: "22BCE0005", email: "also@vitapstudent.ac.in" },
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

	it("stores a registration cap and clears it again", async () => {
		env.ADMIN_GITHUB_USERS = "";

		await seedSession("admin");
		await seedEvent({ slug: "cap-me", title: "Cap Me" });

		const set = await asAdmin("/api/admin/events/cap-me", {
			method: "PATCH",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({ registration_cap: 1050 }),
		});

		expect(set.status).toBe(200);

		expect(
			await env.DB.prepare(`SELECT registration_cap FROM events WHERE slug = 'cap-me'`).first(),
		).toMatchObject({ registration_cap: 1050 });

		/*
		 * An unrelated save must not silently uncap the event — the cap is
		 * only touched when the field is sent.
		 */
		await asAdmin("/api/admin/events/cap-me", {
			method: "PATCH",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({ venue: "AB2 Auditorium" }),
		});

		expect(
			await env.DB.prepare(`SELECT registration_cap FROM events WHERE slug = 'cap-me'`).first(),
		).toMatchObject({ registration_cap: 1050 });

		const cleared = await asAdmin("/api/admin/events/cap-me", {
			method: "PATCH",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({ registration_cap: null }),
		});

		expect(cleared.status).toBe(200);

		expect(
			await env.DB.prepare(`SELECT registration_cap FROM events WHERE slug = 'cap-me'`).first(),
		).toMatchObject({ registration_cap: null });
	});

	it("rejects a registration cap that is not a whole number in range", async () => {
		env.ADMIN_GITHUB_USERS = "";

		await seedSession("admin");
		await seedEvent({ slug: "bad-cap", title: "Bad Cap", registration_cap: 1050 });

		for (const cap of [0, -1, 10.5, 100001, "1050"]) {
			const response = await asAdmin("/api/admin/events/bad-cap", {
				method: "PATCH",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ registration_cap: cap }),
			});

			expect(response.status).toBe(400);
		}

		expect(
			await env.DB.prepare(`SELECT registration_cap FROM events WHERE slug = 'bad-cap'`).first(),
		).toMatchObject({ registration_cap: 1050 });
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
			{ name: "Attendee", college_registration_number: "22BCE0009", email: "attendee@vitapstudent.ac.in" },
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

/*
 * The shape the Worker posts to Discord, declared rather than read off
 * an `any`: what these tests are actually asserting is the STRUCTURE of
 * that payload, so a field losing its name or moving out of the embed
 * should fail here.
 */
interface DiscordEmbedField {
	name: string;
	value: string;
}

interface DiscordEmbed {
	title: string;
	url: string;
	color: number;
	fields: DiscordEmbedField[];
	footer: { text: string };
	timestamp: string;
}

interface DiscordPayload {
	username: string;
	allowed_mentions: { parse: string[] };
	embeds: DiscordEmbed[];
}

describe("Discord registration webhook", () => {
	const HOOK = "https://discord.com/api/webhooks/test/token";

	const originalWebhook = env.DISCORD_WEBHOOK_URL;
	const realFetch = globalThis.fetch;

	/** Every outbound call the Worker made, so the test can read the payload. */
	let sent: { url: string; body: DiscordPayload }[] = [];

	let respondWith: () => Promise<Response> = async () => new Response("", { status: 204 });

	beforeEach(() => {
		sent = [];
		env.DISCORD_WEBHOOK_URL = HOOK;
		respondWith = async () => new Response("", { status: 204 });

		globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
			const url = stubbedUrl(input);

			if (url.startsWith("https://discord.com/")) {
				sent.push({ url, body: JSON.parse(String(init?.body ?? "{}")) });
				return respondWith();
			}

			return realFetch(input, init);
		}) as typeof fetch;
	});

	afterEach(async () => {
		globalThis.fetch = realFetch;
		env.DISCORD_WEBHOOK_URL = originalWebhook;

		await env.DB.prepare(`DELETE FROM registration_members`).run();
		await env.DB.prepare(`DELETE FROM registrations`).run();
	});

	const member = {
		name: "Ada Lovelace",
		year_of_study: "2",
		college_registration_number: "22BCE0777",
		email: "ada.22bce0777@vitapstudent.ac.in",
	};

	async function register(slug: string, body: Record<string, unknown>): Promise<Response> {
		return fetchWorker(`/api/events/${slug}/register`, {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify(body),
		});
	}

	it("announces a registration and says which poster it came from", async () => {
		await seedEvent({ slug: "hook-poster", title: "GITTY UP" });

		const response = await register("hook-poster", {
			source: { page: "/gittyup26", poster: 13 },
			members: [member],
		});

		expect(response.status).toBe(201);
		expect(sent).toHaveLength(1);
		expect(sent[0].url).toBe(HOOK);

		const embed = sent[0].body.embeds[0];

		expect(embed.title).toBe("New registration — GITTY UP");

		const from = embed.fields.find((f: DiscordEmbedField) => f.name === "Registered from");

		expect(from.value).toContain("/gittyup26");
		expect(from.value).toContain("poster 13");

		const who = embed.fields.find((f: DiscordEmbedField) => f.name === "Participant");

		expect(who.value).toContain("Ada Lovelace");
		expect(who.value).toContain("22BCE0777");
	});

	it("names the plain registration page when there is no poster", async () => {
		await seedEvent({ slug: "hook-plain", title: "Plain Event" });

		await register("hook-plain", {
			source: { page: "/events/hook-plain/register" },
			members: [member],
		});

		const from = sent[0].body.embeds[0].fields.find((f: DiscordEmbedField) => f.name === "Registered from");

		expect(from.value).toContain("/events/hook-plain/register");
		expect(from.value).not.toContain("poster");
	});

	/*
	 * The source is browser-supplied. These are the shapes an attacker
	 * would reach for to get their own text, or a link, into the
	 * club's channel.
	 */
	it.each([
		["an absolute URL", { page: "https://evil.example/pwned" }],
		["a protocol-relative URL", { page: "//evil.example" }],
		["a path with a query", { page: "/gittyup26?x=<script>" }],
		["a very long path", { page: `/${"a".repeat(200)}` }],
		["a non-string page", { page: 42 }],
		["no page at all", {}],
		["not an object", "just a string"],
	])("drops %s and says the page is unknown", async (label, source) => {
		const slug = `hook-bad-${label.replace(/[^a-z]+/gi, "")}`;

		await seedEvent({ slug, title: "Bad Source" });

		await register(slug, { source, members: [member] });

		const from = sent[0].body.embeds[0].fields.find((f: DiscordEmbedField) => f.name === "Registered from");

		expect(from.value).toBe("Unknown page");
	});

	it("drops a poster id outside the printed run", async () => {
		await seedEvent({ slug: "hook-poster-range", title: "Range" });

		await register("hook-poster-range", {
			source: { page: "/gittyup26", poster: 9999 },
			members: [member],
		});

		const from = sent[0].body.embeds[0].fields.find((f: DiscordEmbedField) => f.name === "Registered from");

		expect(from.value).toBe("/gittyup26");
	});

	/*
	 * The name field is filled in by whoever is registering. Without
	 * allowed_mentions an @everyone in it pings the whole server, and
	 * without escaping a name of asterisks reformats the message.
	 */
	it("cannot be used to ping the server or to inject markdown", async () => {
		await seedEvent({ slug: "hook-hostile", title: "Hostile" });

		await register("hook-hostile", {
			source: { page: "/gittyup26", poster: 1 },
			members: [
				{
					...member,
					name: "@everyone **bold** [link](https://evil.example)",
				},
			],
		});

		const payload = sent[0].body;

		expect(payload.allowed_mentions).toEqual({ parse: [] });

		const who = payload.embeds[0].fields.find((f: DiscordEmbedField) => f.name === "Participant");

		/*
		 * The escaped form still contains the literal characters, so the
		 * property is that no @ is left UNescaped — an @ not preceded by
		 * a backslash is the one Discord would act on.
		 */
		expect(who.value).not.toMatch(/(^|[^\\])@/);
		expect(who.value).toContain("\\@everyone");
		expect(who.value).toContain("\\[link\\]");
	});

	/*
	 * The roster puts one participant on each line and joins that
	 * participant's own fields with " · ", so both characters are
	 * structural. A name carrying a newline used to render as three
	 * roster rows — the last of them "Admin Override" — under a header
	 * that still read "Participant", singular.
	 *
	 * Whitespace is collapsed at ingest rather than at the encoder, so
	 * the D1 row the CSV export later reads is one line too.
	 */
	it("cannot forge extra roster rows with a newline in a name", async () => {
		await seedEvent({ slug: "hook-newline", title: "Newline" });

		const response = await register("hook-newline", {
			source: { page: "/gittyup26", poster: 6 },
			members: [
				{
					...member,
					name: "Riya Menon\nRohit Sharma 22BCE0001 year 4\r\nAdmin Override",
				},
			],
		});

		expect(response.status).toBe(201);

		const who = sent[0].body.embeds[0].fields.find((f: DiscordEmbedField) => f.name === "Participant");

		expect(who.value.split("\n")).toHaveLength(1);

		const stored = await env.DB.prepare(`SELECT name FROM registration_members`).first<{ name: string }>();

		expect(stored?.name).toBe("Riya Menon Rohit Sharma 22BCE0001 year 4 Admin Override");
	});

	/*
	 * The same forgery within a single line. "·" separates a
	 * participant's own fields, so it cannot be part of one — and unlike
	 * a newline there is no benign reading to collapse it to.
	 */
	it("refuses the roster separator inside a year of study", async () => {
		await seedEvent({ slug: "hook-separator", title: "Separator" });

		const response = await register("hook-separator", {
			source: { page: "/gittyup26", poster: 7 },
			members: [{ ...member, year_of_study: "2 · Admin Override" }],
		});

		expect(response.status).toBe(400);
		expect(sent).toHaveLength(0);

		const stored = await env.DB.prepare(`SELECT COUNT(*) AS n FROM registration_members`).first<{ n: number }>();

		expect(stored?.n).toBe(0);
	});

	it("refuses the roster separator in a team name", async () => {
		await seedEvent({ slug: "hook-team-separator", title: "Team Separator" });

		const response = await register("hook-team-separator", {
			source: { page: "/gittyup26", poster: 8 },
			team_name: "The Twins · 22BCE0003 · year 4",
			members: [member],
		});

		expect(response.status).toBe(400);
		expect(sent).toHaveLength(0);
	});

	/*
	 * The title is the one string in the embed that never meets the
	 * registration validator — the admin write paths only trim it — so
	 * the encoder is the only place it can be flattened. Left raw, a
	 * title with a newline in it renders as a second line above the
	 * fields, and the "·" reads as a roster separator.
	 */
	it("flattens an event title an admin left a newline in", async () => {
		await seedEvent({
			slug: "hook-title",
			title: "Hack\n@everyone **bold** · forged",
		});

		const response = await register("hook-title", {
			source: { page: "/gittyup26", poster: 9 },
			members: [member],
		});

		expect(response.status).toBe(201);

		const title = sent[0].body.embeds[0].title;

		expect(title.split("\n")).toHaveLength(1);
		expect(title).not.toContain("·");
		expect(title).not.toMatch(/(^|[^\\])@/);
	});

	it("sends nothing when no webhook is configured", async () => {
		env.DISCORD_WEBHOOK_URL = "";

		await seedEvent({ slug: "hook-off", title: "No Hook" });

		const response = await register("hook-off", {
			source: { page: "/gittyup26", poster: 2 },
			members: [member],
		});

		expect(response.status).toBe(201);
		expect(sent).toHaveLength(0);
	});

	it("still registers when Discord rejects the webhook", async () => {
		respondWith = async () => new Response("bad webhook", { status: 404 });

		await seedEvent({ slug: "hook-rejected", title: "Rejected" });

		const response = await register("hook-rejected", {
			source: { page: "/gittyup26", poster: 3 },
			members: [member],
		});

		expect(response.status).toBe(201);

		const stored = await env.DB.prepare(`SELECT COUNT(*) AS n FROM registrations`).first<{ n: number }>();

		expect(stored?.n).toBe(1);
	});

	it("still registers when Discord cannot be reached at all", async () => {
		respondWith = async () => {
			throw new Error("network down");
		};

		await seedEvent({ slug: "hook-down", title: "Down" });

		const response = await register("hook-down", {
			source: { page: "/gittyup26", poster: 4 },
			members: [member],
		});

		expect(response.status).toBe(201);
	});

	it("announces nothing for a registration that was rejected", async () => {
		await seedEvent({ slug: "hook-closed", title: "Closed", is_open: 0 });

		const response = await register("hook-closed", {
			source: { page: "/gittyup26", poster: 5 },
			members: [member],
		});

		expect(response.status).toBe(400);
		expect(sent).toHaveLength(0);
	});
});

describe("admin outside the organisation", () => {
	const SESSION_ID = "outsider-session";

	/*
	 * Not the deployed pepper — these only need the digests and the
	 * Worker to agree, and the real one never leaves the secret store.
	 */
	const PEPPER = "test-pepper-0123456789abcdef";

	/*
	 * The exemption is keyed on the numeric GitHub id. The handle is
	 * carried alongside it only so the two can be varied independently
	 * below — nothing is allowed to turn on it.
	 */
	const EXEMPT_ID = "4242";
	const EXEMPT_HANDLE = "an-outsider";

	const originalAllowList = env.ADMIN_GITHUB_USERS;
	const originalHashes = env.ADMIN_OUTSIDER_ID_HASHES;
	const originalPepper = env.ADMIN_HANDLE_PEPPER;

	/*
	 * Mirrors adminIdDigest in the Worker. Written out rather than
	 * imported so a change to the hashing there fails these tests
	 * instead of being silently agreed with.
	 */
	async function digestOf(githubUserId: string, pepper: string): Promise<string> {
		const encoder = new TextEncoder();

		const key = await crypto.subtle.importKey("raw", encoder.encode(pepper), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);

		const signature = await crypto.subtle.sign("HMAC", key, encoder.encode(githubUserId.trim()));

		return [...new Uint8Array(signature)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
	}

	afterEach(async () => {
		env.ADMIN_GITHUB_USERS = originalAllowList;
		env.ADMIN_OUTSIDER_ID_HASHES = originalHashes;
		env.ADMIN_HANDLE_PEPPER = originalPepper;

		await env.DB.prepare(`DELETE FROM admin_sessions`).run();
	});

	async function seedSession(username: string, githubUserId = EXEMPT_ID): Promise<void> {
		await env.DB.prepare(
			`
        INSERT INTO admin_sessions (id, github_user_id, github_username, expires_at)
        VALUES (?, ?, ?, ?)
      `,
		)
			.bind(SESSION_ID, githubUserId, username, new Date(Date.now() + 3600_000).toISOString())
			.run();
	}

	function asAdmin(path: string): Promise<Response> {
		return fetchWorker(path, {
			headers: { Cookie: `osc_admin_session=${SESSION_ID}` },
		});
	}

	/*
	 * Every case here names someone else in ADMIN_GITHUB_USERS, so the
	 * only thing that can produce a 200 is the exemption itself — an
	 * empty allow list would let these pass without it being tested.
	 */
	it("lets an exempt id in even when the allow list names other people", async () => {
		env.ADMIN_GITHUB_USERS = "someone-else";
		env.ADMIN_HANDLE_PEPPER = PEPPER;
		env.ADMIN_OUTSIDER_ID_HASHES = await digestOf(EXEMPT_ID, PEPPER);

		await seedSession(EXEMPT_HANDLE);

		expect((await asAdmin("/api/admin/events")).status).toBe(200);
	});

	/*
	 * The two halves of the reason this is keyed on the id at all.
	 *
	 * GitHub logins are mutable and are NOT reserved when released. When
	 * the exemption hashed the handle, renaming the exempt account locked
	 * its owner out and — far worse — handed the exemption to whoever
	 * claimed the abandoned username, who then skipped the organisation
	 * check entirely. The id survives the rename and does not follow the
	 * name to its next owner.
	 */
	it("still exempts the account after GitHub renames it", async () => {
		env.ADMIN_GITHUB_USERS = "";
		env.ADMIN_HANDLE_PEPPER = PEPPER;
		env.ADMIN_OUTSIDER_ID_HASHES = await digestOf(EXEMPT_ID, PEPPER);

		await seedSession("renamed-since", EXEMPT_ID);

		expect((await asAdmin("/api/admin/events")).status).toBe(200);
	});

	it("does not exempt whoever claims the released handle", async () => {
		env.ADMIN_GITHUB_USERS = "someone-else";
		env.ADMIN_HANDLE_PEPPER = PEPPER;
		env.ADMIN_OUTSIDER_ID_HASHES = await digestOf(EXEMPT_ID, PEPPER);

		/* Same name, different account. */
		await seedSession(EXEMPT_HANDLE, "99999999");

		expect((await asAdmin("/api/admin/events")).status).toBe(401);
	});

	it("matches a digest whatever case or spacing the list arrives in", async () => {
		env.ADMIN_GITHUB_USERS = "someone-else";
		env.ADMIN_HANDLE_PEPPER = PEPPER;
		env.ADMIN_OUTSIDER_ID_HASHES = ` ${(await digestOf(EXEMPT_ID, PEPPER)).toUpperCase()} `;

		await seedSession(EXEMPT_HANDLE);

		expect((await asAdmin("/api/admin/events")).status).toBe(200);
	});

	it("still refuses an account that is on neither list", async () => {
		env.ADMIN_GITHUB_USERS = "someone-else";
		env.ADMIN_HANDLE_PEPPER = PEPPER;
		env.ADMIN_OUTSIDER_ID_HASHES = await digestOf(EXEMPT_ID, PEPPER);

		await seedSession("a-stranger", "77");

		expect((await asAdmin("/api/admin/events")).status).toBe(401);
	});

	it("an empty hash list exempts nobody", async () => {
		env.ADMIN_GITHUB_USERS = "someone-else";
		env.ADMIN_HANDLE_PEPPER = PEPPER;
		env.ADMIN_OUTSIDER_ID_HASHES = "";

		await seedSession(EXEMPT_HANDLE);

		expect((await asAdmin("/api/admin/events")).status).toBe(401);
	});

	/*
	 * The digests are public, so a Worker missing the secret has to
	 * close the hole rather than open it to whoever is listed.
	 */
	it("exempts nobody when no pepper is configured", async () => {
		env.ADMIN_GITHUB_USERS = "someone-else";
		env.ADMIN_OUTSIDER_ID_HASHES = await digestOf(EXEMPT_ID, PEPPER);
		env.ADMIN_HANDLE_PEPPER = "";

		await seedSession(EXEMPT_HANDLE);

		expect((await asAdmin("/api/admin/events")).status).toBe(401);
	});

	it("exempts nobody when the pepper is wrong", async () => {
		env.ADMIN_GITHUB_USERS = "someone-else";
		env.ADMIN_OUTSIDER_ID_HASHES = await digestOf(EXEMPT_ID, PEPPER);
		env.ADMIN_HANDLE_PEPPER = `${PEPPER}-rotated`;

		await seedSession(EXEMPT_HANDLE);

		expect((await asAdmin("/api/admin/events")).status).toBe(401);
	});

	/*
	 * `wrangler secret put` strips trailing whitespace for you, but the
	 * dashboard's secret editor stores the value as pasted, and that is
	 * where a pepper gets pasted in a hurry. A stored "P\n" has to
	 * reproduce a digest computed under "P" anyway, or the exempt
	 * account is locked out by a trailing newline nobody can see.
	 */
	it("matches a pepper stored with a trailing newline", async () => {
		env.ADMIN_GITHUB_USERS = "someone-else";
		env.ADMIN_HANDLE_PEPPER = `${PEPPER}\n`;
		env.ADMIN_OUTSIDER_ID_HASHES = await digestOf(EXEMPT_ID, PEPPER);

		await seedSession(EXEMPT_HANDLE);

		expect((await asAdmin("/api/admin/events")).status).toBe(200);
	});

	/*
	 * The same trim must not turn a secret that is nothing but
	 * whitespace into a usable key — that is an unset secret written
	 * clumsily, and it closes the hole like any other unset one.
	 */
	it("exempts nobody when the pepper is only whitespace", async () => {
		env.ADMIN_GITHUB_USERS = "someone-else";
		env.ADMIN_OUTSIDER_ID_HASHES = await digestOf(EXEMPT_ID, PEPPER);
		env.ADMIN_HANDLE_PEPPER = "  \n\t ";

		await seedSession(EXEMPT_HANDLE);

		expect((await asAdmin("/api/admin/events")).status).toBe(401);
	});

	/*
	 * A typo in a committed digest must be an entry that never matches,
	 * not a 500 that takes the whole admin API down with it.
	 */
	it("survives a malformed hex entry", async () => {
		env.ADMIN_GITHUB_USERS = "someone-else";
		env.ADMIN_HANDLE_PEPPER = PEPPER;
		env.ADMIN_OUTSIDER_ID_HASHES = `not-a-digest,${await digestOf(EXEMPT_ID, PEPPER)}`;

		await seedSession(EXEMPT_HANDLE);

		expect((await asAdmin("/api/admin/events")).status).toBe(200);

		await env.DB.prepare(`DELETE FROM admin_sessions`).run();

		env.ADMIN_OUTSIDER_ID_HASHES = "zzzz,,   ,not-a-digest";

		await seedSession(EXEMPT_HANDLE);

		expect((await asAdmin("/api/admin/events")).status).toBe(401);
	});

	/*
	 * A truncated entry must not act as a wildcard for everything that
	 * starts with it — the comparison is over the whole digest, so a
	 * prefix is simply a different length and never matches.
	 */
	it("refuses an account whose digest merely starts a listed one", async () => {
		env.ADMIN_GITHUB_USERS = "someone-else";
		env.ADMIN_HANDLE_PEPPER = PEPPER;
		env.ADMIN_OUTSIDER_ID_HASHES = (await digestOf(EXEMPT_ID, PEPPER)).slice(0, 32);

		await seedSession(EXEMPT_HANDLE);

		expect((await asAdmin("/api/admin/events")).status).toBe(401);
	});

	/*
	 * Everything above reads a session that already exists. The sign-in
	 * callback is the only place that decides whether the osc-vitap
	 * membership call happens at all, and both of its checks are async.
	 * A dropped await there leaves a pending promise, which is truthy —
	 * so the organisation gate is skipped and an eight-hour session is
	 * handed to any GitHub account that reaches the callback. TypeScript
	 * cannot see it, because `if (promise)` and `if (!promise)` are both
	 * legal, and with the deployed ADMIN_GITHUB_USERS of "" there is
	 * nothing else in the way. Nothing else in this file touches that
	 * route, so these are its only guard.
	 */
	describe("signing in", () => {
		const STATE = "callback-state";

		const realFetch = globalThis.fetch;

		/** Every URL the Worker reached, so a skipped call is visible. */
		let called: string[] = [];

		/** What GitHub answers with, set per test before signing in. */
		let userId = 0;
		let login = "";
		let inOrg = false;

		beforeEach(async () => {
			called = [];
			userId = Number(EXEMPT_ID);
			login = "";
			inOrg = false;

			globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
				const url = stubbedUrl(input);

				called.push(url);

				if (url === "https://github.com/login/oauth/access_token") {
					return Response.json({ access_token: "gho_test", token_type: "bearer" });
				}

				if (url === "https://api.github.com/user") {
					return Response.json({ id: userId, login });
				}

				if (url.startsWith("https://api.github.com/user/memberships/orgs/")) {
					return inOrg ? Response.json({ state: "active", role: "member" }) : new Response("Not Found", { status: 404 });
				}

				return realFetch(input, init);
			}) as typeof fetch;

			await env.DB.prepare(
				`
        INSERT INTO admin_oauth_states (state, expires_at)
        VALUES (?, ?)
      `,
			)
				.bind(STATE, new Date(Date.now() + 600_000).toISOString())
				.run();
		});

		afterEach(async () => {
			globalThis.fetch = realFetch;

			await env.DB.prepare(`DELETE FROM admin_oauth_states`).run();
		});

		/* A fresh IP per test, so AUTH_LIMITER never sees a second hit. */
		function signIn(ip: string): Promise<Response> {
			return fetchWorker(`/auth/github/callback?code=abc&state=${STATE}`, {
				headers: {
					Cookie: `osc_oauth_state=${STATE}`,
					"CF-Connecting-IP": ip,
				},
			});
		}

		function sessionCount(): Promise<{ n: number } | null> {
			return env.DB.prepare(`SELECT COUNT(*) AS n FROM admin_sessions`).first<{ n: number }>();
		}

		/*
		 * With the deployed ADMIN_GITHUB_USERS of "" the allow list lets
		 * everyone past, so organisation membership is the whole gate —
		 * the exact configuration this has to hold under.
		 */
		it("turns away an account the organisation does not know and stores no session", async () => {
			env.ADMIN_GITHUB_USERS = "";
			env.ADMIN_HANDLE_PEPPER = PEPPER;
			env.ADMIN_OUTSIDER_ID_HASHES = await digestOf(EXEMPT_ID, PEPPER);

			userId = 777;
			login = "a-stranger";

			const response = await signIn("203.0.113.20");

			expect(response.status).toBe(302);
			expect(response.headers.get("Location")).toContain("reason=not-a-member");

			expect((await sessionCount())?.n).toBe(0);
		});

		it("signs an exempt id in without asking the organisation", async () => {
			env.ADMIN_GITHUB_USERS = "";
			env.ADMIN_HANDLE_PEPPER = PEPPER;
			env.ADMIN_OUTSIDER_ID_HASHES = await digestOf(EXEMPT_ID, PEPPER);

			login = EXEMPT_HANDLE;

			const response = await signIn("203.0.113.21");

			expect(response.status).toBe(302);
			expect(response.headers.get("Location")).toBe("https://www.oscvitap.com/admin");

			expect(called.filter((url) => url.includes("/memberships/orgs/"))).toHaveLength(0);

			const session = await env.DB.prepare(`SELECT github_user_id, github_username FROM admin_sessions`).first<{
				github_user_id: string;
				github_username: string;
			}>();

			expect(session?.github_user_id).toBe(EXEMPT_ID);
			expect(session?.github_username).toBe(EXEMPT_HANDLE);
		});

		/*
		 * The hijack the id keying exists to stop, end to end: the exempt
		 * account has been renamed or deleted and someone else now signs
		 * in under its old handle. They must fall through to the
		 * organisation check like anybody else.
		 */
		it("makes a new owner of the exempt handle prove organisation membership", async () => {
			env.ADMIN_GITHUB_USERS = "";
			env.ADMIN_HANDLE_PEPPER = PEPPER;
			env.ADMIN_OUTSIDER_ID_HASHES = await digestOf(EXEMPT_ID, PEPPER);

			userId = 99999999;
			login = EXEMPT_HANDLE;

			const response = await signIn("203.0.113.23");

			expect(response.headers.get("Location")).toContain("reason=not-a-member");

			expect(called.filter((url) => url.includes("/memberships/orgs/"))).toHaveLength(1);

			expect((await sessionCount())?.n).toBe(0);
		});

		/*
		 * The allow list is checked first so an unwanted handle costs one
		 * GitHub call rather than two. It is also a member of the
		 * organisation here, which is what would let them in if that
		 * check were skipped.
		 */
		it("turns away a handle the allow list does not name, before the organisation call", async () => {
			env.ADMIN_GITHUB_USERS = "someone-else";
			env.ADMIN_HANDLE_PEPPER = PEPPER;
			env.ADMIN_OUTSIDER_ID_HASHES = await digestOf(EXEMPT_ID, PEPPER);

			userId = 777;
			login = "a-stranger";
			inOrg = true;

			const response = await signIn("203.0.113.22");

			expect(response.headers.get("Location")).toContain("reason=not-allowed");

			expect(called.filter((url) => url.includes("/memberships/orgs/"))).toHaveLength(0);

			expect((await sessionCount())?.n).toBe(0);
		});
	});
});
