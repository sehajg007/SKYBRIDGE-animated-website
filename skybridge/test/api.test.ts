import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawn, type ChildProcess } from 'node:child_process';
import { mkdir, mkdtemp, rm } from 'node:fs/promises';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { setTimeout as delay } from 'node:timers/promises';
import { once } from 'node:events';
import type { RoomState } from '../shared/domain';

test('actual API: secure role sessions, live events, disruption/replan, exact approval, simulation and restart', { timeout: 60000 }, async () => {
  const project = fileURLToPath(new URL('..', import.meta.url));
  const dataRoot = resolve(project, '.data'); await mkdir(dataRoot, { recursive: true });
  const directory = await mkdtemp(resolve(dataRoot, 'api-test-'));
  const base = 'http://127.0.0.1:3099';
  const env = { ...process.env, PORT: '3099', HOST: '127.0.0.1', ROOM_ID: 'api-fixture-room', DATA_DIR: directory,
    STATE_BACKEND: 'fixture', INTEGRATION_MODE: 'fixture',
    DEMO_REQUESTER_TOKEN: 'test-only-requester-code', DEMO_DISPATCHER_TOKEN: 'test-only-dispatcher-code',
    OPENAI_API_KEY: '', OPENAI_MODEL: '', RELAY_WORKSPACE_KEY: '', SUPPLY_AGENT_TOKEN: '', FLEET_AGENT_TOKEN: '', TERSE_API_KEY: '', TERSE_ACTOR_URL: '' };
  let child: ChildProcess;
  let output = '';
  const launch = () => {
    output = '';
    const process = spawn(globalThis.process.execPath, ['run', 'server/index.ts'], { cwd: project, env, windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'] });
    process.stdout?.on('data', chunk => { output = `${output}${chunk}`.slice(-8000); });
    process.stderr?.on('data', chunk => { output = `${output}${chunk}`.slice(-8000); });
    return process;
  };
  async function stop() {
    if (child.exitCode !== null || child.signalCode !== null) return;
    const exited = once(child, 'exit'); child.kill(); await exited;
  }
  async function ready() {
    for (let n = 0; n < 100; n++) {
      if (child.exitCode !== null || child.signalCode !== null) throw new Error(`Fixture server failed to start: ${output}`);
      try { const response = await fetch(`${base}/api/health`); if (response.ok) return await response.json() as any; } catch {}
      await delay(100);
    }
    throw new Error(`Fixture server did not become ready: ${output}`);
  }
  async function post(path: string, body: unknown, cookie?: string, role?: string) {
    return fetch(`${base}${path}`, { method: 'POST', headers: { 'Content-Type': 'application/json', ...(cookie ? { Cookie: cookie } : {}), ...(role ? { 'X-Skybridge-Role': role } : {}) }, body: JSON.stringify(body) });
  }
  async function login(role: 'requester' | 'dispatcher', existingCookie?: string) {
    const response = await post('/api/session', { role, token: role === 'requester' ? env.DEMO_REQUESTER_TOKEN : env.DEMO_DISPATCHER_TOKEN }, existingCookie);
    assert.equal(response.status, 200);
    const cookie = response.headers.get('set-cookie')!;
    assert.match(cookie, /HttpOnly/i); assert.match(cookie, /SameSite=Strict/i);
    return cookie.split(';')[0]!;
  }
  async function snapshot(cookie: string): Promise<RoomState> {
    const response = await fetch(`${base}/api/state`, { headers: { Cookie: cookie } });
    assert.equal(response.status, 200); return (await response.json() as any).state;
  }
  async function waitFor(cookie: string, predicate: (state: RoomState) => boolean, timeout = 20000) {
    const deadline = Date.now() + timeout;
    while (Date.now() < deadline) { const state = await snapshot(cookie); if (predicate(state)) return state; await delay(150); }
    throw new Error('Expected API state was not reached before timeout');
  }
  child = launch();
  try {
    const health = await ready(); assert.equal(health.health.mode, 'fixture'); assert.equal(health.health.terse.status, 'fixture');
    assert.equal((await fetch(`${base}/api/state`)).status, 401);
    assert.equal((await post('/api/session', { role: 'dispatcher', token: 'wrong-test-code' })).status, 401);
    const requester = await login('requester'); let dispatcher = await login('dispatcher');
    // Tabs in one browser share cookies. Signing into the second role must merge
    // authenticated grants rather than silently removing the first tab's access.
    const priorDispatcherCookie = await login('dispatcher');
    const sharedBrowserCookie = await login('requester', priorDispatcherCookie);
    for (const role of ['dispatcher', 'requester']) {
      const response = await fetch(`${base}/api/state`, { headers: { Cookie: sharedBrowserCookie, 'X-Skybridge-Role': role } });
      assert.equal(response.status, 200); assert.equal((await response.json() as any).session.role, role);
    }
    assert.equal((await fetch(`${base}/api/state`, { headers: { Cookie: sharedBrowserCookie, 'X-Skybridge-Role': 'administrator' } })).status, 401);
    assert.equal((await fetch(`${base}/api/state`, { headers: { Cookie: priorDispatcherCookie } })).status, 401);
    const roleEvents = await fetch(`${base}/api/events?role=dispatcher`, { headers: { Cookie: sharedBrowserCookie } });
    assert.equal(roleEvents.status, 200);
    const roleReader = roleEvents.body!.getReader(); const roleEvent = await roleReader.read();
    assert.match(new TextDecoder().decode(roleEvent.value), /"session":\{"role":"dispatcher"\}/); await roleReader.cancel();
    const events = await fetch(`${base}/api/events`, { headers: { Cookie: requester } });
    assert.equal(events.status, 200); assert.match(events.headers.get('content-type')!, /text\/event-stream/);
    const reader = events.body!.getReader(); const initialEvent = await reader.read();
    assert.match(new TextDecoder().decode(initialEvent.value), /"state":/); await reader.cancel();
    let state = await snapshot(dispatcher); const originalEpoch = state.epoch;
    const create = { type: 'createRequest', commandId: 'api-create-main', epoch: state.epoch, input: { id: 'api-main', packageType: 'supply-kit', quantity: 1, destination: 'north', deadlineMinutes: 20 } };
    assert.equal((await post('/api/commands', create, requester)).status, 200);
    state = await waitFor(dispatcher, s => s.requests[0]?.status === 'awaiting-approval');
    assert.equal(state.roomId, 'api-fixture-room'); const firstProposal = state.proposals.find(p => p.id === state.requests[0]!.proposalId)!;
    assert.equal(firstProposal.droneId, 'kestrel'); assert.equal(firstProposal.etaMinutes, 12);
    assert(firstProposal.messages!.every(message => message.serviceMessageId.startsWith('fixture-')));
    const oldApproval = { type: 'approveAndDispatch', commandId: 'api-approve-old', epoch: state.epoch, proposalId: firstProposal.id, proposalVersion: firstProposal.version, expectedWorldVersion: state.worldVersion, human: 'API Test Dispatcher', attested: true };
    assert.equal((await post('/api/commands', oldApproval, requester)).status, 403);
    assert.equal((await post('/api/commands', oldApproval, sharedBrowserCookie, 'requester')).status, 403);
    assert.equal((await post('/api/commands', { type: 'groundDrone', commandId: 'api-ground', epoch: state.epoch, droneId: 'kestrel' }, sharedBrowserCookie, 'dispatcher')).status, 200);
    const stale = await post('/api/commands', oldApproval, dispatcher); assert.equal(stale.status, 409); assert.match((await stale.json() as any).error, /stale/i);
    state = await snapshot(dispatcher); assert.equal(state.proposals.find(p => p.id === firstProposal.id)!.status, 'stale');
    assert.equal((await post('/api/commands', { type: 'startPlanning', commandId: 'api-replan', epoch: state.epoch, requestId: 'api-main', runId: 'api-new-run' }, dispatcher)).status, 200);
    state = await waitFor(dispatcher, s => s.requests[0]?.status === 'awaiting-approval');
    const replacement = state.proposals.find(p => p.id === state.requests[0]!.proposalId)!;
    assert.equal(replacement.droneId, 'swift'); assert.equal(replacement.version, 2);
    const approval = { type: 'approveAndDispatch', commandId: 'api-approve-current', epoch: state.epoch, proposalId: replacement.id, proposalVersion: replacement.version, expectedWorldVersion: state.worldVersion, human: 'API Test Dispatcher', attested: true };
    assert.equal((await post('/api/commands', approval, dispatcher)).status, 200);
    assert.equal((await post('/api/commands', approval, dispatcher)).status, 200);
    state = await snapshot(dispatcher); assert.equal(state.inventory['supply-kit'], 3); assert.equal(state.requests[0]!.status, 'in-flight');
    assert.equal((await post('/api/commands', { type: 'runSimulation', commandId: 'api-run-simulation', epoch: state.epoch }, dispatcher)).status, 200);
    state = await waitFor(dispatcher, s => s.requests[0]?.status === 'delivered');
    assert.equal(state.metrics.simulatedDeliveries, 1); assert.equal(state.inventory['supply-kit'], 3);
    const deliveredState = structuredClone(state);
    await stop(); child = launch(); await ready(); dispatcher = await login('dispatcher');
    state = await snapshot(dispatcher); assert.deepEqual(state, deliveredState);
    assert.equal((await fetch(`${base}/api/state`, { headers: { Cookie: requester } })).status, 401);
    assert.equal((await post('/api/commands', { type: 'resetScenario', commandId: 'api-reset' }, dispatcher)).status, 200);
    state = await snapshot(dispatcher); assert.notEqual(state.epoch, originalEpoch); assert.equal(state.requests.length, 0); assert.equal(state.inventory['supply-kit'], 4);
    const delayed = await post('/api/commands', { type: 'groundDrone', commandId: 'api-delayed-old-epoch', epoch: originalEpoch, droneId: 'swift' }, dispatcher);
    assert.equal(delayed.status, 409); assert.match((await delayed.json() as any).error, /epoch/i);
    const crossOrigin = await fetch(`${base}/api/commands`, { method: 'POST', headers: { Cookie: dispatcher, Origin: 'https://other.invalid', 'Content-Type': 'application/json' }, body: JSON.stringify({ type: 'resetScenario', commandId: 'api-cross-origin' }) });
    assert.equal(crossOrigin.status, 403);
  } finally { await stop(); await rm(directory, { recursive: true, force: true }); }
});
