import { test } from 'node:test';
import assert from 'node:assert/strict';

import { Langfuse } from '../nodes/Langfuse/Langfuse.node.js';
import type { LangfuseExecuteContext, NodeInputItem } from '../src/n8n-lite.js';

// ---------------------------------------------------------------------------
// Test helpers — a mock execute context and a global fetch stub.
// ---------------------------------------------------------------------------

type Params = Record<string, unknown>;

interface FetchCall {
  url: string;
  method: string;
  body: unknown;
}

function withFetch(handler: (call: FetchCall) => { status: number; body: unknown }): {
  calls: FetchCall[];
  restore: () => void;
} {
  const calls: FetchCall[] = [];
  const original = globalThis.fetch;
  globalThis.fetch = (async (input: unknown, init?: { method?: string; body?: unknown }) => {
    let body: unknown;
    if (init?.body !== undefined) {
      try {
        body = JSON.parse(String(init.body));
      } catch {
        body = init.body;
      }
    }
    const call: FetchCall = { url: String(input), method: init?.method ?? 'GET', body };
    calls.push(call);
    const { status, body: respBody } = handler(call);
    return new Response(JSON.stringify(respBody), {
      status,
      headers: { 'content-type': 'application/json' },
    });
  }) as typeof fetch;
  return { calls, restore: () => { globalThis.fetch = original; } };
}

function makeContext(opts: {
  paramsByIndex: Params[];
  continueOnFail?: boolean;
  items?: NodeInputItem[];
}): LangfuseExecuteContext {
  const items = opts.items ?? opts.paramsByIndex.map(() => ({ json: {} }));
  return {
    getInputData: () => items,
    getCredentials: async () => ({
      baseUrl: 'https://cloud.langfuse.com',
      publicKey: 'pk-test',
      secretKey: 'sk-test',
    }),
    getNodeParameter: (name: string, index: number) => {
      const p = opts.paramsByIndex[index] ?? {};
      if (Object.prototype.hasOwnProperty.call(p, name)) {
        return p[name];
      }
      // Mirror n8n: unknown params throw, which getOptionalNodeParameter swallows.
      throw new Error(`Could not get parameter "${name}"`);
    },
    continueOnFail: () => opts.continueOnFail ?? false,
  };
}

const execute = (ctx: LangfuseExecuteContext) => new Langfuse().getNodeType(2).execute.call(ctx);

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

test('routes a Public API GET operation and tags pairedItem', async () => {
  const stub = withFetch(() => ({ status: 200, body: { id: 'tr-1' } }));
  try {
    const ctx = makeContext({ paramsByIndex: [{ resource: 'trace', operation: 'getTrace', traceId: 'tr-1' }] });
    const [out] = await execute(ctx);
    assert.equal(out[0]?.json.resource, 'trace');
    assert.equal(out[0]?.json.operation, 'getTrace');
    assert.equal(out[0]?.json.ok, true);
    assert.deepEqual(out[0]?.json.data, { id: 'tr-1' });
    assert.deepEqual(out[0]?.pairedItem, { item: 0 });
    assert.equal(stub.calls[0]?.method, 'GET');
    assert.match(stub.calls[0]?.url ?? '', /\/api\/public\/traces\/tr-1$/);
  } finally {
    stub.restore();
  }
});

test('routes an ingestion operation to /ingestion and reports batch results', async () => {
  const stub = withFetch(() => ({ status: 207, body: { successes: [{ id: 'evt-1' }], errors: [] } }));
  try {
    const ctx = makeContext({ paramsByIndex: [{ resource: 'trace', operation: 'traceCreate', traceId: 'tr-1', name: 'demo' }] });
    const [out] = await execute(ctx);
    assert.equal(out[0]?.json.operation, 'traceCreate');
    assert.equal(out[0]?.json.ok, true);
    assert.equal(out[0]?.json.batchSize, 1);
    assert.match(String(out[0]?.json.requestUrl), /\/api\/public\/ingestion$/);
    assert.deepEqual(out[0]?.pairedItem, { item: 0 });
    assert.equal(stub.calls[0]?.method, 'POST');
    assert.match(stub.calls[0]?.url ?? '', /\/ingestion$/);
  } finally {
    stub.restore();
  }
});

