import { env, SELF } from "cloudflare:test";
import { describe, it, expect, beforeEach } from "vitest";

const WORKER_ORIGIN = "https://events.oscvitap.com";

interface Member {
	id: string;
	name: string;
	role: string;
	tier: string;
	bio: string;
	image: string;
	socials: {
		github?: string;
		linkedin?: string;
		instagram?: string;
		website?: string;
	};
}

/*
 * The migration seeds nine members. Each test wants a known slate, so the
 * table is cleared first — isolated storage rolls the delete back after the
 * test, leaving the seed intact for anything that depends on it.
 */
async function resetMembers(): Promise<void> {
	await env.DB.prepare(`DELETE FROM team_members`).run();
	await env.DB.prepare(`DELETE FROM admin_sessions`).run();
}

/*
 * A live admin session, minted straight into the table. isAllowedAdmin
 * passes on an empty ADMIN_GITHUB_USERS, which is the test env, so no
 * GitHub round trip is needed — the cookie alone stands in for sign-in.
 */
async function signIn(): Promise<string> {
	const id = crypto.randomUUID();

	await env.DB.prepare(
		`
      INSERT INTO admin_sessions (id, github_user_id, github_username, expires_at)
      VALUES (?, '4242', 'octocat', datetime('now', '+1 hour'))
    `,
	)
		.bind(id)
		.run();

	return `osc_admin_session=${id}`;
}

async function insertMember(over: Partial<{
	name: string;
	role: string;
	tier: string;
	bio: string;
	image_url: string;
	github: string | null;
	linkedin: string | null;
	instagram: string | null;
	website: string | null;
	sort_order: number;
}> = {}): Promise<void> {
	await env.DB.prepare(
		`
      INSERT INTO team_members
        (name, role, tier, bio, image_url, github, linkedin, instagram, website, sort_order)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `,
	)
		.bind(
			over.name ?? "Ada Lovelace",
			over.role ?? "Technical Lead",
			over.tier ?? "Technical Leads",
			over.bio ?? "",
			over.image_url ?? "",
			over.github ?? null,
			over.linkedin ?? null,
			over.instagram ?? null,
			over.website ?? null,
			over.sort_order ?? 1,
		)
		.run();
}

function publicList(): Promise<Response> {
	return SELF.fetch(`${WORKER_ORIGIN}/api/team/members`);
}

function adminList(cookie: string): Promise<Response> {
	return SELF.fetch(`${WORKER_ORIGIN}/api/admin/team/members`, {
		headers: { Cookie: cookie },
	});
}

function createMember(cookie: string, body: unknown): Promise<Response> {
	return SELF.fetch(`${WORKER_ORIGIN}/api/admin/team/members`, {
		method: "POST",
		headers: { "Content-Type": "application/json", Cookie: cookie },
		body: JSON.stringify(body),
	});
}

describe("team members — public read", () => {
	beforeEach(resetMembers);

	it("returns members grouped-ready, sorted by sort_order", async () => {
		await insertMember({ name: "Second", sort_order: 2 });
		await insertMember({ name: "First", sort_order: 1 });

		const response = await publicList();

		expect(response.status).toBe(200);

		const data = await response.json<{ members: Member[] }>();

		expect(data.members.map((m) => m.name)).toEqual(["First", "Second"]);
	});

	it("omits empty socials rather than sending null keys", async () => {
		await insertMember({
			name: "Only GitHub",
			github: "https://github.com/ada",
			linkedin: null,
			instagram: null,
			website: null,
		});

		const { members } = await (await publicList()).json<{ members: Member[] }>();

		expect(members[0].socials).toEqual({ github: "https://github.com/ada" });
	});

	it("needs no sign-in", async () => {
		await insertMember({});

		const response = await publicList();

		expect(response.status).toBe(200);
	});
});

