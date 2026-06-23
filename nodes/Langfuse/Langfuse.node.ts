import {
  asString,
  buildIngestionUrl,
  LangfuseRequestError,
  sendLangfuseIngestion,
  withRetry,
} from '../../src/langfuse.js';
import {
  buildEventsForOperation,
  summarizeIngestionEvents,
  type LangfuseOperation,
  type LangfuseOperationParameters,
} from '../../src/nodeLogic.js';
import {
  buildLangfusePublicApiUrl,
  requestLangfusePublicApi,
  requestLangfusePublicApiAll,
  resolveLangfusePublicApiEndpoint,
  type LangfusePublicApiMethod,
  type LangfusePublicApiOperation,
  type LangfusePublicApiParameters,
} from '../../src/langfusePublicApi.js';
import type {
  LangfuseExecuteContext,
  NodeDescription,
  NodeInputItem,
  NodePropertyDisplayOptions,
  VersionedNodeType,
  VersionedNodeVersion,
} from '../../src/n8n-lite.js';

// ---------------------------------------------------------------------------
// Shared helper utilities
// ---------------------------------------------------------------------------

function getOptionalNodeParameter(
  context: LangfuseExecuteContext,
  name: string,
  itemIndex: number,
): unknown | undefined {
  try {
    return context.getNodeParameter(name, itemIndex);
  } catch (error) {
    if (error instanceof Error && /Could not get parameter/i.test(error.message)) {
      return undefined;
    }
    throw error;
  }
}

function asErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function buildIngestionParameters(context: LangfuseExecuteContext, itemIndex: number): LangfuseOperationParameters {
  const params: LangfuseOperationParameters = {};

  const traceId = asString(getOptionalNodeParameter(context, 'traceId', itemIndex));
  const eventId = asString(getOptionalNodeParameter(context, 'eventId', itemIndex));
  const observationId = asString(getOptionalNodeParameter(context, 'observationId', itemIndex));
  const parentObservationId = asString(getOptionalNodeParameter(context, 'parentObservationId', itemIndex));
  const timestamp = asString(getOptionalNodeParameter(context, 'timestamp', itemIndex));
  const name = asString(getOptionalNodeParameter(context, 'name', itemIndex));
  const userId = asString(getOptionalNodeParameter(context, 'userId', itemIndex));
  const sessionId = asString(getOptionalNodeParameter(context, 'sessionId', itemIndex));
  const startTime = asString(getOptionalNodeParameter(context, 'startTime', itemIndex));
  const endTime = asString(getOptionalNodeParameter(context, 'endTime', itemIndex));
  const version = asString(getOptionalNodeParameter(context, 'version', itemIndex));
  const level = asString(getOptionalNodeParameter(context, 'level', itemIndex));
  const statusMessage = asString(getOptionalNodeParameter(context, 'statusMessage', itemIndex));
  const model = asString(getOptionalNodeParameter(context, 'model', itemIndex));
  const completionStartTime = asString(getOptionalNodeParameter(context, 'completionStartTime', itemIndex));
  const promptName = asString(getOptionalNodeParameter(context, 'promptName', itemIndex));
  const promptVersion = asString(getOptionalNodeParameter(context, 'promptVersion', itemIndex));
  const generationObservationId = asString(getOptionalNodeParameter(context, 'generationObservationId', itemIndex));
  const scoreId = asString(getOptionalNodeParameter(context, 'scoreId', itemIndex));
  const scoreName = asString(getOptionalNodeParameter(context, 'scoreName', itemIndex));
  const scoreComment = asString(getOptionalNodeParameter(context, 'scoreComment', itemIndex));
  const scoreConfigId = asString(getOptionalNodeParameter(context, 'scoreConfigId', itemIndex));
  const scoreEnvironment = asString(getOptionalNodeParameter(context, 'scoreEnvironment', itemIndex));
  const scoreDatasetRunId = asString(getOptionalNodeParameter(context, 'scoreDatasetRunId', itemIndex));
  const scoreSessionId = asString(getOptionalNodeParameter(context, 'scoreSessionId', itemIndex));
  const scoreTraceId = asString(getOptionalNodeParameter(context, 'scoreTraceId', itemIndex));
  const scoreObservationId = asString(getOptionalNodeParameter(context, 'scoreObservationId', itemIndex));
  const sdkMessage = asString(getOptionalNodeParameter(context, 'sdkMessage', itemIndex));
  const sdkLevel = getOptionalNodeParameter(context, 'sdkLevel', itemIndex) as 'debug' | 'info' | 'warn' | 'error' | undefined;
  const environment = asString(getOptionalNodeParameter(context, 'environment', itemIndex));

  if (traceId !== undefined) params.traceId = traceId;
  if (eventId !== undefined) params.eventId = eventId;
  if (observationId !== undefined) params.observationId = observationId;
  if (parentObservationId !== undefined) params.parentObservationId = parentObservationId;
  if (timestamp !== undefined) params.timestamp = timestamp;
  if (name !== undefined) params.name = name;
  if (userId !== undefined) params.userId = userId;
  if (sessionId !== undefined) params.sessionId = sessionId;
  if (startTime !== undefined) params.startTime = startTime;
  if (endTime !== undefined) params.endTime = endTime;
  const isPublic = getOptionalNodeParameter(context, 'public', itemIndex);
  if (isPublic !== undefined) params.public = isPublic as boolean;
  const tags = getOptionalNodeParameter(context, 'tags', itemIndex);
  if (tags !== undefined) params.tags = tags as string;
  params.inputJson = getOptionalNodeParameter(context, 'inputJson', itemIndex);
  params.outputJson = getOptionalNodeParameter(context, 'outputJson', itemIndex);
  params.metadataJson = getOptionalNodeParameter(context, 'metadataJson', itemIndex);
  if (version !== undefined) params.version = version;
  if (level !== undefined) params.level = level;
  if (statusMessage !== undefined) params.statusMessage = statusMessage;
  if (model !== undefined) params.model = model;
  params.modelParametersJson = getOptionalNodeParameter(context, 'modelParametersJson', itemIndex);
  params.usageDetailsJson = getOptionalNodeParameter(context, 'usageDetailsJson', itemIndex);
  params.costDetailsJson = getOptionalNodeParameter(context, 'costDetailsJson', itemIndex);
  if (completionStartTime !== undefined) params.completionStartTime = completionStartTime;
  if (promptName !== undefined) params.promptName = promptName;
  if (promptVersion !== undefined) params.promptVersion = promptVersion;
  params.promptLabelsJson = getOptionalNodeParameter(context, 'promptLabelsJson', itemIndex);
  if (generationObservationId !== undefined) params.generationObservationId = generationObservationId;
  if (scoreId !== undefined) params.scoreId = scoreId;
  if (scoreName !== undefined) params.scoreName = scoreName;
  params.scoreValue = getOptionalNodeParameter(context, 'scoreValue', itemIndex);
  const scoreDataType = getOptionalNodeParameter(context, 'scoreDataType', itemIndex) as 'NUMERIC' | 'BOOLEAN' | 'CATEGORICAL' | 'TEXT' | undefined;
  if (scoreDataType !== undefined) params.scoreDataType = scoreDataType;
  if (scoreComment !== undefined) params.scoreComment = scoreComment;
  if (scoreConfigId !== undefined) params.scoreConfigId = scoreConfigId;
  if (scoreEnvironment !== undefined) params.scoreEnvironment = scoreEnvironment;
  if (scoreDatasetRunId !== undefined) params.scoreDatasetRunId = scoreDatasetRunId;
  if (scoreSessionId !== undefined) params.scoreSessionId = scoreSessionId;
  if (scoreTraceId !== undefined) params.scoreTraceId = scoreTraceId;
  if (scoreObservationId !== undefined) params.scoreObservationId = scoreObservationId;
  if (sdkMessage !== undefined) params.sdkMessage = sdkMessage;
  if (sdkLevel !== undefined) params.sdkLevel = sdkLevel;
  params.batchJson = getOptionalNodeParameter(context, 'batchJson', itemIndex);
  if (environment !== undefined) params.environment = environment;

  return params;
}

