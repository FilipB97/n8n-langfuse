import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  buildLangfusePublicApiUrl,
  extractListPage,
  requestLangfusePublicApi,
  requestLangfusePublicApiAll,
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

// --- Datasets ---

test('resolveLangfusePublicApiEndpoint resolves listDatasets with optional query', () => {
  assert.deepEqual(
    resolveLangfusePublicApiEndpoint('listDatasets', { queryJson: '{"page":1,"limit":5}' }),
    { path: '/v2/datasets', method: 'GET', query: { page: 1, limit: 5 } },
  );

  assert.deepEqual(
    resolveLangfusePublicApiEndpoint('listDatasets', {}),
    { path: '/v2/datasets', method: 'GET' },
  );
});

test('resolveLangfusePublicApiEndpoint resolves getDataset by name', () => {
  assert.deepEqual(
    resolveLangfusePublicApiEndpoint('getDataset', { datasetName: 'qa eval/set' }),
    { path: '/v2/datasets/qa%20eval%2Fset', method: 'GET' },
  );
});

test('resolveLangfusePublicApiEndpoint throws when getDataset has no datasetName', () => {
  assert.throws(() => resolveLangfusePublicApiEndpoint('getDataset', {}), /datasetName is required/i);
});

test('resolveLangfusePublicApiEndpoint builds createDataset body', () => {
  assert.deepEqual(
    resolveLangfusePublicApiEndpoint('createDataset', {
      datasetName: 'qa-set',
      datasetDescription: 'eval set',
      metadataJson: '{"team":"ml"}',
    }),
    {
      path: '/v2/datasets',
      method: 'POST',
      body: { name: 'qa-set', description: 'eval set', metadata: { team: 'ml' } },
    },
  );

  assert.deepEqual(
    resolveLangfusePublicApiEndpoint('createDataset', { datasetName: 'qa-set' }),
    { path: '/v2/datasets', method: 'POST', body: { name: 'qa-set' } },
  );
});

test('resolveLangfusePublicApiEndpoint throws when createDataset has no datasetName', () => {
  assert.throws(() => resolveLangfusePublicApiEndpoint('createDataset', {}), /datasetName is required/i);
});

// --- Dataset items ---

test('resolveLangfusePublicApiEndpoint resolves listDatasetItems with query', () => {
  assert.deepEqual(
    resolveLangfusePublicApiEndpoint('listDatasetItems', { queryJson: '{"datasetName":"qa-set","limit":10}' }),
    { path: '/dataset-items', method: 'GET', query: { datasetName: 'qa-set', limit: 10 } },
  );
});

test('resolveLangfusePublicApiEndpoint resolves getDatasetItem and deleteDatasetItem by id', () => {
  assert.deepEqual(
    resolveLangfusePublicApiEndpoint('getDatasetItem', { datasetItemId: 'item-1' }),
    { path: '/dataset-items/item-1', method: 'GET' },
  );

  assert.deepEqual(
    resolveLangfusePublicApiEndpoint('deleteDatasetItem', { datasetItemId: 'item-1' }),
    { path: '/dataset-items/item-1', method: 'DELETE' },
  );
});

test('resolveLangfusePublicApiEndpoint throws when dataset item id is missing', () => {
  assert.throws(() => resolveLangfusePublicApiEndpoint('getDatasetItem', {}), /datasetItemId is required/i);
  assert.throws(() => resolveLangfusePublicApiEndpoint('deleteDatasetItem', {}), /datasetItemId is required/i);
});

test('resolveLangfusePublicApiEndpoint builds full createDatasetItem body', () => {
  assert.deepEqual(
    resolveLangfusePublicApiEndpoint('createDatasetItem', {
      datasetName: 'qa-set',
      inputJson: '{"q":"2+2"}',
      expectedOutputJson: '{"a":"4"}',
      metadataJson: '{"k":"v"}',
      sourceTraceId: 'trace-1',
      sourceObservationId: 'obs-1',
      datasetItemId: 'item-1',
      datasetItemStatus: 'ACTIVE',
    }),
    {
      path: '/dataset-items',
      method: 'POST',
      body: {
        datasetName: 'qa-set',
        input: { q: '2+2' },
        expectedOutput: { a: '4' },
        metadata: { k: 'v' },
        sourceTraceId: 'trace-1',
        sourceObservationId: 'obs-1',
        id: 'item-1',
        status: 'ACTIVE',
      },
    },
  );

  assert.deepEqual(
    resolveLangfusePublicApiEndpoint('createDatasetItem', { datasetName: 'qa-set' }),
    { path: '/dataset-items', method: 'POST', body: { datasetName: 'qa-set' } },
  );
});

// --- Dataset runs ---

