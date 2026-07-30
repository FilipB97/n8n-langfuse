import { test } from 'node:test';
import assert from 'node:assert/strict';

import { buildEventsForOperation, buildPromptRequestParameters, parseTags, summarizeIngestionEvents } from '../src/nodeLogic.js';

test('parseTags trims comma-separated tags and ignores blanks', () => {
  assert.deepEqual(parseTags(' alpha, beta , ,gamma '), ['alpha', 'beta', 'gamma']);
});

test('buildEventsForOperation builds trace-create payloads from node parameters', () => {
  const events = buildEventsForOperation('traceCreate', {
    name: 'checkout',
    tags: 'prod,checkout',
    inputJson: '{"cartId":"cart-1"}',
    outputJson: '{"ok":true}',
    metadataJson: '{"source":"n8n"}',
  });

  assert.equal(events.length, 1);
  assert.equal(events[0]?.type, 'trace-create');
  assert.match(String(events[0]?.body.id), /^[0-9a-f]{32}$/);
  assert.deepEqual(events[0]?.body.tags, ['prod', 'checkout']);
  assert.equal((events[0]?.body.input as { cartId?: string } | undefined)?.cartId, 'cart-1');
});

test('buildEventsForOperation parses score values and raw batches', () => {
  const scoreEvents = buildEventsForOperation('scoreCreate', {
    traceId: '1234567890abcdef1234567890abcdef',
    scoreName: 'relevance',
    scoreValue: '0.99',
    scoreDataType: 'NUMERIC',
  });

  const rawEvents = buildEventsForOperation('batchRaw', {
    batchJson: '{"batch":[{"id":"evt-1","type":"event-create","timestamp":"2026-06-02T10:00:00.000Z","body":{"id":"abc"}}]}',
  });

  assert.equal(scoreEvents[0]?.type, 'score-create');
  assert.equal(scoreEvents[0]?.body.value, 0.99);
  assert.equal(rawEvents.length, 1);
  assert.equal(rawEvents[0]?.id, 'evt-1');
});

test('span/generation create default startTime, updates default endTime, finalize closes the span', () => {
  const isoRe = /\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/;
  const span = buildEventsForOperation('spanCreate', { traceId: 't', observationId: 's' });
  assert.match(String((span[0]?.body as { startTime?: unknown }).startTime), isoRe);

  const gen = buildEventsForOperation('generationCreate', { traceId: 't', observationId: 'g' });
  assert.match(String((gen[0]?.body as { startTime?: unknown }).startTime), isoRe);

  const spanUpd = buildEventsForOperation('spanUpdate', { traceId: 't', observationId: 's' });
  assert.match(String((spanUpd[0]?.body as { endTime?: unknown }).endTime), isoRe);

  const fin = buildEventsForOperation('finalizeSpan', { traceId: 't', observationId: 's' });
  const spanUpdate = fin.find((e) => e.type === 'span-update');
  assert.match(String((spanUpdate?.body as { endTime?: unknown }).endTime), isoRe);
});

test('explicit startTime/endTime are preserved over the defaults', () => {
  const span = buildEventsForOperation('spanCreate', { traceId: 't', observationId: 's', startTime: '2026-01-01T00:00:00.000Z' });
  assert.equal((span[0]?.body as { startTime?: unknown }).startTime, '2026-01-01T00:00:00.000Z');
});

test('buildEventsForOperation requires observation ids for update operations', () => {
  assert.throws(() => buildEventsForOperation('spanUpdate', {
    traceId: '1234567890abcdef1234567890abcdef',
    name: 'tool-call',
  }), /observationId is required/i);

  assert.throws(() => buildEventsForOperation('generationUpdate', {
    traceId: '1234567890abcdef1234567890abcdef',
    name: 'llm-response',
  }), /observationId is required/i);
});