function buildPublicApiParameters(
  context: LangfuseExecuteContext,
  itemIndex: number,
  operation: LangfusePublicApiOperation,
): LangfusePublicApiParameters {
  const params: LangfusePublicApiParameters = {};

  switch (operation) {
    case 'health':
      break;
    case 'listPrompts':
    case 'listTraces':
    case 'listScores':
    case 'listObservations':
    case 'listSessions':
    case 'listAnnotationQueues':
    case 'listScoreConfigs':
    case 'listDatasets':
    case 'listDatasetItems':
      params.queryJson = getOptionalNodeParameter(context, 'queryJson', itemIndex);
      break;
    case 'getSession': {
      const sessionId = asString(getOptionalNodeParameter(context, 'sessionId', itemIndex));
      if (sessionId !== undefined) params.sessionId = sessionId;
      break;
    }
    case 'getScoreConfig': {
      const scoreConfigId = asString(getOptionalNodeParameter(context, 'scoreConfigId', itemIndex));
      if (scoreConfigId !== undefined) params.scoreConfigId = scoreConfigId;
      break;
    }
    case 'listAnnotationQueueItems': {
      const queueId = asString(getOptionalNodeParameter(context, 'queueId', itemIndex));
      if (queueId !== undefined) params.queueId = queueId;
      params.queryJson = getOptionalNodeParameter(context, 'queryJson', itemIndex);
      break;
    }
    case 'getPrompt': {
      const promptName = asString(getOptionalNodeParameter(context, 'promptName', itemIndex));
      const promptLabel = asString(getOptionalNodeParameter(context, 'promptLabel', itemIndex));
      const promptVersion = asString(getOptionalNodeParameter(context, 'promptVersion', itemIndex));
      if (promptName !== undefined) params.promptName = promptName;
      if (promptLabel !== undefined) params.promptLabel = promptLabel;
      if (promptVersion !== undefined) params.promptVersion = promptVersion;
      break;
    }
    case 'createPrompt': {
      const promptName = asString(getOptionalNodeParameter(context, 'promptName', itemIndex));
      const promptType = asString(getOptionalNodeParameter(context, 'promptType', itemIndex));
      const promptText = asString(getOptionalNodeParameter(context, 'promptText', itemIndex));
      const promptCommitMessage = asString(getOptionalNodeParameter(context, 'promptCommitMessage', itemIndex));
      if (promptName !== undefined) params.promptName = promptName;
      if (promptType !== undefined) params.promptType = promptType;
      if (promptText !== undefined) params.promptText = promptText;
      if (promptCommitMessage !== undefined) params.promptCommitMessage = promptCommitMessage;
      params.promptChatJson = getOptionalNodeParameter(context, 'promptChatJson', itemIndex);
      params.promptLabels = getOptionalNodeParameter(context, 'promptLabels', itemIndex);
      params.promptTags = getOptionalNodeParameter(context, 'promptTags', itemIndex);
      params.promptConfigJson = getOptionalNodeParameter(context, 'promptConfigJson', itemIndex);
      break;
    }
    case 'getTrace': {
      const traceId = asString(getOptionalNodeParameter(context, 'traceId', itemIndex));
      if (traceId !== undefined) params.traceId = traceId;
      break;
    }
    case 'getScore':
    case 'deleteScore': {
      const scoreId = asString(getOptionalNodeParameter(context, 'scoreId', itemIndex));
      if (scoreId !== undefined) params.scoreId = scoreId;
      break;
    }
    case 'getObservation': {
      const observationId = asString(getOptionalNodeParameter(context, 'observationId', itemIndex));
      if (observationId !== undefined) params.observationId = observationId;
      break;
    }
    case 'getAnnotationQueue': {
      const queueId = asString(getOptionalNodeParameter(context, 'queueId', itemIndex));
      if (queueId !== undefined) params.queueId = queueId;
      break;
    }
    case 'getDataset': {
      const datasetName = asString(getOptionalNodeParameter(context, 'datasetName', itemIndex));
      if (datasetName !== undefined) params.datasetName = datasetName;
      break;
    }
    case 'createDataset': {
      const datasetName = asString(getOptionalNodeParameter(context, 'datasetName', itemIndex));
      const datasetDescription = asString(getOptionalNodeParameter(context, 'datasetDescription', itemIndex));
      if (datasetName !== undefined) params.datasetName = datasetName;
      if (datasetDescription !== undefined) params.datasetDescription = datasetDescription;
      params.metadataJson = getOptionalNodeParameter(context, 'metadataJson', itemIndex);
      break;
    }
    case 'getDatasetItem':
    case 'deleteDatasetItem': {
      const datasetItemId = asString(getOptionalNodeParameter(context, 'datasetItemId', itemIndex));
      if (datasetItemId !== undefined) params.datasetItemId = datasetItemId;
      break;
    }
    case 'createDatasetItem': {
      const datasetName = asString(getOptionalNodeParameter(context, 'datasetName', itemIndex));
      const datasetItemId = asString(getOptionalNodeParameter(context, 'datasetItemId', itemIndex));
      const datasetItemStatus = asString(getOptionalNodeParameter(context, 'datasetItemStatus', itemIndex));
      const sourceTraceId = asString(getOptionalNodeParameter(context, 'sourceTraceId', itemIndex));
      const sourceObservationId = asString(getOptionalNodeParameter(context, 'sourceObservationId', itemIndex));
      if (datasetName !== undefined) params.datasetName = datasetName;
      if (datasetItemId !== undefined) params.datasetItemId = datasetItemId;
      if (datasetItemStatus !== undefined) params.datasetItemStatus = datasetItemStatus;
      if (sourceTraceId !== undefined) params.sourceTraceId = sourceTraceId;
      if (sourceObservationId !== undefined) params.sourceObservationId = sourceObservationId;
      params.inputJson = getOptionalNodeParameter(context, 'inputJson', itemIndex);
      params.expectedOutputJson = getOptionalNodeParameter(context, 'expectedOutputJson', itemIndex);
      params.metadataJson = getOptionalNodeParameter(context, 'metadataJson', itemIndex);
      break;
    }
    case 'listDatasetRuns': {
      const datasetName = asString(getOptionalNodeParameter(context, 'datasetName', itemIndex));
      if (datasetName !== undefined) params.datasetName = datasetName;
      params.queryJson = getOptionalNodeParameter(context, 'queryJson', itemIndex);
      break;
    }
    case 'getDatasetRun':
    case 'deleteDatasetRun': {
      const datasetName = asString(getOptionalNodeParameter(context, 'datasetName', itemIndex));
      const runName = asString(getOptionalNodeParameter(context, 'runName', itemIndex));
      if (datasetName !== undefined) params.datasetName = datasetName;
      if (runName !== undefined) params.runName = runName;
      break;
    }
    case 'createDatasetRunItem': {
      const runName = asString(getOptionalNodeParameter(context, 'runName', itemIndex));
      const datasetItemId = asString(getOptionalNodeParameter(context, 'datasetItemId', itemIndex));
      const traceId = asString(getOptionalNodeParameter(context, 'traceId', itemIndex));
      const observationId = asString(getOptionalNodeParameter(context, 'observationId', itemIndex));
      const runDescription = asString(getOptionalNodeParameter(context, 'runDescription', itemIndex));
      if (runName !== undefined) params.runName = runName;
      if (datasetItemId !== undefined) params.datasetItemId = datasetItemId;
      if (traceId !== undefined) params.traceId = traceId;
      if (observationId !== undefined) params.observationId = observationId;
      if (runDescription !== undefined) params.runDescription = runDescription;
      params.metadataJson = getOptionalNodeParameter(context, 'metadataJson', itemIndex);
      break;
    }
    case 'customRequest': {
      const path = asString(getOptionalNodeParameter(context, 'path', itemIndex));
      const method = getOptionalNodeParameter(context, 'method', itemIndex) as LangfusePublicApiMethod | undefined;
      if (path !== undefined) params.path = path;
      if (method !== undefined) params.method = method;
      params.queryJson = getOptionalNodeParameter(context, 'queryJson', itemIndex);
      params.bodyJson = getOptionalNodeParameter(context, 'bodyJson', itemIndex);
      break;
    }
  }

  return params;
}

// ---------------------------------------------------------------------------
// Shared execute logic
// ---------------------------------------------------------------------------

const INGESTION_OPERATIONS = new Set<string>([
  'traceCreate', 'spanCreate', 'spanUpdate', 'generationCreate', 'generationUpdate',
  'finalizeSpan', 'eventCreate', 'scoreCreate', 'sdkLogCreate', 'batchRaw',
]);

// Public API operations that page through a `{ data, meta }` list — eligible for
// the "Return All" auto-pagination toggle.
const LIST_OPERATIONS = new Set<string>([
  'listPrompts', 'listTraces', 'listScores', 'listObservations', 'listSessions',
  'listAnnotationQueues', 'listAnnotationQueueItems', 'listScoreConfigs',
  'listDatasets', 'listDatasetItems', 'listDatasetRuns',
]);

