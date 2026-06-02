import { createHash, randomBytes } from 'node:crypto';

export type JsonPrimitive = string | number | boolean | null;
export type JsonValue = any;
export type JsonObject = Record<string, any>;

export type IngestionEventType =
  | 'trace-create'
  | 'span-create'
  | 'span-update'
  | 'generation-create'
  | 'generation-update'
  | 'event-create'
  | 'score-create'
  | 'sdk-log';

export interface IngestionEvent<TBody extends JsonObject = JsonObject> {
  id: string;
  type: IngestionEventType;
  timestamp: string;
  body: TBody;
}

export interface LangfuseBatchRequest {
  batch: IngestionEvent[];
}

export interface LangfuseBatchResponse {
  successes: unknown[];
  errors: unknown[];
  raw: unknown;
  status: number;
  ok: boolean;
}

export interface LangfuseTransportOptions {
  baseUrl: string;
  publicKey: string;
  secretKey: string;
  batch: IngestionEvent[];
  timeoutMs?: number;
  fetchImpl?: typeof fetch;
  signal?: AbortSignal;
}

export interface LangfusePromptRequestOptions {
  baseUrl: string;
  publicKey: string;
  secretKey: string;
  promptName: string;
  label?: string;
  version?: string | number;
  timeoutMs?: number;
  fetchImpl?: typeof fetch;
  signal?: AbortSignal;
}

export interface LangfusePromptResponse {
  status: number;
  ok: boolean;
  raw: unknown;
  prompt: unknown;
}

export interface LangfuseCredentials {
  baseUrl: string;
  publicKey: string;
  secretKey: string;
  timeoutMs?: number;
}

export interface TraceEventInput {
  traceId?: string;
  eventId?: string;
  timestamp?: string;
  name?: string;
  userId?: string;
  sessionId?: string;
  public?: boolean;
  tags?: string[];
  metadata?: unknown;
  input?: unknown;
  output?: unknown;
  version?: string;
}

export interface ObservationEventInput {
  traceId?: string;
  observationId?: string;
  parentObservationId?: string;
  eventId?: string;
  timestamp?: string;
  startTime?: string;
  endTime?: string;
  name?: string;
  input?: unknown;
  output?: unknown;
  metadata?: unknown;
  version?: string;
  level?: string;
  statusMessage?: string;
}

export interface GenerationEventInput extends ObservationEventInput {
  model?: string;
  modelParameters?: unknown;
  usageDetails?: Record<string, number>;
  costDetails?: Record<string, number>;
  completionStartTime?: string;
  prompt?: unknown;
  promptName?: string;
  promptVersion?: string | number;
  promptLabels?: unknown;
}

export interface ScoreEventInput {
  traceId?: string;
  observationId?: string;
  sessionId?: string;
  datasetRunId?: string;
  scoreId?: string;
  eventId?: string;
  timestamp?: string;
  name: string;
  value: string | number | boolean;
  dataType?: 'NUMERIC' | 'BOOLEAN' | 'CATEGORICAL' | 'TEXT';
  comment?: string;
  configId?: string;
  metadata?: unknown;
  environment?: string;
}

export interface SdkLogEventInput {
  traceId?: string;
  observationId?: string;
  parentObservationId?: string;
  eventId?: string;
  timestamp?: string;
  name?: string;
  message: string;
  level?: 'debug' | 'info' | 'warn' | 'error';
  metadata?: unknown;
}

export class LangfuseRequestError extends Error {
  readonly status: number;
  readonly body: unknown;

  constructor(message: string, status: number, body: unknown) {
    super(message);
    this.name = 'LangfuseRequestError';
    this.status = status;
    this.body = body;
  }
}

export function normalizeBaseUrl(baseUrl: string): string {
  return baseUrl.trim().replace(/\/+$/u, '');
}

export function buildIngestionUrl(baseUrl: string): string {
  const normalized = normalizeBaseUrl(baseUrl);
  if (normalized.endsWith('/api/public')) {
    return `${normalized}/ingestion`;
  }

  return `${normalized}/api/public/ingestion`;
}

export function buildPromptUrl(baseUrl: string, promptName: string, label?: string, version?: string | number): string {
  const normalized = normalizeBaseUrl(baseUrl);
  const resolvedPromptName = promptName.trim();
  if (!resolvedPromptName) {
    throw new Error('promptName is required');
  }

  const params = new URLSearchParams();

  if (label !== undefined) {
    params.set('label', label);
  }

  if (version !== undefined) {
    params.set('version', String(version));
  }

  const query = params.toString();
  const suffix = query ? `?${query}` : '';

  if (normalized.endsWith('/api/public')) {
    return `${normalized}/v2/prompts/${encodeURIComponent(resolvedPromptName)}${suffix}`;
  }

  return `${normalized}/api/public/v2/prompts/${encodeURIComponent(resolvedPromptName)}${suffix}`;
}

