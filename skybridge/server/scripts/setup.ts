import { randomBytes } from 'node:crypto';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parse } from 'dotenv';
export async function ensureSetup() {
  let text: string;
  try { text = await readFile('.env', 'utf8'); } catch (error: any) { if (error.code !== 'ENOENT') throw error; text = await readFile('.env.example', 'utf8'); }
  let config = parse(text);
  for (const name of ['DEMO_REQUESTER_TOKEN', 'DEMO_DISPATCHER_TOKEN']) {
    if (!config[name]) {
      const value = randomBytes(24).toString('hex');
      text = new RegExp(`^${name}=.*$`, 'm').test(text) ? text.replace(new RegExp(`^${name}=.*$`, 'm'), `${name}=${value}`) : `${text}\n${name}=${value}\n`;
    }
  }
  await writeFile('.env', text, { mode: 0o600 }); config = parse(text);
  await mkdir('.data', { recursive: true });
  const base = `http://127.0.0.1:${Number(config.PORT || 3001)}`;
  const link = (role: string, token: string) => `${base}/#role=${role}&token=${encodeURIComponent(token)}`;
  await writeFile('.data/access.html', `<!doctype html><html><meta charset="utf-8"><title>SKYBRIDGE local access</title><style>body{font:18px system-ui;max-width:700px;margin:60px auto;padding:20px;color:#16324a}a{display:block;background:#e0f4ee;padding:20px;margin:20px 0;color:#006c5d;border-radius:12px}</style><h1>SKYBRIDGE local access</h1><p>Start the server, then open either role below. These private demo links contain role credentials. Do not share this file publicly.</p><a href="${link('dispatcher', config.DEMO_DISPATCHER_TOKEN!)}">Open Dispatcher — approve and disrupt</a><a href="${link('requester', config.DEMO_REQUESTER_TOKEN!)}" target="_blank">Open Requester — submit delivery requests</a><p>Tokens are removed from the address bar immediately after joining. Restarting the server requires joining again.</p></html>`, { mode: 0o600 });
  return config;
}
if (resolve(process.argv[1] || '') === fileURLToPath(import.meta.url)) {
  await ensureSetup(); console.log('SKYBRIDGE setup complete. Local .env and private .data/access.html are ready. No secrets printed.');
}
