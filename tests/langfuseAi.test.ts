import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  substitutePromptVariables,
  extractMessagesFromPrompt,
  callOpenAi,
  runLangfuseAi,
  type OpenAiCredentials,
} from '../src/langfuseAi.js';
import type { LangfuseCredentials } from '../src/langfuse.js';

// ---------------------------------------------------------------------------
// substitutePromptVariables
// ---------------------------------------------------------------------------

test('substitutePromptVariables — replaces known variables', () => {
  const result = substitutePromptVariables('Hello {{name}}, you are {{role}}.', { name: 'Alice', role: 'admin' });
  assert.equal(result, 'Hello Alice, you are admin.');
});

test('substitutePromptVariables — leaves unknown variables unchanged', () => {
  const result = substitutePromptVariables('Hello {{name}}, you are {{role}}.', { name: 'Alice' });
  assert.equal(result, 'Hello Alice, you are {{role}}.');
});

test('substitutePromptVariables — no variables in template', () => {
  const result = substitutePromptVariables('Plain text', { name: 'Alice' });
  assert.equal(result, 'Plain text');
});

test('substitutePromptVariables — empty vars object leaves placeholders', () => {
  const result = substitutePromptVariables('Hello {{name}}', {});
  assert.equal(result, 'Hello {{name}}');
});

// ---------------------------------------------------------------------------
// extractMessagesFromPrompt
// ---------------------------------------------------------------------------

test('extractMessagesFromPrompt — text prompt returns system message', () => {
  const raw = { type: 'text', prompt: 'You are {{role}}.' };
  const msgs = extractMessagesFromPrompt(raw, { role: 'a helpful assistant' });
  assert.deepEqual(msgs, [{ role: 'system', content: 'You are a helpful assistant.' }]);
});

test('extractMessagesFromPrompt — text prompt without explicit type falls back to text', () => {
  const raw = { prompt: 'Be concise.' };
  const msgs = extractMessagesFromPrompt(raw, {});
  assert.deepEqual(msgs, [{ role: 'system', content: 'Be concise.' }]);
});

test('extractMessagesFromPrompt — chat prompt returns message array', () => {
  const raw = {
    type: 'chat',
    prompt: [
      { role: 'system', content: 'You are {{persona}}.' },
      { role: 'user', content: 'Answer: {{question}}' },
    ],
  };
  const msgs = extractMessagesFromPrompt(raw, { persona: 'an expert', question: 'What is 2+2?' });
  assert.deepEqual(msgs, [
    { role: 'system', content: 'You are an expert.' },
    { role: 'user', content: 'Answer: What is 2+2?' },
  ]);
});

test('extractMessagesFromPrompt — non-object returns empty array', () => {
  assert.deepEqual(extractMessagesFromPrompt(null, {}), []);
  assert.deepEqual(extractMessagesFromPrompt('string', {}), []);
  assert.deepEqual(extractMessagesFromPrompt(42, {}), []);
});

test('extractMessagesFromPrompt — text prompt with missing prompt field returns empty', () => {
  const raw = { type: 'text' };
  assert.deepEqual(extractMessagesFromPrompt(raw, {}), []);
});

// ---------------------------------------------------------------------------
// callOpenAi
// ---------------------------------------------------------------------------

interface FetchCall { url: string; method: string; body: unknown; headers: Record<string, string> }

function withFetch(handler: (call: FetchCall) => { status: number; body: unknown }): {
  calls: FetchCall[];
  restore: () => void;
} {
  const calls: FetchCall[] = [];
  const original = globalThis.fetch;
  globalThis.fetch = (async (input: unknown, init?: { method?: string; body?: unknown; headers?: unknown; signal?: unknown }) => {
    let body: unknown;
    if (init?.body !== undefined) {
      try { body = JSON.parse(String(init.body)); } catch { body = init.body; }
    }
    const headers: Record<string, string> = {};
    if (init?.headers && typeof init.headers === 'object') {
      for (const [k, v] of Object.entries(init.headers as Record<string, string>)) {
        headers[k] = v;
      }
    }
    const call: FetchCall = { url: String(input), method: init?.method ?? 'GET', body, headers };
    calls.push(call);
    const { status, body: respBody } = handler(call);
    return new Response(JSON.stringify(respBody), {
      status,
      headers: { 'content-type': 'application/json' },
    });
  }) as typeof fetch;
  return { calls, restore: () => { globalThis.fetch = original; } };
}

