import {
  asString,
  createEventEvent,
  createGenerationEvent,
  createGenerationUpdateEvent,
  createObservationId,
  createScoreEvent,
  createSdkLogEvent,
  createSessionId,
  createSpanEvent,
  createSpanUpdateEvent,
  createTraceEvent,
  parseJsonMaybe,
  type GenerationEventInput,
  type IngestionEvent,
  type ObservationEventInput,
  type ScoreEventInput,
  type SdkLogEventInput,
  type TraceEventInput,
} from './langfuse.js';

export type LangfuseOperation =
  | 'traceCreate'
  | 'spanCreate'
  | 'spanUpdate'
  | 'generationCreate'
  | 'generationUpdate'
  | 'finalizeSpan'
  | 'eventCreate'
  | 'scoreCreate'
  | 'sdkLogCreate'
  | 'batchRaw';

export type LangfuseIngestionOperation = LangfuseOperation;

export interface LangfuseOperationParameters {
  traceId?: string;
  eventId?: string;
  observationId?: string;
  parentObservationId?: string;
  timestamp?: string;
  name?: string;
  userId?: string;
  sessionId?: string;
  public?: boolean;
  tags?: string | string[];
  inputJson?: unknown;
  outputJson?: unknown;
  metadataJson?: unknown;
  version?: string;
  level?: string;
  statusMessage?: string;
  startTime?: string;
  endTime?: string;
  model?: string;
  modelParametersJson?: unknown;
  usageDetailsJson?: unknown;
  costDetailsJson?: unknown;
  completionStartTime?: string;
  promptName?: string;
  promptLabel?: string;
  promptVersion?: string;
  promptLabelsJson?: unknown;
  generationObservationId?: string;
  scoreId?: string;
  scoreName?: string;
  scoreValue?: unknown;
  scoreDataType?: 'NUMERIC' | 'BOOLEAN' | 'CATEGORICAL' | 'TEXT';
  scoreComment?: string;
  scoreConfigId?: string;
  scoreEnvironment?: string;
  scoreDatasetRunId?: string;
  scoreSessionId?: string;
  scoreTraceId?: string;
  scoreObservationId?: string;
  sdkMessage?: string;
  sdkLevel?: 'debug' | 'info' | 'warn' | 'error';
  batchJson?: unknown;
  environment?: string;
}

function requireString(value: unknown, message: string): string {
  const resolved = asString(value);
  if (resolved === undefined) {
    throw new Error(message);
  }

  return resolved;
}

function parseJsonField(value: unknown): unknown {
  return parseJsonMaybe(value);
}

export function parseTags(tags: string | string[] | undefined): string[] | undefined {
  if (tags === undefined) {
    return undefined;
  }

  if (Array.isArray(tags)) {
    const normalized = tags.map((tag) => tag.trim()).filter(Boolean);
    return normalized.length > 0 ? normalized : undefined;
  }

  const parsed = parseJsonMaybe(tags);
  if (Array.isArray(parsed)) {
    const normalized = parsed.map((tag) => String(tag).trim()).filter(Boolean);
    return normalized.length > 0 ? normalized : undefined;
  }

  return tags
    .split(',')
    .map((tag) => tag.trim())
    .filter(Boolean);
}

export interface LangfusePromptRequestParameters {
  promptName: string;
  label?: string;
  version?: string;
}

export function buildPromptRequestParameters(params: LangfuseOperationParameters): LangfusePromptRequestParameters {
  const promptName = asString(params.promptName);
  if (promptName === undefined) {
    throw new Error('promptName is required for getPrompt operations');
  }

  const label = asString(params.promptLabel);
  const version = asString(params.promptVersion);

  const request: LangfusePromptRequestParameters = {
    promptName,
  };

  if (label !== undefined) request.label = label;
  if (version !== undefined) request.version = version;

  return request;
}

