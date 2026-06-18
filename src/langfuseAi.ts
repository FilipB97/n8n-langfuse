import {
  createTraceId,
  createObservationId,
  createTraceEvent,
  createGenerationEvent,
  sendLangfuseIngestion,
  fetchLangfusePrompt,
  currentTimestamp,
  withRetry,
  LangfuseRequestError,
  type IngestionEvent,
  type LangfuseCredentials,
} from './langfuse.js';

export type LlmProvider = 'openai' | 'anthropic';

export interface OpenAiCredentials {
  apiKey: string;
  organizationId?: string;
  baseUrl?: string;
}

export interface AnthropicCredentials {
  apiKey: string;
  baseUrl?: string;
}

export type ProviderCredentials = OpenAiCredentials | AnthropicCredentials;

export interface OpenAiMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface LangfuseAiInput {
  provider?: LlmProvider;
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
  provider: LlmProvider;
  messages: OpenAiMessage[];
  usage: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
  /** Whether the trace/generation was successfully logged to Langfuse. */
  logged: boolean;
  /** Populated when logging failed; the AI call still succeeds regardless. */
  loggingError?: string;
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

// ---------------------------------------------------------------------------
// Normalized LLM response — both providers map to this shape so the rest of
// the node stays provider-agnostic.
// ---------------------------------------------------------------------------

interface NormalizedLlmResponse {
  model: string;
  content: string;
  usage: { promptTokens: number; completionTokens: number; totalTokens: number };
}

/**
 * Run a fetch with a timeout (the same AbortController pattern used by the
 * Langfuse transports) and surface non-2xx responses as a retryable
 * `LangfuseRequestError` so `withRetry` can back off on 429/5xx.
 */
async function postJson(
  url: string,
  headers: Record<string, string>,
  body: unknown,
  label: string,
  timeoutMs: number | undefined,
  fetchImpl: typeof fetch,
): Promise<unknown> {
  const controller = new AbortController();
  let timeout: ReturnType<typeof setTimeout> | undefined;
  if (timeoutMs && timeoutMs > 0) {
    timeout = setTimeout(() => controller.abort(new Error(`${label} request timed out after ${timeoutMs}ms`)), timeoutMs);
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
      throw new LangfuseRequestError(
        `${label} request failed with status ${response.status}: ${typeof errorBody === 'object' ? JSON.stringify(errorBody) : text}`,
        response.status,
        errorBody,
      );
    }

    return JSON.parse(text) as unknown;
  } finally {
    if (timeout) clearTimeout(timeout);
  }
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

  return await postJson(url, headers, body, 'OpenAI', options.timeoutMs, fetchImpl) as OpenAiResponse;
}

export interface AnthropicCallOptions {
  apiKey: string;
  baseUrl?: string;
  model: string;
  messages: OpenAiMessage[];
  temperature?: number;
  maxTokens?: number;
  timeoutMs?: number;
  fetchImpl?: typeof fetch;
}

export interface AnthropicResponse {
  id: string;
  model: string;
  content: Array<{ type: string; text?: string }>;
  usage: { input_tokens: number; output_tokens: number };
  stop_reason?: string;
}

// Anthropic requires max_tokens; use a sensible default when the user leaves it blank.
const ANTHROPIC_DEFAULT_MAX_TOKENS = 1024;

export async function callAnthropic(options: AnthropicCallOptions): Promise<AnthropicResponse> {
  const fetchImpl = options.fetchImpl ?? fetch;
  const base = options.baseUrl?.trim().replace(/\/+$/u, '') ?? 'https://api.anthropic.com';
  const url = `${base}/v1/messages`;

  const headers: Record<string, string> = {
    'x-api-key': options.apiKey,
    'anthropic-version': '2023-06-01',
    'Content-Type': 'application/json',
  };

  // Anthropic keeps the system prompt out of the messages array, and the
  // conversation only carries user/assistant turns.
  const systemPrompt = options.messages
    .filter((m) => m.role === 'system')
    .map((m) => m.content)
    .join('\n\n');
  const conversation = options.messages
    .filter((m) => m.role !== 'system')
    .map((m) => ({ role: m.role, content: m.content }));

  const body: Record<string, unknown> = {
    model: options.model,
    max_tokens: options.maxTokens ?? ANTHROPIC_DEFAULT_MAX_TOKENS,
    messages: conversation,
  };
  if (systemPrompt) body.system = systemPrompt;
  if (options.temperature !== undefined) body.temperature = options.temperature;

  return await postJson(url, headers, body, 'Anthropic', options.timeoutMs, fetchImpl) as AnthropicResponse;
}

function normalizeOpenAi(response: OpenAiResponse, fallbackModel: string): NormalizedLlmResponse {
  const usage = response.usage;
  return {
    model: response.model ?? fallbackModel,
    content: response.choices[0]?.message?.content ?? '',
    usage: {
      promptTokens: usage?.prompt_tokens ?? 0,
      completionTokens: usage?.completion_tokens ?? 0,
      totalTokens: usage?.total_tokens ?? 0,
    },
  };
}

function normalizeAnthropic(response: AnthropicResponse, fallbackModel: string): NormalizedLlmResponse {
  const content = (response.content ?? [])
    .filter((block) => block.type === 'text' && typeof block.text === 'string')
    .map((block) => block.text as string)
    .join('');
  const input = response.usage?.input_tokens ?? 0;
  const output = response.usage?.output_tokens ?? 0;
  return {
    model: response.model ?? fallbackModel,
    content,
    usage: { promptTokens: input, completionTokens: output, totalTokens: input + output },
  };
}