test('buildEventsForOperation builds finalize span batches with generation and span update', () => {
  const events = buildEventsForOperation('finalizeSpan', {
    traceId: '1234567890abcdef1234567890abcdef',
    observationId: 'abcdef1234567890',
    generationObservationId: 'abcdef1234567890_gen',
    name: 'llm-response',
    model: 'gpt-4.1-mini',
    inputJson: '{"question":"hello"}',
    outputJson: '{"answer":"hi"}',
    usageDetailsJson: '{"prompt_tokens":10,"completion_tokens":20}',
    costDetailsJson: '{"total_cost":0.01}',
    promptName: 'answer-query',
    promptVersion: '2',
    promptLabelsJson: '["production"]',
    startTime: '2026-06-02T10:00:00.000Z',
    endTime: '2026-06-02T10:00:02.000Z',
  });

  assert.equal(events.length, 2);
  assert.equal(events[0]?.type, 'generation-create');
  assert.equal(events[1]?.type, 'span-update');
  assert.equal(events[0]?.body.parentObservationId, 'abcdef1234567890');
  assert.equal(events[0]?.body.promptName, 'answer-query');
  // Langfuse ingestion expects promptVersion as a number, so the string UI
  // value is coerced.
  assert.equal(events[0]?.body.promptVersion, 2);
  assert.equal(events[1]?.body.endTime, '2026-06-02T10:00:02.000Z');
});

test('generation promptVersion keeps a non-numeric value as a string', () => {
  const events = buildEventsForOperation('generationCreate', {
    traceId: 't', observationId: 'g', promptVersion: 'latest',
  });
  assert.equal(events[0]?.body.promptVersion, 'latest');
});

test('buildEventsForOperation requires trace ids and score values for scoreCreate', () => {
  assert.throws(() => buildEventsForOperation('scoreCreate', {
    scoreName: 'relevance',
    scoreValue: '0.99',
  }), /traceId or sessionId/i);

  assert.throws(() => buildEventsForOperation('scoreCreate', {
    traceId: '1234567890abcdef1234567890abcdef',
    scoreName: 'relevance',
    scoreValue: '',
  }), /scoreValue is required/i);
});

test('buildEventsForOperation scoreCreate accepts session-only scores without traceId', () => {
  const events = buildEventsForOperation('scoreCreate', {
    scoreSessionId: 'session-abc',
    scoreName: 'relevance',
    scoreValue: '0.99',
  });
  assert.equal(events[0]?.type, 'score-create');
  assert.equal(events[0]?.body.sessionId, 'session-abc');
  assert.equal(events[0]?.body.traceId, undefined);
});

test('buildEventsForOperation passes environment through to traceCreate and spanCreate', () => {
  const traceEvents = buildEventsForOperation('traceCreate', { name: 'checkout', environment: 'production' });
  assert.equal(traceEvents[0]?.body.environment, 'production');

  const spanEvents = buildEventsForOperation('spanCreate', { environment: 'staging' });
  assert.equal(spanEvents[0]?.body.environment, 'staging');

  const genEvents = buildEventsForOperation('generationCreate', { environment: 'development' });
  assert.equal(genEvents[0]?.body.environment, 'development');
});

test('buildPromptRequestParameters trims and validates prompt fetch inputs', () => {
  const request = buildPromptRequestParameters({
    promptName: ' answer-query ',
    promptLabel: ' production ',
    promptVersion: '2',
  });

  assert.deepEqual(request, {
    promptName: 'answer-query',
    label: 'production',
    version: '2',
  });
});

test('buildPromptRequestParameters allows prompt name only', () => {
  const request = buildPromptRequestParameters({
    promptName: ' answer-query ',
  });

  assert.deepEqual(request, {
    promptName: 'answer-query',
  });
});

test('traceCreate defaults sessionId to the (auto-generated) trace id', () => {
  const events = buildEventsForOperation('traceCreate', { name: 'checkout' });
  const body = events[0]?.body as { id?: unknown; sessionId?: unknown };
  assert.match(String(body.id), /^[0-9a-f]{32}$/);
  assert.equal(body.sessionId, body.id);
});