async function runExecute(this: LangfuseExecuteContext): Promise<Array<Array<NodeInputItem>>> {
  const items = this.getInputData();
  const output: Array<NodeInputItem> = [];
  const credentials = await this.getCredentials('langfuseApi');

  for (const [itemIndex] of items.entries()) {
    const resource = this.getNodeParameter('resource', itemIndex) as string;
    const operation = this.getNodeParameter('operation', itemIndex) as LangfuseOperation | LangfusePublicApiOperation;

    try {
      if (INGESTION_OPERATIONS.has(operation)) {
        const failOnBatchErrors = Boolean(getOptionalNodeParameter(this, 'failOnBatchErrors', itemIndex));
        const params = buildIngestionParameters(this, itemIndex);
        const events = buildEventsForOperation(operation as LangfuseOperation, params);
        const response = await withRetry(() =>
          sendLangfuseIngestion({
            baseUrl: credentials.baseUrl,
            publicKey: credentials.publicKey,
            secretKey: credentials.secretKey,
            batch: events,
            ...(credentials.timeoutMs !== undefined ? { timeoutMs: credentials.timeoutMs } : {}),
          }),
        );

        if (response.errors.length > 0 && failOnBatchErrors) {
          throw new Error(`Langfuse returned ${response.errors.length} batch error(s) for operation ${operation}`);
        }

        const summary = summarizeIngestionEvents(events);
        output.push({
          json: {
            resource,
            operation,
            requestUrl: buildIngestionUrl(credentials.baseUrl),
            status: response.status,
            ok: response.ok,
            batchSize: events.length,
            // Surface the ids actually written so later spans/scores can attach
            // to the same trace (these reflect what was sent, including any
            // auto-generated ids).
            ...(summary.traceId !== undefined ? { traceId: summary.traceId } : {}),
            ...(summary.sessionId !== undefined ? { sessionId: summary.sessionId } : {}),
            ids: summary.ids,
            eventIds: summary.eventIds,
            successes: response.successes,
            errors: response.errors,
            raw: response.raw,
          },
          pairedItem: { item: itemIndex },
        });
        continue;
      }

      const params = buildPublicApiParameters(this, itemIndex, operation as LangfusePublicApiOperation);
      const endpoint = resolveLangfusePublicApiEndpoint(operation as LangfusePublicApiOperation, params);

      // "Return All" auto-pagination for list operations.
      if (LIST_OPERATIONS.has(operation) && Boolean(getOptionalNodeParameter(this, 'returnAll', itemIndex))) {
        const all = await requestLangfusePublicApiAll({
          baseUrl: credentials.baseUrl,
          publicKey: credentials.publicKey,
          secretKey: credentials.secretKey,
          path: endpoint.path,
          ...(endpoint.query !== undefined ? { query: endpoint.query } : {}),
          ...(credentials.timeoutMs !== undefined ? { timeoutMs: credentials.timeoutMs } : {}),
        });
        output.push({
          json: {
            resource,
            operation,
            requestUrl: buildLangfusePublicApiUrl(credentials.baseUrl, endpoint.path, endpoint.query),
            status: all.status,
            ok: true,
            returnAll: true,
            pages: all.pages,
            count: all.data.length,
            data: all.data,
          },
          pairedItem: { item: itemIndex },
        });
        continue;
      }

      const response = await withRetry(() =>
        requestLangfusePublicApi({
          baseUrl: credentials.baseUrl,
          publicKey: credentials.publicKey,
          secretKey: credentials.secretKey,
          path: endpoint.path,
          method: endpoint.method,
          ...(endpoint.query !== undefined ? { query: endpoint.query } : {}),
          ...(endpoint.body !== undefined ? { body: endpoint.body } : {}),
          ...(credentials.timeoutMs !== undefined ? { timeoutMs: credentials.timeoutMs } : {}),
        }),
      );

      output.push({
        json: {
          resource,
          operation,
          requestUrl: buildLangfusePublicApiUrl(credentials.baseUrl, endpoint.path, endpoint.query),
          status: response.status,
          ok: response.ok,
          data: response.data,
          raw: response.raw,
        },
        pairedItem: { item: itemIndex },
      });
    } catch (error) {
      if (this.continueOnFail?.()) {
        output.push({
          json: {
            resource,
            operation,
            ok: false,
            error: asErrorMessage(error),
            // Preserve the HTTP status and response body for failed API calls so
            // downstream nodes can branch on them instead of parsing the message.
            ...(error instanceof LangfuseRequestError
              ? { status: error.status, errorBody: error.body }
              : {}),
          },
          pairedItem: { item: itemIndex },
        });
        continue;
      }

      throw error;
    }
  }

  return [output];
}

// ---------------------------------------------------------------------------
// V1 — legacy resource/operation layout (ingestion | publicApi)
// ---------------------------------------------------------------------------

const showIngestionBasic = (...operations: LangfuseOperation[]): NodePropertyDisplayOptions => ({
  show: { resource: ['ingestion'] as string[], operation: operations as string[] },
});

const showIngestionAdvanced = (...operations: LangfuseOperation[]): NodePropertyDisplayOptions => ({
  show: { resource: ['ingestion'] as string[], operation: operations as string[], showAdvancedFields: [true] },
});

const showIngestion = showIngestionAdvanced;

const showPublicApiBasic = (...operations: LangfusePublicApiOperation[]): NodePropertyDisplayOptions => ({
  show: { resource: ['publicApi'] as string[], operation: operations as string[] },
});

const showPublicApiAdvanced = (...operations: LangfusePublicApiOperation[]): NodePropertyDisplayOptions => ({
  show: { resource: ['publicApi'] as string[], operation: operations as string[], showAdvancedFields: [true] },
});

const showPublicApi = showPublicApiAdvanced;

