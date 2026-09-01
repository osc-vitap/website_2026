import { env, createExecutionContext, waitOnExecutionContext } from "cloudflare:test";
import { describe, it, expect, beforeEach } from "vitest";
import worker from "../src/index";

const IncomingRequest = Request<unknown, IncomingRequestCfProperties>;
const WORKER_ORIGIN = "https://events.oscvitap.com";
const SESSION_ID = "test-admin-session-token";

interface TestProject {
	id: string;
	title: string;
	description: string;
	techStack: string[];
	repoUrl: string;
	liveUrl?: string | null;
	contributors: string[];
	displayOrder: number;
	createdAt?: string;
	updatedAt?: string;
}

async function fetchWorker(path: string, init?: RequestInit): Promise<Response> {
	const request = new IncomingRequest(`${WORKER_ORIGIN}${path}`, init);
	const ctx = createExecutionContext();
	const response = await worker.fetch(request, env, ctx);
	await waitOnExecutionContext(ctx);
	return response;
}

async function seedAdminSession(username = "admin-user"): Promise<void> {
	await env.DB.prepare(
		`INSERT INTO admin_sessions (id, github_user_id, github_username, expires_at) VALUES (?, ?, ?, ?)`,
	)
		.bind(SESSION_ID, "12345", username, new Date(Date.now() + 3600_000).toISOString())
		.run();
}

const basePayload = {
	title: "Octo Site",
	description: "An example project used by the tests.",
	techStack: ["TypeScript", "React"],
	repoUrl: "https://github.com/octocat/octo-site",
	liveUrl: "https://octo.example.com",
	contributors: ["https://avatars.githubusercontent.com/u/1"],
};

