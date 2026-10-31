import { readFile, writeFile } from 'node:fs/promises';
import { spawn } from 'node:child_process';
import { parse } from 'dotenv';
import { ApiRoutes, buildRoute } from 'terse-types';

async function run(script: string, env: NodeJS.ProcessEnv) {
  return await new Promise<number>((resolve, reject) => {
    const child = spawn(process.execPath, ['run', script], { env, stdio: 'inherit', windowsHide: true });
    child.on('error', reject);
    child.on('exit', code => resolve(code ?? 1));
    process.once('SIGINT', () => child.kill());
  });
}

try {
  const project = JSON.parse(await readFile('actor/terse.config.json', 'utf8'));
  let text = await readFile('.env', 'utf8');
  const current = parse(text);
  // Use the same account already authenticated by the deployment CLI.
  const { getStoredApiKey } = await import('../../node_modules/terse-cli/dist/userConfig.js');
  const key = current.TERSE_API_KEY || getStoredApiKey();
  if (!key) throw new Error('Sign in with Terse first, or save TERSE_API_KEY in .env.');
  const endpoint = current.TERSE_ACTOR_URL || new URL(buildRoute(ApiRoutes.SDK.ACTOR_CONNECT, { projectId: project.projectId }), process.env.TERSE_BACKEND_URL || 'https://api.useterse.ai').href;
  const settings = { STATE_BACKEND: 'terse', TERSE_PROJECT_ID: project.projectId, TERSE_ACTOR_URL: endpoint, TERSE_API_KEY: key, PORT: current.PORT === '3001' ? '3002' : current.PORT || '3002' };
  for (const [name, value] of Object.entries(settings)) {
    const pattern = new RegExp(`^${name}=.*$`, 'm');
    text = pattern.test(text) ? text.replace(pattern, () => `${name}=${value}`) : `${text}\n${name}=${value}\n`;
  }
  await writeFile('.env', text, { mode: 0o600 });
  const env = { ...process.env, ...parse(text) };
  console.log('Configured hosted DispatchRoom. Credentials remain local. Testing real persistence…');
  if (await run('server/scripts/smoke-terse.ts', env) !== 0) throw new Error('Terse verification failed; app was not launched.');
  console.log('Terse verified. Starting the dashboard on its configured port. Coordinator mode remains unchanged.');
  process.exitCode = await run('server/scripts/launch.ts', env);
} catch (error) {
  console.error(error instanceof Error ? error.message : 'Terse connection failed');
  process.exitCode = 1;
}
