import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  asString,
  buildBasicAuthHeader,
  buildBatchRequestBody,
  buildPromptUrl,
  createEventEvent,
  createGenerationEvent,
  createScoreEvent,
  createSpanEvent,
  createTraceEvent,
  createTraceId,
  createObservationId,
  fetchLangfusePrompt,
  normalizeBaseUrl,
  parseJsonMaybe,
  sendLangfuseIngestion,
} from '../src/langfuse.js';

test('normalizeBaseUrl removes trailing slashes without touching protocol', () => {
  assert.equal(normalizeBaseUrl('https://cloud.langfuse.com/'), 'https://cloud.langfuse.com');
  assert.equal(normalizeBaseUrl('https://cloud.langfuse.com/api/public/'), 'https://cloud.langfuse.com/api/public');
});

test('buildBasicAuthHeader encodes the Langfuse public and secret keys', () => {
  assert.equal(buildBasicAuthHeader('pk-test', 'sk-test'), 'Basic cGstdGVzdDpzay10ZXN0');
});

test('buildPromptUrl normalizes the Langfuse public API path and query params', () => {
  assert.equal(
    buildPromptUrl('https://cloud.langfuse.com/api/public/', 'answer-query', 'production', '2'),
    'https://cloud.langfuse.com/api/public/v2/prompts/answer-query?label=production&version=2',
  );
});

test('parseJsonMaybe returns parsed JSON for strings and the original value otherwise', () => {
  assert.deepEqual(parseJsonMaybe('{"hello":"world"}'), { hello: 'world' });
  assert.equal(parseJsonMaybe('plain text'), 'plain text');
  assert.deepEqual(parseJsonMaybe({ ok: true }), { ok: true });
});

test('createTraceId and createObservationId generate lower-case hex ids', () => {
  assert.match(createTraceId(), /^[0-9a-f]{32}$/);
  assert.match(createObservationId(), /^[0-9a-f]{16}$/);
});

test('buildBatchRequestBody wraps events in the Langfuse batch envelope', () => {
  const event = createTraceEvent({
    traceId: '1234567890abcdef1234567890abcdef',
    name: 'root',
    timestamp: '2026-06-02T10:00:00.000Z',
  });

  assert.deepEqual(buildBatchRequestBody([event]), { batch: [event] });
});

test('createTraceEvent includes trace metadata fields', () => {
  const event = createTraceEvent({
    traceId: '1234567890abcdef1234567890abcdef',
    name: 'checkout',
    userId: 'user-1',
    sessionId: 'session-1',
    public: true,
    tags: ['prod', 'checkout'],
    input: { cartId: 'cart-1' },
    output: { ok: true },
    metadata: { source: 'n8n' },
    version: '1.2.3',
    timestamp: '2026-06-02T10:00:00.000Z',
  });

  assert.equal(event.type, 'trace-create');
  assert.equal(event.body.id, '1234567890abcdef1234567890abcdef');
  assert.equal(event.body.name, 'checkout');
  assert.equal(event.body.public, true);
  assert.deepEqual(event.body.tags, ['prod', 'checkout']);
});

test('createSpanEvent and createGenerationEvent preserve parent relationships and observation data', () => {
  const span = createSpanEvent({
    traceId: '1234567890abcdef1234567890abcdef',
    observationId: 'abcdef1234567890',
    parentObservationId: '1111111111111111',
    name: 'tool-call',
    input: { query: 'weather' },
    timestamp: '2026-06-02T10:00:00.000Z',
  });
  const generation = createGenerationEvent({
    traceId: '1234567890abcdef1234567890abcdef',
    observationId: 'abcdef1234567890',
    parentObservationId: '1111111111111111',
    name: 'openai',
    model: 'gpt-4.1-mini',
    modelParameters: { temperature: 0.2 },
    usageDetails: { prompt_tokens: 1, completion_tokens: 2 },
    costDetails: { total_cost: 0.01 },
    timestamp: '2026-06-02T10:00:00.000Z',
  });

  assert.equal(span.type, 'span-create');
  assert.equal(span.body.parentObservationId, '1111111111111111');
  assert.equal(generation.type, 'generation-create');
  assert.equal(generation.body.model, 'gpt-4.1-mini');
  assert.equal((generation.body.costDetails as { total_cost?: number } | null)?.total_cost, 0.01);
});

