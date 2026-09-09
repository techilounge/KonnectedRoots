const {readdirSync} = require('node:fs');
const {join} = require('node:path');
const {spawnSync} = require('node:child_process');

// Node 20 on Windows does not expand shell globs passed to --test.
const files = readdirSync(__dirname).filter(name => name.endsWith('.test.cjs'));
if (!files.length) throw new Error('No Functions regression tests found');
const result = spawnSync(process.execPath, ['--test', ...files.map(name => join(__dirname, name))], {stdio: 'inherit'});
if (result.error) throw result.error;
process.exitCode = result.status ?? 1;
