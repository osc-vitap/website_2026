import { env, SELF } from "cloudflare:test";
import { describe, it, expect, beforeEach } from "vitest";

const WORKER_ORIGIN = "https://events.oscvitap.com";

const SEAT_CODE_PATTERN = /^[ABCDEFGHJKLMNPQRSTUVWXYZ23456789]{4}-[ABCDEFGHJKLMNPQRSTUVWXYZ23456789]{4}$/;

interface FieldError {
	index: number;
	field: string;
	message: string;
}

interface ReserveBody {
	ok?: boolean;
	error?: string;
	reserved?: { seat_id: string; name: string }[];
	field_errors?: FieldError[];
}

interface SeatsBody {
	seats: string[];
	max_per_reservation: number;
}

interface CodeUse {
	seat_id: string;
	name: string;
	college_registration_number: string;
	email: string;
	created_at: string;
}

interface CodeRow {
	code: string;
	created_at: string;
	revoked_at: string | null;
	used_by: CodeUse | null;
}

interface ReservationRow {
	id: number;
	seat_id: string;
	code: string;
	name: string;
	college_registration_number: string;
	email: string;
	email_status: string;
	created_at: string;
}

async function seedSeatEvent(): Promise<string> {
	await env.DB.prepare(`DELETE FROM seat_reservations`).run();
	await env.DB.prepare(`DELETE FROM seat_reservation_codes`).run();
	await env.DB.prepare(`DELETE FROM registration_members`).run();
	await env.DB.prepare(`DELETE FROM registrations`).run();
	await env.DB.prepare(`DELETE FROM events`).run();

	const id = crypto.randomUUID();

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
        venue
      )
      VALUES (?, ?, ?, ?, ?, 1, 'pending', 'solo', 1, 1, ?)
    `,
	)
		.bind(id, "gittyup26", "GittyUp 26", "2099-09-01", null, "AB2 Auditorium")
		.run();

	const registration = await env.DB.prepare(
		`
      INSERT INTO registrations (event_id, name, year_of_study, email, team_size)
      VALUES (?, 'Ada', '2', 'ada@vitapstudent.ac.in', 1)
    `,
	)
		.bind(id)
		.run();

	await env.DB.prepare(
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
      VALUES (?, ?, 'Ada Lovelace', '2', '22BCE1234', 'ada@vitapstudent.ac.in', 1)
    `,
	)
		.bind(registration.meta.last_row_id, id)
		.run();

	await env.DB.prepare(`INSERT INTO seat_reservation_codes (code, event_id) VALUES ('AB3D-7K2M', ?)`).bind(id).run();

	await env.DB.prepare(
		`INSERT INTO seat_reservation_codes (code, event_id, revoked_at) VALUES ('ZZZZ-2222', ?, CURRENT_TIMESTAMP)`,
	)
		.bind(id)
		.run();

	return id;
}

function reserve(seats: unknown[]): Promise<Response> {
	return SELF.fetch(`${WORKER_ORIGIN}/api/events/gittyup26/seats/reserve`, {
		method: "POST",
		headers: { "Content-Type": "application/json" },
		body: JSON.stringify({ seats }),
	});
}