test('traceCreate defaults sessionId to an explicit trace id', () => {
  const events = buildEventsForOperation('traceCreate', { name: 'checkout', traceId: 'trace-xyz' });
  const body = events[0]?.body as { id?: unknown; sessionId?: unknown };
  assert.equal(body.id, 'trace-xyz');
  assert.equal(body.sessionId, 'trace-xyz');
});

test('traceCreate keeps an explicit sessionId over the trace id', () => {
  const events = buildEventsForOperation('traceCreate', { name: 'checkout', traceId: 'trace-xyz', sessionId: 'conversation-42' });
  const body = events[0]?.body as { id?: unknown; sessionId?: unknown };
  assert.equal(body.id, 'trace-xyz');
  assert.equal(body.sessionId, 'conversation-42');
});

test('summarizeIngestionEvents surfaces the sessionId (= trace id by default) for traceCreate', () => {
  const events = buildEventsForOperation('traceCreate', { name: 'checkout' });
  const summary = summarizeIngestionEvents(events);
  assert.equal(summary.sessionId, summary.traceId);
});

test('summarizeIngestionEvents reports the trace id a span attaches to', () => {
  const events = buildEventsForOperation('spanCreate', { traceId: 'trace-123', observationId: 'span-1', name: 'work' });
  const summary = summarizeIngestionEvents(events);
  assert.equal(summary.traceId, 'trace-123');
  assert.equal(summary.observationId, 'span-1');
  assert.deepEqual(summary.ids, ['span-1']);
  assert.equal(summary.eventIds.length, 1);
});

test('summarizeIngestionEvents returns an auto-generated trace id for traceCreate', () => {
  const events = buildEventsForOperation('traceCreate', { name: 'checkout' });
  const summary = summarizeIngestionEvents(events);
  // traceId is the trace's own (auto-generated) id, and matches the entity id written.
  assert.ok(summary.traceId && summary.traceId.length > 0);
  assert.deepEqual(summary.ids, [summary.traceId]);
});

test('summarizeIngestionEvents covers both events of finalizeSpan', () => {
  const events = buildEventsForOperation('finalizeSpan', { traceId: 'trace-9', observationId: 'span-9' });
  const summary = summarizeIngestionEvents(events);
  assert.equal(summary.traceId, 'trace-9');
  // generation id + the span id being finalized
  assert.equal(summary.ids.length, 2);
  assert.ok(summary.ids.includes('span-9'));
});

// ---------------------------------------------------------------------------
// Parity with the Make.com blueprint
// ---------------------------------------------------------------------------

test('trace-create carries a timestamp in the body, not just the envelope', () => {
  const events = buildEventsForOperation('traceCreate', { name: 'checkout', timestamp: '2026-06-02T10:00:00.000Z' });
  assert.equal(events[0]?.body.timestamp, '2026-06-02T10:00:00.000Z');
  assert.equal(events[0]?.timestamp, '2026-06-02T10:00:00.000Z');
});

test('observation creates always pin a traceId so the chain stays in one trace', () => {
  for (const operation of ['spanCreate', 'generationCreate', 'eventCreate'] as const) {
    const events = buildEventsForOperation(operation, { name: 'work' });
    const traceId = String((events[0]?.body as { traceId?: unknown }).traceId);
    assert.match(traceId, /^[0-9a-f]{32}$/, `${operation} should mint a traceId`);
    // The minted id is reported back, so the next step can attach to it.
    assert.equal(summarizeIngestionEvents(events).traceId, traceId);
  }
});

test('observation updates never invent a traceId, which would re-point the observation', () => {
  for (const operation of ['spanUpdate', 'generationUpdate'] as const) {
    const events = buildEventsForOperation(operation, { observationId: 'obs-1' });
    assert.equal((events[0]?.body as { traceId?: unknown }).traceId, undefined);
  }
});

