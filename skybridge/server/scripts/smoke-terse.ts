import 'dotenv/config';
import { openStore } from '../integrations/terse.js';
let store: Awaited<ReturnType<typeof openStore>> | undefined;
try {
  if (process.env.STATE_BACKEND === 'fixture') throw new Error('smoke:terse refuses fixture mode. Set STATE_BACKEND=terse and the real actor endpoint.');
  store = await openStore();
  const state = await store.getSnapshot();
  const commandId = crypto.randomUUID();
  const updated = await store.execute({ type: 'appendAudit', epoch: state.epoch, commandId, entry: { by: 'smoke-test', text: `Terse connectivity write ${commandId}` } });
  await store.close();
  store = await openStore();
  const restored = await store.getSnapshot();
  if (!restored.processedCommands.includes(commandId) || !restored.audit.some(entry => entry.text.includes(commandId))) throw new Error('Terse read-after-reconnect did not preserve the connectivity write');
  console.log(JSON.stringify({ service: 'Terse', actor: 'DispatchRoom', room: restored.roomId, revision: updated.revision, writeReadReconnect: 'passed', restartPersistence: 'not tested by this smoke test; restart the actor runtime separately' }));
} catch (error) { console.error('Terse smoke test FAILED:', error instanceof Error ? error.message.replace(/sk-[A-Za-z0-9_-]+/g, '[redacted]') : 'Unknown error'); process.exitCode = 1; }
finally { await store?.close(); }
