import { spawn } from 'node:child_process';
import { resolve } from 'node:path';
import { ensureSetup } from './setup.ts';
const config = await ensureSetup();
const env = { ...config, ...process.env };
const port = Number(env.PORT || 3001);
console.log(`Starting SKYBRIDGE. State=${env.STATE_BACKEND}; agents=${env.INTEGRATION_MODE}. Fixture means rehearsal, not live integration.`);
const child = spawn(process.execPath, ['run', resolve('server/index.ts')], { env, stdio: 'inherit', windowsHide: true });
function open(url: string) {
  const command = process.platform === 'win32' ? 'cmd.exe' : process.platform === 'darwin' ? 'open' : 'xdg-open';
  const args = process.platform === 'win32' ? ['/d', '/s', '/c', `start "" "${url}"`] : [url];
  const browser = spawn(command, args, { stdio: 'ignore', windowsHide: true }); browser.on('error', () => {});
}
let ready = false;
for (let n = 0; n < 240; n++) {
  if (child.exitCode !== null) break;
  try { ready = (await fetch(`http://127.0.0.1:${port}/api/health`)).ok; if (ready) break; } catch {}
  await new Promise(r => setTimeout(r, 500));
}
if (ready) {
  open(`http://127.0.0.1:${port}/#role=dispatcher&token=${encodeURIComponent(env.DEMO_DISPATCHER_TOKEN!)}`);
  console.log(`Dashboard ready at http://127.0.0.1:${port}. For the second role open .data/access.html. Keep this window open.`);
} else console.error('Server did not become ready. Check the error above; no integration was silently substituted.');
process.on('SIGINT', () => child.kill());
child.on('exit', code => process.exit(code ?? 1));