const v1Description: NodeDescription = {
  displayName: 'Langfuse',
  name: 'langfuse',
  icon: 'file:langfuse.svg',
  group: ['transform'],
  version: 1,
  subtitle: '={{$parameter["operation"]}}',
  description: 'Log LLM traces, spans, generations, and scores to Langfuse, or query traces, prompts, datasets, sessions, and more via the Public API.',
  defaults: { name: 'Langfuse' },
  inputs: ['main'],
  outputs: ['main'],
  credentials: [{ name: 'langfuseApi', required: true }],
  properties: [
    {
      displayName: 'Resource',
      name: 'resource',
      type: 'options',
      default: 'ingestion',
      noDataExpression: true,
      options: [
        { name: 'Ingestion', value: 'ingestion', action: 'Manage Langfuse ingestion events', description: 'Send traces, spans, generations, events, scores, and SDK logs' },
        { name: 'Public API', value: 'publicApi', action: 'Read Langfuse public API data', description: 'Inspect prompts, traces, scores, sessions, and annotation queues' },
      ],
      description: 'Choose which Langfuse API area to work with',
    },
    {
      displayName: 'Operation',
      name: 'operation',
      type: 'options',
      default: 'traceCreate',
      noDataExpression: true,
      options: [
        { name: 'Batch Raw', value: 'batchRaw', action: 'Send raw batch', description: 'Send a raw ingestion batch without mapping fields' },
        { name: 'Event Create', value: 'eventCreate', action: 'Create event', description: 'Send a custom event-create event' },
        { name: 'Finalize Span', value: 'finalizeSpan', action: 'Finalize span', description: 'Send generation-create and span-update in one batch' },
        { name: 'Generation Create', value: 'generationCreate', action: 'Create generation', description: 'Send a generation-create event' },
        { name: 'Generation Update', value: 'generationUpdate', action: 'Update generation', description: 'Send a generation-update event' },
        { name: 'Score Create', value: 'scoreCreate', action: 'Create score', description: 'Send a score-create event' },
        { name: 'SDK Log Create', value: 'sdkLogCreate', action: 'Create SDK log', description: 'Send an sdk-log event' },
        { name: 'Span Create', value: 'spanCreate', action: 'Create span', description: 'Send a span-create event' },
        { name: 'Span Update', value: 'spanUpdate', action: 'Update span', description: 'Send a span-update event' },
        { name: 'Trace Create', value: 'traceCreate', action: 'Create trace', description: 'Send a trace-create event' },
      ],
      displayOptions: { show: { resource: ['ingestion'] } },
      description: 'Choose which Langfuse ingestion event to send',
    },
    {
      displayName: 'Operation',
      name: 'operation',
      type: 'options',
      default: 'health',
      noDataExpression: true,
      options: [
        { name: 'Custom Request', value: 'customRequest', action: 'Send custom request', description: 'Call any Langfuse public API endpoint' },
        { name: 'Delete Score', value: 'deleteScore', action: 'Delete score', description: 'Delete a score by ID' },
        { name: 'Get Annotation Queue', value: 'getAnnotationQueue', action: 'Get annotation queue', description: 'Read a single annotation queue by ID' },
        { name: 'Get Observation', value: 'getObservation', action: 'Get observation', description: 'Read a single observation by ID' },
        { name: 'Get Prompt', value: 'getPrompt', action: 'Get prompt', description: 'Read a specific prompt' },
        { name: 'Get Score', value: 'getScore', action: 'Get score', description: 'Read a single score by ID' },
        { name: 'Get Score Config', value: 'getScoreConfig', action: 'Get score config', description: 'Read a single score configuration by ID' },
        { name: 'Get Session', value: 'getSession', action: 'Get session', description: 'Read a single session by ID' },
        { name: 'Get Trace', value: 'getTrace', action: 'Get trace', description: 'Read a single trace by ID' },
        { name: 'Health', value: 'health', action: 'Check health', description: 'Call the Langfuse health endpoint' },
        { name: 'List Annotation Queue Items', value: 'listAnnotationQueueItems', action: 'List annotation queue items', description: 'Read items in an annotation queue' },
        { name: 'List Annotation Queues', value: 'listAnnotationQueues', action: 'List annotation queues', description: 'Read annotation queues' },
        { name: 'List Observations', value: 'listObservations', action: 'List observations', description: 'Read observations from Langfuse' },
        { name: 'List Prompts', value: 'listPrompts', action: 'List prompts', description: 'Read all prompts' },
        { name: 'List Score Configs', value: 'listScoreConfigs', action: 'List score configs', description: 'Read all score configurations' },
        { name: 'List Scores', value: 'listScores', action: 'List scores', description: 'Read scores from Langfuse' },
        { name: 'List Sessions', value: 'listSessions', action: 'List sessions', description: 'Read sessions from Langfuse' },
        { name: 'List Traces', value: 'listTraces', action: 'List traces', description: 'Read traces from Langfuse' },
      ],
      displayOptions: { show: { resource: ['publicApi'] } },
      description: 'Choose which Langfuse public API endpoint to call',
    },
    {
      displayName: 'Show Advanced Fields',
      name: 'showAdvancedFields',
      type: 'boolean',
      default: false,
      description: 'Whether to reveal optional fields for the selected operation',
      displayOptions: { show: { resource: ['ingestion', 'publicApi'] } },
    },
    { displayName: 'Trace ID', name: 'traceId', type: 'string', default: '', placeholder: '1234567890abcdef1234567890abcdef', description: 'Optional. Leave blank to auto-generate a new trace ID.', displayOptions: showIngestionBasic('traceCreate') },
    { displayName: 'Trace ID', name: 'traceId', type: 'string', default: '={{ $json.traceId }}', placeholder: '1234567890abcdef1234567890abcdef', description: 'Trace this observation or score attaches to. Auto-filled from the previous step traceId output; clear it to start a new trace.', displayOptions: showIngestionBasic('spanCreate', 'spanUpdate', 'generationCreate', 'generationUpdate', 'eventCreate', 'scoreCreate', 'sdkLogCreate') },
    { displayName: 'Trace ID', name: 'traceId', type: 'string', default: '', placeholder: '1234567890abcdef1234567890abcdef', description: 'Trace ID to load with Get Trace', displayOptions: showPublicApiBasic('getTrace') },
    { displayName: 'Event ID', name: 'eventId', type: 'string', default: '', placeholder: 'Optional event ID', description: 'Optional event ID for idempotency and deduplication', displayOptions: showIngestionAdvanced('traceCreate', 'spanCreate', 'spanUpdate', 'generationCreate', 'generationUpdate', 'eventCreate', 'scoreCreate', 'sdkLogCreate') },
    { displayName: 'Observation ID', name: 'observationId', type: 'string', default: '', placeholder: 'Optional observation ID', description: 'Required for update operations. Leave blank for create operations to auto-generate an observation ID.', displayOptions: showIngestionBasic('spanCreate', 'spanUpdate', 'generationCreate', 'generationUpdate', 'eventCreate', 'scoreCreate', 'sdkLogCreate') },
    { displayName: 'Parent Observation ID', name: 'parentObservationId', type: 'string', default: '', placeholder: 'Optional parent observation ID', description: 'Optional parent observation ID for nested spans, generations, events, and logs', displayOptions: showIngestionBasic('spanCreate', 'spanUpdate', 'generationCreate', 'generationUpdate', 'eventCreate', 'sdkLogCreate') },
    { displayName: 'Timestamp', name: 'timestamp', type: 'string', default: '', placeholder: '2026-06-02T10:00:00.000Z', description: 'Optional ISO 8601 timestamp for the event. If blank, the current time is used.', displayOptions: showIngestionAdvanced('traceCreate', 'spanCreate', 'spanUpdate', 'generationCreate', 'generationUpdate', 'eventCreate', 'scoreCreate', 'sdkLogCreate') },
    { displayName: 'Start Time', name: 'startTime', type: 'string', default: '', placeholder: '2026-06-02T10:00:00.000Z', description: 'Optional ISO 8601 start time for spans and generations', displayOptions: showIngestion('spanCreate', 'generationCreate', 'finalizeSpan') },
    { displayName: 'End Time', name: 'endTime', type: 'string', default: '', placeholder: '2026-06-02T10:00:02.000Z', description: 'Optional ISO 8601 end time for spans, generations, and Finalize Span', displayOptions: showIngestion('spanUpdate', 'generationUpdate', 'finalizeSpan') },
    { displayName: 'Name', name: 'name', type: 'string', default: '', description: 'Human-readable name for the trace, span, generation, event, or SDK log', displayOptions: showIngestionBasic('traceCreate', 'spanCreate', 'spanUpdate', 'generationCreate', 'generationUpdate', 'eventCreate', 'scoreCreate', 'sdkLogCreate') },
    { displayName: 'User ID', name: 'userId', type: 'string', default: '', description: 'Optional user identifier attached to the trace', displayOptions: showIngestionBasic('traceCreate') },
    { displayName: 'Session ID', name: 'sessionId', type: 'string', default: '', placeholder: 'Leave blank to auto-generate', description: 'Session this trace or score belongs to. Leave blank on Trace Create to auto-generate one; pass a stable value to group related traces.', displayOptions: showIngestionBasic('traceCreate', 'scoreCreate') },
    { displayName: 'Public', name: 'public', type: 'boolean', default: false, description: 'Whether to mark the trace as public in Langfuse', displayOptions: showIngestion('traceCreate') },
    { displayName: 'Tags', name: 'tags', type: 'string', default: '', placeholder: 'prod,checkout', description: 'Comma-separated tags or a JSON array of tags', displayOptions: showIngestion('traceCreate') },
    { displayName: 'Environment', name: 'environment', type: 'string', default: '', placeholder: 'production', description: 'Optional environment label for the trace or observation', displayOptions: showIngestion('traceCreate', 'spanCreate', 'generationCreate', 'eventCreate') },
    { displayName: 'Input JSON', name: 'inputJson', type: 'string', default: '', placeholder: '{"cartId":"cart-1"}', description: 'JSON input payload stored on the trace or observation', displayOptions: showIngestionBasic('traceCreate', 'spanCreate', 'spanUpdate', 'generationCreate', 'generationUpdate', 'eventCreate') },
    { displayName: 'Output JSON', name: 'outputJson', type: 'string', default: '', placeholder: '{"ok":true}', description: 'JSON output payload stored on the trace or observation', displayOptions: showIngestionBasic('traceCreate', 'spanCreate', 'spanUpdate', 'generationCreate', 'generationUpdate', 'eventCreate') },
    { displayName: 'Metadata JSON', name: 'metadataJson', type: 'string', default: '', placeholder: '{"source":"n8n"}', description: 'Additional JSON metadata stored with the trace, observation, score, or SDK log', displayOptions: showIngestion('traceCreate', 'spanCreate', 'spanUpdate', 'generationCreate', 'generationUpdate', 'eventCreate', 'scoreCreate', 'sdkLogCreate') },
    { displayName: 'Version', name: 'version', type: 'string', default: '', description: 'Optional version string stored on the trace or observation', displayOptions: showIngestion('traceCreate', 'spanCreate', 'spanUpdate', 'generationCreate', 'generationUpdate', 'eventCreate') },
    { displayName: 'Level', name: 'level', type: 'string', default: '', placeholder: 'info', description: 'Optional log or observation level', displayOptions: showIngestion('spanCreate', 'spanUpdate', 'generationCreate', 'generationUpdate', 'eventCreate') },
    { displayName: 'Status Message', name: 'statusMessage', type: 'string', default: '', description: 'Optional status message attached to the observation or event', displayOptions: showIngestion('spanCreate', 'spanUpdate', 'generationCreate', 'generationUpdate', 'eventCreate') },
    { displayName: 'Model', name: 'model', type: 'string', default: '', description: 'Model name used for the generation event', displayOptions: showIngestionBasic('generationCreate', 'generationUpdate') },
    { displayName: 'Generation Observation ID', name: 'generationObservationId', type: 'string', default: '', placeholder: 'abcdef1234567890_gen', description: 'Optional custom observation ID for the generated LLM call in Finalize Span', displayOptions: showIngestion('finalizeSpan') },
    { displayName: 'Model Parameters JSON', name: 'modelParametersJson', type: 'string', default: '', placeholder: '{"temperature":0.2}', description: 'JSON model parameters stored with the generation', displayOptions: showIngestion('generationCreate', 'generationUpdate') },
    { displayName: 'Prompt Name', name: 'promptName', type: 'string', default: '', description: 'Prompt name linked to the generation', displayOptions: showIngestionBasic('generationCreate', 'generationUpdate', 'finalizeSpan') },
    { displayName: 'Prompt Name', name: 'promptName', type: 'string', default: '', description: 'Prompt name to fetch from Langfuse', displayOptions: showPublicApiBasic('getPrompt') },
    { displayName: 'Prompt Label', name: 'promptLabel', type: 'string', default: '', placeholder: 'production', description: 'Optional prompt label query parameter', displayOptions: showPublicApi('getPrompt') },
    { displayName: 'Prompt Version', name: 'promptVersion', type: 'string', default: '', description: 'Optional prompt version linked to the generation', displayOptions: showIngestionBasic('generationCreate', 'generationUpdate', 'finalizeSpan') },
    { displayName: 'Prompt Version', name: 'promptVersion', type: 'string', default: '', description: 'Optional prompt version query parameter', displayOptions: showPublicApi('getPrompt') },
    { displayName: 'Prompt Labels JSON', name: 'promptLabelsJson', type: 'string', default: '', placeholder: '["production"]', description: 'JSON array of prompt labels stored with the generation', displayOptions: showIngestion('generationCreate', 'generationUpdate', 'finalizeSpan') },
    { displayName: 'Usage Details JSON', name: 'usageDetailsJson', type: 'string', default: '', placeholder: '{"prompt_tokens":1,"completion_tokens":2}', description: 'JSON usage breakdown stored with the generation', displayOptions: showIngestion('generationCreate', 'generationUpdate') },
    { displayName: 'Cost Details JSON', name: 'costDetailsJson', type: 'string', default: '', placeholder: '{"total_cost":0.01}', description: 'JSON cost breakdown stored with the generation', displayOptions: showIngestion('generationCreate', 'generationUpdate') },
    { displayName: 'Completion Start Time', name: 'completionStartTime', type: 'string', default: '', description: 'Optional completion start time for the generation', displayOptions: showIngestion('generationCreate', 'generationUpdate') },
    { displayName: 'Score ID', name: 'scoreId', type: 'string', default: '', description: 'Optional score ID for idempotent create/update behavior', displayOptions: showIngestion('scoreCreate') },
    { displayName: 'Score ID', name: 'scoreId', type: 'string', default: '', description: 'Score ID to fetch or delete', displayOptions: showPublicApiBasic('getScore', 'deleteScore') },
    { displayName: 'Observation ID', name: 'observationId', type: 'string', default: '', description: 'Observation ID to fetch from Langfuse', displayOptions: showPublicApiBasic('getObservation') },
    {
      displayName: 'Score Name', name: 'scoreName', type: 'string', default: '', required: true,
      description: 'Score name to store in Langfuse', displayOptions: showIngestionBasic('scoreCreate'),
    },
    {
      displayName: 'Score Value', name: 'scoreValue', type: 'string', default: '', required: true,
      description: 'Score value. Use a JSON-compatible number, boolean, string, or text.', displayOptions: showIngestionBasic('scoreCreate'),
    },
    {
      displayName: 'Score Data Type', name: 'scoreDataType', type: 'options', default: 'NUMERIC',
      options: [{ name: 'Numeric', value: 'NUMERIC' }, { name: 'Boolean', value: 'BOOLEAN' }, { name: 'Categorical', value: 'CATEGORICAL' }, { name: 'Text', value: 'TEXT' }],
      description: 'Optional Langfuse score data type', displayOptions: showIngestionBasic('scoreCreate'),
    },
    { displayName: 'Score Comment', name: 'scoreComment', type: 'string', default: '', description: 'Optional human-readable comment for the score', displayOptions: showIngestion('scoreCreate') },
    { displayName: 'Score Config ID', name: 'scoreConfigId', type: 'string', default: '', description: 'Optional score config ID', displayOptions: showIngestion('scoreCreate') },
    { displayName: 'Score Environment', name: 'scoreEnvironment', type: 'string', default: '', description: 'Optional environment label for the score', displayOptions: showIngestion('scoreCreate') },
    { displayName: 'Score Dataset Run ID', name: 'scoreDatasetRunId', type: 'string', default: '', description: 'Optional dataset run ID attached to the score', displayOptions: showIngestion('scoreCreate') },
    { displayName: 'Score Session ID', name: 'scoreSessionId', type: 'string', default: '', description: 'Optional session ID attached to the score', displayOptions: showIngestion('scoreCreate') },
    { displayName: 'Score Trace ID', name: 'scoreTraceId', type: 'string', default: '', description: 'Optional trace ID override for the score', displayOptions: showIngestion('scoreCreate') },
    { displayName: 'Score Observation ID', name: 'scoreObservationId', type: 'string', default: '', description: 'Optional observation ID override for the score', displayOptions: showIngestion('scoreCreate') },
    { displayName: 'SDK Message', name: 'sdkMessage', type: 'string', default: '', description: 'Message written to the SDK log event', displayOptions: showIngestionBasic('sdkLogCreate') },
    {
      displayName: 'SDK Level', name: 'sdkLevel', type: 'options', default: 'info',
      options: [{ name: 'Debug', value: 'debug' }, { name: 'Info', value: 'info' }, { name: 'Warn', value: 'warn' }, { name: 'Error', value: 'error' }],
      description: 'Log severity for the SDK log event', displayOptions: showIngestionBasic('sdkLogCreate'),
    },
    { displayName: 'Queue ID', name: 'queueId', type: 'string', default: '', description: 'Annotation queue ID to fetch or list items from', displayOptions: showPublicApiBasic('getAnnotationQueue', 'listAnnotationQueueItems') },
    { displayName: 'Session ID', name: 'sessionId', type: 'string', default: '', description: 'Session ID to fetch', displayOptions: showPublicApiBasic('getSession') },
    { displayName: 'Score Config ID', name: 'scoreConfigId', type: 'string', default: '', description: 'Score config ID to fetch', displayOptions: showPublicApiBasic('getScoreConfig') },
    { displayName: 'Path', name: 'path', type: 'string', default: '', placeholder: '/v2/prompts', description: 'Relative Langfuse Public API path for a custom request', displayOptions: showPublicApiBasic('customRequest') },
    {
      displayName: 'Method', name: 'method', type: 'options', default: 'GET',
      options: [{ name: 'DELETE', value: 'DELETE' }, { name: 'GET', value: 'GET' }, { name: 'PATCH', value: 'PATCH' }, { name: 'POST', value: 'POST' }, { name: 'PUT', value: 'PUT' }],
      description: 'HTTP method for the custom request', displayOptions: showPublicApiBasic('customRequest'),
    },
    { displayName: 'Query JSON', name: 'queryJson', type: 'string', default: '', placeholder: '{"page":1,"limit":20}', description: 'JSON object converted into query string parameters', displayOptions: showPublicApi('listPrompts', 'listTraces', 'listScores', 'listObservations', 'listSessions', 'listAnnotationQueues', 'listAnnotationQueueItems', 'listScoreConfigs', 'customRequest') },
    { displayName: 'Return All', name: 'returnAll', type: 'boolean', default: false, description: 'Whether to return all results or only up to a given limit', displayOptions: showPublicApiBasic('listPrompts', 'listTraces', 'listScores', 'listObservations', 'listSessions', 'listAnnotationQueues', 'listAnnotationQueueItems', 'listScoreConfigs') },
    { displayName: 'Body JSON', name: 'bodyJson', type: 'string', default: '', placeholder: '{"name":"prompt-name"}', description: 'JSON request body for Custom Request. Ignored for GET and HEAD requests.', displayOptions: showPublicApi('customRequest') },
    { displayName: 'Batch JSON', name: 'batchJson', type: 'string', default: '', placeholder: '{"batch":[{"ID":"evt-1","type":"event-create"}]}', description: 'Raw Langfuse ingestion batch sent without mapping fields', displayOptions: showIngestionBasic('batchRaw') },
    { displayName: 'Fail On Batch Errors', name: 'failOnBatchErrors', type: 'boolean', default: false, description: 'Whether to fail the item when Langfuse returns partial ingestion errors', displayOptions: showIngestion('traceCreate', 'spanCreate', 'spanUpdate', 'generationCreate', 'generationUpdate', 'finalizeSpan', 'eventCreate', 'scoreCreate', 'sdkLogCreate', 'batchRaw') },
  ],
};

