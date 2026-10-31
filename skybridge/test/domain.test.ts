import { test } from 'node:test';
import assert from 'node:assert/strict';
import { feasibility, seedRoom, transition, type Command, type DroneId, type RoomState } from '../shared/domain';

let n = 0;
const id = () => `command-${++n}`;
function create(state = seedRoom(), requestId = 'request-main', overrides = {}) {
  return transition(state, { type: 'createRequest', epoch: state.epoch, commandId: id(), input: { id: requestId, packageType: 'supply-kit', quantity: 1, destination: 'north', deadlineMinutes: 20, ...overrides } });
}
function plan(state: RoomState, requestId = 'request-main', droneId: DroneId = 'kestrel', runId = `run-${++n}`) {
  state = transition(state, { type: 'startPlanning', epoch: state.epoch, commandId: id(), requestId, runId });
  return transition(state, { type: 'submitProposal', epoch: state.epoch, commandId: id(), requestId, runId, baseWorldVersion: state.worldVersion, proposal: { id: `proposal-${++n}`, droneId, explanation: 'Known feasible route chosen from checked options.', planningLatencyMs: 100 } });
}
function approval(state: RoomState, requestId = 'request-main'): Command {
  const request = state.requests.find(r => r.id === requestId)!;
  const proposal = state.proposals.find(p => p.id === request.proposalId)!;
  return { type: 'approveAndDispatch', epoch: state.epoch, commandId: id(), proposalId: proposal.id, proposalVersion: proposal.version, expectedWorldVersion: state.worldVersion, human: 'Demo Dispatcher', attested: true };
}

test('main route proposes Kestrel, excludes the lighter faster Finch, then replans Swift', () => {
  let state = create();
  const options = feasibility(state, state.requests[0]!);
  assert.equal(options[0]!.droneId, 'kestrel');
  const finch = options.find(o => o.droneId === 'finch')!;
  assert.equal(finch.feasible, false); assert.match(finch.reasons.join(), /Payload 2 kg exceeds 1 kg/);
  state = plan(state); const oldApproval = approval(state); const originalProposal = state.proposals[0]!;
  state = transition(state, { type: 'groundDrone', epoch: state.epoch, commandId: id(), droneId: 'kestrel' });
  assert.equal(state.proposals[0]!.status, 'stale'); assert.equal(state.requests[0]!.status, 'replanning');
  assert.throws(() => transition(state, oldApproval), /stale/i);
  state = plan(state, 'request-main', 'swift');
  assert.equal(state.proposals.at(-1)!.version, originalProposal.version + 1);
  state = transition(state, approval(state));
  assert.equal(state.requests[0]!.status, 'in-flight'); assert.equal(state.inventory['supply-kit'], 3);
  assert.equal(state.drones.find(d => d.id === 'swift')!.status, 'in-flight');
  state = transition(state, { type: 'advanceSimulation', epoch: state.epoch, commandId: id(), minutes: 16 });
  assert.equal(state.requests[0]!.status, 'delivered'); assert.equal(state.metrics.simulatedDeliveries, 1);
  assert.equal(state.drones.find(d => d.id === 'swift')!.rangeKm, 14);
});

test('no feasible solution when Kestrel and Swift are grounded', () => {
  let state = create();
  for (const droneId of ['kestrel', 'swift'] as const) state = transition(state, { type: 'groundDrone', epoch: state.epoch, commandId: id(), droneId });
  assert.equal(feasibility(state, state.requests[0]!).some(f => f.feasible), false);
  assert.throws(() => plan(state, 'request-main', 'finch'), /Payload/);
  state = transition(state, { type: 'startPlanning', epoch: state.epoch, commandId: id(), requestId: 'request-main', runId: 'run-none' });
  state = transition(state, { type: 'failPlanning', epoch: state.epoch, commandId: id(), requestId: 'request-main', runId: 'run-none', reason: 'No feasible aircraft. Finch fails payload; Kestrel and Swift are grounded.' });
  assert.equal(state.requests[0]!.status, 'needs-attention'); assert.equal(state.inventory['supply-kit'], 4);
});

test('stock, full round-trip range and elapsed deadlines are validated', () => {
  let state = create();
  state.inventory['supply-kit'] = 0;
  assert(feasibility(state, state.requests[0]!).every(f => !f.feasible && f.reasons.some(r => /inventory/.test(r))));
  state.inventory['supply-kit'] = 4; state.drones.forEach(d => d.rangeKm = 15);
  assert(feasibility(state, state.requests[0]!).every(f => f.reasons.some(r => /Round trip 16 km/.test(r))));
  state.drones.forEach(d => d.rangeKm = 30); state.simulationMinute = 19;
  assert(feasibility(state, state.requests[0]!).every(f => f.reasons.some(r => /deadline/.test(r))));
});

test('unknown records and malformed quantities/deadlines are rejected', () => {
  for (const overrides of [{ packageType: 'medicine' }, { destination: 'unknown' }, { quantity: -1 }, { quantity: 1.5 }, { deadlineMinutes: 0 }, { deadlineMinutes: Infinity }]) {
    assert.throws(() => create(seedRoom(), 'bad', overrides));
  }
  const state = create();
  assert.throws(() => plan(state, 'request-main', 'unknown' as DroneId), /Unknown aircraft/);
});

