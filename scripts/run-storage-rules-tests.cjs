const fs = require('node:fs');
const path = require('node:path');
const net = require('node:net');
const {spawn} = require('node:child_process');

const root = path.resolve(__dirname, '..');
const workdir = path.join(root, '.storage-rules-test');
const ports = [18380, 18399, 18440, 18450, 18451];

async function main() {
  // Never reuse or stop existing billing emulators. Refuse occupied test ports.
  for (const port of ports) await new Promise((resolve, reject) => {
    const server = net.createServer();
    server.once('error', reject);
    server.listen(port, '127.0.0.1', () => server.close(resolve));
  });
  const cli = (process.env.PATH || '').split(path.delimiter).map(dir =>
    process.platform === 'win32' ? path.join(dir, 'node_modules/firebase-tools/lib/bin/firebase.js')
      : path.join(dir, 'firebase'),
  ).find(file => fs.existsSync(file));
  if (!cli) throw new Error('Install Firebase CLI separately; it is not a production dependency.');
  fs.mkdirSync(workdir, {recursive: true});
  const env = {...process.env, FIREBASE_CLI_DISABLE_UPDATE_CHECK: 'true'};
  if (process.platform === 'win32') {
    // Java 21's selector wakeup pipe fails with AF_UNIX on some Windows hosts.
    // A nonexistent socket directory makes Java fall back to TCP loopback.
    // This setting affects only the isolated emulator subprocess.
    const socketDir = path.join(workdir, 'disabled-unix-sockets');
    if (fs.existsSync(socketDir)) throw new Error('The test socket fallback path must not exist.');
    env.JAVA_TOOL_OPTIONS = `${env.JAVA_TOOL_OPTIONS || ''} -Djdk.net.unixdomain.tmpdir="${socketDir}"`;
  }
  const script = `"${process.execPath}" "${path.join(root, 'tests/storage/storage.rules.test.cjs')}"`;
  const child = spawn(process.execPath, [cli, 'emulators:exec', '--project', 'demo-konnectedroots-storage-rules',
    '--config', path.join(root, 'firebase.storage-rules-test.json'), '--only', 'firestore,storage', script],
  {cwd: workdir, env, stdio: 'inherit', windowsHide: true});
  child.once('error', error => {console.error(error.message); process.exitCode = 1;});
  child.once('exit', code => {process.exitCode = code ?? 1;});
}

main().catch(error => {console.error(error.message); process.exitCode = 1;});
