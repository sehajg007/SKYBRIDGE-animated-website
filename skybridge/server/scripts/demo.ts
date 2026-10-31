import 'dotenv/config';
import { randomUUID } from 'node:crypto';
const base = process.env.DEMO_URL || `http://127.0.0.1:${process.env.PORT || 3001}`;
const response = await fetch(`${base}/api/session`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ role: 'dispatcher', token: process.env.DEMO_DISPATCHER_TOKEN }) });
if (!response.ok) throw new Error('Demo dispatcher sign-in failed. Run npm run setup and start the server first.');
const cookie = response.headers.get('set-cookie')!.split(';')[0]!;
const headers = { 'Content-Type': 'application/json', Cookie: cookie, 'X-Skybridge-Role': 'dispatcher' };
const snapshot = async () => await fetch(`${base}/api/state`, { headers }).then(r => r.json()) as any;
async function command(body: any, expectedStatus = 200) {
  const r = await fetch(`${base}/api/commands`, { method: 'POST', headers, body: JSON.stringify({ commandId: randomUUID(), ...body }) });
  const data = await r.json() as any; if (r.status !== expectedStatus) throw new Error(`Expected ${expectedStatus}, received ${r.status}: ${data.error}`); return data;
}
async function waitFor(requestId: string, status: string) {
  const deadline = Date.now() + 150000;
  while (Date.now() < deadline) {
    const data = await snapshot(); const request = data.state.requests.find((r: any) => r.id === requestId);
    if (request?.status === 'needs-attention') throw new Error(request.error);
    if (request?.status === status) return data;
    await new Promise(r => setTimeout(r, 250));
  }
  throw new Error(`Waiting for ${status} timed out`);
}
const initial = await snapshot(); console.log('Observed integration status:', JSON.stringify(initial.health));
const metrics: any[] = [];
for (let run = 1; run <= Number(process.env.DEMO_RUNS || 3); run++) {
  const reset = await command({ type: 'resetScenario' }); const epoch = reset.state.epoch;
  const requestId = randomUUID();
  await command({ type: 'createRequest', epoch, input: { id: requestId, packageType: 'supply-kit', quantity: 1, destination: 'north', deadlineMinutes: 20 } });
  const first = await waitFor(requestId, 'awaiting-approval'); const old = first.state.proposals.at(-1);
  if (old.droneId !== 'kestrel') throw new Error('Baseline should select Kestrel');
  await command({ type: 'groundDrone', epoch, droneId: 'kestrel' });
  await command({ type: 'approveAndDispatch', epoch, proposalId: old.id, proposalVersion: old.version, expectedWorldVersion: old.baseWorldVersion, human: 'Scripted Demo Dispatcher', attested: true }, 409);
  await command({ type: 'startPlanning', epoch, requestId, runId: randomUUID() });
  const replanned = await waitFor(requestId, 'awaiting-approval'); const fresh = replanned.state.proposals.at(-1);
  if (fresh.droneId !== 'swift') throw new Error('Grounded Kestrel must be replaced by Swift');
  const approval = { type: 'approveAndDispatch', epoch, proposalId: fresh.id, proposalVersion: fresh.version, expectedWorldVersion: fresh.baseWorldVersion, human: 'Scripted Demo Dispatcher', attested: true, commandId: randomUUID() };
  await command(approval); const duplicate = await command(approval);
  if (duplicate.state.inventory['supply-kit'] !== 3) throw new Error('Duplicate approval consumed stock twice');
  await command({ type: 'runSimulation', epoch }); await waitFor(requestId, 'delivered');
  metrics.push({ run, firstPlanMs: old.planningLatencyMs, replanMs: fresh.planningLatencyMs, staleApprovalRejected: true, duplicateAllocatedOnce: true, result: 'delivered', stateBackend: initial.health.terse.status, model: initial.health.model.status });
  console.log(`Run ${run} PASS: Kestrel → grounded → stale approval rejected → Swift → approved once → simulated delivery.`);
}
console.log('Measured prototype results:', JSON.stringify(metrics, null, 2));
