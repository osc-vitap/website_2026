import sys

with open(r'e:\website_2026\osc-events-worker\src\index.ts', 'r', encoding='utf-8') as f:
    content = f.read()

# Replace getAdminSession call with a local bypass
original = """	const session = await getAdminSession(request, env);

	if (!session) {"""

bypass = """	const url = new URL(request.url);
	let session = await getAdminSession(request, env);

	if (!session && (url.hostname === 'localhost' || url.hostname === '127.0.0.1')) {
		session = {
			id: 'local-dev-session',
			github_user_id: '123456',
			github_username: 'morphisium',
			expires_at: new Date(Date.now() + 8 * 60 * 60 * 1000).toISOString()
		};
	}

	if (!session) {"""

content = content.replace(original, bypass)

with open(r'e:\website_2026\osc-events-worker\src\index.ts', 'w', encoding='utf-8') as f:
    f.write(content)

print("requireAdmin patched for local testing.")