async function callProvider(
  provider: LlmProvider,
  input: LangfuseAiInput,
  messages: OpenAiMessage[],
  providerCreds: ProviderCredentials,
  timeoutMs: number | undefined,
  fetchImpl?: typeof fetch,
): Promise<NormalizedLlmResponse> {
  if (provider === 'anthropic') {
    const creds = providerCreds as AnthropicCredentials;
    const response = await withRetry(() =>
      callAnthropic({
        apiKey: creds.apiKey,
        model: input.model,
        messages,
        ...(creds.baseUrl ? { baseUrl: creds.baseUrl } : {}),
        ...(input.temperature !== undefined ? { temperature: input.temperature } : {}),
        ...(input.maxTokens !== undefined ? { maxTokens: input.maxTokens } : {}),
        ...(timeoutMs !== undefined ? { timeoutMs } : {}),
        ...(fetchImpl ? { fetchImpl } : {}),
      }),
    );
    return normalizeAnthropic(response, input.model);
  }

  const creds = providerCreds as OpenAiCredentials;
  const response = await withRetry(() =>
    callOpenAi({
      apiKey: creds.apiKey,
      model: input.model,
      messages,
      ...(creds.organizationId ? { organizationId: creds.organizationId } : {}),
      ...(creds.baseUrl ? { baseUrl: creds.baseUrl } : {}),
      ...(input.temperature !== undefined ? { temperature: input.temperature } : {}),
      ...(input.maxTokens !== undefined ? { maxTokens: input.maxTokens } : {}),
      ...(timeoutMs !== undefined ? { timeoutMs } : {}),
      ...(fetchImpl ? { fetchImpl } : {}),
    }),
  );
  return normalizeOpenAi(response, input.model);
}

async function logToLangfuse(
  langfuseCreds: LangfuseCredentials,
  batch: IngestionEvent[],
  fetchImpl?: typeof fetch,
): Promise<void> {
  await sendLangfuseIngestion({
    baseUrl: langfuseCreds.baseUrl,
    publicKey: langfuseCreds.publicKey,
    secretKey: langfuseCreds.secretKey,
    batch,
    ...(langfuseCreds.timeoutMs !== undefined ? { timeoutMs: langfuseCreds.timeoutMs } : {}),
    ...(fetchImpl ? { fetchImpl } : {}),
  });
}

export async function runLangfuseAi(
  input: LangfuseAiInput,
  langfuseCreds: LangfuseCredentials,
  providerCreds: ProviderCredentials,
  fetchImpl?: typeof fetch,
): Promise<LangfuseAiResult> {
  const provider: LlmProvider = input.provider ?? 'openai';
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

  const modelParameters: Record<string, unknown> = {};
  if (input.temperature !== undefined) modelParameters.temperature = input.temperature;
  if (input.maxTokens !== undefined) modelParameters.max_tokens = input.maxTokens;

  let normalized: NormalizedLlmResponse;
  try {
    normalized = await callProvider(provider, input, messages, providerCreds, langfuseCreds.timeoutMs, fetchImpl);
  } catch (error) {
    // Record the failure in Langfuse (level=ERROR) so failed calls are observable
    // too — best-effort, never masking the original provider error.
    const endTime = currentTimestamp();
    const message = error instanceof Error ? error.message : String(error);
    const errorTrace = createTraceEvent({
      traceId,
      name: input.traceName ?? `${input.model} (error)`,
      input: messages,
      ...(input.sessionId ? { sessionId: input.sessionId } : {}),
      ...(input.userId ? { userId: input.userId } : {}),
      ...(input.tags?.length ? { tags: input.tags } : {}),
      ...(input.environment ? { environment: input.environment } : {}),
    });
    const errorGeneration = createGenerationEvent({
      traceId,
      observationId: generationId,
      name: `${provider}-completion`,
      model: input.model,
      input: messages,
      startTime,
      endTime,
      level: 'ERROR',
      statusMessage: message,
      ...(input.promptName ? { promptName: input.promptName } : {}),
      ...(resolvedPromptVersion !== undefined ? { promptVersion: resolvedPromptVersion } : {}),
      ...(Object.keys(modelParameters).length ? { modelParameters } : {}),
      ...(input.environment ? { environment: input.environment } : {}),
    });
    await logToLangfuse(langfuseCreds, [errorTrace, errorGeneration], fetchImpl).catch(() => {
      /* logging the error must not mask the underlying failure */
    });
    throw error;
  }

  const endTime = currentTimestamp();
  const content = normalized.content;
  const usedModel = normalized.model;

  const outputMessages: OpenAiMessage[] = [...messages, { role: 'assistant', content }];

  const usageDetails: Record<string, number> = {};
  if (normalized.usage.promptTokens) usageDetails.input = normalized.usage.promptTokens;
  if (normalized.usage.completionTokens) usageDetails.output = normalized.usage.completionTokens;
  if (normalized.usage.totalTokens) usageDetails.total = normalized.usage.totalTokens;

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
    name: `${provider}-completion`,
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

  // Logging is awaited (so it completes before short-lived runtimes tear down)
  // but never fatal — its outcome is reported on the result instead.
  let logged = true;
  let loggingError: string | undefined;
  try {
    await logToLangfuse(langfuseCreds, [traceEvent, generationEvent], fetchImpl);
  } catch (error) {
    logged = false;
    loggingError = error instanceof Error ? error.message : String(error);
  }

  return {
    content,
    traceId,
    generationId,
    model: usedModel,
    provider,
    messages: outputMessages,
    usage: {
      promptTokens: normalized.usage.promptTokens,
      completionTokens: normalized.usage.completionTokens,
      totalTokens: normalized.usage.totalTokens,
    },
    logged,
    ...(loggingError !== undefined ? { loggingError } : {}),
  };
}
