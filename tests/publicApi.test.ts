import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  buildLangfusePublicApiUrl,
  requestLangfusePublicApi,
  resolveLangfusePublicApiEndpoint,
} from '../src/langfusePublicApi.js';

test('buildLangfusePublicApiUrl normalizes the public API base path and query params', () => {
  assert.equal(
    buildLangfusePublicApiUrl('https://cloud.langfuse.com', '/v2/prompts', { page: 1, limit: 10 }),
    'https://cloud.langfuse.com/api/public/v2/prompts?page=1&limit=10',
  );
});

test('requestLangfusePublicApi uses basic auth and returns raw JSON data', async () => {
  const calls: Array<RequestInit & { url: string }> = [];
  const fakeFetch: typeof fetch = async (input, init) => {
    calls.push({ url: String(input), ...(init ?? {}) });
    return new Response(JSON.stringify({ data: [{ id: 'trace-1' }] }), {
      status: 200,
      headers: { 'content-type': 'application/json' },
    });
  };

  const result = await requestLangfusePublicApi({
    baseUrl: 'https://cloud.langfuse.com/',
    publicKey: 'pk-test',
    secretKey: 'sk-test',
    path: '/traces',
    query: { page: 1 },
    fetchImpl: fakeFetch,
  });

  assert.equal(calls[0]?.url, 'https://cloud.langfuse.com/api/public/traces?page=1');
  assert.equal(new Headers(calls[0]?.headers).get('authorization'), 'Basic cGstdGVzdDpzay10ZXN0');
  assert.equal(result.status, 200);
  assert.deepEqual(result.data, { data: [{ id: 'trace-1' }] });
});

test('requestLangfusePublicApi supports prompt label and version query params', async () => {
  const calls: Array<RequestInit & { url: string }> = [];
  const fakeFetch: typeof fetch = async (input, init) => {
    calls.push({ url: String(input), ...(init ?? {}) });
    return new Response(JSON.stringify({ name: 'answer-query' }), {
      status: 200,
      headers: { 'content-type': 'application/json' },
    });
  };

  await requestLangfusePublicApi({
    baseUrl: 'https://cloud.langfuse.com',
    publicKey: 'pk-test',
    secretKey: 'sk-test',
    path: '/v2/prompts/answer-query',
    query: { label: 'production', version: '2' },
    fetchImpl: fakeFetch,
  });

  assert.equal(calls[0]?.url, 'https://cloud.langfuse.com/api/public/v2/prompts/answer-query?label=production&version=2');
});

test('requestLangfusePublicApi never sends a body for GET requests', async () => {
  const calls: Array<RequestInit & { url: string }> = [];
  const fakeFetch: typeof fetch = async (input, init) => {
    calls.push({ url: String(input), ...(init ?? {}) });
    return new Response(JSON.stringify({ ok: true }), {
      status: 200,
      headers: { 'content-type': 'application/json' },
    });
  };

  await requestLangfusePublicApi({
    baseUrl: 'https://cloud.langfuse.com',
    publicKey: 'pk-test',
    secretKey: 'sk-test',
    path: '/health',
    method: 'GET',
    body: {},
    fetchImpl: fakeFetch,
  });

  assert.equal(calls[0]?.method, 'GET');
  assert.equal(calls[0]?.body, undefined);
  assert.equal(new Headers(calls[0]?.headers).get('content-type'), null);
});

test('resolveLangfusePublicApiEndpoint resolves getPrompt and customRequest payloads', () => {
  assert.deepEqual(
    resolveLangfusePublicApiEndpoint('getPrompt', {
      promptName: 'answer-query',
      promptLabel: 'production',
      promptVersion: '2',
    }),
    {
      path: '/v2/prompts/answer-query',
      method: 'GET',
      query: {
        label: 'production',
        version: '2',
      },
    },
  );

  assert.deepEqual(
    resolveLangfusePublicApiEndpoint('customRequest', {
      path: '/v2/prompts',
      method: 'POST',
      queryJson: '{"page":1,"limit":10}',
      bodyJson: '{"name":"answer-query"}',
    }),
    {
      path: '/v2/prompts',
      method: 'POST',
      query: {
        page: 1,
        limit: 10,
      },
      body: {
        name: 'answer-query',
      },
    },
  );
});

test('resolveLangfusePublicApiEndpoint resolves getObservation with ID', () => {
  assert.deepEqual(
    resolveLangfusePublicApiEndpoint('getObservation', { observationId: 'obs-abc-123' }),
    { path: '/v2/observations/obs-abc-123', method: 'GET' },
  );
});

test('resolveLangfusePublicApiEndpoint throws when getObservation has no observationId', () => {
  assert.throws(
    () => resolveLangfusePublicApiEndpoint('getObservation', {}),
    /observationId is required/i,
  );
});

test('resolveLangfusePublicApiEndpoint resolves listSessions with optional query', () => {
  assert.deepEqual(
    resolveLangfusePublicApiEndpoint('listSessions', { queryJson: '{"page":1,"limit":10}' }),
    { path: '/sessions', method: 'GET', query: { page: 1, limit: 10 } },
  );

  assert.deepEqual(
    resolveLangfusePublicApiEndpoint('listSessions', {}),
    { path: '/sessions', method: 'GET' },
  );
});

test('resolveLangfusePublicApiEndpoint resolves deleteScore with score ID', () => {
  assert.deepEqual(
    resolveLangfusePublicApiEndpoint('deleteScore', { scoreId: 'score-abc-123' }),
    { path: '/v2/scores/score-abc-123', method: 'DELETE' },
  );
});

test('resolveLangfusePublicApiEndpoint throws when deleteScore has no scoreId', () => {
  assert.throws(
    () => resolveLangfusePublicApiEndpoint('deleteScore', {}),
    /scoreId is required/i,
  );
});

test('resolveLangfusePublicApiEndpoint omits empty customRequest body for GET requests', () => {
  assert.deepEqual(
    resolveLangfusePublicApiEndpoint('customRequest', {
      path: '/health',
      method: 'GET',
      queryJson: '{}',
      bodyJson: '',
    }),
    {
      path: '/health',
      method: 'GET',
      query: {},
    },
  );
});