test('routes createDataset to a POST with a JSON body', async () => {
  const stub = withFetch(() => ({ status: 200, body: { id: 'ds-1', name: 'd1' } }));
  try {
    const ctx = makeContext({ paramsByIndex: [{ resource: 'dataset', operation: 'createDataset', datasetName: 'd1' }] });
    const [out] = await execute(ctx);
    assert.equal(out[0]?.json.ok, true);
    assert.equal(stub.calls[0]?.method, 'POST');
    assert.match(stub.calls[0]?.url ?? '', /\/api\/public\/v2\/datasets$/);
    assert.deepEqual(stub.calls[0]?.body, { name: 'd1' });
  } finally {
    stub.restore();
  }
});

test('routes createDatasetRunItem to /dataset-run-items with required body fields', async () => {
  const stub = withFetch(() => ({ status: 200, body: { id: 'dri-1' } }));
  try {
    const ctx = makeContext({
      paramsByIndex: [{ resource: 'datasetRun', operation: 'createDatasetRunItem', runName: 'run-1', datasetItemId: 'item-1', traceId: 'tr-1' }],
    });
    const [out] = await execute(ctx);
    assert.equal(out[0]?.json.ok, true);
    assert.equal(stub.calls[0]?.method, 'POST');
    assert.match(stub.calls[0]?.url ?? '', /\/api\/public\/dataset-run-items$/);
    assert.deepEqual(stub.calls[0]?.body, { runName: 'run-1', datasetItemId: 'item-1', traceId: 'tr-1' });
  } finally {
    stub.restore();
  }
});

test('routes createPrompt to a POST /v2/prompts with a typed body', async () => {
  const stub = withFetch(() => ({ status: 201, body: { name: 'greeting', version: 1 } }));
  try {
    const ctx = makeContext({
      paramsByIndex: [{ resource: 'prompt', operation: 'createPrompt', promptName: 'greeting', promptType: 'text', promptText: 'Hello {{name}}' }],
    });
    const [out] = await execute(ctx);
    assert.equal(out[0]?.json.ok, true);
    assert.equal(stub.calls[0]?.method, 'POST');
    assert.match(stub.calls[0]?.url ?? '', /\/api\/public\/v2\/prompts$/);
    assert.deepEqual(stub.calls[0]?.body, { name: 'greeting', type: 'text', prompt: 'Hello {{name}}' });
  } finally {
    stub.restore();
  }
});

test('tags pairedItem per input item across multiple items', async () => {
  const stub = withFetch(() => ({ status: 200, body: { status: 'OK' } }));
  try {
    const ctx = makeContext({
      paramsByIndex: [
        { resource: 'system', operation: 'health' },
        { resource: 'system', operation: 'health' },
      ],
    });
    const [out] = await execute(ctx);
    assert.equal(out.length, 2);
    assert.deepEqual(out[0]?.pairedItem, { item: 0 });
    assert.deepEqual(out[1]?.pairedItem, { item: 1 });
  } finally {
    stub.restore();
  }
});

test('continueOnFail captures the error instead of throwing', async () => {
  const stub = withFetch(() => ({ status: 404, body: { message: 'not found' } }));
  try {
    const ctx = makeContext({
      paramsByIndex: [{ resource: 'trace', operation: 'getTrace', traceId: 'missing' }],
      continueOnFail: true,
    });
    const [out] = await execute(ctx);
    assert.equal(out[0]?.json.ok, false);
    assert.equal(out[0]?.json.operation, 'getTrace');
    assert.equal(typeof out[0]?.json.error, 'string');
    assert.deepEqual(out[0]?.pairedItem, { item: 0 });
  } finally {
    stub.restore();
  }
});

test('without continueOnFail a failed request rejects', async () => {
  const stub = withFetch(() => ({ status: 404, body: { message: 'not found' } }));
  try {
    const ctx = makeContext({
      paramsByIndex: [{ resource: 'trace', operation: 'getTrace', traceId: 'missing' }],
      continueOnFail: false,
    });
    await assert.rejects(() => execute(ctx));
  } finally {
    stub.restore();
  }
});
