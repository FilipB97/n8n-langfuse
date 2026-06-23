import { test } from 'node:test';
import assert from 'node:assert/strict';

import { LangfuseApi, description as credentialDescription } from '../credentials/LangfuseApi.credentials.js';
import { description as nodeDescription } from '../nodes/Langfuse/Langfuse.node.js';
import { description as triggerDescription } from '../nodes/LangfuseTrigger/LangfuseTrigger.node.js';
import { description as aiDescription } from '../nodes/LangfuseAi/LangfuseAi.node.js';

function getProperty(name: string) {
  return nodeDescription.properties.find((property) => property.name === name);
}

test('Langfuse node exposes a custom svg icon and grouped resource actions', () => {
  assert.equal(nodeDescription.icon, 'file:langfuse.svg');
  assert.equal(nodeDescription.displayName, 'Langfuse');
  assert.equal(nodeDescription.properties[0]?.name, 'resource');
  assert.equal(nodeDescription.properties[1]?.name, 'operation');
  assert.equal(getProperty('showAdvancedFields')?.default, false);
  // Content fields (e.g. Name) stay visible by default; plumbing ids (Trace ID)
  // and other optional fields move under Show Advanced Fields.
  assert.deepEqual(getProperty('name')?.displayOptions?.show?.showAdvancedFields, undefined);
  assert.deepEqual(getProperty('traceId')?.displayOptions?.show?.showAdvancedFields, [true]);
  assert.deepEqual(getProperty('eventId')?.displayOptions?.show?.showAdvancedFields, [true]);
});

test('Langfuse Trigger is a polling trigger node with an event selector', () => {
  assert.equal(triggerDescription.icon, 'file:langfuse.svg');
  assert.equal(triggerDescription.displayName, 'Langfuse Trigger');
  assert.deepEqual(triggerDescription.group, ['trigger']);
  assert.equal(triggerDescription.polling, true);
  assert.deepEqual(triggerDescription.inputs, []);
  assert.deepEqual(triggerDescription.outputs, ['main']);
  assert.equal(triggerDescription.properties[0]?.name, 'event');
});

test('Langfuse credential exposes a custom svg icon and credential test request', () => {
  assert.equal(credentialDescription.icon, 'file:langfuse.svg');
  assert.equal(credentialDescription.authenticate?.type, 'generic');
  assert.equal(credentialDescription.authenticate?.properties.auth?.username, '={{$credentials.publicKey}}');
  assert.equal(credentialDescription.test?.request.url, '/api/public/v2/prompts?limit=1');

  const credentialType = new LangfuseApi();
  assert.equal(credentialType.icon, credentialDescription.icon);
  assert.equal(credentialType.authenticate, credentialDescription.authenticate);
  assert.equal(credentialType.test, credentialDescription.test);
});

test('Langfuse credential test base URL strips a trailing slash and an existing /api/public suffix', () => {
  const baseURL = credentialDescription.test?.request.baseURL ?? '';
  assert.ok(baseURL.startsWith('={{'), 'baseURL should be an expression');
  // Strips a trailing slash, then an existing /api/public suffix.
  assert.ok(/replace\(.*\$\/.*\)\.replace\(.*api.*public.*\)/.test(baseURL), baseURL);
});

test('Langfuse AI node offers OpenAI and Anthropic providers with provider-gated credentials', () => {
  const provider = aiDescription.properties.find((p) => p.name === 'provider');
  assert.ok(provider, 'provider property should exist');
  assert.deepEqual(provider?.options?.map((o) => o.value), ['openai', 'anthropic']);

  // Model is a free-text string so any current/new model id can be entered.
  const model = aiDescription.properties.find((p) => p.name === 'model');
  assert.equal(model?.type, 'string');

  const openAiCred = aiDescription.credentials.find((c) => c.name === 'openAiApi');
  const anthropicCred = aiDescription.credentials.find((c) => c.name === 'anthropicApi');
  assert.deepEqual(openAiCred?.displayOptions?.show?.provider, ['openai']);
  assert.deepEqual(anthropicCred?.displayOptions?.show?.provider, ['anthropic']);
});