export function buildBasicAuthHeader(publicKey: string, secretKey: string): string {
  return `Basic ${Buffer.from(`${publicKey}:${secretKey}`, 'utf8').toString('base64')}`;
}

export function parseJsonMaybe(value: unknown): unknown {
  if (typeof value !== 'string') {
    return value;
  }

  const trimmed = value.trim();
  if (!trimmed) {
    return value;
  }

  if (!/^[\[{"]|^-?\d|^(true|false|null)$/u.test(trimmed)) {
    return value;
  }

  try {
    return JSON.parse(trimmed) as unknown;
  } catch {
    return value;
  }
}

export function createTraceId(seed?: string): string {
  if (!seed) {
    return randomBytes(16).toString('hex');
  }

  return createHash('sha256').update(seed).digest('hex').slice(0, 32);
}

export function createObservationId(seed?: string): string {
  if (!seed) {
    return randomBytes(8).toString('hex');
  }

  return createHash('sha256').update(seed).digest('hex').slice(0, 16);
}

export function currentTimestamp(): string {
  return new Date().toISOString();
}

export function buildBatchRequestBody(batch: IngestionEvent[]): LangfuseBatchRequest {
  return { batch };
}

function ensureTimestamp(timestamp?: string): string {
  return timestamp ?? currentTimestamp();
}

function ensureTraceId(traceId?: string): string {
  return traceId ?? createTraceId();
}

function ensureObservationId(observationId?: string): string {
  return observationId ?? createObservationId();
}

function ensureEventId(eventId?: string): string {
  return eventId ?? createTraceId();
}

function normalizeJsonValue(value: unknown): JsonValue | undefined {
  const parsed = parseJsonMaybe(value);
  if (parsed === undefined) {
    return undefined;
  }

  if (parsed === null || typeof parsed === 'string' || typeof parsed === 'number' || typeof parsed === 'boolean') {
    return parsed;
  }

  if (Array.isArray(parsed)) {
    return parsed.map((item) => normalizeJsonValue(item) ?? null);
  }

  if (typeof parsed === 'object') {
    return Object.entries(parsed as Record<string, unknown>).reduce<JsonObject>((acc, [key, entry]) => {
      const normalized = normalizeJsonValue(entry);
      if (normalized !== undefined) {
        acc[key] = normalized;
      }
      return acc;
    }, {});
  }

  return undefined;
}

function normalizeJsonObject(value: unknown): JsonObject | undefined {
  const parsed = normalizeJsonValue(value);
  if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
    return parsed as JsonObject;
  }

  return undefined;
}

export function createTraceEvent(input: TraceEventInput): IngestionEvent {
  const traceId = ensureTraceId(input.traceId);
  const body: JsonObject = {
    id: traceId,
  };

  if (input.name !== undefined) body.name = input.name;
  if (input.userId !== undefined) body.userId = input.userId;
  if (input.sessionId !== undefined) body.sessionId = input.sessionId;
  if (input.public !== undefined) body.public = input.public;
  if (input.tags !== undefined) body.tags = input.tags;
  if (input.metadata !== undefined) body.metadata = normalizeJsonValue(input.metadata) ?? null;
  if (input.input !== undefined) body.input = normalizeJsonValue(input.input) ?? null;
  if (input.output !== undefined) body.output = normalizeJsonValue(input.output) ?? null;
  if (input.version !== undefined) body.version = input.version;

  return {
    id: ensureEventId(input.eventId),
    type: 'trace-create',
    timestamp: ensureTimestamp(input.timestamp),
    body,
  };
}

export function createSpanEvent(input: ObservationEventInput): IngestionEvent {
  const body: JsonObject = {
    id: ensureObservationId(input.observationId),
  };

  if (input.traceId !== undefined) body.traceId = ensureTraceId(input.traceId);
  if (input.parentObservationId !== undefined) body.parentObservationId = input.parentObservationId;
  if (input.name !== undefined) body.name = input.name;
  if (input.startTime !== undefined) body.startTime = input.startTime;
  if (input.endTime !== undefined) body.endTime = input.endTime;
  if (input.input !== undefined) body.input = normalizeJsonValue(input.input) ?? null;
  if (input.output !== undefined) body.output = normalizeJsonValue(input.output) ?? null;
  if (input.metadata !== undefined) body.metadata = normalizeJsonValue(input.metadata) ?? null;
  if (input.version !== undefined) body.version = input.version;
  if (input.level !== undefined) body.level = input.level;
  if (input.statusMessage !== undefined) body.statusMessage = input.statusMessage;

  return {
    id: ensureEventId(input.eventId),
    type: 'span-create',
    timestamp: ensureTimestamp(input.timestamp),
    body,
  };
}

export function createSpanUpdateEvent(input: ObservationEventInput): IngestionEvent {
  const event = createSpanEvent(input);
  return {
    ...event,
    type: 'span-update',
  };
}

export function createGenerationEvent(input: GenerationEventInput): IngestionEvent {
  const body: JsonObject = {
    id: ensureObservationId(input.observationId),
  };

  if (input.traceId !== undefined) body.traceId = ensureTraceId(input.traceId);
  if (input.parentObservationId !== undefined) body.parentObservationId = input.parentObservationId;
  if (input.name !== undefined) body.name = input.name;
  if (input.startTime !== undefined) body.startTime = input.startTime;
  if (input.input !== undefined) body.input = normalizeJsonValue(input.input) ?? null;
  if (input.output !== undefined) body.output = normalizeJsonValue(input.output) ?? null;
  if (input.metadata !== undefined) body.metadata = normalizeJsonValue(input.metadata) ?? null;
  if (input.version !== undefined) body.version = input.version;
  if (input.level !== undefined) body.level = input.level;
  if (input.statusMessage !== undefined) body.statusMessage = input.statusMessage;
  if (input.completionStartTime !== undefined) body.completionStartTime = input.completionStartTime;
  if (input.model !== undefined) body.model = input.model;
  if (input.modelParameters !== undefined) body.modelParameters = normalizeJsonObject(input.modelParameters) ?? null;
  if (input.usageDetails !== undefined) body.usageDetails = normalizeJsonObject(input.usageDetails) ?? null;
  if (input.costDetails !== undefined) body.costDetails = normalizeJsonObject(input.costDetails) ?? null;
  if (input.prompt !== undefined) body.prompt = normalizeJsonValue(input.prompt) ?? null;
  if (input.promptName !== undefined) body.promptName = input.promptName;
  if (input.promptVersion !== undefined) body.promptVersion = input.promptVersion;
  if (input.promptLabels !== undefined) body.promptLabels = normalizeJsonValue(input.promptLabels) ?? null;
  if (input.endTime !== undefined) body.endTime = input.endTime;

  return {
    id: ensureEventId(input.eventId),
    type: 'generation-create',
    timestamp: ensureTimestamp(input.timestamp),
    body,
  };
}

export function createGenerationUpdateEvent(input: GenerationEventInput): IngestionEvent {
  const event = createGenerationEvent(input);
  return {
    ...event,
    type: 'generation-update',
  };
}

export function createEventEvent(input: ObservationEventInput): IngestionEvent {
  const body: JsonObject = {
    id: ensureObservationId(input.observationId),
  };

  if (input.traceId !== undefined) body.traceId = ensureTraceId(input.traceId);
  if (input.parentObservationId !== undefined) body.parentObservationId = input.parentObservationId;
  if (input.name !== undefined) body.name = input.name;
  if (input.endTime !== undefined) body.endTime = input.endTime;
  if (input.input !== undefined) body.input = normalizeJsonValue(input.input) ?? null;
  if (input.output !== undefined) body.output = normalizeJsonValue(input.output) ?? null;
  if (input.metadata !== undefined) body.metadata = normalizeJsonValue(input.metadata) ?? null;
  if (input.version !== undefined) body.version = input.version;
  if (input.level !== undefined) body.level = input.level;
  if (input.statusMessage !== undefined) body.statusMessage = input.statusMessage;

  return {
    id: ensureEventId(input.eventId),
    type: 'event-create',
    timestamp: ensureTimestamp(input.timestamp),
    body,
  };
}

export function createScoreEvent(input: ScoreEventInput): IngestionEvent {
  const body: JsonObject = {
    id: input.scoreId ?? createObservationId(),
    name: input.name,
    value: input.value as JsonValue,
  };

  if (input.traceId !== undefined) body.traceId = ensureTraceId(input.traceId);
  if (input.observationId !== undefined) body.observationId = ensureObservationId(input.observationId);
  if (input.sessionId !== undefined) body.sessionId = input.sessionId;
  if (input.datasetRunId !== undefined) body.datasetRunId = input.datasetRunId;
  if (input.dataType !== undefined) body.dataType = input.dataType;
  if (input.comment !== undefined) body.comment = input.comment;
  if (input.configId !== undefined) body.configId = input.configId;
  if (input.metadata !== undefined) body.metadata = normalizeJsonValue(input.metadata) ?? null;
  if (input.environment !== undefined) body.environment = input.environment;

  return {
    id: ensureEventId(input.eventId),
    type: 'score-create',
    timestamp: ensureTimestamp(input.timestamp),
    body,
  };
}

export function createSdkLogEvent(input: SdkLogEventInput): IngestionEvent {
  const body: JsonObject = {
    id: ensureObservationId(input.observationId),
    message: input.message,
    level: input.level ?? 'info',
  };

  if (input.traceId !== undefined) body.traceId = ensureTraceId(input.traceId);
  if (input.parentObservationId !== undefined) body.parentObservationId = input.parentObservationId;
  if (input.name !== undefined) body.name = input.name;
  if (input.metadata !== undefined) body.metadata = normalizeJsonValue(input.metadata) ?? null;

  return {
    id: ensureEventId(input.eventId),
    type: 'sdk-log',
    timestamp: ensureTimestamp(input.timestamp),
    body,
  };
}

export async function sendLangfuseIngestion(options: LangfuseTransportOptions): Promise<LangfuseBatchResponse> {
  const fetchImpl = options.fetchImpl ?? fetch;
  const url = buildIngestionUrl(options.baseUrl);
  const body = JSON.stringify(buildBatchRequestBody(options.batch));
  const headers = {
    Authorization: buildBasicAuthHeader(options.publicKey, options.secretKey),
    'Content-Type': 'application/json',
  } as const;

  const controller = new AbortController();
  const externalSignal = options.signal;
  let timeout: ReturnType<typeof setTimeout> | undefined;

  if (externalSignal) {
    if (externalSignal.aborted) {
      controller.abort(externalSignal.reason);
    } else {
      externalSignal.addEventListener('abort', () => controller.abort(externalSignal.reason), { once: true });
    }
  }

  if (options.timeoutMs && options.timeoutMs > 0) {
    timeout = setTimeout(() => controller.abort(new Error(`Langfuse request timed out after ${options.timeoutMs}ms`)), options.timeoutMs);
  }

  try {
    const response = await fetchImpl(url, {
      method: 'POST',
      headers,
      body,
      signal: controller.signal,
    });

    const text = await response.text();
    const raw = text ? JSON.parse(text) as unknown : {};
    const object = typeof raw === 'object' && raw !== null ? (raw as Record<string, unknown>) : {};
    const successes = Array.isArray(object.successes)
      ? object.successes
      : Array.isArray(object.data)
        ? object.data
        : [];
    const errors = Array.isArray(object.errors)
      ? object.errors
      : Array.isArray(object.failures)
        ? object.failures
        : [];

    if (!response.ok && response.status !== 207) {
      throw new LangfuseRequestError(
        `Langfuse ingestion failed with status ${response.status}`,
        response.status,
        raw,
      );
    }

    return {
      status: response.status,
      successes,
      errors,
      raw,
      ok: response.ok || response.status === 207,
    };
  } catch (error) {
    if (error instanceof SyntaxError) {
      throw new Error(`Langfuse ingestion response was not valid JSON: ${error.message}`);
    }

    throw error;
  } finally {
    if (timeout) {
      clearTimeout(timeout);
    }
  }
}

export async function fetchLangfusePrompt(options: LangfusePromptRequestOptions): Promise<LangfusePromptResponse> {
  const fetchImpl = options.fetchImpl ?? fetch;
  const url = buildPromptUrl(options.baseUrl, options.promptName, options.label, options.version);
  const headers = {
    Authorization: buildBasicAuthHeader(options.publicKey, options.secretKey),
    'Content-Type': 'application/json',
  } as const;

  const controller = new AbortController();
  const externalSignal = options.signal;
  let timeout: ReturnType<typeof setTimeout> | undefined;

  if (externalSignal) {
    if (externalSignal.aborted) {
      controller.abort(externalSignal.reason);
    } else {
      externalSignal.addEventListener('abort', () => controller.abort(externalSignal.reason), { once: true });
    }
  }

  if (options.timeoutMs && options.timeoutMs > 0) {
    timeout = setTimeout(
      () => controller.abort(new Error(`Langfuse prompt request timed out after ${options.timeoutMs}ms`)),
      options.timeoutMs,
    );
  }

  try {
    const response = await fetchImpl(url, {
      method: 'GET',
      headers,
      signal: controller.signal,
    });

    const text = await response.text();
    let raw: unknown = {};
    if (text) {
      try {
        raw = JSON.parse(text) as unknown;
      } catch (error) {
        throw new Error(`Langfuse prompt response was not valid JSON: ${(error as Error).message}`);
      }
    }

    if (!response.ok) {
      throw new LangfuseRequestError(
        `Langfuse prompt fetch failed with status ${response.status}`,
        response.status,
        raw,
      );
    }

    return {
      status: response.status,
      ok: response.ok,
      raw,
      prompt: raw,
    };
  } finally {
    if (timeout) {
      clearTimeout(timeout);
    }
  }
}
