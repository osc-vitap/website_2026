import { env, SELF } from "cloudflare:test";
import { describe, it, expect, beforeEach } from "vitest";

const WORKER_ORIGIN = "https://events.oscvitap.com";

const PEPPER = "test-pepper-for-scanner-devices";

interface Verdict {
	verdict?: string;
	kind?: string;
	name?: string | null;
	seat_id?: string | null;
	first_device?: string;
	first_scanned_at?: string;
	error?: string;
}

interface State {
	configured: boolean;
	is_open?: boolean;
	capacity?: number;
	inside?: number;
	inside_general?: number;
	inside_reserved?: number;
	reserved_issued?: number;
	general_cap?: number;
	general_remaining?: number;
}

/** The same digest the Worker stores device tokens under. */
async function digest(value: string): Promise<string> {
	const encoder = new TextEncoder();

	const key = await crypto.subtle.importKey(
		"raw",
		encoder.encode(PEPPER),
		{ name: "HMAC", hash: "SHA-256" },
		false,
		["sign"],
	);

	const signature = await crypto.subtle.sign("HMAC", key, encoder.encode(value.trim()));

	return [...new Uint8Array(signature)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

let eventId = "";

/*
 * A door with a known capacity, two kinds of pass, and two phones.
 *
 * Capacity is deliberately tiny. The interesting behaviour is all at
 * the boundary, and a test that has to admit five hundred people to
 * reach it is a test nobody will run.
 */
async function seedDoor(options: { capacity?: number; isOpen?: number } = {}): Promise<void> {
	const capacity = options.capacity ?? 3;

	for (const table of [
		"entry_events",
		"entry_scans",
		"scanner_sessions",
		"scanner_devices",
		"entry_passes",
		"entry_gate",
		"events",
	]) {
		await env.DB.prepare(`DELETE FROM ${table}`).run();
	}

	eventId = crypto.randomUUID();

	await env.DB.prepare(
		`
      INSERT INTO events (
        id, slug, title, event_date, event_end_at, is_open,
        archive_status, registration_type, min_team_size, max_team_size, venue
      )
      VALUES (?, 'gittyup26', 'GittyUp 26', '2099-09-01', NULL, 1,
              'pending', 'solo', 1, 1, 'AB2 Auditorium')
    `,
	)
		.bind(eventId)
		.run();

	await env.DB.prepare(
		`INSERT INTO entry_gate (event_id, capacity, is_open) VALUES (?, ?, ?)`,
	)
		.bind(eventId, capacity, options.isOpen ?? 1)
		.run();

	for (const [queue, token] of [
		["queue-1", "device-token-one"],
		["queue-2", "device-token-two"],
	]) {
		await env.DB.prepare(
			`INSERT INTO scanner_devices (id, event_id, label, token_hash) VALUES (?, ?, ?, ?)`,
		)
			.bind(queue, eventId, `Queue ${queue.slice(-1)}`, await digest(token))
			.run();
	}
}

async function addPass(
	token: string,
	kind: "reserved" | "registered",
	regNo: string,
	seatId: string | null = null,
): Promise<void> {
	await env.DB.prepare(
		`
      INSERT INTO entry_passes (token, event_id, kind, name, email, college_registration_number, seat_id)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `,
	)
		.bind(token, eventId, kind, `Holder ${regNo}`, `${regNo.toLowerCase()}@vitapstudent.ac.in`, regNo, seatId)
		.run();
}

/** A signed-in phone, without going through the sign-in endpoint. */
async function signedIn(deviceId = "queue-1"): Promise<string> {
	const sessionId = crypto.randomUUID();

	await env.DB.prepare(
		`
      INSERT INTO scanner_sessions (id, device_id, event_id, expires_at)
      VALUES (?, ?, ?, datetime('now', '+8 hours'))
    `,
	)
		.bind(sessionId, deviceId, eventId)
		.run();

	return `osc_scan_session=${sessionId}`;
}

async function asAdmin(): Promise<string> {
	env.ADMIN_GITHUB_USERS = "";

	const sessionId = crypto.randomUUID();

	await env.DB.prepare(
		`
      INSERT INTO admin_sessions (id, github_user_id, github_username, expires_at)
      VALUES (?, '1', 'doorkeeper', ?)
    `,
	)
		.bind(sessionId, new Date(Date.now() + 3600_000).toISOString())
		.run();

	return `osc_admin_session=${sessionId}`;
}

function claim(token: string, cookie: string): Promise<Response> {
	return SELF.fetch(`${WORKER_ORIGIN}/api/scan/claim`, {
		method: "POST",
		headers: { "Content-Type": "application/json", Cookie: cookie },
		body: JSON.stringify({ token }),
	});
}

describe("door scanning", () => {
	beforeEach(async () => {
		env.ADMIN_HANDLE_PEPPER = PEPPER;
		await seedDoor();
	});

	describe("device sign-in", () => {
		it("trades a device token for a session", async () => {
			const response = await SELF.fetch(`${WORKER_ORIGIN}/api/scan/session`, {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ device_token: "device-token-one" }),
			});

			expect(response.status).toBe(200);

			const body = await response.json<{ device_id: string; label: string }>();

			expect(body.device_id).toBe("queue-1");
			expect(body.label).toBe("Queue 1");

			const cookie = response.headers.get("Set-Cookie") ?? "";

			expect(cookie).toContain("osc_scan_session=");
			expect(cookie).toContain("HttpOnly");
			/* Scoped to the scan API so it is never sent to an admin route. */
			expect(cookie).toContain("Path=/api/scan");
		});

		it("refuses a token it does not know", async () => {
			const response = await SELF.fetch(`${WORKER_ORIGIN}/api/scan/session`, {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ device_token: "not-a-real-token" }),
			});

			expect(response.status).toBe(401);
		});

		it("refuses a revoked device", async () => {
			await env.DB.prepare(
				`UPDATE scanner_devices SET revoked_at = datetime('now') WHERE id = 'queue-1'`,
			).run();

			const response = await SELF.fetch(`${WORKER_ORIGIN}/api/scan/session`, {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ device_token: "device-token-one" }),
			});

			expect(response.status).toBe(401);
		});

		/*
		 * Without the pepper no digest can be computed, so no device can
		 * be recognised. It must fail shut rather than fall back to
		 * comparing raw tokens.
		 */
		it("fails closed when the pepper is not set", async () => {
			env.ADMIN_HANDLE_PEPPER = "";

			const response = await SELF.fetch(`${WORKER_ORIGIN}/api/scan/session`, {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ device_token: "device-token-one" }),
			});

			expect(response.status).toBe(503);
		});
	});

	/*
	 * The reason the scanner has its own table, its own cookie and its
	 * own resolver. If this ever passes a door phone into the admin
	 * gate, it hands a volunteer every registrant's email address.
	 */
	describe("isolation from the admin gate", () => {
		it("does not open any admin route", async () => {
			const cookie = await signedIn();

			for (const path of [
				"/api/admin/me",
				"/api/admin/events",
				"/api/admin/events/gittyup26/registrations",
				"/api/admin/posters",
				/* Capacity is an admin decision, not a door decision. */
				"/api/admin/events/gittyup26/entry",
			]) {
				const response = await SELF.fetch(`${WORKER_ORIGIN}${path}`, {
					headers: { Cookie: cookie },
				});

				expect(response.status, `${path} let a scanner in`).toBe(401);
			}
		});

		it("refuses a scan without a scanner session", async () => {
			await addPass("tok-a", "registered", "22BCE1001");

			const response = await claim("tok-a", "");

			expect(response.status).toBe(401);
		});
	});

	describe("verdicts", () => {
		it("admits a registered pass", async () => {
			await addPass("tok-a", "registered", "22BCE1001");

			const response = await claim("tok-a", await signedIn());

			expect(response.status).toBe(200);

			const body = await response.json<Verdict>();

			expect(body.verdict).toBe("admitted");
			expect(body.kind).toBe("registered");
			expect(body.name).toBe("Holder 22BCE1001");
		});

		it("gives a reserved pass its seat number", async () => {
			await addPass("tok-r", "reserved", "22BCE2001", "R5-S12");

			const body = await (await claim("tok-r", await signedIn())).json<Verdict>();

			expect(body.verdict).toBe("admitted");
			expect(body.seat_id).toBe("R5-S12");
		});

		/* The volunteer needs to know it was them, not a stranger. */
		it("says already-in on a second scan, and where the first was", async () => {
			await addPass("tok-a", "registered", "22BCE1001");

			await claim("tok-a", await signedIn("queue-1"));

			const body = await (await claim("tok-a", await signedIn("queue-2"))).json<Verdict>();

			expect(body.verdict).toBe("already-in");
			expect(body.first_device).toBe("queue-1");
			expect(body.first_scanned_at).toBeTruthy();
		});

		it("does not know a token that was never issued", async () => {
			const body = await (await claim("never-issued", await signedIn())).json<Verdict>();

			expect(body.verdict).toBe("unknown");
		});

		it("refuses a revoked pass", async () => {
			await addPass("tok-a", "registered", "22BCE1001");

			await env.DB.prepare(`UPDATE entry_passes SET revoked_at = datetime('now') WHERE token = 'tok-a'`).run();

			const body = await (await claim("tok-a", await signedIn())).json<Verdict>();

			expect(body.verdict).toBe("revoked");
		});

		it("refuses everyone once the gate is closed", async () => {
			await addPass("tok-a", "registered", "22BCE1001");

			await env.DB.prepare(`UPDATE entry_gate SET is_open = 0 WHERE event_id = ?`).bind(eventId).run();

			const body = await (await claim("tok-a", await signedIn())).json<Verdict>();

			expect(body.verdict).toBe("closed");
		});

		/*
		 * A missing gate row would otherwise count as zero capacity and
		 * read as a full auditorium, which is the worst possible way to
		 * find out the migration did not seed.
		 */
		it("says not-configured rather than full when there is no gate", async () => {
			await addPass("tok-a", "registered", "22BCE1001");

			await env.DB.prepare(`DELETE FROM entry_gate WHERE event_id = ?`).bind(eventId).run();

			const body = await (await claim("tok-a", await signedIn())).json<Verdict>();

			expect(body.verdict).toBe("not-configured");
		});
	});

	describe("capacity", () => {
		it("stops admitting once the room is full", async () => {
			await seedDoor({ capacity: 2 });

			for (const n of [1, 2, 3]) {
				await addPass(`tok-${n}`, "registered", `22BCE100${n}`);
			}

			const cookie = await signedIn();

			expect((await (await claim("tok-1", cookie)).json<Verdict>()).verdict).toBe("admitted");
			expect((await (await claim("tok-2", cookie)).json<Verdict>()).verdict).toBe("admitted");
			expect((await (await claim("tok-3", cookie)).json<Verdict>()).verdict).toBe("full");
		});

		/*
		 * The whole reason the two kinds are counted separately. General
		 * admission must not eat the seats of reserved people who have
		 * not walked through the door yet.
		 */
		it("holds seats for reserved passes that have not arrived", async () => {
			await seedDoor({ capacity: 3 });

			await addPass("res-1", "reserved", "22BCE2001", "R5-S1");
			await addPass("res-2", "reserved", "22BCE2002", "R5-S2");
			await addPass("gen-1", "registered", "22BCE1001");
			await addPass("gen-2", "registered", "22BCE1002");

			const cookie = await signedIn();

			/* Capacity 3, two reserved issued, so general admission is 1. */
			expect((await (await claim("gen-1", cookie)).json<Verdict>()).verdict).toBe("admitted");
			expect((await (await claim("gen-2", cookie)).json<Verdict>()).verdict).toBe("full");

			/* Both reserved holders still get in. */
			expect((await (await claim("res-1", cookie)).json<Verdict>()).verdict).toBe("admitted");
			expect((await (await claim("res-2", cookie)).json<Verdict>()).verdict).toBe("admitted");
		});

		/*
		 * Reserved is not a bypass. The room has walls, and a reserved
		 * pass beyond physical capacity is still a person with nowhere
		 * to sit.
		 */
		it("refuses a reserved pass once the room is physically full", async () => {
			await seedDoor({ capacity: 2 });

			await addPass("res-1", "reserved", "22BCE2001", "R5-S1");
			await addPass("res-2", "reserved", "22BCE2002", "R5-S2");
			await addPass("res-3", "reserved", "22BCE2003", "R5-S3");

			const cookie = await signedIn();

			expect((await (await claim("res-1", cookie)).json<Verdict>()).verdict).toBe("admitted");
			expect((await (await claim("res-2", cookie)).json<Verdict>()).verdict).toBe("admitted");
			expect((await (await claim("res-3", cookie)).json<Verdict>()).verdict).toBe("full");
		});
	});

	/*
	 * Four queues, four phones, one database. These are the tests the
	 * whole single-statement claim exists to pass: an earlier design
	 * took the capacity slot and recorded the entry as two separate
	 * writes, which leaks a slot every time the second one loses.
	 */
	describe("four queues at once", () => {
		it("admits exactly one when the same pass is scanned on two queues together", async () => {
			await addPass("tok-a", "registered", "22BCE1001");

			const [one, two] = await Promise.all([
				claim("tok-a", await signedIn("queue-1")),
				claim("tok-a", await signedIn("queue-2")),
			]);

			const verdicts = [
				(await one.json<Verdict>()).verdict,
				(await two.json<Verdict>()).verdict,
			].sort();

			expect(verdicts).toEqual(["admitted", "already-in"]);

			const inside = await env.DB.prepare(
				`SELECT COUNT(*) AS n FROM entry_scans WHERE event_id = ? AND voided_at IS NULL`,
			)
				.bind(eventId)
				.first<{ n: number }>();

			expect(inside?.n).toBe(1);
		});

		it("never exceeds capacity when everyone scans at once", async () => {
			await seedDoor({ capacity: 5 });

			const tokens: string[] = [];

			for (let n = 1; n <= 20; n += 1) {
				const token = `tok-${n}`;
				tokens.push(token);
				await addPass(token, "registered", `22BCE${1000 + n}`);
			}

			const cookies = await Promise.all([
				signedIn("queue-1"),
				signedIn("queue-2"),
			]);

			const responses = await Promise.all(
				tokens.map((token, i) => claim(token, cookies[i % cookies.length])),
			);

			const verdicts = await Promise.all(responses.map((r) => r.json<Verdict>()));

			const admitted = verdicts.filter((v) => v.verdict === "admitted").length;
			const full = verdicts.filter((v) => v.verdict === "full").length;

			expect(admitted).toBe(5);
			expect(full).toBe(15);

			const inside = await env.DB.prepare(
				`SELECT COUNT(*) AS n FROM entry_scans WHERE event_id = ? AND voided_at IS NULL`,
			)
				.bind(eventId)
				.first<{ n: number }>();

			expect(inside?.n).toBe(5);
		}, 20_000);
	});

	describe("state", () => {
		it("counts what is actually inside", async () => {
			await seedDoor({ capacity: 10 });

			await addPass("res-1", "reserved", "22BCE2001", "R5-S1");
			await addPass("gen-1", "registered", "22BCE1001");

			const cookie = await signedIn();

			await claim("res-1", cookie);
			await claim("gen-1", cookie);

			const body = await (
				await SELF.fetch(`${WORKER_ORIGIN}/api/scan/state`, { headers: { Cookie: cookie } })
			).json<State>();

			expect(body.configured).toBe(true);
			expect(body.capacity).toBe(10);
			expect(body.inside).toBe(2);
			expect(body.inside_general).toBe(1);
			expect(body.inside_reserved).toBe(1);
			expect(body.reserved_issued).toBe(1);
			expect(body.general_cap).toBe(9);
			expect(body.general_remaining).toBe(8);
		});

		it("needs a scanner session", async () => {
			const response = await SELF.fetch(`${WORKER_ORIGIN}/api/scan/state`);

			expect(response.status).toBe(401);
		});
	});

	/*
	 * Capacity is set from the admin panel, behind the normal GitHub
	 * gate. A borrowed phone at a door must not be able to decide how
	 * many people fit in a room.
	 */
	describe("the gate, from the admin panel", () => {
		function gate(method: string, cookie: string, body?: unknown): Promise<Response> {
			return SELF.fetch(`${WORKER_ORIGIN}/api/admin/events/gittyup26/entry`, {
				method,
				headers: { "Content-Type": "application/json", Cookie: cookie },
				body: body === undefined ? undefined : JSON.stringify(body),
			});
		}

		it("needs an admin session", async () => {
			expect((await gate("GET", "")).status).toBe(401);
			expect((await gate("PATCH", "", { capacity: 10 })).status).toBe(401);
		});

		it("reads the current state", async () => {
			const body = await (await gate("GET", await asAdmin())).json<State>();

			expect(body.configured).toBe(true);
			expect(body.capacity).toBe(3);
		});

		it("changes the capacity", async () => {
			const cookie = await asAdmin();

			const body = await (await gate("PATCH", cookie, { capacity: 40 })).json<State>();

			expect(body.capacity).toBe(40);
			expect(body.general_cap).toBe(40);
		});

		/* A fat finger turning 520 into 5200 uncaps the room silently. */
		it("refuses a capacity outside the sane range", async () => {
			const cookie = await asAdmin();

			for (const capacity of [0, -5, 99999, 1.5]) {
				expect((await gate("PATCH", cookie, { capacity })).status, `${capacity}`).toBe(400);
			}
		});

		it("closes the door, and the door stays closed", async () => {
			const cookie = await asAdmin();

			await addPass("tok-a", "registered", "22BCE1001");

			await gate("PATCH", cookie, { is_open: false });

			const body = await (await claim("tok-a", await signedIn())).json<Verdict>();

			expect(body.verdict).toBe("closed");
		});

		it("records who changed it", async () => {
			await gate("PATCH", await asAdmin(), { capacity: 25 });

			const row = await env.DB.prepare(
				`SELECT actor, result FROM entry_events WHERE result = 'gate-changed' ORDER BY id DESC LIMIT 1`,
			).first<{ actor: string; result: string }>();

			expect(row?.actor).toBe("doorkeeper");
		});
	});

	/*
	 * The throwaway door an admin can build to try the scanner before
	 * the day, without waiting for the real passes to be generated.
	 */
	describe("the test door", () => {
		interface TestDoor {
			event_slug: string;
			capacity: number;
			device_token: string;
			device_id: string;
			passes: { token: string; kind: string; name: string }[];
			expected: string;
		}

		function testDoor(method: string, cookie: string, body?: unknown): Promise<Response> {
			return SELF.fetch(`${WORKER_ORIGIN}/api/admin/entry-test`, {
				method,
				headers: { "Content-Type": "application/json", Cookie: cookie },
				body: body === undefined ? undefined : JSON.stringify(body),
			});
		}

		it("needs an admin session", async () => {
			expect((await testDoor("POST", "")).status).toBe(401);
			expect((await testDoor("DELETE", "")).status).toBe(401);
		});

		it("builds a door with passes and a device token", async () => {
			const body = await (await testDoor("POST", await asAdmin())).json<TestDoor>();

			expect(body.capacity).toBe(5);
			expect(body.passes).toHaveLength(6);
			expect(body.passes.filter((p) => p.kind === "reserved")).toHaveLength(3);
			expect(body.device_token).toMatch(/^[a-f0-9]{32}$/);

			/* The tokens are what a camera has to read back, so they are
			   the same single character class the scanner validates. */
			body.passes.forEach((p) => expect(p.token).toMatch(/^[a-f0-9]{32}$/));
		});

		/*
		 * The safety property the whole design rests on. A test pass is
		 * on its own event, so admitting one cannot move the real
		 * auditorium's count. If this ever fails, the test door is a way
		 * to quietly fill the room.
		 */
		it("cannot admit anyone into the real auditorium", async () => {
			const admin = await asAdmin();

			const door = await (await testDoor("POST", admin)).json<TestDoor>();

			const signIn = await SELF.fetch(`${WORKER_ORIGIN}/api/scan/session`, {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ device_token: door.device_token }),
			});

			expect(signIn.status).toBe(200);

			const cookie = `osc_scan_session=${
				/osc_scan_session=([^;]+)/.exec(signIn.headers.get("Set-Cookie") ?? "")?.[1]
			}`;

			const verdict = await (await claim(door.passes[0].token, cookie)).json<Verdict>();

			expect(verdict.verdict).toBe("admitted");

			/* The real door has not moved. */
			const real = await env.DB.prepare(
				`SELECT COUNT(*) AS n FROM entry_scans WHERE event_id = ? AND voided_at IS NULL`,
			)
				.bind(eventId)
				.first<{ n: number }>();

			expect(real?.n).toBe(0);
		});

		/* It would otherwise show up on the events page as a real event. */
		it("hides the test event from the public listing", async () => {
			await testDoor("POST", await asAdmin());

			const events = await (
				await SELF.fetch(`${WORKER_ORIGIN}/api/events`)
			).json<{ events: { slug: string }[] }>();

			expect(events.events.map((e) => e.slug)).not.toContain("door-scanner-test");
		});

		it("resets rather than piling up when pressed twice", async () => {
			const admin = await asAdmin();

			const first = await (await testDoor("POST", admin)).json<TestDoor>();
			const second = await (await testDoor("POST", admin)).json<TestDoor>();

			expect(second.passes[0].token).not.toBe(first.passes[0].token);

			const passes = await env.DB.prepare(
				`
          SELECT COUNT(*) AS n FROM entry_passes
          WHERE event_id = (SELECT id FROM events WHERE slug = 'door-scanner-test')
        `,
			).first<{ n: number }>();

			expect(passes?.n).toBe(6);
		});

		it("tears the whole thing down", async () => {
			const admin = await asAdmin();

			await testDoor("POST", admin);

			expect((await (await testDoor("DELETE", admin)).json<{ removed: boolean }>()).removed).toBe(true);

			for (const table of ["entry_passes", "scanner_devices", "entry_gate"]) {
				const left = await env.DB.prepare(
					`SELECT COUNT(*) AS n FROM ${table} WHERE event_id NOT IN (SELECT id FROM events)`,
				).first<{ n: number }>();

				expect(left?.n, `${table} left orphans`).toBe(0);
			}
		});
	});

	/* Refusals leave no row in entry_scans, so without this table there
	   is no record of who was turned away. */
	describe("audit", () => {
		it("records refusals as well as admissions", async () => {
			await addPass("tok-a", "registered", "22BCE1001");

			const cookie = await signedIn();

			await claim("tok-a", cookie);
			await claim("tok-a", cookie);
			await claim("never-issued", cookie);

			const rows = await env.DB.prepare(
				`SELECT result FROM entry_events WHERE event_id = ? ORDER BY id`,
			)
				.bind(eventId)
				.all<{ result: string }>();

			expect(rows.results.map((r) => r.result)).toEqual(["admitted", "already-in", "unknown"]);
		});

		it("reads the log back, newest first", async () => {
			await addPass("tok-a", "registered", "22BCE1001");

			const cookie = await signedIn();

			await claim("tok-a", cookie);
			await claim("never-issued", cookie);

			const response = await SELF.fetch(
				`${WORKER_ORIGIN}/api/admin/events/gittyup26/entry/log`,
				{ headers: { Cookie: await asAdmin() } },
			);

			expect(response.status).toBe(200);

			const body = await response.json<{
				entries: { result: string; name: string | null; token_prefix: string }[];
			}>();

			expect(body.entries.map((e) => e.result)).toEqual(["unknown", "admitted"]);

			/* The holder's name is there so a line reads without a lookup. */
			expect(body.entries[1].name).toBe("Holder 22BCE1001");
		});

		/*
		 * A token is a credential. A log that prints one is a log that
		 * lets whoever reads it walk in on somebody else's pass.
		 */
		it("never returns a whole token", async () => {
			await addPass("tok-abcdef123456", "registered", "22BCE1001");

			await claim("tok-abcdef123456", await signedIn());

			const body = await (
				await SELF.fetch(`${WORKER_ORIGIN}/api/admin/events/gittyup26/entry/log`, {
					headers: { Cookie: await asAdmin() },
				})
			).json<{ entries: { token_prefix: string }[] }>();

			expect(body.entries[0].token_prefix).toBe("tok-abcd");
			expect(JSON.stringify(body)).not.toContain("tok-abcdef123456");
		});

		it("needs an admin session", async () => {
			const response = await SELF.fetch(
				`${WORKER_ORIGIN}/api/admin/events/gittyup26/entry/log`,
			);

			expect(response.status).toBe(401);
		});
	});
});
