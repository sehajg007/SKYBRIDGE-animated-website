/** All aircraft performance, routes, inventory and facilities below are fictional. */
export const PACKAGES = {
  'supply-kit': { name: 'Sealed supply kit', weightKg: 2 },
  'diagnostic-kit': { name: 'Diagnostic kit', weightKg: 1 },
} as const;
export const FACILITIES = [
  { id: 'hub', name: 'Central Supply Hub', distanceKm: 0, x: 25, y: 65 },
  { id: 'north', name: 'North Clinic', distanceKm: 8, x: 63, y: 20 },
  { id: 'east', name: 'East Clinic', distanceKm: 6, x: 83, y: 70 },
] as const;
export type PackageType = keyof typeof PACKAGES;
export type Destination = 'north' | 'east';
export type DroneId = 'kestrel' | 'swift' | 'finch';
export type RequestStatus = 'requested' | 'planning' | 'replanning' | 'awaiting-approval' | 'in-flight' | 'delivered' | 'needs-attention';
export type Drone = { id: DroneId; name: string; payloadKg: number; rangeKm: number; status: 'available' | 'grounded' | 'in-flight'; requestId?: string };
export type RequestInput = { id: string; packageType: PackageType; quantity: number; destination: Destination; deadlineMinutes: number };
export type DeliveryRequest = RequestInput & { status: RequestStatus; createdAt: string; deadlineAtMinute: number; runId?: string; planningWorldVersion?: number; proposalId?: string; error?: string; departureMinute?: number; arrivalMinute?: number; deliveredAt?: string };
export type MessageEvidence = { from: string; to: string; serviceMessageId: string; kind: string; text: string; runId: string };
export type Proposal = { id: string; requestId: string; droneId: DroneId; version: number; baseWorldVersion: number; epoch: string; runId: string; status: 'active' | 'stale' | 'dispatched'; etaMinutes: number; payloadKg: number; roundTripKm: number; explanation: string; createdAt: string; planningLatencyMs?: number; messages?: MessageEvidence[]; approvedBy?: string; approvedAt?: string; staleReason?: string };
export type AuditEntry = { seq: number; at: string; by: string; text: string; requestId?: string; runId?: string; from?: string; to?: string; serviceMessageId?: string; kind?: string };
export type RoomState = { roomId: string; epoch: string; worldVersion: number; revision: number; simulationMinute: number; drones: Drone[]; inventory: Record<PackageType, number>; requests: DeliveryRequest[]; proposals: Proposal[]; audit: AuditEntry[]; processedCommands: string[]; metrics: { plansCreated: number; rejectedApprovals: number; simulatedDeliveries: number } };
export type Feasibility = { droneId: DroneId; droneName: string; feasible: boolean; reasons: string[]; etaMinutes: number; payloadKg: number; roundTripKm: number };
type BaseCommand = { epoch: string; commandId: string };
export type Command =
  | (BaseCommand & { type: 'createRequest'; input: RequestInput })
  | (BaseCommand & { type: 'startPlanning'; requestId: string; runId: string })
  | (BaseCommand & { type: 'submitProposal'; requestId: string; runId: string; baseWorldVersion: number; proposal: { id: string; droneId: DroneId; explanation: string; planningLatencyMs?: number; messages?: MessageEvidence[] } })
  | (BaseCommand & { type: 'groundDrone'; droneId: DroneId })
  | (BaseCommand & { type: 'approveAndDispatch'; proposalId: string; proposalVersion: number; expectedWorldVersion: number; human: string; attested: true })
  | (BaseCommand & { type: 'advanceSimulation'; minutes?: number })
  | { type: 'resetScenario'; commandId: string }
  | (BaseCommand & { type: 'failPlanning'; requestId: string; runId: string; reason: string })
  | (BaseCommand & { type: 'appendAudit'; requestId?: string; runId?: string; entry: Omit<AuditEntry, 'seq' | 'at'> });

