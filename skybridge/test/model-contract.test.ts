import test from 'node:test';
import assert from 'node:assert/strict';
import type OpenAI from 'openai';
import { requestDecision } from '../server/agents/model.js';

function client(output: string) { return { responses: { create: async () => ({ id: 'test-response', model: 'test-model', output_text: output }) } } as unknown as OpenAI; }
test('model output cannot introduce an unknown aircraft or expand the feasible set', async () => {
  await assert.rejects(() => requestDecision(client('{"droneId":"invented-aircraft","explanation":"fast"}'), 'Fleet', {}, ['kestrel']));
  await assert.rejects(() => requestDecision(client('{"droneId":"swift","explanation":"fast"}'), 'Fleet', {}, ['kestrel']), /outside the validated feasible set/);
});
test('malformed, empty and refused model output fails without a fixture substitution', async () => {
  for (const output of ['', 'not JSON', '{"refusal":"Cannot plan"}']) await assert.rejects(() => requestDecision(client(output), 'Supply', {}, ['kestrel']));
});
test('valid constrained model output retains real response evidence', async () => {
  const result = await requestDecision(client('{"droneId":"kestrel","explanation":"Meets the supplied payload, range and deadline."}'), 'Fleet', {}, ['kestrel']);
  assert.equal(result.droneId, 'kestrel'); assert.equal(result.evidence.responseId, 'test-response');
});