export function buildEventsForOperation(operation: LangfuseIngestionOperation, params: LangfuseOperationParameters): IngestionEvent[] {
  switch (operation) {
    case 'traceCreate':
      return [createTraceEvent(toTraceInput(params))];
    case 'spanCreate':
      return [createSpanEvent(toObservationInput(params))];
    case 'spanUpdate':
      return [createSpanUpdateEvent(toObservationInput(params, true))];
    case 'generationCreate':
      return [createGenerationEvent(toGenerationInput(params))];
    case 'generationUpdate':
      return [createGenerationUpdateEvent(toGenerationInput(params, true))];
    case 'finalizeSpan':
      return buildFinalizeSpanBatch(params);
    case 'eventCreate':
      return [createEventEvent(toObservationInput(params))];
    case 'scoreCreate':
      return [createScoreEvent(toScoreInput(params))];
    case 'sdkLogCreate':
      return [createSdkLogEvent(toSdkLogInput(params))];
    case 'batchRaw':
      return parseRawBatch(params.batchJson);
  }

  throw new Error(`Unsupported Langfuse ingestion operation: ${operation}`);
}

export interface IngestionEventSummary {
  /** The trace this batch creates or attaches to (a trace's own id, or the observations' traceId). */
  traceId?: string;
  /** The session attached to the trace/score (provided or auto-generated). */
  sessionId?: string;
  /** Every entity id written (observation ids, score id, or the trace id). */
  ids: string[];
  /** The ingestion envelope event ids (useful for idempotency/debugging). */
  eventIds: string[];
}

function bodyString(body: unknown, key: string): string | undefined {
  if (body && typeof body === 'object') {
    const value = (body as Record<string, unknown>)[key];
    if (typeof value === 'string') return value;
  }
  return undefined;
}

/**
 * Extract the ids actually written by a batch so the node can return them.
 * Without this, auto-generated trace/observation ids are lost and users can't
 * reliably attach later spans/scores to the same trace (the #1 cause of
 * "my span isn't showing inside the trace").
 */
export function summarizeIngestionEvents(events: IngestionEvent[]): IngestionEventSummary {
  const ids = events.map((event) => bodyString(event.body, 'id')).filter((id): id is string => id !== undefined);
  const eventIds = events.map((event) => event.id);

  // Prefer a trace-create's own id; otherwise the traceId an observation points at.
  let traceId = events.find((event) => event.type === 'trace-create')
    ? bodyString(events.find((event) => event.type === 'trace-create')?.body, 'id')
    : undefined;
  if (traceId === undefined) {
    for (const event of events) {
      const tid = bodyString(event.body, 'traceId');
      if (tid !== undefined) {
        traceId = tid;
        break;
      }
    }
  }

  let sessionId: string | undefined;
  for (const event of events) {
    const sid = bodyString(event.body, 'sessionId');
    if (sid !== undefined) {
      sessionId = sid;
      break;
    }
  }

  const summary: IngestionEventSummary = { ids, eventIds };
  if (traceId !== undefined) summary.traceId = traceId;
  if (sessionId !== undefined) summary.sessionId = sessionId;
  return summary;
}

function toTraceInput(params: LangfuseOperationParameters): TraceEventInput {
  const input: TraceEventInput = {};

  const traceId = asString(params.traceId);
  const eventId = asString(params.eventId);
  const timestamp = asString(params.timestamp);
  const name = asString(params.name);
  const userId = asString(params.userId);
  const sessionId = asString(params.sessionId);
  const version = asString(params.version);

  if (traceId !== undefined) input.traceId = traceId;
  if (eventId !== undefined) input.eventId = eventId;
  if (timestamp !== undefined) input.timestamp = timestamp;
  if (name !== undefined) input.name = name;
  if (userId !== undefined) input.userId = userId;
  // Auto-generate a session id when none is provided so every trace is grouped
  // into a session and appears in Langfuse's Sessions view. Pass an explicit
  // (stable) sessionId to group related traces together instead.
  input.sessionId = sessionId ?? createSessionId();
  if (params.public !== undefined) input.public = params.public;
  const tags = parseTags(params.tags);
  if (tags !== undefined) input.tags = tags;
  const metadata = parseJsonField(params.metadataJson);
  if (metadata !== undefined) input.metadata = metadata;
  const inputJson = parseJsonField(params.inputJson);
  if (inputJson !== undefined) input.input = inputJson;
  const outputJson = parseJsonField(params.outputJson);
  if (outputJson !== undefined) input.output = outputJson;
  if (version !== undefined) input.version = version;
  const environment = asString(params.environment);
  if (environment !== undefined) input.environment = environment;

  return input;
}