// ---------------------------------------------------------------------------
// V2 — entity-based resource layout
// ---------------------------------------------------------------------------

const v2Basic = (...ops: string[]): NodePropertyDisplayOptions => ({ show: { operation: ops } });
const v2Adv = (...ops: string[]): NodePropertyDisplayOptions => ({ show: { operation: ops, showAdvancedFields: [true] } });

const v2Description: NodeDescription = {
  displayName: 'Langfuse',
  name: 'langfuse',
  icon: 'file:langfuse.svg',
  group: ['transform'],
  version: 2,
  subtitle: '={{$parameter["resource"] + ": " + $parameter["operation"]}}',
  description: 'Log LLM traces, spans, generations, and scores to Langfuse, or query traces, prompts, datasets, sessions, and more via the Public API.',
  defaults: { name: 'Langfuse' },
  inputs: ['main'],
  outputs: ['main'],
  credentials: [{ name: 'langfuseApi', required: true }],
  properties: [
    // ---- Resource selector ----
    {
      displayName: 'Resource',
      name: 'resource',
      type: 'options',
      default: 'trace',
      noDataExpression: true,
      options: [
        { name: 'Annotation Queue', value: 'queue', description: 'Read and list annotation queues from the Public API' },
        { name: 'Dataset', value: 'dataset', description: 'Create, read, and list datasets' },
        { name: 'Dataset Item', value: 'datasetItem', description: 'Create, read, list, or delete dataset items' },
        { name: 'Dataset Run', value: 'datasetRun', description: 'Read, list, or delete dataset runs and link run items' },
        { name: 'Generation', value: 'generation', description: 'Create and update generation observations' },
        { name: 'Observation', value: 'observation', description: 'Read and list observations from the Public API' },
        { name: 'Prompt', value: 'prompt', description: 'Read and list prompts from the Public API' },
        { name: 'Score', value: 'score', description: 'Create, read, list, or delete scores' },
        { name: 'Session', value: 'session', description: 'List sessions from the Public API' },
        { name: 'Span', value: 'span', description: 'Create and update span observations' },
        { name: 'System', value: 'system', description: 'Health check, SDK logs, raw batches, and custom requests' },
        { name: 'Trace', value: 'trace', description: 'Create traces or read them via the Public API' },
      ],
      description: 'Choose which Langfuse entity to work with',
    },

    // ---- Operation selectors (one per resource) ----
    {
      displayName: 'Operation', name: 'operation', type: 'options', default: 'traceCreate', noDataExpression: true,
      displayOptions: { show: { resource: ['trace'] } },
      options: [
        { name: 'Create', value: 'traceCreate', action: 'Create trace', description: 'Send a trace-create ingestion event' },
        { name: 'Get', value: 'getTrace', action: 'Get trace by ID', description: 'Read a single trace by ID (Public API)' },
        { name: 'List', value: 'listTraces', action: 'List traces', description: 'Read traces from Langfuse (Public API)' },
      ],
      description: 'Choose the trace operation',
    },
    {
      displayName: 'Operation', name: 'operation', type: 'options', default: 'spanCreate', noDataExpression: true,
      displayOptions: { show: { resource: ['span'] } },
      options: [
        { name: 'Create', value: 'spanCreate', action: 'Create span', description: 'Send a span-create ingestion event' },
        { name: 'Update', value: 'spanUpdate', action: 'Update span', description: 'Send a span-update ingestion event' },
      ],
      description: 'Choose the span operation',
    },
    {
      displayName: 'Operation', name: 'operation', type: 'options', default: 'generationCreate', noDataExpression: true,
      displayOptions: { show: { resource: ['generation'] } },
      options: [
        { name: 'Create', value: 'generationCreate', action: 'Create generation', description: 'Send a generation-create ingestion event' },
        { name: 'Update', value: 'generationUpdate', action: 'Update generation', description: 'Send a generation-update ingestion event' },
        { name: 'Finalize', value: 'finalizeSpan', action: 'Finalize span', description: 'Send generation-create and span-update in one batch' },
      ],
      description: 'Choose the generation operation',
    },
    {
      displayName: 'Operation', name: 'operation', type: 'options', default: 'scoreCreate', noDataExpression: true,
      displayOptions: { show: { resource: ['score'] } },
      options: [
        { name: 'Create', value: 'scoreCreate', action: 'Create score', description: 'Send a score-create ingestion event' },
        { name: 'Delete', value: 'deleteScore', action: 'Delete score', description: 'Delete a score by ID (Public API)' },
        { name: 'Get', value: 'getScore', action: 'Get score by ID', description: 'Read a single score by ID (Public API)' },
        { name: 'Get Score Config', value: 'getScoreConfig', action: 'Get score config by ID', description: 'Read a single score configuration by ID (Public API)' },
        { name: 'List', value: 'listScores', action: 'List scores', description: 'Read scores from Langfuse (Public API)' },
        { name: 'List Score Configs', value: 'listScoreConfigs', action: 'List score configs', description: 'Read all score configurations (Public API)' },
      ],
      description: 'Choose the score operation',
    },
    {
      displayName: 'Operation', name: 'operation', type: 'options', default: 'getPrompt', noDataExpression: true,
      displayOptions: { show: { resource: ['prompt'] } },
      options: [
        { name: 'Create', value: 'createPrompt', action: 'Create prompt', description: 'Create a prompt or a new version of it' },
        { name: 'Get', value: 'getPrompt', action: 'Get prompt', description: 'Read a specific prompt by name' },
        { name: 'List', value: 'listPrompts', action: 'List prompts', description: 'Read all prompts' },
      ],
      description: 'Choose the prompt operation',
    },
    {
      displayName: 'Operation', name: 'operation', type: 'options', default: 'listSessions', noDataExpression: true,
      displayOptions: { show: { resource: ['session'] } },
      options: [
        { name: 'Get', value: 'getSession', action: 'Get session by ID', description: 'Read a single session by ID' },
        { name: 'List', value: 'listSessions', action: 'List sessions', description: 'Read sessions from Langfuse' },
      ],
      description: 'Choose the session operation',
    },
    {
      displayName: 'Operation', name: 'operation', type: 'options', default: 'getObservation', noDataExpression: true,
      displayOptions: { show: { resource: ['observation'] } },
      options: [
        { name: 'Get', value: 'getObservation', action: 'Get observation by ID', description: 'Read a single observation by ID' },
        { name: 'List', value: 'listObservations', action: 'List observations', description: 'Read observations from Langfuse' },
      ],
      description: 'Choose the observation operation',
    },
    {
      displayName: 'Operation', name: 'operation', type: 'options', default: 'getAnnotationQueue', noDataExpression: true,
      displayOptions: { show: { resource: ['queue'] } },
      options: [
        { name: 'Get', value: 'getAnnotationQueue', action: 'Get annotation queue', description: 'Read a single annotation queue by ID' },
        { name: 'List', value: 'listAnnotationQueues', action: 'List annotation queues', description: 'Read all annotation queues' },
        { name: 'List Items', value: 'listAnnotationQueueItems', action: 'List annotation queue items', description: 'Read items in an annotation queue' },
      ],
      description: 'Choose the annotation queue operation',
    },
    {
      displayName: 'Operation', name: 'operation', type: 'options', default: 'listDatasets', noDataExpression: true,
      displayOptions: { show: { resource: ['dataset'] } },
      options: [
        { name: 'Create', value: 'createDataset', action: 'Create dataset', description: 'Create a dataset (Public API)' },
        { name: 'Get', value: 'getDataset', action: 'Get dataset by name', description: 'Read a single dataset by name (Public API)' },
        { name: 'List', value: 'listDatasets', action: 'List datasets', description: 'Read all datasets (Public API)' },
      ],
      description: 'Choose the dataset operation',
    },
    {
      displayName: 'Operation', name: 'operation', type: 'options', default: 'listDatasetItems', noDataExpression: true,
      displayOptions: { show: { resource: ['datasetItem'] } },
      options: [
        { name: 'Create', value: 'createDatasetItem', action: 'Create dataset item', description: 'Create or upsert a dataset item (Public API)' },
        { name: 'Get', value: 'getDatasetItem', action: 'Get dataset item by ID', description: 'Read a single dataset item by ID (Public API)' },
        { name: 'List', value: 'listDatasetItems', action: 'List dataset items', description: 'Read dataset items, optionally filtered by dataset (Public API)' },
        { name: 'Delete', value: 'deleteDatasetItem', action: 'Delete dataset item', description: 'Delete a dataset item by ID (Public API)' },
      ],
      description: 'Choose the dataset item operation',
    },
    {
      displayName: 'Operation', name: 'operation', type: 'options', default: 'listDatasetRuns', noDataExpression: true,
      displayOptions: { show: { resource: ['datasetRun'] } },
      options: [
        { name: 'Create Run Item', value: 'createDatasetRunItem', action: 'Create dataset run item', description: 'Link a dataset item and trace into a run (Public API)' },
        { name: 'Get', value: 'getDatasetRun', action: 'Get dataset run', description: 'Read a single dataset run by name (Public API)' },
        { name: 'List', value: 'listDatasetRuns', action: 'List dataset runs', description: 'Read all runs for a dataset (Public API)' },
        { name: 'Delete', value: 'deleteDatasetRun', action: 'Delete dataset run', description: 'Delete a dataset run by name (Public API)' },
      ],
      description: 'Choose the dataset run operation',
    },
    {
      displayName: 'Operation', name: 'operation', type: 'options', default: 'health', noDataExpression: true,
      displayOptions: { show: { resource: ['system'] } },
      options: [
        { name: 'Batch Raw', value: 'batchRaw', action: 'Send raw batch', description: 'Send a raw ingestion batch without mapping fields' },
        { name: 'Custom Request', value: 'customRequest', action: 'Send custom request', description: 'Call any Langfuse public API endpoint' },
        { name: 'Event Create', value: 'eventCreate', action: 'Create event', description: 'Send a custom event-create ingestion event' },
        { name: 'Health', value: 'health', action: 'Check health', description: 'Call the Langfuse health endpoint' },
        { name: 'SDK Log', value: 'sdkLogCreate', action: 'Create SDK log', description: 'Send an sdk-log ingestion event' },
      ],
      description: 'Choose the system operation',
    },

    // ---- Show Advanced Fields toggle ----
    {
      displayName: 'Show Advanced Fields',
      name: 'showAdvancedFields',
      type: 'boolean',
      default: false,
      description: 'Whether to reveal optional fields for the selected operation',
      displayOptions: { show: { resource: ['trace', 'span', 'generation', 'score', 'prompt', 'session', 'observation', 'queue', 'dataset', 'datasetItem', 'datasetRun', 'system'] } },
    },

    // ---- Fields (same params as v1, displayOptions keyed by operation only) ----
    { displayName: 'Trace ID', name: 'traceId', type: 'string', default: '', placeholder: '1234567890abcdef1234567890abcdef', description: 'Optional. Leave blank to auto-generate.', displayOptions: v2Basic('traceCreate') },
    { displayName: 'Trace ID', name: 'traceId', type: 'string', default: '={{ $json.traceId }}', placeholder: '1234567890abcdef1234567890abcdef', description: 'Trace this observation or score attaches to. Auto-filled from the previous step traceId output; clear it to start a new trace.', displayOptions: v2Basic('spanCreate', 'spanUpdate', 'generationCreate', 'generationUpdate', 'eventCreate', 'scoreCreate', 'sdkLogCreate') },
    { displayName: 'Trace ID', name: 'traceId', type: 'string', default: '', placeholder: '1234567890abcdef1234567890abcdef', description: 'Trace ID to load with Get Trace', displayOptions: v2Basic('getTrace') },
    { displayName: 'Event ID', name: 'eventId', type: 'string', default: '', placeholder: 'Optional event ID', description: 'Optional event ID for idempotency and deduplication', displayOptions: v2Adv('traceCreate', 'spanCreate', 'spanUpdate', 'generationCreate', 'generationUpdate', 'eventCreate', 'scoreCreate', 'sdkLogCreate') },
    { displayName: 'Observation ID', name: 'observationId', type: 'string', default: '', placeholder: 'Optional observation ID', description: 'Required for update operations. Leave blank for create operations to auto-generate.', displayOptions: v2Basic('spanCreate', 'spanUpdate', 'generationCreate', 'generationUpdate', 'eventCreate', 'scoreCreate', 'sdkLogCreate') },
    { displayName: 'Parent Observation ID', name: 'parentObservationId', type: 'string', default: '', placeholder: 'Optional parent observation ID', description: 'Optional parent observation ID for nested spans, generations, events, and logs', displayOptions: v2Basic('spanCreate', 'spanUpdate', 'generationCreate', 'generationUpdate', 'eventCreate', 'sdkLogCreate') },
    { displayName: 'Timestamp', name: 'timestamp', type: 'string', default: '', placeholder: '2026-06-02T10:00:00.000Z', description: 'Optional ISO 8601 timestamp. If blank, the current time is used.', displayOptions: v2Adv('traceCreate', 'spanCreate', 'spanUpdate', 'generationCreate', 'generationUpdate', 'eventCreate', 'scoreCreate', 'sdkLogCreate') },
    { displayName: 'Start Time', name: 'startTime', type: 'string', default: '', placeholder: '2026-06-02T10:00:00.000Z', description: 'Optional ISO 8601 start time for spans and generations', displayOptions: v2Adv('spanCreate', 'generationCreate', 'finalizeSpan') },
    { displayName: 'End Time', name: 'endTime', type: 'string', default: '', placeholder: '2026-06-02T10:00:02.000Z', description: 'Optional ISO 8601 end time for spans, generations, and Finalize Span', displayOptions: v2Adv('spanUpdate', 'generationUpdate', 'finalizeSpan') },
    { displayName: 'Name', name: 'name', type: 'string', default: '', description: 'Human-readable name for the trace, span, generation, event, or SDK log', displayOptions: v2Basic('traceCreate', 'spanCreate', 'spanUpdate', 'generationCreate', 'generationUpdate', 'eventCreate', 'scoreCreate', 'sdkLogCreate') },
    { displayName: 'User ID', name: 'userId', type: 'string', default: '', description: 'Optional user identifier attached to the trace', displayOptions: v2Basic('traceCreate') },
    { displayName: 'Session ID', name: 'sessionId', type: 'string', default: '', placeholder: 'Leave blank to auto-generate', description: 'Session this trace or score belongs to. Leave blank on Trace Create to auto-generate one; pass a stable value to group related traces.', displayOptions: v2Basic('traceCreate', 'scoreCreate') },
    { displayName: 'Public', name: 'public', type: 'boolean', default: false, description: 'Whether to mark the trace as public in Langfuse', displayOptions: v2Adv('traceCreate') },
    { displayName: 'Tags', name: 'tags', type: 'string', default: '', placeholder: 'prod,checkout', description: 'Comma-separated tags or a JSON array of tags', displayOptions: v2Adv('traceCreate') },
    { displayName: 'Environment', name: 'environment', type: 'string', default: '', placeholder: 'production', description: 'Optional environment label for the trace or observation', displayOptions: v2Adv('traceCreate', 'spanCreate', 'generationCreate', 'eventCreate') },
    { displayName: 'Input JSON', name: 'inputJson', type: 'string', default: '', placeholder: '{"cartId":"cart-1"}', description: 'JSON input payload stored on the trace or observation', displayOptions: v2Basic('traceCreate', 'spanCreate', 'spanUpdate', 'generationCreate', 'generationUpdate', 'eventCreate') },
    { displayName: 'Output JSON', name: 'outputJson', type: 'string', default: '', placeholder: '{"ok":true}', description: 'JSON output payload stored on the trace or observation', displayOptions: v2Basic('traceCreate', 'spanCreate', 'spanUpdate', 'generationCreate', 'generationUpdate', 'eventCreate') },
    { displayName: 'Metadata JSON', name: 'metadataJson', type: 'string', default: '', placeholder: '{"source":"n8n"}', description: 'Additional JSON metadata stored with the trace, observation, score, or SDK log', displayOptions: v2Adv('traceCreate', 'spanCreate', 'spanUpdate', 'generationCreate', 'generationUpdate', 'eventCreate', 'scoreCreate', 'sdkLogCreate') },
    { displayName: 'Version', name: 'version', type: 'string', default: '', description: 'Optional version string stored on the trace or observation', displayOptions: v2Adv('traceCreate', 'spanCreate', 'spanUpdate', 'generationCreate', 'generationUpdate', 'eventCreate') },
    { displayName: 'Level', name: 'level', type: 'string', default: '', placeholder: 'info', description: 'Optional log or observation level', displayOptions: v2Adv('spanCreate', 'spanUpdate', 'generationCreate', 'generationUpdate', 'eventCreate') },
    { displayName: 'Status Message', name: 'statusMessage', type: 'string', default: '', description: 'Optional status message attached to the observation or event', displayOptions: v2Adv('spanCreate', 'spanUpdate', 'generationCreate', 'generationUpdate', 'eventCreate') },
    { displayName: 'Model', name: 'model', type: 'string', default: '', description: 'Model name used for the generation', displayOptions: v2Basic('generationCreate', 'generationUpdate') },
    { displayName: 'Generation Observation ID', name: 'generationObservationId', type: 'string', default: '', placeholder: 'abcdef1234567890_gen', description: 'Optional custom observation ID for the LLM call in Finalize Span', displayOptions: v2Adv('finalizeSpan') },
    { displayName: 'Model Parameters JSON', name: 'modelParametersJson', type: 'string', default: '', placeholder: '{"temperature":0.2}', description: 'JSON model parameters stored with the generation', displayOptions: v2Adv('generationCreate', 'generationUpdate') },
    { displayName: 'Prompt Name', name: 'promptName', type: 'string', default: '', description: 'Prompt name linked to the generation', displayOptions: v2Basic('generationCreate', 'generationUpdate', 'finalizeSpan') },
    { displayName: 'Prompt Name', name: 'promptName', type: 'string', default: '', description: 'Prompt name to fetch from Langfuse', displayOptions: v2Basic('getPrompt') },
    { displayName: 'Prompt Label', name: 'promptLabel', type: 'string', default: '', placeholder: 'production', description: 'Optional prompt label query parameter', displayOptions: v2Adv('getPrompt') },
    { displayName: 'Prompt Version', name: 'promptVersion', type: 'string', default: '', description: 'Optional prompt version linked to the generation', displayOptions: v2Basic('generationCreate', 'generationUpdate', 'finalizeSpan') },
    { displayName: 'Prompt Version', name: 'promptVersion', type: 'string', default: '', description: 'Optional prompt version query parameter', displayOptions: v2Adv('getPrompt') },

    // ---- Create Prompt fields ----
    { displayName: 'Prompt Name', name: 'promptName', type: 'string', default: '', required: true, description: 'Name of the prompt to create or version', displayOptions: v2Basic('createPrompt') },
    {
      displayName: 'Prompt Type', name: 'promptType', type: 'options', default: 'text',
      options: [{ name: 'Chat', value: 'chat' }, { name: 'Text', value: 'text' }],
      description: 'Type of prompt to create', displayOptions: v2Basic('createPrompt'),
    },
    { displayName: 'Prompt Text', name: 'promptText', type: 'string', typeOptions: { rows: 4 }, default: '', placeholder: 'You are a helpful assistant. Answer: {{question}}', description: 'Text prompt content. Use {{variable}} placeholders for Langfuse variables.', displayOptions: { show: { operation: ['createPrompt'], promptType: ['text'] } } },
    { displayName: 'Prompt Messages', name: 'promptChatJson', type: 'string', typeOptions: { rows: 4 }, default: '', placeholder: '[{"role":"system","content":"You are helpful"}]', description: 'JSON array of chat messages, each with a role and content', displayOptions: { show: { operation: ['createPrompt'], promptType: ['chat'] } } },
    { displayName: 'Labels', name: 'promptLabels', type: 'string', default: '', placeholder: 'production', description: 'Comma-separated labels or a JSON array, for example "production"', displayOptions: v2Adv('createPrompt') },
    { displayName: 'Tags', name: 'promptTags', type: 'string', default: '', placeholder: 'support,faq', description: 'Comma-separated tags or a JSON array', displayOptions: v2Adv('createPrompt') },
    { displayName: 'Config JSON', name: 'promptConfigJson', type: 'string', default: '', placeholder: '{"model":"gpt-4o-mini","temperature":0}', description: 'Optional JSON config stored with the prompt, such as model and parameters', displayOptions: v2Adv('createPrompt') },
    { displayName: 'Commit Message', name: 'promptCommitMessage', type: 'string', default: '', description: 'Optional commit message describing this prompt version', displayOptions: v2Adv('createPrompt') },
    { displayName: 'Prompt Labels JSON', name: 'promptLabelsJson', type: 'string', default: '', placeholder: '["production"]', description: 'JSON array of prompt labels stored with the generation', displayOptions: v2Adv('generationCreate', 'generationUpdate', 'finalizeSpan') },
    { displayName: 'Usage Details JSON', name: 'usageDetailsJson', type: 'string', default: '', placeholder: '{"prompt_tokens":1,"completion_tokens":2}', description: 'JSON usage breakdown stored with the generation', displayOptions: v2Adv('generationCreate', 'generationUpdate') },
    { displayName: 'Cost Details JSON', name: 'costDetailsJson', type: 'string', default: '', placeholder: '{"total_cost":0.01}', description: 'JSON cost breakdown stored with the generation', displayOptions: v2Adv('generationCreate', 'generationUpdate') },
    { displayName: 'Completion Start Time', name: 'completionStartTime', type: 'string', default: '', description: 'Optional completion start time for the generation', displayOptions: v2Adv('generationCreate', 'generationUpdate') },
    { displayName: 'Score ID', name: 'scoreId', type: 'string', default: '', description: 'Optional score ID for idempotent create/update behavior', displayOptions: v2Adv('scoreCreate') },
    { displayName: 'Score ID', name: 'scoreId', type: 'string', default: '', description: 'Score ID to fetch or delete', displayOptions: v2Basic('getScore', 'deleteScore') },
    { displayName: 'Observation ID', name: 'observationId', type: 'string', default: '', description: 'Observation ID to fetch from Langfuse', displayOptions: v2Basic('getObservation') },
    { displayName: 'Score Name', name: 'scoreName', type: 'string', default: '', required: true, description: 'Score name to store in Langfuse', displayOptions: v2Basic('scoreCreate') },
    { displayName: 'Score Value', name: 'scoreValue', type: 'string', default: '', required: true, description: 'Score value. Use a JSON-compatible number, boolean, string, or text.', displayOptions: v2Basic('scoreCreate') },
    {
      displayName: 'Score Data Type', name: 'scoreDataType', type: 'options', default: 'NUMERIC',
      options: [{ name: 'Numeric', value: 'NUMERIC' }, { name: 'Boolean', value: 'BOOLEAN' }, { name: 'Categorical', value: 'CATEGORICAL' }, { name: 'Text', value: 'TEXT' }],
      description: 'Optional Langfuse score data type', displayOptions: v2Basic('scoreCreate'),
    },
    { displayName: 'Score Comment', name: 'scoreComment', type: 'string', default: '', description: 'Optional human-readable comment for the score', displayOptions: v2Adv('scoreCreate') },
    { displayName: 'Score Config ID', name: 'scoreConfigId', type: 'string', default: '', description: 'Optional score config ID', displayOptions: v2Adv('scoreCreate') },
    { displayName: 'Score Environment', name: 'scoreEnvironment', type: 'string', default: '', description: 'Optional environment label for the score', displayOptions: v2Adv('scoreCreate') },
    { displayName: 'Score Dataset Run ID', name: 'scoreDatasetRunId', type: 'string', default: '', description: 'Optional dataset run ID attached to the score', displayOptions: v2Adv('scoreCreate') },
    { displayName: 'Score Session ID', name: 'scoreSessionId', type: 'string', default: '', description: 'Optional session ID attached to the score', displayOptions: v2Adv('scoreCreate') },
    { displayName: 'Score Trace ID', name: 'scoreTraceId', type: 'string', default: '', description: 'Optional trace ID override for the score', displayOptions: v2Adv('scoreCreate') },
    { displayName: 'Score Observation ID', name: 'scoreObservationId', type: 'string', default: '', description: 'Optional observation ID override for the score', displayOptions: v2Adv('scoreCreate') },
    { displayName: 'SDK Message', name: 'sdkMessage', type: 'string', default: '', description: 'Message written to the SDK log event', displayOptions: v2Basic('sdkLogCreate') },
    {
      displayName: 'SDK Level', name: 'sdkLevel', type: 'options', default: 'info',
      options: [{ name: 'Debug', value: 'debug' }, { name: 'Info', value: 'info' }, { name: 'Warn', value: 'warn' }, { name: 'Error', value: 'error' }],
      description: 'Log severity for the SDK log event', displayOptions: v2Basic('sdkLogCreate'),
    },
    { displayName: 'Queue ID', name: 'queueId', type: 'string', default: '', description: 'Annotation queue ID to fetch or list items from', displayOptions: v2Basic('getAnnotationQueue', 'listAnnotationQueueItems') },
    { displayName: 'Session ID', name: 'sessionId', type: 'string', default: '', description: 'Session ID to fetch', displayOptions: v2Basic('getSession') },
    { displayName: 'Score Config ID', name: 'scoreConfigId', type: 'string', default: '', description: 'Score config ID to fetch', displayOptions: v2Basic('getScoreConfig') },

    // ---- Dataset fields ----
    { displayName: 'Dataset Name', name: 'datasetName', type: 'string', default: '', required: true, placeholder: 'qa-eval-set', description: 'Name of the dataset', displayOptions: v2Basic('getDataset', 'createDataset', 'createDatasetItem', 'listDatasetRuns', 'getDatasetRun', 'deleteDatasetRun') },
    { displayName: 'Dataset Description', name: 'datasetDescription', type: 'string', default: '', description: 'Optional description stored on the dataset', displayOptions: v2Adv('createDataset') },
    { displayName: 'Dataset Item ID', name: 'datasetItemId', type: 'string', default: '', required: true, displayOptions: v2Basic('getDatasetItem', 'deleteDatasetItem', 'createDatasetRunItem') },
    { displayName: 'Dataset Item ID', name: 'datasetItemId', type: 'string', default: '', placeholder: 'Optional item ID', description: 'Optional dataset item ID. Provide an existing ID to update (upsert) that item.', displayOptions: v2Adv('createDatasetItem') },
    { displayName: 'Run Name', name: 'runName', type: 'string', default: '', required: true, placeholder: 'run-2026-06-04', description: 'Name of the dataset run', displayOptions: v2Basic('getDatasetRun', 'deleteDatasetRun', 'createDatasetRunItem') },
    { displayName: 'Input JSON', name: 'inputJson', type: 'string', default: '', placeholder: '{"question":"2+2?"}', description: 'JSON input payload stored on the dataset item', displayOptions: v2Basic('createDatasetItem') },
    { displayName: 'Expected Output JSON', name: 'expectedOutputJson', type: 'string', default: '', placeholder: '{"answer":"4"}', description: 'JSON expected output stored on the dataset item', displayOptions: v2Basic('createDatasetItem') },
    { displayName: 'Metadata JSON', name: 'metadataJson', type: 'string', default: '', placeholder: '{"source":"n8n"}', description: 'Additional JSON metadata stored with the dataset, item, or run item', displayOptions: v2Adv('createDataset', 'createDatasetItem', 'createDatasetRunItem') },
    { displayName: 'Source Trace ID', name: 'sourceTraceId', type: 'string', default: '', description: 'Optional trace ID this dataset item was derived from', displayOptions: v2Adv('createDatasetItem') },
    { displayName: 'Source Observation ID', name: 'sourceObservationId', type: 'string', default: '', description: 'Optional observation ID this dataset item was derived from', displayOptions: v2Adv('createDatasetItem') },
    {
      displayName: 'Dataset Item Status', name: 'datasetItemStatus', type: 'options', default: 'ACTIVE',
      options: [{ name: 'Active', value: 'ACTIVE' }, { name: 'Archived', value: 'ARCHIVED' }],
      description: 'Status of the dataset item', displayOptions: v2Adv('createDatasetItem'),
    },
    { displayName: 'Trace ID', name: 'traceId', type: 'string', default: '', placeholder: '1234567890abcdef1234567890abcdef', description: 'Trace ID this run item links to. Recommended for dataset run items.', displayOptions: v2Basic('createDatasetRunItem') },
    { displayName: 'Observation ID', name: 'observationId', type: 'string', default: '', description: 'Optional observation ID this run item links to instead of a trace', displayOptions: v2Adv('createDatasetRunItem') },
    { displayName: 'Run Description', name: 'runDescription', type: 'string', default: '', description: 'Optional description applied to the dataset run', displayOptions: v2Adv('createDatasetRunItem') },

    { displayName: 'Path', name: 'path', type: 'string', default: '', placeholder: '/v2/prompts', description: 'Relative Langfuse Public API path for a custom request', displayOptions: v2Basic('customRequest') },
    {
      displayName: 'Method', name: 'method', type: 'options', default: 'GET',
      options: [{ name: 'DELETE', value: 'DELETE' }, { name: 'GET', value: 'GET' }, { name: 'PATCH', value: 'PATCH' }, { name: 'POST', value: 'POST' }, { name: 'PUT', value: 'PUT' }],
      description: 'HTTP method for the custom request', displayOptions: v2Basic('customRequest'),
    },
    { displayName: 'Query JSON', name: 'queryJson', type: 'string', default: '', placeholder: '{"page":1,"limit":20}', description: 'JSON object converted into query string parameters', displayOptions: v2Adv('listPrompts', 'listTraces', 'listScores', 'listObservations', 'listSessions', 'listAnnotationQueues', 'listAnnotationQueueItems', 'listScoreConfigs', 'listDatasets', 'listDatasetItems', 'listDatasetRuns', 'customRequest') },
    { displayName: 'Return All', name: 'returnAll', type: 'boolean', default: false, description: 'Whether to return all results or only up to a given limit', displayOptions: v2Basic('listPrompts', 'listTraces', 'listScores', 'listObservations', 'listSessions', 'listAnnotationQueues', 'listAnnotationQueueItems', 'listScoreConfigs', 'listDatasets', 'listDatasetItems', 'listDatasetRuns') },
    { displayName: 'Body JSON', name: 'bodyJson', type: 'string', default: '', placeholder: '{"name":"prompt-name"}', description: 'JSON request body for Custom Request. Ignored for GET and HEAD requests.', displayOptions: v2Adv('customRequest') },
    { displayName: 'Batch JSON', name: 'batchJson', type: 'string', default: '', placeholder: '{"batch":[{"ID":"evt-1","type":"event-create"}]}', description: 'Raw Langfuse ingestion batch sent without mapping fields', displayOptions: v2Basic('batchRaw') },
    { displayName: 'Fail On Batch Errors', name: 'failOnBatchErrors', type: 'boolean', default: false, description: 'Whether to fail the item when Langfuse returns partial ingestion errors', displayOptions: v2Adv('traceCreate', 'spanCreate', 'spanUpdate', 'generationCreate', 'generationUpdate', 'finalizeSpan', 'eventCreate', 'scoreCreate', 'sdkLogCreate', 'batchRaw') },
  ],
};

