import { AgentRelay, type RelayAgentClient, type RelayMessage } from '@agent-relay/sdk';
import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { z } from 'zod';

export type WorkerName = 'supply' | 'fleet';
export type WireEnvelope = { protocol: 'skybridge-v1'; roomId: string; epoch: string; requestId: string; runId: string; baseWorldVersion: number; from: WorkerName; to: WorkerName; kind: string; payload: unknown };
const envelopeSchema = z.object({ protocol: z.literal('skybridge-v1'), roomId: z.string(), epoch: z.string(), requestId: z.string(), runId: z.string(), baseWorldVersion: z.number().int().nonnegative(), from: z.enum(['supply', 'fleet']), to: z.enum(['supply', 'fleet']), kind: z.string(), payload: z.unknown() }).strict();
export type RelayReceipt = { messageId: string; from: WorkerName; to: WorkerName; envelope: WireEnvelope };
type Saved = { workspaceKey?: string; fingerprint?: string; supplyToken?: string; fleetToken?: string };

export async function provisionRelay() {
  const directory = resolve(process.env.DATA_DIR || '.data'); await mkdir(directory, { recursive: true });
  const file = resolve(directory, 'relay-credentials.json');
  let saved: Saved = {};
  try { saved = JSON.parse(await readFile(file, 'utf8')); } catch (error: any) { if (error.code !== 'ENOENT') throw error; }
  const key = process.env.RELAY_WORKSPACE_KEY || saved.workspaceKey;
  const retryPolicy = { maxRetries: 3, backoffMs: 1000, backoffMultiplier: 2, jitter: true, retryOn: [429, 500, 502, 503, 504] };
  let relay: AgentRelay;
  if (key) relay = new AgentRelay({ workspaceKey: key, baseUrl: process.env.RELAY_BASE_URL || undefined, retryPolicy, onError: () => {} });
  else if (process.env.RELAY_AUTO_CREATE === 'true') {
    relay = await AgentRelay.createWorkspace({ name: `skybridge-${crypto.randomUUID().slice(0, 8)}`, baseUrl: process.env.RELAY_BASE_URL || undefined, retryPolicy });
    saved = { workspaceKey: relay.workspaceKey };
    await writeFile(file, JSON.stringify(saved), { mode: 0o600 });
  } else throw new Error('RELAY_WORKSPACE_KEY is missing. Set it locally, or enable RELAY_AUTO_CREATE=true for a disposable demo workspace.');
  const fingerprint = createHash('sha256').update(key || relay.workspaceKey || '').digest('hex');
  if (saved.fingerprint && saved.fingerprint !== fingerprint) saved = { ...(process.env.RELAY_WORKSPACE_KEY ? {} : { workspaceKey: relay.workspaceKey }) };
  const agents = {} as Record<WorkerName, RelayAgentClient>;
  for (const name of ['supply', 'fleet'] as const) {
    const token = process.env[name === 'supply' ? 'SUPPLY_AGENT_TOKEN' : 'FLEET_AGENT_TOKEN'] || saved[`${name}Token`];
    agents[name] = token ? await relay.workspace.reconnect({ apiToken: token }) : await relay.workspace.register({ name: `skybridge-${name}`, type: 'agent' });
    if (!agents[name].token) throw new Error(`Relay did not provide the ${name} agent token`);
    saved[`${name}Token`] = agents[name].token;
    saved.fingerprint = fingerprint;
    await writeFile(file, JSON.stringify(saved), { mode: 0o600 });
  }
  return { relay, agents };
}

/** Worker callbacks run only after a real SDK event or a real Relay history read. */
export async function openRelayTransport() {
  const { relay, agents } = await provisionRelay();
  const handlers = new Map<string, (receipt: RelayReceipt) => Promise<void>>();
  const seen = new Set<string>();
  const conversations = new Set<string>();
  let closed = false;
  let polling = false;
  async function receive(message: RelayMessage) {
    if (closed || seen.has(message.messageId)) return;
    let parsed: z.infer<typeof envelopeSchema>;
    try { parsed = envelopeSchema.parse(JSON.parse(message.text)); } catch { return; }
    const sender = agents[parsed.from];
    if (message.from.id !== sender.id && message.from.name !== sender.name) return;
    if (parsed.from === parsed.to) return;
    const handler = handlers.get(parsed.runId); if (!handler) return;
    seen.add(message.messageId);
    if (seen.size > 3000) seen.delete(seen.values().next().value!);
    try { await handler({ messageId: message.messageId, from: parsed.from, to: parsed.to, envelope: parsed }); }
    catch (error) { seen.delete(message.messageId); throw error; }
  }
  const unsubscribe = relay.addListener('dm.received', async ({ message }) => { await receive(message); });
  async function poll() {
    if (polling) return; polling = true;
    while (!closed && handlers.size) {
      await new Promise(resolve => setTimeout(resolve, 1500));
      for (const conversationId of conversations) {
        if (closed || !handlers.size) break;
        try { for (const message of await agents.supply.messages.listDirect({ conversationId, limit: 50 })) await receive(message); }
        catch { /* An absent response remains a timed-out failure, never a fixture response. */ }
      }
    }
    polling = false;
  }
  async function send(envelope: WireEnvelope) {
    const target = agents[envelope.to].handle.replace(/^@/, '');
    const message = await agents[envelope.from].sendMessage({ to: `@${target}`, text: JSON.stringify(envelope), idempotencyKey: `${envelope.runId}:${envelope.kind}:${envelope.from}` });
    if (message.conversationId) conversations.add(message.conversationId);
    if (message.target?.kind === 'dm' && typeof message.target.conversationId === 'string') conversations.add(message.target.conversationId);
    return message.messageId;
  }
  async function probe() {
    const runId = crypto.randomUUID();
    let timer: ReturnType<typeof setTimeout>;
    const wait = new Promise<{ requestId: string; responseId: string }>((resolve, reject) => {
      let requestId = '';
      handlers.set(runId, async receipt => {
        if (receipt.envelope.kind === 'probe' && receipt.from === 'supply' && receipt.to === 'fleet') {
          requestId = receipt.messageId;
          await send({ ...receipt.envelope, from: 'fleet', to: 'supply', kind: 'probe.reply', payload: { connected: true } });
        } else if (receipt.envelope.kind === 'probe.reply' && receipt.from === 'fleet' && receipt.to === 'supply') resolve({ requestId, responseId: receipt.messageId });
      });
      timer = setTimeout(() => reject(new Error('Relay receive/reply smoke test timed out. No live connectivity is claimed.')), Number(process.env.RELAY_TIMEOUT_MS || 60000));
    });
    void wait.catch(() => {});
    try {
      await send({ protocol: 'skybridge-v1', roomId: 'probe', epoch: 'probe', requestId: 'probe', runId, baseWorldVersion: 0, from: 'supply', to: 'fleet', kind: 'probe', payload: {} });
      void poll(); return await wait;
    } finally { clearTimeout(timer!); handlers.delete(runId); }
  }
  return { send, probe, handle(runId: string, handler: (receipt: RelayReceipt) => Promise<void>) { handlers.set(runId, handler); void poll(); return () => handlers.delete(runId); }, async close() { closed = true; handlers.clear(); unsubscribe(); await relay.events.disconnect(); } };
}
