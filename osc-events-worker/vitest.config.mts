import path from "node:path";
import { fileURLToPath } from "node:url";
import { cloudflareTest, readD1Migrations } from "@cloudflare/vitest-pool-workers";
import { defineConfig } from "vitest/config";

const rootDir = path.dirname(fileURLToPath(import.meta.url));

/*
 * Migrations are read in Node and handed to the tests through a
 * binding, because `applyD1Migrations()` runs inside the Worker.
 */
const migrations = await readD1Migrations(path.join(rootDir, "migrations"));

export default defineConfig({
	plugins: [
		cloudflareTest({
			wrangler: { configPath: "./wrangler.jsonc" },
			miniflare: {
				bindings: { TEST_MIGRATIONS: migrations },
			},
		}),
	],
	test: {
		setupFiles: ["./test/apply-migrations.ts"],
	},
});