test('resolveLangfusePublicApiEndpoint resolves dataset runs under /datasets (not /v2)', () => {
  assert.deepEqual(
    resolveLangfusePublicApiEndpoint('listDatasetRuns', { datasetName: 'qa-set', queryJson: '{"page":2}' }),
    { path: '/datasets/qa-set/runs', method: 'GET', query: { page: 2 } },
  );

  assert.deepEqual(
    resolveLangfusePublicApiEndpoint('getDatasetRun', { datasetName: 'qa-set', runName: 'run-1' }),
    { path: '/datasets/qa-set/runs/run-1', method: 'GET' },
  );

  assert.deepEqual(
    resolveLangfusePublicApiEndpoint('deleteDatasetRun', { datasetName: 'qa-set', runName: 'run-1' }),
    { path: '/datasets/qa-set/runs/run-1', method: 'DELETE' },
  );
});

test('resolveLangfusePublicApiEndpoint throws when dataset run params are missing', () => {
  assert.throws(() => resolveLangfusePublicApiEndpoint('listDatasetRuns', {}), /datasetName is required/i);
  assert.throws(() => resolveLangfusePublicApiEndpoint('getDatasetRun', { datasetName: 'qa-set' }), /runName is required/i);
  assert.throws(() => resolveLangfusePublicApiEndpoint('getDatasetRun', { runName: 'run-1' }), /datasetName is required/i);
});

test('resolveLangfusePublicApiEndpoint builds createDatasetRunItem body', () => {
  assert.deepEqual(
    resolveLangfusePublicApiEndpoint('createDatasetRunItem', {
      runName: 'run-1',
      datasetItemId: 'item-1',
      traceId: 'trace-1',
      runDescription: 'nightly',
      metadataJson: '{"k":"v"}',
    }),
    {
      path: '/dataset-run-items',
      method: 'POST',
      body: { runName: 'run-1', datasetItemId: 'item-1', traceId: 'trace-1', runDescription: 'nightly', metadata: { k: 'v' } },
    },
  );
});

test('resolveLangfusePublicApiEndpoint throws when createDatasetRunItem is missing required fields', () => {
  assert.throws(() => resolveLangfusePublicApiEndpoint('createDatasetRunItem', { datasetItemId: 'item-1' }), /runName is required/i);
  assert.throws(() => resolveLangfusePublicApiEndpoint('createDatasetRunItem', { runName: 'run-1' }), /datasetItemId is required/i);
});

// --- Prompts (create) ---

test('resolveLangfusePublicApiEndpoint builds a text createPrompt body (default type)', () => {
  assert.deepEqual(
    resolveLangfusePublicApiEndpoint('createPrompt', { promptName: 'greeting', promptText: 'Hello {{name}}' }),
    { path: '/v2/prompts', method: 'POST', body: { name: 'greeting', type: 'text', prompt: 'Hello {{name}}' } },
  );
});

test('resolveLangfusePublicApiEndpoint builds a chat createPrompt body and parses labels/tags/config', () => {
  assert.deepEqual(
    resolveLangfusePublicApiEndpoint('createPrompt', {
      promptName: 'support',
      promptType: 'chat',
      promptChatJson: '[{"role":"system","content":"You are helpful"}]',
      promptLabels: 'production, staging',
      promptTags: '["faq","support"]',
      promptConfigJson: '{"model":"gpt-4o-mini","temperature":0}',
      promptCommitMessage: 'initial version',
    }),
    {
      path: '/v2/prompts',
      method: 'POST',
      body: {
        name: 'support',
        type: 'chat',
        prompt: [{ role: 'system', content: 'You are helpful' }],
        labels: ['production', 'staging'],
        tags: ['faq', 'support'],
        config: { model: 'gpt-4o-mini', temperature: 0 },
        commitMessage: 'initial version',
      },
    },
  );
});

test('resolveLangfusePublicApiEndpoint validates createPrompt required fields', () => {
  assert.throws(() => resolveLangfusePublicApiEndpoint('createPrompt', {}), /promptName is required/i);
  assert.throws(() => resolveLangfusePublicApiEndpoint('createPrompt', { promptName: 'p' }), /promptText is required/i);
  assert.throws(
    () => resolveLangfusePublicApiEndpoint('createPrompt', { promptName: 'p', promptType: 'chat' }),
    /promptChatJson is required/i,
  );
});

// --- Session, Score Configs, Annotation Queue Items ---

test('resolveLangfusePublicApiEndpoint resolves getSession with ID', () => {
  assert.deepEqual(
    resolveLangfusePublicApiEndpoint('getSession', { sessionId: 'sess-abc' }),
    { path: '/sessions/sess-abc', method: 'GET' },
  );
  assert.throws(() => resolveLangfusePublicApiEndpoint('getSession', {}), /sessionId is required/i);
});

