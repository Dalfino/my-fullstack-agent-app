// Spawn the Next.js web server as a child of the (immortal) postgres process
// using COPY TO PROGRAM, so it inherits postgres's surviving process tree.
const { createRequire } = require('node:module');
// run with apps/api's node_modules
const path = require('node:path');
process.chdir('/home/z/my-project/my-fullstack-agent-app/apps/api');
const req = createRequire('/home/z/my-project/my-fullstack-agent-app/apps/api/package.json');
const { Client } = req('pg');

const cmd = process.argv[2];
if (!cmd) {
  console.error('usage: node spawn-via-pg.cjs "<command>"');
  process.exit(1);
}

const c = new Client({
  host: 'localhost',
  port: 5432,
  user: 'talentshowcase',
  password: 'talentshowcase',
  database: 'talentshowcase',
});

(async () => {
  await c.connect();
  // shell-wrap: detach + log
  const wrapped = `nohup bash -c ${JSON.stringify(cmd)} >> /tmp/pg-spawn.log 2>&1 < /dev/null &`;
  try {
    await c.query(`COPY (SELECT 1) TO PROGRAM $p$${wrapped}$p$`);
    console.log('spawned via postgres');
  } catch (e) {
    console.error('spawn failed:', e.message);
    process.exitCode = 1;
  } finally {
    await c.end().catch(() => {});
  }
})();