export function seedRoom(roomId = 'demo'): RoomState {
  return { roomId, epoch: crypto.randomUUID(), worldVersion: 1, revision: 0, simulationMinute: 0,
    drones: [
      { id: 'kestrel', name: 'Kestrel', payloadKg: 3, rangeKm: 24, status: 'available' },
      { id: 'swift', name: 'Swift', payloadKg: 2, rangeKm: 30, status: 'available' },
      { id: 'finch', name: 'Finch', payloadKg: 1, rangeKm: 18, status: 'available' },
    ], inventory: { 'supply-kit': 4, 'diagnostic-kit': 4 }, requests: [], proposals: [],
    audit: [{ seq: 1, at: new Date().toISOString(), by: 'system', text: 'Simulation room ready. All facilities, stock, aircraft and delivery estimates are fictional.' }],
    processedCommands: [], metrics: { plansCreated: 0, rejectedApprovals: 0, simulatedDeliveries: 0 } };
}
function ensure(value: unknown, message: string): asserts value { if (!value) throw new Error(message); }
function validId(value: unknown): value is string { return typeof value === 'string' && /^[a-zA-Z0-9][a-zA-Z0-9_.:-]{0,127}$/.test(value); }
function shortText(value: unknown, max: number): value is string { return typeof value === 'string' && value.trim().length > 0 && value.length <= max; }
function validateInput(input: RequestInput) {
  ensure(input && validId(input.id), 'A valid request ID is required');
  ensure(input.packageType === 'supply-kit' || input.packageType === 'diagnostic-kit', 'Unknown package type');
  ensure(input.destination === 'north' || input.destination === 'east', 'Unknown destination');
  ensure(Number.isInteger(input.quantity) && input.quantity >= 1 && input.quantity <= 20, 'Quantity must be an integer from 1 to 20');
  ensure(Number.isInteger(input.deadlineMinutes) && input.deadlineMinutes >= 1 && input.deadlineMinutes <= 120, 'Deadline must be 1–120 simulated minutes');
}
export function feasibility(state: RoomState, request: RequestInput & { deadlineAtMinute?: number }): Feasibility[] {
  validateInput(request);
  const distance = request.destination === 'north' ? 8 : 6;
  const payloadKg = PACKAGES[request.packageType].weightKg * request.quantity;
  const deadline = request.deadlineAtMinute ?? state.simulationMinute + request.deadlineMinutes;
  return state.drones.map(drone => {
    const northEta = drone.id === 'kestrel' ? 12 : drone.id === 'swift' ? 16 : 10;
    const etaMinutes = request.destination === 'north' ? northEta : Math.ceil(northEta * .75);
    const reasons = [
      drone.status !== 'available' ? `${drone.name} is ${drone.status}` : '',
      payloadKg > drone.payloadKg ? `Payload ${payloadKg} kg exceeds ${drone.payloadKg} kg capacity` : '',
      distance * 2 > drone.rangeKm ? `Round trip ${distance * 2} km exceeds ${drone.rangeKm} km distance budget` : '',
      state.inventory[request.packageType] < request.quantity ? `Insufficient inventory: ${state.inventory[request.packageType]} available, ${request.quantity} requested` : '',
      state.simulationMinute + etaMinutes > deadline ? `Arrival in ${etaMinutes} simulated minutes misses the receiving deadline` : '',
    ].filter(Boolean);
    return { droneId: drone.id, droneName: drone.name, feasible: reasons.length === 0, reasons, etaMinutes, payloadKg, roundTripKm: distance * 2 };
  }).sort((a, b) => Number(b.feasible) - Number(a.feasible) || a.etaMinutes - b.etaMinutes);
}
function addAudit(state: RoomState, entry: Omit<AuditEntry, 'seq' | 'at'>) {
  state.audit.push({ ...entry, seq: (state.audit.at(-1)?.seq ?? 0) + 1, at: new Date().toISOString() });
}
function invalidatePlans(state: RoomState, reason: string, except?: string) {
  for (const proposal of state.proposals) {
    if (proposal.status !== 'active' || proposal.id === except) continue;
    proposal.status = 'stale'; proposal.staleReason = reason;
    const request = state.requests.find(r => r.id === proposal.requestId)!;
    if (request.status === 'awaiting-approval') { request.status = 'replanning'; request.error = reason; }
    addAudit(state, { by: 'system', text: `Plan invalidated: ${reason}`, requestId: request.id, runId: proposal.runId });
  }
}
export function transition(state: RoomState, command: Command): RoomState {
  ensure(command && typeof command === 'object' && validId(command.commandId), 'A valid command ID is required');
  // Retries of a successfully committed command return without applying it twice,
  // including a repeated reset that carries the previous epoch.
  if (state.processedCommands.includes(command.commandId)) return state;
  if (command.type === 'resetScenario') {
    const next = seedRoom(state.roomId); next.worldVersion = state.worldVersion + 1; next.revision = state.revision + 1;
    next.processedCommands = [...state.processedCommands, command.commandId].slice(-2000);
    addAudit(next, { by: 'dispatcher', text: 'Demo reset. A new epoch cancels all prior planning runs and approvals.' }); return next;
  }
  ensure(command.epoch === state.epoch, 'Stale demo epoch; refresh the room');
  const next = structuredClone(state);
  const requestFor = (id: string) => { const request = next.requests.find(r => r.id === id); ensure(request, 'Request not found'); return request; };
  switch (command.type) {
    case 'createRequest': {
      validateInput(command.input); ensure(!next.requests.some(r => r.id === command.input.id), 'Request ID already exists');
      next.requests.push({ ...command.input, status: 'requested', createdAt: new Date().toISOString(), deadlineAtMinute: next.simulationMinute + command.input.deadlineMinutes });
      addAudit(next, { by: 'requester', text: `Requested ${command.input.quantity} ${PACKAGES[command.input.packageType].name} to ${command.input.destination === 'north' ? 'North Clinic' : 'East Clinic'} within ${command.input.deadlineMinutes} simulated minutes.`, requestId: command.input.id }); break;
    }
    case 'startPlanning': {
      ensure(validId(command.runId), 'A valid planning run ID is required'); const request = requestFor(command.requestId);
      ensure(request.status !== 'in-flight' && request.status !== 'delivered', 'Cannot replan an allocated delivery');
      for (const p of next.proposals) if (p.requestId === request.id && p.status === 'active') { p.status = 'stale'; p.staleReason = 'A newer planning run superseded this proposal'; }
      request.status = request.runId ? 'replanning' : 'planning'; request.runId = command.runId; request.planningWorldVersion = next.worldVersion; delete request.error;
      addAudit(next, { by: 'supply', text: 'Planning started from current inventory, fleet and receiving constraints.', requestId: request.id, runId: command.runId }); break;
    }
    case 'submitProposal': {
      const request = requestFor(command.requestId);
      ensure(request.runId === command.runId && ['planning', 'replanning'].includes(request.status), 'Stale or completed planning run');
      ensure(command.baseWorldVersion === next.worldVersion && request.planningWorldVersion === command.baseWorldVersion, 'World changed during planning; replan from current state');
      ensure(command.proposal && validId(command.proposal.id), 'A valid proposal ID is required');
      ensure(!next.proposals.some(p => p.id === command.proposal.id), 'Proposal ID already exists');
      ensure(shortText(command.proposal.explanation, 4000), 'Proposal explanation is required and must fit 4000 characters');
      ensure(command.proposal.planningLatencyMs === undefined || (Number.isFinite(command.proposal.planningLatencyMs) && command.proposal.planningLatencyMs >= 0), 'Planning latency must be nonnegative');
      const option = feasibility(next, request).find(f => f.droneId === command.proposal.droneId);
      ensure(option, 'Unknown aircraft'); ensure(option.feasible, option.reasons.join('; ') || 'Aircraft is not feasible');
      const version = next.proposals.filter(p => p.requestId === request.id).reduce((v, p) => Math.max(v, p.version), 0) + 1;
      const proposal: Proposal = { ...structuredClone(command.proposal), requestId: request.id, version, baseWorldVersion: next.worldVersion, epoch: next.epoch, runId: command.runId, status: 'active', etaMinutes: option.etaMinutes, payloadKg: option.payloadKg, roundTripKm: option.roundTripKm, createdAt: new Date().toISOString() };
      if (proposal.messages) for (const message of proposal.messages) ensure(shortText(message.from, 100) && shortText(message.to, 100) && shortText(message.serviceMessageId, 200) && message.runId === command.runId && shortText(message.kind, 100) && shortText(message.text, 12000), 'Invalid agent message evidence');
      next.proposals.push(proposal); request.proposalId = proposal.id; request.status = 'awaiting-approval'; delete request.error; next.metrics.plansCreated++;
      addAudit(next, { by: 'supply', text: `${option.droneName} proposed: ${option.payloadKg} kg, ${option.roundTripKm} km round trip, ${option.etaMinutes} simulated minutes. Human approval required.`, requestId: request.id, runId: command.runId }); break;
    }
    case 'groundDrone': {
      const drone = next.drones.find(d => d.id === command.droneId); ensure(drone, 'Unknown aircraft'); ensure(drone.status !== 'in-flight', 'Grounding is only supported before dispatch');
      if (drone.status !== 'grounded') { drone.status = 'grounded'; next.worldVersion++; invalidatePlans(next, `${drone.name} grounded before dispatch. Fleet availability changed.`); }
      addAudit(next, { by: 'dispatcher', text: `${drone.name} grounded in the simulation. Replan affected requests before approval.` }); break;
    }
    case 'approveAndDispatch': {
      ensure(command.attested === true && shortText(command.human, 80) && command.human.trim().length >= 2, 'Explicit human approval and dispatcher name are required');
      const proposal = next.proposals.find(p => p.id === command.proposalId); ensure(proposal, 'Proposal not found'); const request = requestFor(proposal.requestId);
      ensure(proposal.epoch === next.epoch && proposal.status === 'active' && request.status === 'awaiting-approval' && request.proposalId === proposal.id, 'Proposal is stale, superseded or already dispatched');
      ensure(command.proposalVersion === proposal.version, 'Stale proposal version');
      ensure(command.expectedWorldVersion === next.worldVersion && proposal.baseWorldVersion === next.worldVersion, 'Stale world version; review a new plan');
      const option = feasibility(next, request).find(f => f.droneId === proposal.droneId)!; ensure(option.feasible, option.reasons.join('; '));
      const drone = next.drones.find(d => d.id === proposal.droneId)!;
      // Inventory and aircraft assignment are committed in the same persisted state.
      next.inventory[request.packageType] -= request.quantity; drone.status = 'in-flight'; drone.requestId = request.id;
      proposal.status = 'dispatched'; proposal.approvedBy = command.human.trim(); proposal.approvedAt = new Date().toISOString();
      request.status = 'in-flight'; request.departureMinute = next.simulationMinute; request.arrivalMinute = next.simulationMinute + proposal.etaMinutes;
      next.worldVersion++; invalidatePlans(next, `${drone.name} and inventory allocated to another approved delivery.`, proposal.id);
      addAudit(next, { by: command.human.trim(), text: `Approved exact proposal v${proposal.version}; ${drone.name} allocated and stock decremented atomically. Simulated dispatch only.`, requestId: request.id, runId: proposal.runId }); break;
    }
    case 'advanceSimulation': {
      const minutes = command.minutes ?? 1; ensure(Number.isInteger(minutes) && minutes > 0 && minutes <= 60, 'Advance must be 1–60 simulated minutes'); next.simulationMinute += minutes; next.worldVersion++;
      for (const request of next.requests) if (request.status === 'in-flight' && request.arrivalMinute! <= next.simulationMinute) {
        request.status = 'delivered'; request.deliveredAt = new Date().toISOString();
        const drone = next.drones.find(d => d.requestId === request.id)!; const proposal = next.proposals.find(p => p.id === request.proposalId)!;
        drone.status = 'available'; drone.rangeKm -= proposal.roundTripKm; delete drone.requestId; next.metrics.simulatedDeliveries++;
        addAudit(next, { by: 'simulation', text: `${drone.name} delivery completed at simulated minute ${request.arrivalMinute}. Fictional round-trip distance budget consumed; aircraft returned to hub.`, requestId: request.id });
      }
      invalidatePlans(next, 'Simulation clock advanced; receiving windows must be rechecked.'); break;
    }
    case 'failPlanning': {
      const request = requestFor(command.requestId); ensure(request.runId === command.runId && ['planning', 'replanning'].includes(request.status), 'Stale planning failure');
      ensure(shortText(command.reason, 4000), 'Planning failure reason is required'); request.status = 'needs-attention'; request.error = command.reason;
      addAudit(next, { by: 'system', text: command.reason, requestId: request.id, runId: command.runId }); break;
    }
    case 'appendAudit': {
      ensure(command.entry && shortText(command.entry.by, 100) && shortText(command.entry.text, 12000), 'Invalid audit entry');
      if (command.requestId) { const request = requestFor(command.requestId); if (command.runId) ensure(request.runId === command.runId, 'Stale agent log'); }
      if (command.entry.kind === 'approval-rejected') next.metrics.rejectedApprovals++;
      addAudit(next, { ...command.entry, ...(command.requestId ? { requestId: command.requestId } : {}), ...(command.runId ? { runId: command.runId } : {}) }); break;
    }
    default: throw new Error('Unknown room command');
  }
  next.processedCommands = [...next.processedCommands, command.commandId].slice(-2000); next.revision++;
  return next;
}
