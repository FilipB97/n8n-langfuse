import {
  createTraceId,
  createObservationId,
  createTraceEvent,
  createGenerationEvent,
  sendLangfuseIngestion,
  fetchLangfusePrompt,
  currentTimestamp,
  withRetry,
  type LangfuseCredentials,
} from './langfuse.js';

export interface OpenAiCredentials {
  apiKey: string;
  organizationId?: string;
  baseUrl?: string;
}

export interface OpenAiMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface LangfuseAiInput {
  model: string;
  userMessage: string;
  systemMessage?: string;
  previousMessages?: OpenAiMessage[];
  promptName?: string;
  promptLabel?: string;
  promptVersion?: string | number;
  promptVariables?: Record<string, string>;
  temperature?: number;
  maxTokens?: number;
  traceName?: string;
  sessionId?: string;
  userId?: string;
  tags?: string[];
  environment?: string;
}

export interface LangfuseAiResult {
  content: string;
  traceId: string;
  generationId: string;
  model: string;
  messages: OpenAiMessage[];
  usage: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
}

export function substitutePromptVariables(template: string, vars: Record<string, string>): string {
  return template.replace(/\{\{(\w+)\}\}/gu, (_match, key: string) => vars[key] ?? `{{${key}}}`);
}

type PromptMessage = { role: string; content: string };

function extractTextPrompt(raw: unknown, vars: Record<string, string>): OpenAiMessage[] {
  if (typeof raw !== 'object' || raw === null) return [];
  const obj = raw as Record<string, unknown>;
  if (typeof obj.prompt !== 'string') return [];
  return [{ role: 'system', content: substitutePromptVariables(obj.prompt, vars) }];
}

function extractChatPrompt(raw: unknown, vars: Record<string, string>): OpenAiMessage[] {
  if (typeof raw !== 'object' || raw === null) return [];
  const obj = raw as Record<string, unknown>;
  if (!Array.isArray(obj.prompt)) return [];
  return (obj.prompt as unknown[])
    .filter((m): m is PromptMessage =>
      typeof m === 'object' && m !== null &&
      typeof (m as PromptMessage).role === 'string' &&
      typeof (m as PromptMessage).content === 'string',
    )
    .map((m) => ({
      role: m.role as 'system' | 'user' | 'assistant',
      content: substitutePromptVariables(m.content, vars),
    }));
}

export function extractMessagesFromPrompt(raw: unknown, vars: Record<string, string>): OpenAiMessage[] {
  if (typeof raw !== 'object' || raw === null) return [];
  const obj = raw as Record<string, unknown>;
  return obj.type === 'chat' ? extractChatPrompt(raw, vars) : extractTextPrompt(raw, vars);
}

export interface OpenAiCallOptions {
  apiKey: string;
  organizationId?: string;
  baseUrl?: string;
  model: string;
  messages: OpenAiMessage[];
  temperature?: number;
  maxTokens?: number;
  timeoutMs?: number;
  fetchImpl?: typeof fetch;
}

export interface OpenAiResponse {
  id: string;
  model: string;
  choices: Array<{ message: { role: string; content: string } }>;
  usage: { prompt_tokens: number; completion_tokens: number; total_tokens: number };
}

export async function callOpenAi(options: OpenAiCallOptions): Promise<OpenAiResponse> {
  const fetchImpl = options.fetchImpl ?? fetch;
  const base = options.baseUrl?.trim().replace(/\/+$/u, '') ?? 'https://api.openai.com';
  const url = `${base}/v1/chat/completions`;

  const headers: Record<string, string> = {
    Authorization: `Bearer ${options.apiKey}`,
    'Content-Type': 'application/json',
  };
  if (options.organizationId) headers['OpenAI-Organization'] = options.organizationId;

  const body: Record<string, unknown> = { model: options.model, messages: options.messages };
  if (options.temperature !== undefined) body.temperature = options.temperature;
  if (options.maxTokens !== undefined) body.max_tokens = options.maxTokens;

  const controller = new AbortController();
  let timeout: ReturnType<typeof setTimeout> | undefined;
  if (options.timeoutMs && options.timeoutMs > 0) {
    timeout = setTimeout(() => controller.abort(new Error(`OpenAI request timed out after ${options.timeoutMs}ms`)), options.timeoutMs);
  }

  try {
    const response = await fetchImpl(url, {
      method: 'POST',
      headers,
      body: JSON.stringify(body),
      signal: controller.signal,
    });

    const text = await response.text();
    if (!response.ok) {
      let errorBody: unknown = text;
      try { errorBody = JSON.parse(text) as unknown; } catch { /* keep raw text */ }
      throw new Error(
        `OpenAI request failed with status ${response.status}: ${typeof errorBody === 'object' ? JSON.stringify(errorBody) : text}`,
      );
    }

    return JSON.parse(text) as OpenAiResponse;
  } finally {
    if (timeout) clearTimeout(timeout);
  }
}