describe("seat reservations", () => {
	beforeEach(seedSeatEvent);

	it("lists no taken seats to start with", async () => {
		const response = await SELF.fetch(`${WORKER_ORIGIN}/api/events/gittyup26/seats`);

		expect(response.status).toBe(200);

		expect(await response.json<SeatsBody>()).toEqual({ seats: [], max_per_reservation: 20 });
	});

	it("reserves a seat and answers with the registered name", async () => {
		const response = await reserve([
			{ seat_id: "R22-S1", code: "ab3d-7k2m", college_registration_number: " 22bce1234 " },
		]);

		expect(response.status).toBe(200);

		expect(await response.json<ReserveBody>()).toEqual({
			ok: true,
			reserved: [{ seat_id: "R22-S1", name: "Ada Lovelace" }],
		});

		const listed = await (await SELF.fetch(`${WORKER_ORIGIN}/api/events/gittyup26/seats`)).json<SeatsBody>();

		expect(listed.seats).toEqual(["R22-S1"]);

		const row = await env.DB.prepare(`SELECT email, email_status, code FROM seat_reservations`).first<{
			email: string;
			email_status: string;
			code: string;
		}>();

		expect(row?.email).toBe("ada@vitapstudent.ac.in");
		expect(row?.email_status).toBe("pending");
		expect(row?.code).toBe("AB3D-7K2M");
	});

	it("turns away a registration number that is not registered", async () => {
		const response = await reserve([
			{ seat_id: "R1-S1", code: "AB3D-7K2M", college_registration_number: "22BCE9999" },
		]);

		expect(response.status).toBe(400);

		const body = await response.json<ReserveBody>();

		expect(body.field_errors).toEqual([
			{
				index: 0,
				field: "college_registration_number",
				message: "That registration number is not registered for gitty up. Register at oscvitap.com/gittyup26 first.",
			},
		]);
	});

	it("reports every bad row of one request together", async () => {
		const response = await reserve([
			{ seat_id: "R23-S1", code: "AB3D-7K2M", college_registration_number: "22BCE1234" },
			{ seat_id: "R1-S1", code: "NOPE", college_registration_number: "22BCE1234" },
			{ seat_id: "R1-S2", code: "ZZZZ-2222", college_registration_number: "22BCE1234" },
		]);

		expect(response.status).toBe(400);

		const errors = (await response.json<ReserveBody>()).field_errors ?? [];

		const fields = errors.map((entry) => `${entry.index}:${entry.field}`);

		expect(fields).toContain("0:seat_id");
		expect(fields).toContain("1:code");

		expect(errors.find((entry) => entry.index === 2 && entry.field === "code")?.message).toBe(
			"That reservation code has been revoked.",
		);
	});

	it("refuses the same seat twice in one request and writes nothing", async () => {
		await env.DB.prepare(
			`INSERT INTO seat_reservation_codes (code, event_id) SELECT 'CCCC-4444', id FROM events WHERE slug = 'gittyup26'`,
		).run();

		const response = await reserve([
			{ seat_id: "R1-S1", code: "AB3D-7K2M", college_registration_number: "22BCE1234" },
			{ seat_id: "R1-S1", code: "CCCC-4444", college_registration_number: "22BCE1234" },
		]);

		expect(response.status).toBe(400);

		const errors = (await response.json<ReserveBody>()).field_errors ?? [];

		expect(errors.map((entry) => `${entry.index}:${entry.field}`)).toEqual([
			"0:seat_id",
			"0:college_registration_number",
			"1:seat_id",
			"1:college_registration_number",
		]);

		const count = await env.DB.prepare(`SELECT COUNT(*) AS n FROM seat_reservations`).first<{ n: number }>();

		expect(count?.n).toBe(0);
	});

	it("answers 409 for a seat somebody already holds", async () => {
		const event = await env.DB.prepare(`SELECT id FROM events WHERE slug = 'gittyup26'`).first<{ id: string }>();

		await env.DB.prepare(
			`
        INSERT INTO seat_reservations (event_id, seat_id, code, college_registration_number, name, email)
        VALUES (?, 'R22-S1', 'QQQQ-3333', '22BCE7777', 'Other', 'other@vitapstudent.ac.in')
      `,
		)
			.bind(event?.id)
			.run();

		const response = await reserve([
			{ seat_id: "R22-S1", code: "AB3D-7K2M", college_registration_number: "22BCE1234" },
		]);

		expect(response.status).toBe(409);

		const errors = (await response.json<ReserveBody>()).field_errors ?? [];

		expect(errors[0].field).toBe("seat_id");
	});

	it("refuses more than twenty seats in one request", async () => {
		const seats = Array.from({ length: 21 }, (_unused, index) => ({
			seat_id: `R1-S${(index % 26) + 1}`,
			code: "AB3D-7K2M",
			college_registration_number: "22BCE1234",
		}));

		const response = await reserve(seats);

		expect(response.status).toBe(400);
	});

	it("keeps every seat admin route behind the admin check", async () => {
		const routes = [
			["GET", "/api/admin/events/gittyup26/seat-codes"],
			["POST", "/api/admin/events/gittyup26/seat-codes"],
			["DELETE", "/api/admin/events/gittyup26/seat-codes/AB3D-7K2M"],
			["GET", "/api/admin/events/gittyup26/seats"],
			["GET", "/api/admin/events/gittyup26/seats.csv"],
			["DELETE", "/api/admin/events/gittyup26/seats/1"],
		] as const;

		for (const [method, path] of routes) {
			const response = await SELF.fetch(`${WORKER_ORIGIN}${path}`, { method });

			expect(response.status, `${method} ${path}`).toBe(401);
		}
	});

	it("generates, lists, revokes codes and exports the csv as an admin", async () => {
		await env.DB.prepare(
			`
        INSERT INTO admin_sessions (id, github_user_id, github_username, expires_at)
        VALUES ('seat-session', '1', 'ada', datetime('now', '+1 hour'))
      `,
		).run();

		const cookie = { Cookie: "osc_admin_session=seat-session" };

		const made = await SELF.fetch(`${WORKER_ORIGIN}/api/admin/events/gittyup26/seat-codes`, {
			method: "POST",
			headers: { ...cookie, "Content-Type": "application/json" },
			body: JSON.stringify({ count: 20 }),
		});

		expect(made.status).toBe(201);

		const madeCodes = (await made.json<{ codes: string[] }>()).codes;

		expect(madeCodes).toHaveLength(20);
		expect(new Set(madeCodes).size).toBe(20);

		for (const code of madeCodes) {
			expect(code).toMatch(SEAT_CODE_PATTERN);
		}

		const createdBy = await env.DB.prepare(`SELECT created_by FROM seat_reservation_codes WHERE code = ?`)
			.bind(madeCodes[0])
			.first<{ created_by: string }>();

		expect(createdBy?.created_by).toBe("ada");

		const tooMany = await SELF.fetch(`${WORKER_ORIGIN}/api/admin/events/gittyup26/seat-codes`, {
			method: "POST",
			headers: { ...cookie, "Content-Type": "application/json" },
			body: JSON.stringify({ count: 201 }),
		});

		expect(tooMany.status).toBe(400);

		await reserve([{ seat_id: "R22-S1", code: "AB3D-7K2M", college_registration_number: "22BCE1234" }]);

		const listed = await (
			await SELF.fetch(`${WORKER_ORIGIN}/api/admin/events/gittyup26/seat-codes`, { headers: cookie })
		).json<{ codes: CodeRow[] }>();

		expect(listed.codes.find((row) => row.code === "AB3D-7K2M")?.used_by).toEqual({
			seat_id: "R22-S1",
			name: "Ada Lovelace",
			college_registration_number: "22BCE1234",
			email: "ada@vitapstudent.ac.in",
			created_at: expect.any(String),
		});

		expect(listed.codes.find((row) => row.code === "ZZZZ-2222")?.revoked_at).toEqual(expect.any(String));

		const revokeUsed = await SELF.fetch(`${WORKER_ORIGIN}/api/admin/events/gittyup26/seat-codes/AB3D-7K2M`, {
			method: "DELETE",
			headers: cookie,
		});

		expect(revokeUsed.status).toBe(409);

		const revoke = await SELF.fetch(`${WORKER_ORIGIN}/api/admin/events/gittyup26/seat-codes/${madeCodes[0]}`, {
			method: "DELETE",
			headers: cookie,
		});

		expect(revoke.status).toBe(200);
		expect(await revoke.json()).toEqual({ ok: true });

		const reservations = await (
			await SELF.fetch(`${WORKER_ORIGIN}/api/admin/events/gittyup26/seats`, { headers: cookie })
		).json<{ reservations: ReservationRow[] }>();

		expect(reservations.reservations).toHaveLength(1);

		expect(reservations.reservations[0]).toMatchObject({
			seat_id: "R22-S1",
			code: "AB3D-7K2M",
			email_status: "pending",
		});

		const csv = await SELF.fetch(`${WORKER_ORIGIN}/api/admin/events/gittyup26/seats.csv`, { headers: cookie });

		expect(csv.status).toBe(200);
		expect(csv.headers.get("Content-Type")).toContain("text/csv");

		const text = await csv.text();

		expect(text).toContain("Row 22 Seat 1");
		expect(text).toContain("22BCE1234");

		await env.DB.prepare(`DELETE FROM admin_sessions`).run();
	});

	it("removes a reservation as an admin and frees the seat and the code", async () => {
		await env.DB.prepare(
			`
        INSERT INTO admin_sessions (id, github_user_id, github_username, expires_at)
        VALUES ('seat-session', '1', 'ada', datetime('now', '+1 hour'))
      `,
		).run();

		const cookie = { Cookie: "osc_admin_session=seat-session" };

		const booked = await reserve([
			{ seat_id: "R22-S1", code: "AB3D-7K2M", college_registration_number: "22BCE1234" },
		]);

		expect(booked.status).toBe(200);

		const before = await (
			await SELF.fetch(`${WORKER_ORIGIN}/api/admin/events/gittyup26/seats`, { headers: cookie })
		).json<{ reservations: ReservationRow[] }>();

		expect(before.reservations).toHaveLength(1);

		const id = before.reservations[0].id;

		const badId = await SELF.fetch(`${WORKER_ORIGIN}/api/admin/events/gittyup26/seats/nope`, {
			method: "DELETE",
			headers: cookie,
		});

		expect(badId.status).toBe(400);

		const removed = await SELF.fetch(`${WORKER_ORIGIN}/api/admin/events/gittyup26/seats/${id}`, {
			method: "DELETE",
			headers: cookie,
		});

		expect(removed.status).toBe(200);
		expect(await removed.json()).toEqual({ ok: true });

		const after = await (
			await SELF.fetch(`${WORKER_ORIGIN}/api/admin/events/gittyup26/seats`, { headers: cookie })
		).json<{ reservations: ReservationRow[] }>();

		expect(after.reservations).toHaveLength(0);

		const publicSeats = await (
			await SELF.fetch(`${WORKER_ORIGIN}/api/events/gittyup26/seats`)
		).json<SeatsBody>();

		expect(publicSeats.seats).not.toContain("R22-S1");

		const again = await SELF.fetch(`${WORKER_ORIGIN}/api/admin/events/gittyup26/seats/${id}`, {
			method: "DELETE",
			headers: cookie,
		});

		expect(again.status).toBe(404);

		const rebooked = await reserve([
			{ seat_id: "R22-S1", code: "AB3D-7K2M", college_registration_number: "22BCE1234" },
		]);

		expect(rebooked.status).toBe(200);

		await env.DB.prepare(`DELETE FROM admin_sessions`).run();
	});
});