test('createScoreEvent serializes numeric and categorical score payloads', () => {
  const score = createScoreEvent({
    scoreId: 'score-1',
    traceId: '1234567890abcdef1234567890abcdef',
    observationId: 'abcdef1234567890',
    name: 'relevance',
    value: 0.95,
    dataType: 'NUMERIC',
    metadata: { reviewer: 'qa' },
    timestamp: '2026-06-02T10:00:00.000Z',
  });

  assert.equal(score.type, 'score-create');
  assert.equal(score.body.value, 0.95);
  assert.equal(score.body.dataType, 'NUMERIC');
  assert.equal(score.body.id, 'score-1');
});

test('asString trims strings and returns undefined for blank or non-string values', () => {
  assert.equal(asString('  hello  '), 'hello');
  assert.equal(asString(''), undefined);
  assert.equal(asString('   '), undefined);
  assert.equal(asString(42), undefined);
  assert.equal(asString(null), undefined);
});

test('createTraceEvent includes environment when provided', () => {
  const event = createTraceEvent({
    traceId: '1234567890abcdef1234567890abcdef',
    name: 'checkout',
    environment: 'production',
    timestamp: '2026-06-02T10:00:00.000Z',
  });
  assert.equal(event.body.environment, 'production');
});

test('createSpanEvent and createGenerationEvent and createEventEvent include environment', () => {
  const span = createSpanEvent({ environment: 'staging', timestamp: '2026-06-02T10:00:00.000Z' });
  const gen = createGenerationEvent({ environment: 'production', timestamp: '2026-06-02T10:00:00.000Z' });
  const evt = createEventEvent({ environment: 'development', timestamp: '2026-06-02T10:00:00.000Z' });
  assert.equal(span.body.environment, 'staging');
  assert.equal(gen.body.environment, 'production');
  assert.equal(evt.body.environment, 'development');
});

test('sendLangfuseIngestion accepts 207 multi-status with successes and errors', async () => {
  const calls: Array<RequestInit & { url: string }> = [];
  const fakeFetch: typeof fetch = async (input, init) => {
    calls.push({ url: String(input), ...(init ?? {}) });
    return new Response(
      JSON.stringify({
        successes: [{ id: 'evt-1' }],
        errors: [{ id: 'evt-2', message: 'rejected' }],
      }),
      { status: 207, headers: { 'content-type': 'application/json' } },
    );
  };

  const result = await sendLangfuseIngestion({
    baseUrl: 'https://cloud.langfuse.com/',
    publicKey: 'pk-test',
    secretKey: 'sk-test',
    batch: [createTraceEvent({ traceId: '1234567890abcdef1234567890abcdef' })],
    fetchImpl: fakeFetch,
  });

  assert.equal(calls[0]?.url, 'https://cloud.langfuse.com/api/public/ingestion');
  assert.equal(new Headers(calls[0]?.headers).get('authorization'), 'Basic cGstdGVzdDpzay10ZXN0');
  assert.equal(result.status, 207);
  assert.equal(result.successes.length, 1);
  assert.equal(result.errors.length, 1);
});

test('fetchLangfusePrompt uses basic auth and returns the prompt payload', async () => {
  const calls: Array<RequestInit & { url: string }> = [];
  const fakeFetch: typeof fetch = async (input, init) => {
    calls.push({ url: String(input), ...(init ?? {}) });
    return new Response(
      JSON.stringify({
        name: 'answer-query',
        label: 'production',
        version: 2,
        prompt: 'Hello world',
      }),
      { status: 200, headers: { 'content-type': 'application/json' } },
    );
  };

  const result = await fetchLangfusePrompt({
    baseUrl: 'https://cloud.langfuse.com',
    publicKey: 'pk-test',
    secretKey: 'sk-test',
    promptName: 'answer-query',
    label: 'production',
    version: '2',
    fetchImpl: fakeFetch,
    timeoutMs: 1000,
  });

  assert.equal(calls[0]?.url, 'https://cloud.langfuse.com/api/public/v2/prompts/answer-query?label=production&version=2');
  assert.equal(new Headers(calls[0]?.headers).get('authorization'), 'Basic cGstdGVzdDpzay10ZXN0');
  assert.equal(result.status, 200);
  assert.equal(result.ok, true);
  assert.deepEqual(result.prompt, {
    name: 'answer-query',
    label: 'production',
    version: 2,
    prompt: 'Hello world',
  });
});
