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
  assert.equal(events[1]?.body.endTime, '2026-06-02T10:00:02.000Z');
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

test('summarizeIngestionEvents reports the trace id a span attaches to', () => {
  const events = buildEventsForOperation('spanCreate', { traceId: 'trace-123', observationId: 'span-1', name: 'work' });
  const summary = summarizeIngestionEvents(events);
  assert.equal(summary.traceId, 'trace-123');
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