const FAKE_OPENAI_RESPONSE = {
  id: 'chatcmpl-test',
  model: 'gpt-4o',
  choices: [{ message: { role: 'assistant', content: 'Hello!' } }],
  usage: { prompt_tokens: 10, completion_tokens: 5, total_tokens: 15 },
};

test('callOpenAi — sends correct request and returns parsed response', async () => {
  const { calls, restore } = withFetch(() => ({ status: 200, body: FAKE_OPENAI_RESPONSE }));
  try {
    const result = await callOpenAi({
      apiKey: 'sk-test',
      model: 'gpt-4o',
      messages: [{ role: 'user', content: 'Hi' }],
    });
    assert.equal(calls.length, 1);
    assert.equal(calls[0].url, 'https://api.openai.com/v1/chat/completions');
    assert.equal(calls[0].method, 'POST');
    assert.equal((calls[0].body as Record<string, unknown>).model, 'gpt-4o');
    assert.equal(calls[0].headers['Authorization'], 'Bearer sk-test');
    assert.equal(result.choices[0].message.content, 'Hello!');
    assert.equal(result.usage.total_tokens, 15);
  } finally {
    restore();
  }
});

test('callOpenAi — uses custom baseUrl', async () => {
  const { calls, restore } = withFetch(() => ({ status: 200, body: FAKE_OPENAI_RESPONSE }));
  try {
    await callOpenAi({
      apiKey: 'sk-test',
      baseUrl: 'https://my-proxy.example.com',
      model: 'gpt-4o',
      messages: [],
    });
    assert.ok(calls[0].url.startsWith('https://my-proxy.example.com'));
  } finally {
    restore();
  }
});

test('callOpenAi — forwards temperature and max_tokens', async () => {
  const { calls, restore } = withFetch(() => ({ status: 200, body: FAKE_OPENAI_RESPONSE }));
  try {
    await callOpenAi({
      apiKey: 'sk-test',
      model: 'gpt-4o',
      messages: [],
      temperature: 0.5,
      maxTokens: 256,
    });
    const body = calls[0].body as Record<string, unknown>;
    assert.equal(body.temperature, 0.5);
    assert.equal(body.max_tokens, 256);
  } finally {
    restore();
  }
});

test('callOpenAi — throws on non-2xx status', async () => {
  const { restore } = withFetch(() => ({ status: 401, body: { error: { message: 'Invalid API key' } } }));
  try {
    await assert.rejects(
      () => callOpenAi({ apiKey: 'bad', model: 'gpt-4o', messages: [] }),
      /OpenAI request failed with status 401/,
    );
  } finally {
    restore();
  }
});

test('callOpenAi — sends OpenAI-Organization header when organizationId set', async () => {
  const { calls, restore } = withFetch(() => ({ status: 200, body: FAKE_OPENAI_RESPONSE }));
  try {
    await callOpenAi({ apiKey: 'sk-test', organizationId: 'org-abc', model: 'gpt-4o', messages: [] });
    assert.equal(calls[0].headers['OpenAI-Organization'], 'org-abc');
  } finally {
    restore();
  }
});

// ---------------------------------------------------------------------------
// runLangfuseAi
// ---------------------------------------------------------------------------

const LANGFUSE_CREDS: LangfuseCredentials = {
  baseUrl: 'https://cloud.langfuse.com',
  publicKey: 'pk-test',
  secretKey: 'sk-test',
};

const OPENAI_CREDS: OpenAiCredentials = { apiKey: 'sk-openai-test' };