// ---------------------------------------------------------------------------
// Versioned node export
// ---------------------------------------------------------------------------

class LangfuseV1 implements VersionedNodeVersion {
  description = v1Description;
  execute = runExecute;
}

class LangfuseV2 implements VersionedNodeVersion {
  description = v2Description;
  execute = runExecute;
}

export class Langfuse implements VersionedNodeType {
  description = {
    displayName: 'Langfuse',
    name: 'langfuse',
    icon: 'file:langfuse.svg' as const,
    group: ['transform'] as string[],
    version: [1, 2] as number[],
    subtitle: '={{$parameter["resource"] + ": " + $parameter["operation"]}}',
    description: 'Send Langfuse ingestion events and read Langfuse Public API data.',
    defaults: { name: 'Langfuse' },
    inputs: ['main'] as string[],
    outputs: ['main'] as string[],
    credentials: [{ name: 'langfuseApi', required: true }],
  };

  currentVersion = 2;

  nodeVersions: Record<number, VersionedNodeVersion> = {
    1: new LangfuseV1(),
    2: new LangfuseV2(),
  };

  getNodeType(version = this.currentVersion): VersionedNodeVersion {
    return this.nodeVersions[version] ?? new LangfuseV2();
  }
}

// Export v2 description as the canonical named export (used by metadata tests and n8n tooling)
export const description = v2Description;
