import { test } from 'node:test';
import assert from 'node:assert/strict';

import { description as credentialDescription } from '../credentials/LangfuseApi.credentials.js';
import { description as nodeDescription } from '../nodes/Langfuse/Langfuse.node.js';

function getProperty(name: string) {
  return nodeDescription.properties.find((property) => property.name === name);
}

test('Langfuse node exposes a custom svg icon and grouped resource actions', () => {
  assert.equal(nodeDescription.icon, 'file:langfuse.svg');
  assert.equal(nodeDescription.displayName, 'Langfuse');
  assert.equal(nodeDescription.properties[0]?.name, 'resource');
  assert.equal(nodeDescription.properties[1]?.name, 'operation');
  assert.equal(getProperty('showAdvancedFields')?.default, false);
  assert.deepEqual(getProperty('traceId')?.displayOptions?.show?.showAdvancedFields, undefined);
  assert.deepEqual(getProperty('eventId')?.displayOptions?.show?.showAdvancedFields, [true]);
});

test('Langfuse credential exposes a custom svg icon and credential test request', () => {
  assert.equal(credentialDescription.icon, 'file:langfuse.svg');
  assert.equal(credentialDescription.authenticate?.type, 'generic');
  assert.equal(credentialDescription.authenticate?.properties.auth?.username, '={{$credentials.publicKey}}');
  assert.equal(credentialDescription.test?.request.url, '/api/public/v2/prompts?limit=1');
});