describe("team members — admin gate", () => {
	beforeEach(resetMembers);

	it("refuses the admin list without a session", async () => {
		const response = await SELF.fetch(`${WORKER_ORIGIN}/api/admin/team/members`);

		expect(response.status).toBe(401);
	});

	it("refuses a create without a session", async () => {
		const response = await SELF.fetch(`${WORKER_ORIGIN}/api/admin/team/members`, {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({ name: "X", role: "Y", tier: "Admins" }),
		});

		expect(response.status).toBe(401);
	});
});

describe("team members — create", () => {
	beforeEach(resetMembers);

	it("adds a member and returns it with a nested socials shape", async () => {
		const cookie = await signIn();

		const response = await createMember(cookie, {
			name: "Grace Hopper",
			role: "Compiler Lead",
			tier: "Technical Leads",
			bio: "Coined the bug.",
			socials: { github: "https://github.com/grace", linkedin: "" },
		});

		expect(response.status).toBe(201);

		const { member } = await response.json<{ member: Member }>();

		expect(member.name).toBe("Grace Hopper");
		// The empty linkedin was dropped, the real github kept.
		expect(member.socials).toEqual({ github: "https://github.com/grace" });

		// And it shows up on the public list.
		const { members } = await (await publicList()).json<{ members: Member[] }>();
		expect(members).toHaveLength(1);
	});

	it("sorts new members after the ones already there", async () => {
		await insertMember({ name: "Existing", sort_order: 5 });

		const cookie = await signIn();
		await createMember(cookie, { name: "Newcomer", role: "R", tier: "Admins" });

		const { members } = await (await publicList()).json<{ members: Member[] }>();

		expect(members.map((m) => m.name)).toEqual(["Existing", "Newcomer"]);
	});

	it("rejects a missing name, role or tier", async () => {
		const cookie = await signIn();

		const response = await createMember(cookie, { name: "No role", tier: "Admins" });

		expect(response.status).toBe(400);
	});

	it("rejects a tier outside the four known ones", async () => {
		const cookie = await signIn();

		const response = await createMember(cookie, {
			name: "Wrong tier",
			role: "R",
			tier: "Overlords",
		});

		expect(response.status).toBe(400);
	});
});

describe("team members — edit and delete", () => {
	beforeEach(resetMembers);

	it("patches only the fields sent and leaves the rest", async () => {
		await insertMember({
			name: "Before",
			role: "Old Role",
			tier: "Admins",
			github: "https://github.com/before",
		});

		const cookie = await signIn();
		const id = (await (await adminList(cookie)).json<{ members: Member[] }>()).members[0].id;

		const response = await SELF.fetch(`${WORKER_ORIGIN}/api/admin/team/members/${id}`, {
			method: "PATCH",
			headers: { "Content-Type": "application/json", Cookie: cookie },
			body: JSON.stringify({ role: "New Role" }),
		});

		expect(response.status).toBe(200);

		const { member } = await response.json<{ member: Member }>();

		expect(member.role).toBe("New Role");
		// Untouched fields survive.
		expect(member.name).toBe("Before");
		expect(member.socials.github).toBe("https://github.com/before");
	});

	it("clears a social when its key is sent empty", async () => {
		await insertMember({ github: "https://github.com/ada" });

		const cookie = await signIn();
		const id = (await (await adminList(cookie)).json<{ members: Member[] }>()).members[0].id;

		const response = await SELF.fetch(`${WORKER_ORIGIN}/api/admin/team/members/${id}`, {
			method: "PATCH",
			headers: { "Content-Type": "application/json", Cookie: cookie },
			body: JSON.stringify({ socials: { github: "" } }),
		});

		const { member } = await response.json<{ member: Member }>();

		expect(member.socials.github).toBeUndefined();
	});

	it("removes a member", async () => {
		await insertMember({});

		const cookie = await signIn();
		const id = (await (await adminList(cookie)).json<{ members: Member[] }>()).members[0].id;

		const response = await SELF.fetch(`${WORKER_ORIGIN}/api/admin/team/members/${id}`, {
			method: "DELETE",
			headers: { Cookie: cookie },
		});

		expect(response.status).toBe(200);

		const { members } = await (await publicList()).json<{ members: Member[] }>();
		expect(members).toHaveLength(0);
	});

	it("404s a patch to a member that does not exist", async () => {
		const cookie = await signIn();

		const response = await SELF.fetch(`${WORKER_ORIGIN}/api/admin/team/members/999999`, {
			method: "PATCH",
			headers: { "Content-Type": "application/json", Cookie: cookie },
			body: JSON.stringify({ role: "x" }),
		});

		expect(response.status).toBe(404);
	});
});

