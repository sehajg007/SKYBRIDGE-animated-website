import { feasibility, type DroneId, type MessageEvidence, type RoomState } from '../../shared/domain.js';
import { createModel, smokeModel } from '../agents/model.js';
import { evaluateFleet } from '../agents/fleet.js';
import { reconcileSupply } from '../agents/supply.js';
import { openRelayTransport, type WireEnvelope } from './relay.js';
import { z } from 'zod';

export type Plan = { droneId: DroneId; explanation: string; messages: MessageEvidence[] };
export type ServiceStatus = { status: 'connected' | 'fixture' | 'unavailable'; detail: string };
export interface PlanningIntegration { kind: 'live' | 'fixture' | 'hybrid' | 'unavailable'; health: { relay: ServiceStatus; model: ServiceStatus }; plan(state: RoomState, requestId: string, runId: string, onMessage?: (message: MessageEvidence) => Promise<void>): Promise<Plan>; close(): Promise<void> }
const fleetDecision = z.object({ droneId: z.enum(['kestrel', 'swift', 'finch']), explanation: z.string(), options: z.array(z.unknown()), evidence: z.object({ responseId: z.string(), model: z.string(), latencyMs: z.number() }) });

export async function openPlanningIntegration(): Promise<PlanningIntegration> {
  if (process.env.INTEGRATION_MODE === 'model-local') {
    const client = createModel();
    const proof = await smokeModel();
    return {
      kind: 'hybrid',
      health: { relay: { status: 'fixture', detail: 'SIMULATED message handoff in this server; Agent Relay delivery is not used.' }, model: { status: 'connected', detail: `Live OpenAI ${proof.model}; verified response ${proof.responseId}` } },
      async plan(state, requestId, runId, onMessage) {
        const messages: MessageEvidence[] = [];
        const emit = async (message: MessageEvidence) => { messages.push(message); await onMessage?.(message); };
        await emit({ from: 'supply', to: 'fleet', runId, kind: 'fixture.handoff', serviceMessageId: `fixture-${runId}`, text: 'SIMULATED TRANSPORT: Supply asks Fleet to evaluate the request. No Agent Relay delivery.' });
        const fleet = await evaluateFleet(client, state, requestId);
        await emit({ from: 'fleet', to: 'supply', runId, kind: 'model.response', serviceMessageId: fleet.evidence.responseId, text: `LIVE OPENAI Fleet findings (local handoff): ${fleet.explanation}` });
        const supply = await reconcileSupply(client, state, requestId, fleet);
        await emit({ from: 'supply', to: 'dispatcher', runId, kind: 'model.response', serviceMessageId: supply.evidence.responseId, text: `LIVE OPENAI Supply review: ${supply.explanation}. Human approval required.` });
        return { droneId: supply.droneId, explanation: `${supply.explanation} [Live OpenAI coordinators; simulated Relay transport.]`, messages };
      }, async close() {},
    };
  }
  if (process.env.INTEGRATION_MODE === 'fixture') return {
    kind: 'fixture', health: { relay: { status: 'fixture', detail: 'Development fixture: no Relay transport' }, model: { status: 'fixture', detail: 'Deterministic development fixture: no model request' } },
    async plan(state, requestId, runId, onMessage) {
      await new Promise(resolve => setTimeout(resolve, 450));
      const request = state.requests.find(request => request.id === requestId); if (!request) throw new Error('Unknown request');
      const options = feasibility(state, request);
      const best = options.filter(option => option.feasible).sort((a, b) => a.etaMinutes - b.etaMinutes || a.droneId.localeCompare(b.droneId))[0];
      if (!best) throw new Error(`No feasible aircraft: ${options.map(option => `${option.droneName}: ${option.reasons.join(', ')}`).join('; ')}`);
      const messages: MessageEvidence[] = [
        { from: 'supply', to: 'fleet', serviceMessageId: `fixture-${runId}-request`, kind: 'fixture.request', text: 'LOCAL FIXTURE: evaluate fictional fleet constraints.', runId },
        { from: 'fleet', to: 'supply', serviceMessageId: `fixture-${runId}-response`, kind: 'fixture.response', text: `LOCAL FIXTURE: ${best.droneName} is the lowest-ETA feasible aircraft.`, runId },
      ];
      for (const message of messages) await onMessage?.(message);
      return { droneId: best.droneId, explanation: `DEVELOPMENT FIXTURE — ${best.droneName} meets ${best.payloadKg} kg payload, ${best.roundTripKm} km round-trip range and the receiving deadline at ${best.etaMinutes} simulated minutes. No model or Relay request was made.`, messages };
    }, async close() {},
  };
  let transport: Awaited<ReturnType<typeof openRelayTransport>> | undefined;
  const health: PlanningIntegration['health'] = { relay: { status: 'unavailable', detail: 'Not connected' }, model: { status: 'unavailable', detail: 'Not connected' } };
  try {
    const client = createModel();
    const modelEvidence = await smokeModel();
    health.model = { status: 'connected', detail: `${modelEvidence.model}; live response verified` };
    transport = await openRelayTransport();
    const probe = await transport.probe();
    health.relay = { status: 'connected', detail: `Received live reply ${probe.responseId}` };
    const activeTransport = transport;
    return {
      kind: 'live', health,
      async plan(state, requestId, runId, onMessage) {
        const request = state.requests.find(request => request.id === requestId);
        if (!request || request.runId !== runId) throw new Error('Unknown or stale planning run');
        const messages: MessageEvidence[] = [];
        let timer: ReturnType<typeof setTimeout>;
        let removeHandler: () => void = () => {};
        const wait = new Promise<Plan>((resolve, reject) => {
          removeHandler = activeTransport.handle(runId, async receipt => {
            const envelope = receipt.envelope;
            if (envelope.roomId !== state.roomId || envelope.epoch !== state.epoch || envelope.requestId !== requestId || envelope.baseWorldVersion !== state.worldVersion) return;
            try {
              const message: MessageEvidence = { from: receipt.from, to: receipt.to, serviceMessageId: receipt.messageId, kind: envelope.kind, text: JSON.stringify(envelope.payload), runId };
              messages.push(message); await onMessage?.(message);
              if (envelope.kind === 'fleet.request' && receipt.from === 'supply' && receipt.to === 'fleet') {
                const findings = await evaluateFleet(client, state, requestId);
                await activeTransport.send({ ...envelope, from: 'fleet', to: 'supply', kind: 'fleet.findings', payload: findings });
              } else if (envelope.kind === 'fleet.findings' && receipt.from === 'fleet' && receipt.to === 'supply') {
                const findings = fleetDecision.parse(envelope.payload);
                const decision = await reconcileSupply(client, state, requestId, findings);
                const decisionMessage: MessageEvidence = { from: 'supply', to: 'dispatcher', serviceMessageId: decision.evidence.responseId, kind: 'model.response', text: `${decision.explanation} (Live OpenAI ${decision.evidence.model}, ${decision.evidence.latencyMs} ms)`, runId };
                messages.push(decisionMessage); await onMessage?.(decisionMessage);
                resolve({ droneId: decision.droneId, explanation: decision.explanation, messages });
              }
            } catch (error) { reject(error); }
          });
          timer = setTimeout(() => reject(new Error('Live planning timed out. No dispatch occurred; verify Relay/model access and replan.')), Number(process.env.PLANNING_TIMEOUT_MS || 120000));
        });
        void wait.catch(() => {});
        const envelope: WireEnvelope = { protocol: 'skybridge-v1', roomId: state.roomId, epoch: state.epoch, requestId, runId, baseWorldVersion: state.worldVersion, from: 'supply', to: 'fleet', kind: 'fleet.request', payload: { request, aircraft: state.drones, inventory: state.inventory, simulationMinute: state.simulationMinute, validatedOptions: feasibility(state, request) } };
        try { await activeTransport.send(envelope); return await wait; }
        finally { clearTimeout(timer!); removeHandler(); }
      }, async close() { await activeTransport.close(); },
    };
  } catch (error) {
    await transport?.close();
    const detail = error instanceof Error ? error.message : 'Integration unavailable';
    if (health.model.status !== 'connected') health.model.detail = detail; else health.relay.detail = detail;
    return { kind: 'unavailable', health, async plan() { throw new Error(detail); }, async close() {} };
  }
}
