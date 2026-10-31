import { spawn } from 'node:child_process';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const mode = process.argv[2];
if (mode !== 'dev' && mode !== 'deploy') throw new Error('Expected actor CLI mode dev or deploy');
const args = mode === 'dev' ? ['actor', 'dev'] : ['deploy'];
const child = spawn(process.execPath, [resolve(root, 'node_modules/terse-cli/dist/index.js'), ...args, ...process.argv.slice(3)], { cwd: resolve(root, 'actor'), env: process.env, stdio: 'inherit' });
process.on('SIGINT', () => child.kill('SIGINT'));
process.on('SIGTERM', () => child.kill('SIGTERM'));
child.on('error', error => { console.error('Could not start the Terse CLI:', error.message); process.exit(1); });
child.on('exit', code => { process.exit(code ?? 1); });