describe("team members — photo upload", () => {
	beforeEach(resetMembers);

	async function uploadPhoto(
		cookie: string,
		id: string,
		file: File,
	): Promise<Response> {
		const form = new FormData();
		form.append("image", file);

		return SELF.fetch(`${WORKER_ORIGIN}/api/admin/team/members/${id}/image`, {
			method: "POST",
			headers: { Cookie: cookie },
			body: form,
		});
	}

	it("stores a photo, points the member at it, and serves it publicly", async () => {
		await insertMember({});

		const cookie = await signIn();
		const id = (await (await adminList(cookie)).json<{ members: Member[] }>()).members[0].id;

		const bytes = new Uint8Array([1, 2, 3, 4]);
		const response = await uploadPhoto(
			cookie,
			id,
			new File([bytes], "face.png", { type: "image/png" }),
		);

		expect(response.status).toBe(200);

		const { member } = await response.json<{ member: Member }>();

		// Absolute, against the Worker origin, and under the public image route.
		expect(member.image).toMatch(
			/^https:\/\/events\.oscvitap\.com\/api\/team\/image\/[A-Za-z0-9._-]+\.png$/,
		);

		// The public route returns the bytes with the stored content type.
		const image = await SELF.fetch(member.image);
		expect(image.status).toBe(200);
		expect(image.headers.get("Content-Type")).toBe("image/png");
		expect(new Uint8Array(await image.arrayBuffer())).toEqual(bytes);
	});

	it("frees the old photo when a new one replaces it", async () => {
		await insertMember({});

		const cookie = await signIn();
		const id = (await (await adminList(cookie)).json<{ members: Member[] }>()).members[0].id;

		const first = await (
			await uploadPhoto(cookie, id, new File([new Uint8Array([1])], "a.png", { type: "image/png" }))
		).json<{ member: Member }>();

		await uploadPhoto(cookie, id, new File([new Uint8Array([2])], "b.webp", { type: "image/webp" }));

		// The first object is gone once the second one lands.
		const stale = await SELF.fetch(first.member.image);
		expect(stale.status).toBe(404);
	});

	it("frees the photo when the member is deleted", async () => {
		await insertMember({});

		const cookie = await signIn();
		const id = (await (await adminList(cookie)).json<{ members: Member[] }>()).members[0].id;

		const uploaded = await (
			await uploadPhoto(cookie, id, new File([new Uint8Array([9])], "c.png", { type: "image/png" }))
		).json<{ member: Member }>();

		await SELF.fetch(`${WORKER_ORIGIN}/api/admin/team/members/${id}`, {
			method: "DELETE",
			headers: { Cookie: cookie },
		});

		const gone = await SELF.fetch(uploaded.member.image);
		expect(gone.status).toBe(404);
	});

	it("rejects a file that is not a PNG, JPEG or WebP", async () => {
		await insertMember({});

		const cookie = await signIn();
		const id = (await (await adminList(cookie)).json<{ members: Member[] }>()).members[0].id;

		const response = await uploadPhoto(
			cookie,
			id,
			new File([new Uint8Array([1])], "note.txt", { type: "text/plain" }),
		);

		expect(response.status).toBe(400);
	});

	it("rejects a file larger than 5 MB", async () => {
		await insertMember({});

		const cookie = await signIn();
		const id = (await (await adminList(cookie)).json<{ members: Member[] }>()).members[0].id;

		const tooBig = new Uint8Array(5 * 1024 * 1024 + 1);
		const response = await uploadPhoto(
			cookie,
			id,
			new File([tooBig], "huge.png", { type: "image/png" }),
		);

		expect(response.status).toBe(400);
	});
});