test('runLangfuseAi — returns content, traceId, generationId, model, messages, usage', async () => {
  const { restore } = withFetch((call) => {
    if (call.url.includes('openai')) {
      return { status: 200, body: FAKE_OPENAI_RESPONSE };
    }
    return { status: 200, body: { successes: [], errors: [] } };
  });
  try {
    const result = await runLangfuseAi(
      { model: 'gpt-4o', userMessage: 'Hi' },
      LANGFUSE_CREDS,
      OPENAI_CREDS,
    );
    assert.equal(result.content, 'Hello!');
    assert.equal(result.model, 'gpt-4o');
    assert.ok(typeof result.traceId === 'string' && result.traceId.length > 0);
    assert.ok(typeof result.generationId === 'string' && result.generationId.length > 0);
    assert.equal(result.usage.promptTokens, 10);
    assert.equal(result.usage.completionTokens, 5);
    assert.equal(result.usage.totalTokens, 15);
    // output messages = sent messages + assistant reply
    const last = result.messages[result.messages.length - 1];
    assert.equal(last?.role, 'assistant');
    assert.equal(last?.content, 'Hello!');
  } finally {
    restore();
  }
});

test('runLangfuseAi — uses systemMessage when no promptName', async () => {
  const { calls, restore } = withFetch((call) => {
    if (call.url.includes('openai')) return { status: 200, body: FAKE_OPENAI_RESPONSE };
    return { status: 200, body: { successes: [], errors: [] } };
  });
  try {
    await runLangfuseAi(
      { model: 'gpt-4o', userMessage: 'Hello', systemMessage: 'You are a pirate.' },
      LANGFUSE_CREDS,
      OPENAI_CREDS,
    );
    const openAiCall = calls.find((c) => c.url.includes('openai'));
    const messages = (openAiCall?.body as Record<string, unknown>)?.messages as unknown[];
    assert.ok(Array.isArray(messages));
    assert.equal((messages[0] as Record<string, unknown>).content, 'You are a pirate.');
    assert.equal((messages[0] as Record<string, unknown>).role, 'system');
  } finally {
    restore();
  }
});

test('runLangfuseAi — fetches Langfuse prompt when promptName given', async () => {
  const { calls, restore } = withFetch((call) => {
    if (call.url.includes('openai')) return { status: 200, body: FAKE_OPENAI_RESPONSE };
    if (call.url.includes('prompts')) {
      return { status: 200, body: { type: 'text', prompt: 'You are {{persona}}.', name: 'test-prompt', version: 1 } };
    }
    return { status: 200, body: { successes: [], errors: [] } };
  });
  try {
    await runLangfuseAi(
      { model: 'gpt-4o', userMessage: 'Hi', promptName: 'test-prompt', promptVariables: { persona: 'a chef' } },
      LANGFUSE_CREDS,
      OPENAI_CREDS,
    );
    const promptCall = calls.find((c) => c.url.includes('prompts'));
    assert.ok(promptCall, 'should have called Langfuse prompts endpoint');
    const openAiCall = calls.find((c) => c.url.includes('openai'));
    const messages = (openAiCall?.body as Record<string, unknown>)?.messages as unknown[];
    assert.equal((messages[0] as Record<string, unknown>).content, 'You are a chef.');
  } finally {
    restore();
  }
});

test('runLangfuseAi — previousMessages are inserted between system and user message', async () => {
  const { calls, restore } = withFetch((call) => {
    if (call.url.includes('openai')) return { status: 200, body: FAKE_OPENAI_RESPONSE };
    return { status: 200, body: { successes: [], errors: [] } };
  });
  try {
    await runLangfuseAi(
      {
        model: 'gpt-4o',
        systemMessage: 'Be concise.',
        previousMessages: [
          { role: 'user', content: 'What is 2+2?' },
          { role: 'assistant', content: '4' },
        ],
        userMessage: 'Are you sure?',
      },
      LANGFUSE_CREDS,
      OPENAI_CREDS,
    );
    const openAiCall = calls.find((c) => c.url.includes('openai'));
    const messages = (openAiCall?.body as Record<string, unknown>)?.messages as Array<{ role: string; content: string }>;
    assert.equal(messages[0]?.role, 'system');
    assert.equal(messages[1]?.role, 'user');
    assert.equal(messages[1]?.content, 'What is 2+2?');
    assert.equal(messages[2]?.role, 'assistant');
    assert.equal(messages[3]?.role, 'user');
    assert.equal(messages[3]?.content, 'Are you sure?');
  } finally {
    restore();
  }
});

