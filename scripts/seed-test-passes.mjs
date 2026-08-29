/*
 * Twenty test passes against a capacity of fifteen, for trying the door
 * before the door exists.
 *
 *   node scripts/seed-test-passes.mjs
 *
 * Writes .test-passes/seed.sql and .test-passes/passes.json, applies the
 * SQL to the LOCAL D1, and leaves the json for make-entry-qr.mjs.
 *
 * Local only, and it refuses to touch the remote database. The real
 * gate is seeded at the real capacity and a stray --remote here would
 * quietly cap the actual auditorium at fifteen people.
 *
 * Ten reserved and ten registered against fifteen seats is not an
 * arbitrary mix. Reserved passes hold their seats, so general admission
 * is 15 - 10 = 5: five of the ten registered get in and five are
 * refused, and all ten reserved get in, filling the room to exactly
 * fifteen. Every branch of the claim is reachable with these twenty.
 */

import { execFileSync } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { randomBytes } from 'node:crypto';

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const workerDir = path.join(projectRoot, 'osc-events-worker');
const outDir = path.join(projectRoot, '.test-passes');

mkdirSync(outDir, { recursive: true });

const CAPACITY = 15;
const RESERVED = 10;
const REGISTERED = 10;

/* Fixed, so re-running the fixture reuses one event rather than piling
   up a new one per run. Obviously a fixture at a glance. */
const EVENT_ID = 'local-fixture-gittyup26';

/* The same shape the real generator will mint: 128 bits, hex. */
const token = () => randomBytes(16).toString('hex');

const quote = (value) => `'${String(value).replace(/'/g, "''")}'`;

const passes = [];

for (let n = 1; n <= RESERVED; n += 1) {
	passes.push({
		token: token(),
		kind: 'reserved',
		name: `Test Reserved ${n}`,
		email: `test.reserved${n}@vitapstudent.ac.in`,
		regNo: `22BCE9${String(n).padStart(3, '0')}`,
		seatId: `R3-S${n}`,
	});
}

for (let n = 1; n <= REGISTERED; n += 1) {
	passes.push({
		token: token(),
		kind: 'registered',
		name: `Test Registered ${n}`,
		email: `test.registered${n}@vitapstudent.ac.in`,
		regNo: `22BCE8${String(n).padStart(3, '0')}`,
		seatId: null,
	});
}

/*
 * Five scanning phones. Their tokens are printed once here and stored
 * only as a digest, so this output is the only place they exist in the
 * clear. For a local test that is fine; the real ones are minted the
 * same way and handed over in person.
 */
const devices = Array.from({ length: 5 }, (_, i) => ({
	id: `queue-${i + 1}`,
	label: `Queue ${i + 1}`,
	token: token(),
}));

const lines = [
	'-- Local test fixture. Never run this against the remote database.',
	'',
	"DELETE FROM entry_events;",
	"DELETE FROM entry_scans;",
	"DELETE FROM scanner_sessions;",
	"DELETE FROM scanner_devices;",
	"DELETE FROM entry_passes;",
	'',
	'-- Self-contained: a fresh local database has no events at all, and',
	'-- every insert below selects the event id, so without this they all',
	'-- quietly insert nothing and the fixture looks like it worked.',
	'INSERT OR IGNORE INTO events (',
	'  id, slug, title, event_date, event_end_at, is_open,',
	'  archive_status, registration_type, min_team_size, max_team_size, venue',
	')',
	`VALUES (${quote(EVENT_ID)}, 'gittyup26', 'GITTY UP 26', '2026-09-01', NULL, 1,`,
	"        'pending', 'solo', 1, 1, 'AB-2 Auditorium');",
	'',
	`INSERT OR IGNORE INTO entry_gate (event_id, capacity)`,
	`  SELECT id, ${CAPACITY} FROM events WHERE slug = 'gittyup26';`,
	'',
	`UPDATE entry_gate SET capacity = ${CAPACITY}, is_open = 1`,
	"  WHERE event_id = (SELECT id FROM events WHERE slug = 'gittyup26');",
	'',
];

for (const p of passes) {
	lines.push(
		'INSERT INTO entry_passes (token, event_id, kind, name, email, college_registration_number, seat_id)',
		`  SELECT ${quote(p.token)}, id, ${quote(p.kind)}, ${quote(p.name)}, ${quote(p.email)}, ${quote(p.regNo)}, ${p.seatId ? quote(p.seatId) : 'NULL'}`,
		"  FROM events WHERE slug = 'gittyup26';",
	);
}

lines.push('');

/*
 * Device tokens are stored as HMAC under the pepper, the same way the
 * Worker reads them. Without the pepper the digests would be wrong and
 * every sign-in would fail with no clue why, so it is required rather
 * than defaulted.
 */
const pepper = process.env.ADMIN_HANDLE_PEPPER;

if (!pepper) {
	console.error('Set ADMIN_HANDLE_PEPPER to the same value the local Worker uses.');
	console.error('  ADMIN_HANDLE_PEPPER=dev-pepper node scripts/seed-test-passes.mjs');
	process.exit(1);
}

const digest = async (value) => {
	const key = await crypto.subtle.importKey(
		'raw',
		new TextEncoder().encode(pepper),
		{ name: 'HMAC', hash: 'SHA-256' },
		false,
		['sign'],
	);

	const sig = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(value.trim()));

	return [...new Uint8Array(sig)].map((b) => b.toString(16).padStart(2, '0')).join('');
};

for (const d of devices) {
	lines.push(
		'INSERT INTO scanner_devices (id, event_id, label, token_hash)',
		`  SELECT ${quote(d.id)}, id, ${quote(d.label)}, ${quote(await digest(d.token))}`,
		"  FROM events WHERE slug = 'gittyup26';",
	);
}

const sqlFile = path.join(outDir, 'seed.sql');

writeFileSync(sqlFile, lines.join('\n') + '\n', 'utf8');

writeFileSync(
	path.join(outDir, 'passes.json'),
	JSON.stringify(passes, null, 2),
	'utf8',
);

writeFileSync(
	path.join(outDir, 'devices.json'),
	JSON.stringify(devices, null, 2),
	'utf8',
);

console.log(`${passes.length} passes, ${devices.length} devices, capacity ${CAPACITY}\n`);

execFileSync(
	'npx',
	['wrangler', 'd1', 'execute', 'osc-events-db', '--local', '--file', sqlFile],
	{ cwd: workerDir, stdio: 'inherit', shell: true },
);

console.log(`\nreserved   ${RESERVED}  gold`);
console.log(`registered ${REGISTERED}  black`);
console.log(`capacity   ${CAPACITY}  so general admission is ${CAPACITY - RESERVED}`);
console.log(`\nExpected: all ${RESERVED} reserved in, ${CAPACITY - RESERVED} registered in, ${REGISTERED - (CAPACITY - RESERVED)} refused as full.`);
console.log('\nDevice tokens (the only place these appear in the clear):');
devices.forEach((d) => console.log(`  ${d.id}  ${d.token}`));