test('approval requires exact proposal and world versions plus explicit human attestation', () => {
  const state = plan(create()); const command = approval(state);
  assert.throws(() => transition(state, { ...command, proposalVersion: 999 } as Command), /proposal version/);
  assert.throws(() => transition(state, { ...command, expectedWorldVersion: 999 } as Command), /world version/);
  assert.throws(() => transition(state, { ...command, attested: false } as unknown as Command), /Explicit human/);
  assert.throws(() => transition(state, { ...command, human: '' } as Command), /Explicit human/);
  assert.equal(state.inventory['supply-kit'], 4);
});

test('retrying a committed command cannot allocate resources twice', () => {
  const state = plan(create()); const command = approval(state);
  const committed = transition(state, command), duplicate = transition(committed, command);
  assert.equal(duplicate, committed); assert.equal(duplicate.inventory['supply-kit'], 3);
  assert.throws(() => transition(committed, { ...command, commandId: id() }), /already dispatched/);
});

test('two proposals may name Kestrel but only one can dispatch it', () => {
  let state = create(); state = create(state, 'request-second');
  state = plan(state); state = plan(state, 'request-second');
  const first = approval(state), second = approval(state, 'request-second');
  state = transition(state, first);
  assert.throws(() => transition(state, second), /stale/i);
  assert.equal(state.inventory['supply-kit'], 3);
  assert.equal(state.requests.filter(r => r.status === 'in-flight').length, 1);
  assert.equal(state.drones.find(d => d.id === 'kestrel')!.requestId, 'request-main');
});

test('operational changes reject proposals produced from an old world', () => {
  let state = create();
  state = transition(state, { type: 'startPlanning', epoch: state.epoch, commandId: id(), requestId: 'request-main', runId: 'run-old' });
  const oldWorld = state.worldVersion;
  state = transition(state, { type: 'groundDrone', epoch: state.epoch, commandId: id(), droneId: 'kestrel' });
  assert.throws(() => transition(state, { type: 'submitProposal', epoch: state.epoch, commandId: id(), requestId: 'request-main', runId: 'run-old', baseWorldVersion: oldWorld, proposal: { id: 'stale-proposal', droneId: 'swift', explanation: 'Old context' } }), /World changed/);
});

test('audit-only updates leave approval world valid', () => {
  let state = plan(create()); const command = approval(state); const world = state.worldVersion;
  state = transition(state, { type: 'appendAudit', epoch: state.epoch, commandId: id(), entry: { by: 'fleet', text: 'Response received', from: 'fleet', to: 'supply', serviceMessageId: 'relay-message-123' } });
  assert.equal(state.worldVersion, world); state = transition(state, command); assert.equal(state.requests[0]!.status, 'in-flight');
});

test('new run rejects stale proposals and failure callbacks', () => {
  let state = create();
  for (const runId of ['run-before', 'run-after']) state = transition(state, { type: 'startPlanning', epoch: state.epoch, commandId: id(), requestId: 'request-main', runId });
  assert.throws(() => transition(state, { type: 'failPlanning', epoch: state.epoch, commandId: id(), requestId: 'request-main', runId: 'run-before', reason: 'Late failure' }), /Stale/);
  assert.throws(() => transition(state, { type: 'submitProposal', epoch: state.epoch, commandId: id(), requestId: 'request-main', runId: 'run-before', baseWorldVersion: state.worldVersion, proposal: { id: 'late-proposal', droneId: 'kestrel', explanation: 'Late response' } }), /Stale/);
});

test('reset cancels delayed messages and duplicate reset is idempotent', () => {
  const state = plan(create()); const oldApproval = approval(state); const reset: Command = { type: 'resetScenario', commandId: id() };
  const resetState = transition(state, reset);
  assert.notEqual(resetState.epoch, state.epoch); assert.equal(resetState.requests.length, 0); assert.equal(resetState.inventory['supply-kit'], 4);
  assert.throws(() => transition(resetState, oldApproval), /epoch/);
  assert.equal(transition(resetState, reset), resetState);
});

test('cannot ground a dispatched aircraft or replan an in-flight mission', () => {
  let state = plan(create()); state = transition(state, approval(state));
  assert.throws(() => transition(state, { type: 'groundDrone', epoch: state.epoch, commandId: id(), droneId: 'kestrel' }), /before dispatch/);
  assert.throws(() => transition(state, { type: 'startPlanning', epoch: state.epoch, commandId: id(), requestId: 'request-main', runId: 'illegal-run' }), /allocated/);
});

test('three consecutive reset → disruption → replan → approval → delivery runs complete', () => {
  let state = seedRoom();
  for (let run = 0; run < 3; run++) {
    state = transition(state, { type: 'resetScenario', commandId: id() }); state = plan(create(state));
    state = transition(state, { type: 'groundDrone', epoch: state.epoch, commandId: id(), droneId: 'kestrel' });
    state = plan(state, 'request-main', 'swift'); state = transition(state, approval(state));
    state = transition(state, { type: 'advanceSimulation', epoch: state.epoch, commandId: id(), minutes: 16 });
    assert.equal(state.requests[0]!.status, 'delivered'); assert.equal(state.inventory['supply-kit'], 3);
  }
});

test('an invalid command leaves the input state completely unchanged', () => {
  const state = plan(create()); const before = structuredClone(state);
  assert.throws(() => transition(state, { ...approval(state), human: '' } as Command));
  assert.deepEqual(state, before);
});