test('runLangfuseAi — output messages array includes assistant reply for chaining', async () => {
  const { restore } = withFetch((call) => {
    if (call.url.includes('openai')) return { status: 200, body: FAKE_OPENAI_RESPONSE };
    return { status: 200, body: { successes: [], errors: [] } };
  });
  try {
    const result = await runLangfuseAi(
      { model: 'gpt-4o', systemMessage: 'Be helpful.', userMessage: 'Hi' },
      LANGFUSE_CREDS,
      OPENAI_CREDS,
    );
    assert.equal(result.messages.length, 3); // system + user + assistant
    assert.equal(result.messages[2]?.role, 'assistant');
    assert.equal(result.messages[2]?.content, 'Hello!');
  } finally {
    restore();
  }
});

test('runLangfuseAi — extracts promptVersion from Langfuse prompt response', async () => {
  const { calls, restore } = withFetch((call) => {
    if (call.url.includes('openai')) return { status: 200, body: FAKE_OPENAI_RESPONSE };
    if (call.url.includes('prompts')) {
      return { status: 200, body: { type: 'text', prompt: 'You are helpful.', name: 'my-prompt', version: 7 } };
    }
    return { status: 200, body: { successes: [], errors: [] } };
  });
  try {
    await runLangfuseAi(
      { model: 'gpt-4o', userMessage: 'Hi', promptName: 'my-prompt' },
      LANGFUSE_CREDS,
      OPENAI_CREDS,
    );
    await new Promise<void>((r) => setTimeout(r, 10)); // flush fire-and-forget
    const ingestionCall = calls.find((c) => c.url.includes('ingestion'));
    const batch = (ingestionCall?.body as Record<string, unknown>)?.batch as Array<Record<string, unknown>>;
    const genEvent = batch?.find((e) => e.type === 'generation-create');
    const genBody = genEvent?.body as Record<string, unknown>;
    assert.equal(genBody?.promptName, 'my-prompt');
    assert.equal(genBody?.promptVersion, 7);
  } finally {
    restore();
  }
});

test('runLangfuseAi — logs modelParameters when temperature and maxTokens set', async () => {
  const { calls, restore } = withFetch((call) => {
    if (call.url.includes('openai')) return { status: 200, body: FAKE_OPENAI_RESPONSE };
    return { status: 200, body: { successes: [], errors: [] } };
  });
  try {
    await runLangfuseAi(
      { model: 'gpt-4o', userMessage: 'Hi', temperature: 0.3, maxTokens: 512 },
      LANGFUSE_CREDS,
      OPENAI_CREDS,
    );
    await new Promise<void>((r) => setTimeout(r, 10)); // flush fire-and-forget
    const ingestionCall = calls.find((c) => c.url.includes('ingestion'));
    const batch = (ingestionCall?.body as Record<string, unknown>)?.batch as Array<Record<string, unknown>>;
    const genEvent = batch?.find((e) => e.type === 'generation-create');
    const genBody = genEvent?.body as Record<string, unknown>;
    const modelParams = genBody?.modelParameters as Record<string, unknown>;
    assert.equal(modelParams?.temperature, 0.3);
    assert.equal(modelParams?.max_tokens, 512);
  } finally {
    restore();
  }
});

test('runLangfuseAi — Langfuse ingestion failure does not throw', async () => {
  let ingestionCalled = false;
  const { restore } = withFetch((call) => {
    if (call.url.includes('openai')) return { status: 200, body: FAKE_OPENAI_RESPONSE };
    ingestionCalled = true;
    return { status: 500, body: { error: 'server error' } };
  });
  try {
    const result = await runLangfuseAi(
      { model: 'gpt-4o', userMessage: 'Hi' },
      LANGFUSE_CREDS,
      OPENAI_CREDS,
    );
    assert.equal(result.content, 'Hello!', 'should still return content despite ingestion failure');
    // Give the fire-and-forget a tick to run
    await new Promise<void>((r) => setTimeout(r, 10));
    assert.ok(ingestionCalled, 'should have attempted ingestion');
  } finally {
    restore();
  }
});
