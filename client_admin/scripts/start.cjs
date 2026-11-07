/* global __dirname */
const { spawnSync } = require('node:child_process');
const path = require('node:path');
const sync = spawnSync(process.execPath, [path.join(__dirname, 'sync-app-preview.cjs')], { stdio: 'inherit' });
if (sync.status !== 0) process.exit(sync.status || 1);
const expo = path.join(path.dirname(require.resolve('expo/package.json')), 'bin/cli');
const run = spawnSync(process.execPath, [expo, 'start', ...process.argv.slice(2)], { stdio: 'inherit' });
if (run.error) console.error(run.error.message);
process.exit(run.status ?? 1);
