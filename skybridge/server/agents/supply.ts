import type OpenAI from 'openai';
import { feasibility, PACKAGES, type RoomState, type DroneId } from '../../shared/domain.js';
import { requestDecision } from './model.js';

export async function reconcileSupply(client: OpenAI, state: RoomState, requestId: string, fleet: { droneId: DroneId; explanation: string }) {
  const request = state.requests.find(request => request.id === requestId);
  if (!request) throw new Error('Supply received an unknown request');
  const options = feasibility(state, request);
  const valid = options.filter(option => option.feasible).sort((a, b) => a.etaMinutes - b.etaMinutes || a.droneId.localeCompare(b.droneId));
  if (!valid.length || !valid.some(option => option.droneId === fleet.droneId)) throw new Error('Supply rejected infeasible Fleet findings');
  const decision = await requestDecision(client, 'Supply', { request, package: PACKAGES[request.packageType], stock: state.inventory[request.packageType], receivingDeadlineMinute: request.deadlineAtMinute, simulationMinute: state.simulationMinute, validatedOptions: options, receivedFleetFindings: fleet, policy: 'Reconcile Fleet findings against stock and receiving deadline. Select lowest-ETA feasible aircraft; human approval remains required.' }, valid.map(option => option.droneId));
  if (decision.droneId !== valid[0]!.droneId) throw new Error('Supply model violated the lowest-ETA baseline policy');
  return decision;
}
