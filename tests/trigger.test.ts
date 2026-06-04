import { test } from 'node:test';
import assert from 'node:assert/strict';

import { pollLangfuse } from '../src/langfuseTrigger.js';
import type { LangfusePollContext } from '../src/n8n-lite.js';

function withFetch(body: unknown): { calls: string[]; restore: () => void } {
  const calls: string[] = [];
  const original = globalThis.fetch;
  globalThis.fetch = (async (input: unknown) => {
    calls.push(String(input));
    return new Response(JSON.stringify(body), { status: 200, headers: { 'content-type': 'application/json' } });
  }) as typeof fetch;
  return { calls, restore: () => { globalThis.fetch = original; } };
}

function makeContext(opts: { event?: string; staticData?: Record<string, unknown>; mode?: string }): {
  context: LangfusePollContext;
  staticData: Record<string, unknown>;
} {
  const staticData = opts.staticData ?? {};
  const context: LangfusePollContext = {
    getNodeParameter: (name: string) => (name === 'event' ? opts.event ?? 'trace' : undefined),
    getCredentials: async () => ({ baseUrl: 'https://cloud.langfuse.com', publicKey: 'pk', secretKey: 'sk' }),
    getWorkflowStaticData: () => staticData,
    getMode: () => opts.mode ?? 'trigger',
  };
  return { context, staticData };
}

test('first poll establishes a baseline and emits nothing', async () => {
  const stub = withFetch({ data: [{ id: 't1' }, { id: 't2' }] });
  try {
    const { context, staticData } = makeContext({ event: 'trace' });
    const result = await pollLangfuse(context);
    assert.equal(result, null);
    assert.equal(typeof staticData.lastPolledAt, 'string');
    assert.deepEqual(staticData.seenIds, ['t1', 't2']);
    // Baseline poll has no cursor yet, so no time filter is sent.
    assert.doesNotMatch(stub.calls[0] ?? '', /fromTimestamp/);
    assert.match(stub.calls[0] ?? '', /\/api\/public\/traces\?/);
  } finally {
    stub.restore();
  }
});

test('subsequent poll emits only new records and de-duplicates by id', async () => {
  const stub = withFetch({ data: [{ id: 't1' }, { id: 't2' }] });
  try {
    const { context, staticData } = makeContext({
      event: 'trace',
      staticData: { lastPolledAt: '2026-01-01T00:00:00.000Z', seenIds: ['t1'] },
    });
    const result = await pollLangfuse(context);
    assert.deepEqual(result, [[{ json: { id: 't2' } }]]);
    assert.deepEqual(staticData.seenIds, ['t1', 't2']);
    assert.notEqual(staticData.lastPolledAt, '2026-01-01T00:00:00.000Z');
    assert.match(stub.calls[0] ?? '', /fromTimestamp=2026-01-01/);
  } finally {
    stub.restore();
  }
});

test('subsequent poll with no new records returns null', async () => {
  const stub = withFetch({ data: [{ id: 't1' }] });
  try {
    const { context } = makeContext({
      event: 'trace',
      staticData: { lastPolledAt: '2026-01-01T00:00:00.000Z', seenIds: ['t1'] },
    });
    const result = await pollLangfuse(context);
    assert.equal(result, null);
  } finally {
    stub.restore();
  }
});

test('manual mode returns a sample without touching the cursor', async () => {
  const stub = withFetch({ data: [{ id: 'sample' }] });
  try {
    const { context, staticData } = makeContext({ event: 'trace', mode: 'manual' });
    const result = await pollLangfuse(context);
    assert.deepEqual(result, [[{ json: { id: 'sample' } }]]);
    assert.equal(staticData.lastPolledAt, undefined);
    assert.match(stub.calls[0] ?? '', /limit=1/);
    assert.doesNotMatch(stub.calls[0] ?? '', /fromTimestamp/);
  } finally {
    stub.restore();
  }
});

test('observation event polls /v2/observations with fromStartTime', async () => {
  const stub = withFetch({ data: [] });
  try {
    const { context } = makeContext({
      event: 'observation',
      staticData: { lastPolledAt: '2026-01-02T00:00:00.000Z', seenIds: [] },
    });
    const result = await pollLangfuse(context);
    assert.equal(result, null);
    assert.match(stub.calls[0] ?? '', /\/api\/public\/v2\/observations\?/);
    assert.match(stub.calls[0] ?? '', /fromStartTime=2026-01-02/);
    assert.doesNotMatch(stub.calls[0] ?? '', /fromTimestamp/);
  } finally {
    stub.restore();
  }
});

test('score event polls /v2/scores with fromTimestamp', async () => {
  const stub = withFetch({ data: [] });
  try {
    const { context } = makeContext({
      event: 'score',
      staticData: { lastPolledAt: '2026-01-03T00:00:00.000Z', seenIds: [] },
    });
    await pollLangfuse(context);
    assert.match(stub.calls[0] ?? '', /\/api\/public\/v2\/scores\?/);
    assert.match(stub.calls[0] ?? '', /fromTimestamp=2026-01-03/);
  } finally {
    stub.restore();
  }
});