test('finalizeSpan puts the generation and the span update in the same trace', () => {
  const events = buildEventsForOperation('finalizeSpan', { traceId: 'trace-1', observationId: 'span-1' });
  const [generation, spanUpdate] = events;
  assert.equal((generation?.body as { traceId?: unknown }).traceId, 'trace-1');
  assert.equal((spanUpdate?.body as { traceId?: unknown }).traceId, 'trace-1');
  assert.equal((generation?.body as { parentObservationId?: unknown }).parentObservationId, 'span-1');
  // The generation closes with the span so it has a duration in Langfuse.
  assert.equal((generation?.body as { endTime?: unknown }).endTime, (spanUpdate?.body as { endTime?: unknown }).endTime);
});

test('finalizeSpan folds the token fields into Langfuse usage buckets', () => {
  const events = buildEventsForOperation('finalizeSpan', {
    traceId: 'trace-1',
    observationId: 'span-1',
    promptTokens: '150',
    completionTokens: '42',
    totalTokens: '192',
  });
  assert.deepEqual(events[0]?.body.usageDetails, { input: 150, output: 42, total: 192 });
});

test('usage details map legacy token keys and coerce string values to numbers', () => {
  const events = buildEventsForOperation('generationCreate', {
    traceId: 'trace-1',
    observationId: 'gen-1',
    usageDetailsJson: '{"prompt_tokens":"10","completion_tokens":"20","total_tokens":"30","cache_read":"5"}',
  });
  assert.deepEqual(events[0]?.body.usageDetails, { input: 10, output: 20, total: 30, cache_read: 5 });
});

test('usage details JSON wins over the token fields for the same bucket', () => {
  const events = buildEventsForOperation('generationCreate', {
    traceId: 'trace-1',
    observationId: 'gen-1',
    promptTokens: '1',
    totalTokens: '3',
    usageDetailsJson: '{"input":99}',
  });
  assert.deepEqual(events[0]?.body.usageDetails, { input: 99, total: 3 });
});

test('prompt labels are stored as metadata prompt_labels, not a dropped top-level field', () => {
  const events = buildEventsForOperation('finalizeSpan', {
    traceId: 'trace-1',
    observationId: 'span-1',
    promptLabelsJson: '["production"]',
    metadataJson: '{"source":"n8n"}',
  });
  assert.deepEqual(events[0]?.body.metadata, { source: 'n8n', prompt_labels: ['production'] });
  assert.equal((events[0]?.body as { promptLabels?: unknown }).promptLabels, undefined);
});

test('prompt labels work without any other metadata', () => {
  const events = buildEventsForOperation('generationCreate', {
    traceId: 'trace-1', observationId: 'gen-1', promptLabelsJson: '["production"]',
  });
  assert.deepEqual(events[0]?.body.metadata, { prompt_labels: ['production'] });
});

test('loose timestamps are normalized to ISO 8601 instead of being rejected by Langfuse', () => {
  const events = buildEventsForOperation('spanCreate', {
    traceId: 'trace-1',
    observationId: 'span-1',
    startTime: '2026-06-02 10:00:00',
  });
  assert.match(String((events[0]?.body as { startTime?: unknown }).startTime), /^2026-06-02T\d{2}:00:00\.000Z$/);

  const epoch = buildEventsForOperation('spanUpdate', {
    observationId: 'span-1',
    endTime: '1780394400000',
  });
  assert.equal((epoch[0]?.body as { endTime?: unknown }).endTime, new Date(1780394400000).toISOString());
});

test('an explicit Timestamp also drives the observation start/end time, as Make derives both from one date', () => {
  const span = buildEventsForOperation('spanCreate', {
    traceId: 'trace-1', observationId: 'span-1', timestamp: '2026-06-02T10:00:00.000Z',
  });
  assert.equal((span[0]?.body as { startTime?: unknown }).startTime, '2026-06-02T10:00:00.000Z');
  assert.equal(span[0]?.timestamp, '2026-06-02T10:00:00.000Z');

  const update = buildEventsForOperation('spanUpdate', {
    observationId: 'span-1', timestamp: '2026-06-02T10:00:05.000Z',
  });
  assert.equal((update[0]?.body as { endTime?: unknown }).endTime, '2026-06-02T10:00:05.000Z');
});