function toObservationInput(params: LangfuseOperationParameters, requireObservationId = false): ObservationEventInput {
  const input: ObservationEventInput = {};

  const traceId = asString(params.traceId);
  const observationId = asString(params.observationId);
  const parentObservationId = asString(params.parentObservationId);
  const eventId = asString(params.eventId);
  const timestamp = asString(params.timestamp);
  const name = asString(params.name);
  const version = asString(params.version);
  const level = asString(params.level);
  const statusMessage = asString(params.statusMessage);
  const startTime = asString(params.startTime);
  const endTime = asString(params.endTime);

  if (traceId !== undefined) input.traceId = traceId;
  if (requireObservationId) {
    input.observationId = requireString(params.observationId, 'observationId is required for update operations');
  } else if (observationId !== undefined) {
    input.observationId = observationId;
  }
  if (parentObservationId !== undefined) input.parentObservationId = parentObservationId;
  if (eventId !== undefined) input.eventId = eventId;
  if (timestamp !== undefined) input.timestamp = timestamp;
  if (name !== undefined) input.name = name;
  const inputJson = parseJsonField(params.inputJson);
  if (inputJson !== undefined) input.input = inputJson;
  const outputJson = parseJsonField(params.outputJson);
  if (outputJson !== undefined) input.output = outputJson;
  const metadata = parseJsonField(params.metadataJson);
  if (metadata !== undefined) input.metadata = metadata;
  if (version !== undefined) input.version = version;
  if (level !== undefined) input.level = level;
  if (statusMessage !== undefined) input.statusMessage = statusMessage;
  if (startTime !== undefined) input.startTime = startTime;
  if (endTime !== undefined) input.endTime = endTime;
  const environment = asString(params.environment);
  if (environment !== undefined) input.environment = environment;

  return input;
}

function toGenerationInput(params: LangfuseOperationParameters, requireObservationId = false): GenerationEventInput {
  const input: GenerationEventInput = {
    ...toObservationInput(params, requireObservationId),
  };

  const model = asString(params.model);
  const modelParameters = parseJsonField(params.modelParametersJson);
  const usageDetails = parseJsonField(params.usageDetailsJson);
  const costDetails = parseJsonField(params.costDetailsJson);
  const completionStartTime = asString(params.completionStartTime);
  const promptName = asString(params.promptName);
  const promptVersion = asString(params.promptVersion);
  const promptLabels = parseJsonField(params.promptLabelsJson);

  if (model !== undefined) input.model = model;
  if (modelParameters !== undefined) input.modelParameters = modelParameters;
  if (usageDetails && typeof usageDetails === 'object' && !Array.isArray(usageDetails)) {
    input.usageDetails = usageDetails as Record<string, number>;
  }
  if (costDetails && typeof costDetails === 'object' && !Array.isArray(costDetails)) {
    input.costDetails = costDetails as Record<string, number>;
  }
  if (completionStartTime !== undefined) input.completionStartTime = completionStartTime;
  if (promptName !== undefined) input.promptName = promptName;
  if (promptVersion !== undefined) input.promptVersion = promptVersion;
  if (promptLabels !== undefined) input.promptLabels = promptLabels;

  return input;
}

