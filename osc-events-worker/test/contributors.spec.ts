import { env, createExecutionContext, waitOnExecutionContext } from "cloudflare:test";
import { describe, it, expect, beforeEach } from "vitest";
import worker from "../src/index";

const IncomingRequest = Request<unknown, IncomingRequestCfProperties>;
const WORKER_ORIGIN = "https://events.oscvitap.com";
const SESSION_ID = "test-admin-session-token";

interface TestContributor {
	id?: number;
	login: string;
	avatar_url: string;
	html_url: string;
	display_order?: number;
	created_at?: string;
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
		`
      INSERT INTO admin_sessions (id, github_user_id, github_username, expires_at)
      VALUES (?, ?, ?, ?)
    `,
	)
		.bind(SESSION_ID, "12345", username, new Date(Date.now() + 3600_000).toISOString())
		.run();
}

describe("Contributors API", () => {
	beforeEach(async () => {
		await env.DB.batch([
			env.DB.prepare(`DELETE FROM admin_sessions`),
			env.DB.prepare(`DELETE FROM contributors`),
		]);
	});

	it("returns public contributors list", async () => {
		await env.DB.prepare(
			`INSERT INTO contributors (login, avatar_url, html_url, display_order) VALUES (?, ?, ?, ?)`,
		)
			.bind("torvalds", "https://avatars.githubusercontent.com/u/1024025", "https://github.com/torvalds", 1)
			.run();

		const response = await fetchWorker("/api/contributors");
		expect(response.status).toBe(200);

		const data = (await response.json()) as { contributors: TestContributor[] };
		expect(data.contributors.length).toBe(1);
		expect(data.contributors[0].login).toBe("torvalds");
	});

	it("requires admin auth for admin endpoints", async () => {
		const getRes = await fetchWorker("/api/admin/contributors");
		expect(getRes.status).toBe(401);

		const postRes = await fetchWorker("/api/admin/contributors", {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({ login: "torvalds" }),
		});
		expect(postRes.status).toBe(401);

		const deleteRes = await fetchWorker("/api/admin/contributors/1", {
			method: "DELETE",
		});
		expect(deleteRes.status).toBe(401);
	});

	it("allows admin to add and delete a contributor", async () => {
		await seedAdminSession("admin-user");

		const postRes = await fetchWorker("/api/admin/contributors", {
			method: "POST",
			headers: {
				"Content-Type": "application/json",
				Cookie: `osc_admin_session=${SESSION_ID}`,
			},
			body: JSON.stringify({ login: "octocat" }),
		});

		expect(postRes.status).toBe(201);
		const postData = (await postRes.json()) as { success: boolean; contributor: TestContributor };
		expect(postData.success).toBe(true);
		expect(postData.contributor.login).toBe("octocat");
		expect(postData.contributor.avatar_url).toBe("https://avatars.githubusercontent.com/octocat");
		expect(postData.contributor.html_url).toBe("https://github.com/octocat");

		const contributorId = postData.contributor.id;

		// Verify GET /api/admin/contributors
		const getRes = await fetchWorker("/api/admin/contributors", {
			headers: { Cookie: `osc_admin_session=${SESSION_ID}` },
		});
		expect(getRes.status).toBe(200);
		const getData = (await getRes.json()) as { contributors: TestContributor[] };
		expect(getData.contributors.length).toBe(1);
		expect(getData.contributors[0].login).toBe("octocat");

		// Delete contributor
		const deleteRes = await fetchWorker(`/api/admin/contributors/${contributorId}`, {
			method: "DELETE",
			headers: { Cookie: `osc_admin_session=${SESSION_ID}` },
		});
		expect(deleteRes.status).toBe(200);

		// Verify deletion
		const getAfterDelete = await fetchWorker("/api/contributors");
		const getAfterData = (await getAfterDelete.json()) as { contributors: TestContributor[] };
		expect(getAfterData.contributors.length).toBe(0);
	});
});
