import type OpenAI from 'openai';
import { feasibility, type RoomState } from '../../shared/domain.js';
import { requestDecision } from './model.js';

export async function evaluateFleet(client: OpenAI, state: RoomState, requestId: string) {
  const request = state.requests.find(request => request.id === requestId);
  if (!request) throw new Error('Fleet received an unknown request');
  const options = feasibility(state, request);
  const feasible = options.filter(option => option.feasible).sort((a, b) => a.etaMinutes - b.etaMinutes || a.droneId.localeCompare(b.droneId));
  if (!feasible.length) throw new Error(`No feasible aircraft: ${options.map(option => `${option.droneName}: ${option.reasons.join(', ')}`).join('; ')}`);
  const decision = await requestDecision(client, 'Fleet', { request, simulationMinute: state.simulationMinute, aircraft: state.drones, validatedOptions: options, policy: 'Choose the feasible aircraft with the lowest ETA; provide a short constraint-based explanation.' }, feasible.map(option => option.droneId));
  if (decision.droneId !== feasible[0]!.droneId) throw new Error('Fleet model violated the lowest-ETA baseline policy');
  return { ...decision, options };
}