describe("Projects API", () => {
	beforeEach(async () => {
		await env.DB.batch([
			env.DB.prepare(`DELETE FROM admin_sessions`),
			env.DB.prepare(`DELETE FROM projects`),
		]);
	});

	it("returns 401 without a session", async () => {
		const getRes = await fetchWorker("/api/admin/projects");
		expect(getRes.status).toBe(401);

		const postRes = await fetchWorker("/api/admin/projects", {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({ id: "octo-site", ...basePayload }),
		});
		expect(postRes.status).toBe(401);

		const patchRes = await fetchWorker("/api/admin/projects/octo-site", {
			method: "PATCH",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({ title: "X" }),
		});
		expect(patchRes.status).toBe(401);

		const deleteRes = await fetchWorker("/api/admin/projects/octo-site", { method: "DELETE" });
		expect(deleteRes.status).toBe(401);
	});

	it("serves projects publicly without auth", async () => {
		await env.DB.batch([
			env.DB.prepare(
				`INSERT INTO projects (id, title, repo_url, tech_stack, contributors, display_order) VALUES (?, ?, ?, ?, ?, ?)`,
			).bind("zeta", "Zeta", "https://github.com/o/zeta", "[\"Go\"]", "[\"https://a\"]", 2),
			env.DB.prepare(
				`INSERT INTO projects (id, title, repo_url, tech_stack, contributors, display_order) VALUES (?, ?, ?, ?, ?, ?)`,
			).bind("alpha", "Alpha", "https://github.com/o/alpha", "[\"TypeScript\"]", "[\"https://b\"]", 1),
		]);

		const res = await fetchWorker("/api/projects");
		expect(res.status).toBe(200);

		const data = (await res.json()) as { projects: TestProject[] };
		expect(data.projects.map((p) => p.id)).toEqual(["alpha", "zeta"]);
		expect(data.projects[0].techStack).toEqual(["TypeScript"]);
		expect(data.projects[0].contributors).toEqual(["https://b"]);
	});

	it("lists projects in display_order then id order", async () => {
		await seedAdminSession();
		await env.DB.batch([
			env.DB.prepare(
				`INSERT INTO projects (id, title, repo_url, tech_stack, contributors, display_order) VALUES (?, ?, ?, ?, ?, ?)`,
			).bind("zeta", "Zeta", "https://github.com/o/zeta", "[]", "[]", 3),
			env.DB.prepare(
				`INSERT INTO projects (id, title, repo_url, tech_stack, contributors, display_order) VALUES (?, ?, ?, ?, ?, ?)`,
			).bind("alpha", "Alpha", "https://github.com/o/alpha", "[]", "[]", 1),
			env.DB.prepare(
				`INSERT INTO projects (id, title, repo_url, tech_stack, contributors, display_order) VALUES (?, ?, ?, ?, ?, ?)`,
			).bind("mid", "Mid", "https://github.com/o/mid", "[]", "[]", 2),
		]);

		const res = await fetchWorker("/api/admin/projects", {
			headers: { Cookie: `osc_admin_session=${SESSION_ID}` },
		});
		expect(res.status).toBe(200);

		const data = (await res.json()) as { projects: TestProject[] };
		expect(data.projects.map((p) => p.id)).toEqual(["alpha", "mid", "zeta"]);
	});

	it("creates a project with a valid payload", async () => {
		await seedAdminSession();

		const res = await fetchWorker("/api/admin/projects", {
			method: "POST",
			headers: {
				"Content-Type": "application/json",
				Cookie: `osc_admin_session=${SESSION_ID}`,
			},
			body: JSON.stringify({ id: "octo-site", ...basePayload }),
		});

		expect(res.status).toBe(201);
		const data = (await res.json()) as { success: boolean; project: TestProject };
		expect(data.success).toBe(true);
		expect(data.project.id).toBe("octo-site");
		expect(data.project.title).toBe("Octo Site");
		expect(data.project.techStack).toEqual(["TypeScript", "React"]);
		expect(data.project.contributors).toEqual(["https://avatars.githubusercontent.com/u/1"]);
		expect(data.project.displayOrder).toBe(1);

		const listRes = await fetchWorker("/api/admin/projects", {
			headers: { Cookie: `osc_admin_session=${SESSION_ID}` },
		});
		const listData = (await listRes.json()) as { projects: TestProject[] };
		expect(listData.projects).toHaveLength(1);
	});

	it("rejects invalid payloads on create", async () => {
		await seedAdminSession();

		const cases: Array<{ body: Record<string, unknown>; expect: string }> = [
			{ body: { ...basePayload }, expect: "Project id is required" },
			{ body: { id: "!!", ...basePayload }, expect: "Project id must be lowercase" },
			{ body: { id: "no-title", repoUrl: "https://x" }, expect: "Project title is required" },
			{ body: { id: "no-url", title: "x", repoUrl: "not-a-url" }, expect: "repository URL" },
			{ body: { id: "bad-array", ...basePayload, techStack: "TypeScript,React" }, expect: "techStack must be an array" },
			{ body: { id: "bad-contrib", ...basePayload, contributors: [1, 2] }, expect: "contributors must be an array" },
		];

		for (const c of cases) {
			const res = await fetchWorker("/api/admin/projects", {
				method: "POST",
				headers: {
					"Content-Type": "application/json",
					Cookie: `osc_admin_session=${SESSION_ID}`,
				},
				body: JSON.stringify(c.body),
			});
			expect(res.status).toBe(400);
			const data = (await res.json()) as { error: string };
			expect(data.error).toContain(c.expect);
		}
	});

	it("returns 409 on duplicate id", async () => {
		await seedAdminSession();

		const first = await fetchWorker("/api/admin/projects", {
			method: "POST",
			headers: {
				"Content-Type": "application/json",
				Cookie: `osc_admin_session=${SESSION_ID}`,
			},
			body: JSON.stringify({ id: "octo-site", ...basePayload }),
		});
		expect(first.status).toBe(201);

		const second = await fetchWorker("/api/admin/projects", {
			method: "POST",
			headers: {
				"Content-Type": "application/json",
				Cookie: `osc_admin_session=${SESSION_ID}`,
			},
			body: JSON.stringify({ id: "octo-site", ...basePayload, title: "Other" }),
		});
		expect(second.status).toBe(400);
		const data = (await second.json()) as { error: string };
		expect(data.error).toMatch(/already exist|Unable to create/);
	});

	it("patches only the supplied fields", async () => {
		await seedAdminSession();

		await fetchWorker("/api/admin/projects", {
			method: "POST",
			headers: {
				"Content-Type": "application/json",
				Cookie: `osc_admin_session=${SESSION_ID}`,
			},
			body: JSON.stringify({ id: "octo-site", ...basePayload }),
		});

		const res = await fetchWorker("/api/admin/projects/octo-site", {
			method: "PATCH",
			headers: {
				"Content-Type": "application/json",
				Cookie: `osc_admin_session=${SESSION_ID}`,
			},
			body: JSON.stringify({ title: "Renamed" }),
		});

		expect(res.status).toBe(200);
		const data = (await res.json()) as { success: boolean; project: TestProject };
		expect(data.project.title).toBe("Renamed");
		expect(data.project.techStack).toEqual(["TypeScript", "React"]);
		expect(data.project.contributors).toEqual(["https://avatars.githubusercontent.com/u/1"]);
		expect(data.project.liveUrl).toBe("https://octo.example.com");
	});

	it("replaces arrays on patch, not merges", async () => {
		await seedAdminSession();

		await fetchWorker("/api/admin/projects", {
			method: "POST",
			headers: {
				"Content-Type": "application/json",
				Cookie: `osc_admin_session=${SESSION_ID}`,
			},
			body: JSON.stringify({ id: "octo-site", ...basePayload }),
		});

		const res = await fetchWorker("/api/admin/projects/octo-site", {
			method: "PATCH",
			headers: {
				"Content-Type": "application/json",
				Cookie: `osc_admin_session=${SESSION_ID}`,
			},
			body: JSON.stringify({ techStack: ["Go"], contributors: [] }),
		});

		expect(res.status).toBe(200);
		const data = (await res.json()) as { project: TestProject };
		expect(data.project.techStack).toEqual(["Go"]);
		expect(data.project.contributors).toEqual([]);
	});

	it("returns 404 when patching an unknown project", async () => {
		await seedAdminSession();

		const res = await fetchWorker("/api/admin/projects/missing", {
			method: "PATCH",
			headers: {
				"Content-Type": "application/json",
				Cookie: `osc_admin_session=${SESSION_ID}`,
			},
			body: JSON.stringify({ title: "X" }),
		});
		expect(res.status).toBe(404);
	});

	it("deletes a project and returns 404 on the second delete", async () => {
		await seedAdminSession();

		await fetchWorker("/api/admin/projects", {
			method: "POST",
			headers: {
				"Content-Type": "application/json",
				Cookie: `osc_admin_session=${SESSION_ID}`,
			},
			body: JSON.stringify({ id: "octo-site", ...basePayload }),
		});

		const first = await fetchWorker("/api/admin/projects/octo-site", {
			method: "DELETE",
			headers: { Cookie: `osc_admin_session=${SESSION_ID}` },
		});
		expect(first.status).toBe(200);

		const listRes = await fetchWorker("/api/admin/projects", {
			headers: { Cookie: `osc_admin_session=${SESSION_ID}` },
		});
		const listData = (await listRes.json()) as { projects: TestProject[] };
		expect(listData.projects).toHaveLength(0);

		const second = await fetchWorker("/api/admin/projects/octo-site", {
			method: "DELETE",
			headers: { Cookie: `osc_admin_session=${SESSION_ID}` },
		});
		expect(second.status).toBe(404);
	});
});