test('resolveLangfusePublicApiEndpoint resolves listScoreConfigs with optional query', () => {
  assert.deepEqual(
    resolveLangfusePublicApiEndpoint('listScoreConfigs', {}),
    { path: '/score-configs', method: 'GET' },
  );
  assert.deepEqual(
    resolveLangfusePublicApiEndpoint('listScoreConfigs', { queryJson: '{"limit":5}' }),
    { path: '/score-configs', method: 'GET', query: { limit: 5 } },
  );
});

test('resolveLangfusePublicApiEndpoint resolves getScoreConfig with ID', () => {
  assert.deepEqual(
    resolveLangfusePublicApiEndpoint('getScoreConfig', { scoreConfigId: 'cfg-1' }),
    { path: '/score-configs/cfg-1', method: 'GET' },
  );
  assert.throws(() => resolveLangfusePublicApiEndpoint('getScoreConfig', {}), /scoreConfigId is required/i);
});

test('resolveLangfusePublicApiEndpoint resolves listAnnotationQueueItems with queue ID and optional query', () => {
  assert.deepEqual(
    resolveLangfusePublicApiEndpoint('listAnnotationQueueItems', { queueId: 'q-1' }),
    { path: '/annotation-queues/q-1/items', method: 'GET' },
  );
  assert.deepEqual(
    resolveLangfusePublicApiEndpoint('listAnnotationQueueItems', { queueId: 'q-1', queryJson: '{"page":2}' }),
    { path: '/annotation-queues/q-1/items', method: 'GET', query: { page: 2 } },
  );
  assert.throws(() => resolveLangfusePublicApiEndpoint('listAnnotationQueueItems', {}), /queueId is required/i);
});

// ---------------------------------------------------------------------------
// Auto-pagination
// ---------------------------------------------------------------------------

test('extractListPage reads data array and meta.totalPages', () => {
  assert.deepEqual(extractListPage({ data: [1, 2], meta: { totalPages: 3 } }), { items: [1, 2], totalPages: 3 });
  assert.deepEqual(extractListPage([{ id: 'a' }]), { items: [{ id: 'a' }], totalPages: undefined });
  assert.deepEqual(extractListPage({ nope: true }), { items: [], totalPages: undefined });
  assert.deepEqual(extractListPage(null), { items: [], totalPages: undefined });
});

test('requestLangfusePublicApiAll walks every page using meta.totalPages', async () => {
  const seenPages: number[] = [];
  const fakeFetch: typeof fetch = async (input) => {
    const url = new URL(String(input));
    const page = Number(url.searchParams.get('page'));
    seenPages.push(page);
    const totalPages = 3;
    const data = [{ id: `p${page}-a` }, { id: `p${page}-b` }];
    return new Response(JSON.stringify({ data, meta: { page, totalPages } }), {
      status: 200,
      headers: { 'content-type': 'application/json' },
    });
  };

  const result = await requestLangfusePublicApiAll({
    baseUrl: 'https://cloud.langfuse.com',
    publicKey: 'pk-test',
    secretKey: 'sk-test',
    path: '/traces',
    fetchImpl: fakeFetch,
  });

  assert.deepEqual(seenPages, [1, 2, 3]);
  assert.equal(result.pages, 3);
  assert.equal(result.data.length, 6);
});

test('requestLangfusePublicApiAll stops on a short page when meta is absent', async () => {
  let calls = 0;
  const fakeFetch: typeof fetch = async (input) => {
    calls += 1;
    const url = new URL(String(input));
    const limit = Number(url.searchParams.get('limit'));
    // First page full, second page short → stop after second.
    const data = calls === 1 ? Array.from({ length: limit }, (_, i) => ({ id: i })) : [{ id: 'last' }];
    return new Response(JSON.stringify({ data }), { status: 200, headers: { 'content-type': 'application/json' } });
  };

  const result = await requestLangfusePublicApiAll({
    baseUrl: 'https://cloud.langfuse.com',
    publicKey: 'pk-test',
    secretKey: 'sk-test',
    path: '/v2/scores',
    fetchImpl: fakeFetch,
    pageSize: 2,
  });

  assert.equal(calls, 2);
  assert.equal(result.data.length, 3);
});

test('requestLangfusePublicApiAll forwards base query params alongside pagination', async () => {
  let capturedUrl = '';
  const fakeFetch: typeof fetch = async (input) => {
    capturedUrl = String(input);
    return new Response(JSON.stringify({ data: [], meta: { totalPages: 1 } }), {
      status: 200,
      headers: { 'content-type': 'application/json' },
    });
  };

  await requestLangfusePublicApiAll({
    baseUrl: 'https://cloud.langfuse.com',
    publicKey: 'pk-test',
    secretKey: 'sk-test',
    path: '/traces',
    query: { userId: 'u-1' },
    fetchImpl: fakeFetch,
  });

  const url = new URL(capturedUrl);
  assert.equal(url.searchParams.get('userId'), 'u-1');
  assert.equal(url.searchParams.get('page'), '1');
  assert.ok(url.searchParams.get('limit'));
});