export async function runLangfuseAi(
  input: LangfuseAiInput,
  langfuseCreds: LangfuseCredentials,
  openAiCreds: OpenAiCredentials,
  fetchImpl?: typeof fetch,
): Promise<LangfuseAiResult> {
  const messages: OpenAiMessage[] = [];

  // Resolved from Langfuse prompt response (version number returned by the API).
  let resolvedPromptVersion: number | string | undefined;

  if (input.promptName) {
    const promptResp = await withRetry(() =>
      fetchLangfusePrompt({
        baseUrl: langfuseCreds.baseUrl,
        publicKey: langfuseCreds.publicKey,
        secretKey: langfuseCreds.secretKey,
        promptName: input.promptName as string,
        ...(input.promptLabel ? { label: input.promptLabel } : {}),
        ...(input.promptVersion !== undefined ? { version: input.promptVersion } : {}),
        ...(langfuseCreds.timeoutMs !== undefined ? { timeoutMs: langfuseCreds.timeoutMs } : {}),
        ...(fetchImpl ? { fetchImpl } : {}),
      }),
    );
    messages.push(...extractMessagesFromPrompt(promptResp.raw, input.promptVariables ?? {}));
    if (typeof promptResp.raw === 'object' && promptResp.raw !== null) {
      const raw = promptResp.raw as Record<string, unknown>;
      if (typeof raw.version === 'number') resolvedPromptVersion = raw.version;
    }
  } else if (input.systemMessage) {
    messages.push({ role: 'system', content: input.systemMessage });
  }

  if (input.previousMessages?.length) {
    messages.push(...input.previousMessages);
  }

  messages.push({ role: 'user', content: input.userMessage });

  const traceId = createTraceId();
  const generationId = createObservationId();
  const startTime = currentTimestamp();

  const openAiResponse = await callOpenAi({
    apiKey: openAiCreds.apiKey,
    model: input.model,
    messages,
    ...(openAiCreds.organizationId ? { organizationId: openAiCreds.organizationId } : {}),
    ...(openAiCreds.baseUrl ? { baseUrl: openAiCreds.baseUrl } : {}),
    ...(input.temperature !== undefined ? { temperature: input.temperature } : {}),
    ...(input.maxTokens !== undefined ? { maxTokens: input.maxTokens } : {}),
    ...(langfuseCreds.timeoutMs !== undefined ? { timeoutMs: langfuseCreds.timeoutMs } : {}),
    ...(fetchImpl ? { fetchImpl } : {}),
  });

  const endTime = currentTimestamp();
  const content = openAiResponse.choices[0]?.message?.content ?? '';
  const usedModel = openAiResponse.model ?? input.model;
  const rawUsage = openAiResponse.usage;

  const outputMessages: OpenAiMessage[] = [...messages, { role: 'assistant', content }];

  const usageDetails: Record<string, number> = {};
  if (rawUsage) {
    if (rawUsage.prompt_tokens) usageDetails.input = rawUsage.prompt_tokens;
    if (rawUsage.completion_tokens) usageDetails.output = rawUsage.completion_tokens;
    if (rawUsage.total_tokens) usageDetails.total = rawUsage.total_tokens;
  }

  const modelParameters: Record<string, unknown> = {};
  if (input.temperature !== undefined) modelParameters.temperature = input.temperature;
  if (input.maxTokens !== undefined) modelParameters.max_tokens = input.maxTokens;

  const traceEvent = createTraceEvent({
    traceId,
    name: input.traceName ?? usedModel,
    input: messages,
    output: content,
    ...(input.sessionId ? { sessionId: input.sessionId } : {}),
    ...(input.userId ? { userId: input.userId } : {}),
    ...(input.tags?.length ? { tags: input.tags } : {}),
    ...(input.environment ? { environment: input.environment } : {}),
  });

  const generationEvent = createGenerationEvent({
    traceId,
    observationId: generationId,
    name: 'openai-completion',
    model: usedModel,
    input: messages,
    output: content,
    startTime,
    endTime,
    ...(input.promptName ? { promptName: input.promptName } : {}),
    ...(resolvedPromptVersion !== undefined ? { promptVersion: resolvedPromptVersion } : {}),
    ...(Object.keys(modelParameters).length ? { modelParameters } : {}),
    ...(Object.keys(usageDetails).length ? { usageDetails } : {}),
    ...(input.environment ? { environment: input.environment } : {}),
  });

  sendLangfuseIngestion({
    baseUrl: langfuseCreds.baseUrl,
    publicKey: langfuseCreds.publicKey,
    secretKey: langfuseCreds.secretKey,
    batch: [traceEvent, generationEvent],
    ...(langfuseCreds.timeoutMs !== undefined ? { timeoutMs: langfuseCreds.timeoutMs } : {}),
    ...(fetchImpl ? { fetchImpl } : {}),
  }).catch(() => { /* fire-and-forget: Langfuse logging must not break the node */ });

  return {
    content,
    traceId,
    generationId,
    model: usedModel,
    messages: outputMessages,
    usage: {
      promptTokens: rawUsage?.prompt_tokens ?? 0,
      completionTokens: rawUsage?.completion_tokens ?? 0,
      totalTokens: rawUsage?.total_tokens ?? 0,
    },
  };
}
