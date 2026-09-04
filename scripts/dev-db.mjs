#!/usr/bin/env node
/**
 * Dockerless development database launcher.
 *
 * Boots a throwaway PostgreSQL 18 instance via embedded-postgres so the API can
 * run in environments without Docker (CI, sandboxes, quick demos).
 *
 * Credentials mirror docker-compose.yml:
 *   db=talentshowcase  user=talentshowcase  password=talentshowcase  port=5432
 *
 * Usage:  node scripts/dev-db.mjs        (starts and blocks until Ctrl+C)
 *         node scripts/dev-db.mjs --once (starts, waits for readiness, exits)
 */
import EmbeddedPostgres from 'embedded-postgres';
import fs from 'node:fs';
import path from 'node:path';
import url from 'node:url';

const __dirname = path.dirname(url.fileURLToPath(import.meta.url));
const dataDir = path.resolve(__dirname, '../.pgdata');
const once = process.argv.includes('--once');

// Some hosts lack the ICU 60 runtime the bundled postgres binaries link
// against. We vendor those libs in .pglibs and inject them via LD_LIBRARY_PATH
// before any postgres process is spawned.
const vendorLibs = path.resolve(__dirname, '../.pglibs/usr/lib/x86_64-linux-gnu');
if (fs.existsSync(vendorLibs)) {
  process.env.LD_LIBRARY_PATH = process.env.LD_LIBRARY_PATH
    ? `${vendorLibs}:${process.env.LD_LIBRARY_PATH}`
    : vendorLibs;
}

const PG_OPTIONS = {
  database: 'talentshowcase',
  user: 'talentshowcase',
  password: 'talentshowcase',
  port: 5432,
  persistent: !once,
  onShutdown: (code) => process.exit(code ?? 0),
  onError: (msgOrErr) => console.error('[dev-db] error:', msgOrErr),
  pgControl: {},
  auth: { method: 'trust' },
  initdbArgs: ['--encoding=UTF-8', '--locale=C'],
};

const pg = new EmbeddedPostgres({
  ...PG_OPTIONS,
  databaseDir: dataDir,
});

async function main() {
  if (!fs.existsSync(dataDir)) {
    console.log('[dev-db] initialising cluster at', dataDir);
    await pg.initialise();
  }
  console.log('[dev-db] starting postgres on port 5432 ...');
  await pg.start();
  try {
    await pg.createDatabase('talentshowcase');
    console.log('[dev-db] created database "talentshowcase"');
  } catch {
    console.log('[dev-db] database "talentshowcase" already exists');
  }
  console.log('[dev-db] ready: postgres://talentshowcase:talentshowcase@localhost:5432/talentshowcase');
  if (once) {
    await pg.stop();
    process.exit(0);
  }
}

let stopping = false;
async function shutdown(signal) {
  if (stopping) return;
  stopping = true;
  console.log(`\n[dev-db] ${signal} received, stopping postgres ...`);
  try {
    await pg.stop();
  } catch {
    /* already stopped */
  }
  process.exit(0);
}
process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));

main().catch((err) => {
  console.error('[dev-db] failed:', err.message ?? err);
  process.exit(1);
});