function toScoreInput(params: LangfuseOperationParameters): ScoreEventInput {
  const rawValue = parseJsonField(params.scoreValue);
  if (rawValue === undefined || rawValue === '') {
    throw new Error('scoreValue is required for scoreCreate operations');
  }
  const resolvedName = asString(params.scoreName) ?? asString(params.name);
  if (resolvedName === undefined) {
    throw new Error('scoreName is required for scoreCreate operations');
  }

  const traceId = asString(params.scoreTraceId) ?? asString(params.traceId);
  const resolvedSessionId = asString(params.scoreSessionId) ?? asString(params.sessionId);
  if (traceId === undefined && resolvedSessionId === undefined) {
    throw new Error('scoreCreate requires either traceId or sessionId');
  }

  const input: ScoreEventInput = {
    name: resolvedName,
    value: rawValue as string | number | boolean,
  };

  const scoreId = asString(params.scoreId);
  const observationId = asString(params.scoreObservationId) ?? asString(params.observationId);
  const datasetRunId = asString(params.scoreDatasetRunId);
  const timestamp = asString(params.timestamp);
  const comment = asString(params.scoreComment);
  const configId = asString(params.scoreConfigId);
  const metadata = parseJsonField(params.metadataJson);
  const environment = asString(params.scoreEnvironment);

  if (scoreId !== undefined) input.scoreId = scoreId;
  if (traceId !== undefined) input.traceId = traceId;
  if (observationId !== undefined) input.observationId = observationId;
  if (resolvedSessionId !== undefined) input.sessionId = resolvedSessionId;
  if (datasetRunId !== undefined) input.datasetRunId = datasetRunId;
  if (timestamp !== undefined) input.timestamp = timestamp;
  if (params.scoreDataType !== undefined) input.dataType = params.scoreDataType;
  if (comment !== undefined) input.comment = comment;
  if (configId !== undefined) input.configId = configId;
  if (metadata !== undefined) input.metadata = metadata;
  if (environment !== undefined) input.environment = environment;

  return input;
}

function toSdkLogInput(params: LangfuseOperationParameters): SdkLogEventInput {
  const input: SdkLogEventInput = {
    message: asString(params.sdkMessage) ?? asString(params.name) ?? 'sdk-log',
  };

  const traceId = asString(params.traceId);
  const observationId = asString(params.observationId);
  const parentObservationId = asString(params.parentObservationId);
  const timestamp = asString(params.timestamp);
  const name = asString(params.name);
  const metadata = parseJsonField(params.metadataJson);

  if (traceId !== undefined) input.traceId = traceId;
  if (observationId !== undefined) input.observationId = observationId;
  if (parentObservationId !== undefined) input.parentObservationId = parentObservationId;
  if (timestamp !== undefined) input.timestamp = timestamp;
  if (name !== undefined) input.name = name;
  if (params.sdkLevel !== undefined) input.level = params.sdkLevel;
  if (metadata !== undefined) input.metadata = metadata;

  return input;
}

function buildFinalizeSpanBatch(params: LangfuseOperationParameters): IngestionEvent[] {
  const spanObservationId = requireString(params.observationId, 'observationId is required for finalizeSpan operations');
  const generationObservationId = asString(params.generationObservationId) ?? `${spanObservationId}_gen`;
  const generationInput = toGenerationInput(params, false);
  generationInput.observationId = generationObservationId;
  generationInput.parentObservationId = spanObservationId;
  generationInput.name = asString(params.name) ?? 'llm-response';

  const spanUpdateInput = toObservationInput(params, true);
  spanUpdateInput.observationId = spanObservationId;
  const endTime = asString(params.endTime);
  if (endTime !== undefined) {
    spanUpdateInput.endTime = endTime;
  }

  const generation = createGenerationEvent(generationInput);
  const spanUpdate = createSpanUpdateEvent(spanUpdateInput);

  return [generation, spanUpdate];
}

function parseRawBatch(batchJson: unknown): IngestionEvent[] {
  const parsed = parseJsonField(batchJson);
  if (Array.isArray(parsed)) {
    return parsed as IngestionEvent[];
  }

  if (parsed && typeof parsed === 'object') {
    const batch = (parsed as { batch?: unknown }).batch;
    if (Array.isArray(batch)) {
      return batch as IngestionEvent[];
    }
  }

  return [];
}
