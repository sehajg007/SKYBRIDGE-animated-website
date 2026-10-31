import 'dotenv/config';
import express, { type Request, type Response } from 'express';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { existsSync } from 'node:fs';
import { randomUUID } from 'node:crypto';
import { z } from 'zod';
import type { Command, RoomState } from '../shared/domain.ts';
import { feasibility } from '../shared/domain.ts';
import { authenticate, requireRole, sessionFor } from './auth.ts';
import { openStore } from './integrations/terse.ts';
import { openPlanningIntegration } from './integrations/planning.ts';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const store = await openStore();
const planning = await openPlanningIntegration();
const health = { mode: planning.kind, terse: { status: store.kind === 'terse' ? 'connected' : 'fixture', detail: store.kind === 'terse' ? 'Authoritative Terse DispatchRoom connected' : 'Local development file; NOT Terse' }, ...planning.health };
const clients = new Map<Response, ReturnType<typeof sessionFor>>();
const runs = new Set<string>();
let simulationTimer: ReturnType<typeof setInterval> | undefined;
let advancing = false;
const app = express();
app.disable('x-powered-by');
app.set('trust proxy', 1);
app.use(express.json({ limit: '24kb' }));
app.use((req, res, next) => {
  res.set({ 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff', 'Referrer-Policy': 'no-referrer', 'Content-Security-Policy': "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; connect-src 'self'; frame-ancestors 'none'" });
  if (req.method === 'POST') {
    const origin = req.get('origin');
    const expected = `${req.protocol}://${req.get('host')}`;
    if (origin && origin !== expected) return res.status(403).json({ error: 'Cross-origin mutation rejected' });
    if (!req.is('application/json')) return res.status(415).json({ error: 'JSON body required' });
  }
  next();
});
function publicSession(session: ReturnType<typeof sessionFor>) { return session ? { role: session.role } : null; }
function assessments(state: RoomState) { return Object.fromEntries(state.requests.map(request => [request.id, feasibility(state, request)])); }
async function packet(session?: ReturnType<typeof sessionFor>) { const state = await store.getSnapshot(); return { state, health, assessments: assessments(state), session: publicSession(session), simulationRunning: !!simulationTimer }; }
async function broadcast() {
  const state = await store.getSnapshot();
  for (const [res, session] of clients) {
    if (!session || session.expires < Date.now()) { res.end(); clients.delete(res); continue; }
    res.write(`data: ${JSON.stringify({ state, health, assessments: assessments(state), session: publicSession(session), simulationRunning: !!simulationTimer })}\n\n`);
  }
}
async function execute(command: Command) { const state = await store.execute(command); await broadcast(); return state; }
async function plan(requestId: string, runId: string, epoch: string) {
  const key = `${epoch}:${requestId}:${runId}`;
  if (runs.has(key)) return;
  runs.add(key); const started = performance.now();
  try {
    const state = await store.getSnapshot();
    if (state.epoch !== epoch) return;
    const result = await planning.plan(state, requestId, runId, async message => {
      await execute({ type: 'appendAudit', epoch, requestId, runId, commandId: randomUUID(), entry: { by: message.from, text: message.text, from: message.from, to: message.to, serviceMessageId: message.serviceMessageId, kind: message.kind } });
    });
    await execute({ type: 'submitProposal', epoch, requestId, runId, baseWorldVersion: state.worldVersion, commandId: randomUUID(), proposal: { id: randomUUID(), droneId: result.droneId, explanation: result.explanation, messages: result.messages, planningLatencyMs: Math.round(performance.now() - started) } });
  } catch (error) {
    const state = await store.getSnapshot();
    const request = state.requests.find(r => r.id === requestId);
    if (state.epoch === epoch && request?.runId === runId && ['planning', 'replanning'].includes(request.status)) {
      await execute({ type: 'failPlanning', epoch, requestId, runId, commandId: randomUUID(), reason: error instanceof Error ? error.message.slice(0, 2000) : 'Planning service failed. No dispatch made.' });
    }
  } finally { runs.delete(key); }
}
function stopSimulation() { if (simulationTimer) clearInterval(simulationTimer); simulationTimer = undefined; }
async function tick() {
  if (advancing) return; advancing = true;
  try {
    const state = await store.getSnapshot();
    if (!state.requests.some(r => r.status === 'in-flight')) { stopSimulation(); await broadcast(); return; }
    await execute({ type: 'advanceSimulation', epoch: state.epoch, minutes: 1, commandId: randomUUID() });
  } catch { stopSimulation(); await broadcast(); } finally { advancing = false; }
}
const base = { commandId: z.string().min(1).max(128), epoch: z.string().min(1).max(128) };
const commands = z.discriminatedUnion('type', [
  z.object({ ...base, type: z.literal('createRequest'), input: z.object({ id: z.string().min(1).max(128), packageType: z.enum(['supply-kit', 'diagnostic-kit']), quantity: z.number().int().min(1).max(20), destination: z.enum(['north', 'east']), deadlineMinutes: z.number().int().min(1).max(120) }).strict() }).strict(),
  z.object({ ...base, type: z.literal('startPlanning'), requestId: z.string(), runId: z.string().min(1).max(128) }).strict(),
  z.object({ ...base, type: z.literal('groundDrone'), droneId: z.enum(['kestrel', 'swift', 'finch']) }).strict(),
  z.object({ ...base, type: z.literal('approveAndDispatch'), proposalId: z.string(), proposalVersion: z.number().int(), expectedWorldVersion: z.number().int(), human: z.string().trim().min(2).max(80), attested: z.literal(true) }).strict(),
  z.object({ ...base, type: z.literal('advanceSimulation'), minutes: z.number().int().min(1).max(60).optional() }).strict(),
  z.object({ type: z.literal('resetScenario'), commandId: z.string().min(1).max(128), epoch: z.string().optional() }).strict(),
  z.object({ ...base, type: z.literal('runSimulation') }).strict(),
]);
app.get('/api/health', (_req, res) => res.json({ health }));
app.post('/api/session', (req, res) => {
  try {
    const { role, token } = z.object({ role: z.enum(['requester', 'dispatcher']), token: z.string().min(1).max(256) }).strict().parse(req.body);
    const id = authenticate(role, token, req);
    res.cookie('skybridge_session', id, { httpOnly: true, sameSite: 'strict', secure: req.secure, maxAge: 8 * 3600000, path: '/' });
    res.json({ session: { role } });
  } catch { res.status(401).json({ error: 'Invalid role or demo access code.' }); }
});
app.get('/api/state', async (req, res) => {
  try { requireRole(req); res.json(await packet(sessionFor(req))); } catch (e) { res.status(401).json({ error: (e as Error).message, health, session: null }); }
});
app.get('/api/events', async (req, res) => {
  try { const session = requireRole(req); res.set({ 'Content-Type': 'text/event-stream', Connection: 'keep-alive', 'X-Accel-Buffering': 'no' }); res.flushHeaders(); clients.set(res, session); res.write(`data: ${JSON.stringify(await packet(session))}\n\n`);
    const heartbeat = setInterval(() => res.write(': heartbeat\n\n'), 15000);
    req.on('close', () => { clearInterval(heartbeat); clients.delete(res); });
  } catch (e) { res.status(401).json({ error: (e as Error).message }); }
});
app.post('/api/commands', async (req, res) => {
  try {
    const command = commands.parse(req.body);
    const session = requireRole(req, command.type !== 'createRequest');
    if (command.type === 'runSimulation') {
      const state = await store.getSnapshot();
      if (command.epoch !== state.epoch || !state.requests.some(r => r.status === 'in-flight')) throw new Error('No current simulated flight to run');
      if (!simulationTimer) simulationTimer = setInterval(() => { void tick(); }, 700);
      await broadcast();
    } else {
      if (command.type === 'resetScenario') stopSimulation();
      if (command.type === 'startPlanning' && [...runs].some(key => key.startsWith(`${command.epoch}:${command.requestId}:`))) throw new Error('Planning is already running for this request. Wait for its result before retrying.');
      const before = await store.getSnapshot();
      const duplicate = before.processedCommands.includes(command.commandId);
      const state = await execute(command as Command);
      if (!duplicate && command.type === 'createRequest') {
        const runId = randomUUID();
        await execute({ type: 'startPlanning', epoch: state.epoch, requestId: command.input.id, runId, commandId: randomUUID() });
        void plan(command.input.id, runId, state.epoch);
      } else if (!duplicate && command.type === 'startPlanning') void plan(command.requestId, command.runId, command.epoch);
    }
    res.json(await packet(session));
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Command failed';
    const forbidden = /permission required|Join the room/.test(message);
    if (req.body?.type === 'approveAndDispatch' && sessionFor(req)?.role === 'dispatcher') {
      try {
        const state = await store.getSnapshot();
        if (req.body.epoch === state.epoch) await execute({ type: 'appendAudit', epoch: state.epoch, commandId: randomUUID(), entry: { by: 'dispatcher', kind: 'approval-rejected', text: `Approval rejected: ${message.slice(0, 1000)}. No resources allocated.` } });
      } catch { /* Never obscure the original rejected approval. */ }
    }
    res.status(forbidden ? 403 : 409).json({ error: message });
  }
});
const web = resolve(root, 'web/dist');
app.use(express.static(web, { etag: true }));
app.get('/{*path}', (_req, res) => existsSync(resolve(web, 'index.html')) ? res.sendFile(resolve(web, 'index.html')) : res.status(503).send('Dashboard has not been built. Run npm run build.'));
app.use((error: any, _req: Request, res: Response, _next: unknown) => res.status(400).json({ error: error.type === 'entity.too.large' ? 'Request is too large' : 'Malformed request' }));
const listener = app.listen(Number(process.env.PORT ?? 3001), process.env.HOST ?? '127.0.0.1', () => console.log(`SKYBRIDGE ready: http://127.0.0.1:${process.env.PORT ?? 3001} | state=${store.kind} | agents=${planning.kind}`));
async function shutdown() { stopSimulation(); for (const res of clients.keys()) res.end(); listener.close(); await planning.close(); await store.close(); process.exit(0); }
process.on('SIGINT', () => void shutdown()); process.on('SIGTERM', () => void shutdown());
