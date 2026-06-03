import {
  buildIngestionUrl,
  sendLangfuseIngestion,
} from '../../src/langfuse.js';
import {
  buildEventsForOperation,
  type LangfuseOperation,
  type LangfuseOperationParameters,
} from '../../src/nodeLogic.js';
import {
  buildLangfusePublicApiUrl,
  requestLangfusePublicApi,
  resolveLangfusePublicApiEndpoint,
  type LangfusePublicApiMethod,
  type LangfusePublicApiOperation,
  type LangfusePublicApiParameters,
} from '../../src/langfusePublicApi.js';
import type { LangfuseExecuteContext, NodeDescription } from '../../src/n8n-lite.js';

type LangfuseResource = 'ingestion' | 'publicApi';

const showIngestionBasic = (...operations: LangfuseOperation[]) => ({
  show: {
    resource: ['ingestion'],
    operation: operations,
  },
});

const showIngestionAdvanced = (...operations: LangfuseOperation[]) => ({
  show: {
    resource: ['ingestion'],
    operation: operations,
    showAdvancedFields: [true],
  },
});

const showIngestion = showIngestionAdvanced;

const showPublicApiBasic = (...operations: LangfusePublicApiOperation[]) => ({
  show: {
    resource: ['publicApi'],
    operation: operations,
  },
});

const showPublicApiAdvanced = (...operations: LangfusePublicApiOperation[]) => ({
  show: {
    resource: ['publicApi'],
    operation: operations,
    showAdvancedFields: [true],
  },
});

const showPublicApi = showPublicApiAdvanced;

const description: NodeDescription = {
  displayName: 'Langfuse',
  name: 'langfuse',
  icon: 'file:langfuse.svg',
  group: ['transform'],
  version: 1,
  subtitle: '={{$parameter["operation"]}}',
  description: 'Send Langfuse ingestion events and read Langfuse Public API data.',
  defaults: {
    name: 'Langfuse',
  },
  inputs: ['main'],
  outputs: ['main'],
  credentials: [
    {
      name: 'langfuseApi',
      required: true,
    },
  ],
  properties: [
    {
      displayName: 'Resource',
      name: 'resource',
      type: 'options',
      default: 'ingestion',
      noDataExpression: true,
      options: [
        {
          name: 'Ingestion',
          value: 'ingestion',
          action: 'Manage Langfuse ingestion events',
          description: 'Send traces, spans, generations, events, scores, and SDK logs.',
        },
        {
          name: 'Public API',
          value: 'publicApi',
          action: 'Read Langfuse public API data',
          description: 'Inspect prompts, traces, scores, sessions, and annotation queues.',
        },
      ],
      description: 'Choose which Langfuse API area to work with.',
    },
    {
      displayName: 'Operation',
      name: 'operation',
      type: 'options',
      default: 'traceCreate',
      noDataExpression: true,
      options: [
        { name: 'Trace Create', value: 'traceCreate', action: 'Create trace', description: 'Send a trace-create event.' },
        { name: 'Span Create', value: 'spanCreate', action: 'Create span', description: 'Send a span-create event.' },
        { name: 'Span Update', value: 'spanUpdate', action: 'Update span', description: 'Send a span-update event.' },
        { name: 'Generation Create', value: 'generationCreate', action: 'Create generation', description: 'Send a generation-create event.' },
        { name: 'Generation Update', value: 'generationUpdate', action: 'Update generation', description: 'Send a generation-update event.' },
        { name: 'Finalize Span', value: 'finalizeSpan', action: 'Finalize span', description: 'Send generation-create and span-update in one batch.' },
        { name: 'Event Create', value: 'eventCreate', action: 'Create event', description: 'Send a custom event-create event.' },
        { name: 'Score Create', value: 'scoreCreate', action: 'Create score', description: 'Send a score-create event.' },
        { name: 'SDK Log Create', value: 'sdkLogCreate', action: 'Create SDK log', description: 'Send an sdk-log event.' },
        { name: 'Batch Raw', value: 'batchRaw', action: 'Send raw batch', description: 'Send a raw ingestion batch without mapping fields.' },
      ],
      displayOptions: {
        show: {
          resource: ['ingestion'],
        },
      },
      description: 'Choose which Langfuse ingestion event to send.',
    },
    {
      displayName: 'Operation',
      name: 'operation',
      type: 'options',
      default: 'health',
      noDataExpression: true,
      options: [
        { name: 'Health', value: 'health', action: 'Check health', description: 'Call the Langfuse health endpoint.' },
        { name: 'List Prompts', value: 'listPrompts', action: 'List prompts', description: 'Read all prompts.' },
        { name: 'Get Prompt', value: 'getPrompt', action: 'Get prompt', description: 'Read a specific prompt.' },
        { name: 'List Traces', value: 'listTraces', action: 'List traces', description: 'Read traces from Langfuse.' },
        { name: 'Get Trace', value: 'getTrace', action: 'Get trace', description: 'Read a single trace by ID.' },
        { name: 'List Scores', value: 'listScores', action: 'List scores', description: 'Read scores from Langfuse.' },
        { name: 'Get Score', value: 'getScore', action: 'Get score', description: 'Read a single score by ID.' },
        { name: 'List Observations', value: 'listObservations', action: 'List observations', description: 'Read observations from Langfuse.' },
        { name: 'List Annotation Queues', value: 'listAnnotationQueues', action: 'List annotation queues', description: 'Read annotation queues.' },
        { name: 'Get Annotation Queue', value: 'getAnnotationQueue', action: 'Get annotation queue', description: 'Read a single annotation queue by ID.' },
        { name: 'Custom Request', value: 'customRequest', action: 'Send custom request', description: 'Call any Langfuse public API endpoint.' },
      ],
      displayOptions: {
        show: {
          resource: ['publicApi'],
        },
      },
      description: 'Choose which Langfuse public API endpoint to call.',
    },
    {
      displayName: 'Show Advanced Fields',
      name: 'showAdvancedFields',
      type: 'boolean',
      default: false,
      description: 'Reveal optional fields for the selected operation.',
      displayOptions: {
        show: {
          resource: ['ingestion', 'publicApi'],
        },
      },
    },
    {
      displayName: 'Trace ID',
      name: 'traceId',
      type: 'string',
      default: '',
      placeholder: '1234567890abcdef1234567890abcdef',
      description: 'Optional for Trace Create. Leave blank to auto-generate a new trace id.',
      displayOptions: showIngestionBasic('traceCreate', 'spanCreate', 'spanUpdate', 'generationCreate', 'generationUpdate', 'eventCreate', 'scoreCreate', 'sdkLogCreate'),
    },
    {
      displayName: 'Trace ID',
      name: 'traceId',
      type: 'string',
      default: '',
      placeholder: '1234567890abcdef1234567890abcdef',
      description: 'Trace id to load with Get Trace.',
      displayOptions: showPublicApiBasic('getTrace'),
    },
    {
      displayName: 'Event ID',
      name: 'eventId',
      type: 'string',
      default: '',
      placeholder: 'Optional event id',
      description: 'Optional event id for idempotency and deduplication.',
      displayOptions: showIngestionAdvanced('traceCreate', 'spanCreate', 'spanUpdate', 'generationCreate', 'generationUpdate', 'eventCreate', 'scoreCreate', 'sdkLogCreate'),
    },
    {
      displayName: 'Observation ID',
      name: 'observationId',
      type: 'string',
      default: '',
      placeholder: 'Optional observation id',
      description: 'Required for update operations. Leave blank for create operations to auto-generate an observation id.',
      displayOptions: showIngestionAdvanced('spanCreate', 'spanUpdate', 'generationCreate', 'generationUpdate', 'eventCreate', 'scoreCreate', 'sdkLogCreate'),
    },
    {
      displayName: 'Parent Observation ID',
      name: 'parentObservationId',
      type: 'string',
      default: '',
      placeholder: 'Optional parent observation id',
      description: 'Optional parent observation id for nested spans, generations, events, and logs.',
      displayOptions: showIngestionAdvanced('spanCreate', 'spanUpdate', 'generationCreate', 'generationUpdate', 'eventCreate', 'sdkLogCreate'),
    },
    {
      displayName: 'Timestamp',
      name: 'timestamp',
      type: 'string',
      default: '',
      placeholder: '2026-06-02T10:00:00.000Z',
      description: 'Optional ISO 8601 timestamp for the event. If blank, the current time is used.',
      displayOptions: showIngestionAdvanced('traceCreate', 'spanCreate', 'spanUpdate', 'generationCreate', 'generationUpdate', 'eventCreate', 'scoreCreate', 'sdkLogCreate'),
    },
    {
      displayName: 'Start Time',
      name: 'startTime',
      type: 'string',
      default: '',
      placeholder: '2026-06-02T10:00:00.000Z',
      description: 'Optional ISO 8601 start time for spans and generations.',
      displayOptions: showIngestion('spanCreate', 'generationCreate', 'finalizeSpan'),
    },
    {
      displayName: 'End Time',
      name: 'endTime',
      type: 'string',
      default: '',
      placeholder: '2026-06-02T10:00:02.000Z',
      description: 'Optional ISO 8601 end time for spans, generations, and Finalize Span.',
      displayOptions: showIngestion('spanUpdate', 'generationUpdate', 'finalizeSpan'),
    },
    {
      displayName: 'Name',
      name: 'name',
      type: 'string',
      default: '',
      description: 'Human-readable name for the trace, span, generation, event, or SDK log.',
      displayOptions: showIngestionBasic('traceCreate', 'spanCreate', 'spanUpdate', 'generationCreate', 'generationUpdate', 'eventCreate', 'scoreCreate', 'sdkLogCreate'),
    },
    {
      displayName: 'User ID',
      name: 'userId',
      type: 'string',
      default: '',
      description: 'Optional user identifier attached to the trace.',
      displayOptions: showIngestion('traceCreate'),
    },
    {
      displayName: 'Session ID',
      name: 'sessionId',
      type: 'string',
      default: '',
      description: 'Optional session identifier attached to the trace or score.',
      displayOptions: showIngestion('traceCreate', 'scoreCreate'),
    },
    {
      displayName: 'Public',
      name: 'public',
      type: 'boolean',
      default: false,
      description: 'Mark the trace as public in Langfuse.',
      displayOptions: showIngestion('traceCreate'),
    },
    {
      displayName: 'Tags',
      name: 'tags',
      type: 'string',
      default: '',
      placeholder: 'prod,checkout',
      description: 'Comma-separated tags or a JSON array of tags.',
      displayOptions: showIngestion('traceCreate'),
    },
    {
      displayName: 'Input JSON',
      name: 'inputJson',
      type: 'string',
      default: '',
      placeholder: '{"cartId":"cart-1"}',
      description: 'JSON input payload stored on the trace or observation.',
      displayOptions: showIngestionBasic('traceCreate', 'spanCreate', 'spanUpdate', 'generationCreate', 'generationUpdate', 'eventCreate'),
    },
    {
      displayName: 'Output JSON',
      name: 'outputJson',
      type: 'string',
      default: '',
      placeholder: '{"ok":true}',
      description: 'JSON output payload stored on the trace or observation.',
      displayOptions: showIngestionBasic('traceCreate', 'spanCreate', 'spanUpdate', 'generationCreate', 'generationUpdate', 'eventCreate'),
    },
    {
      displayName: 'Metadata JSON',
      name: 'metadataJson',
      type: 'string',
      default: '',
      placeholder: '{"source":"n8n"}',
      description: 'Additional JSON metadata stored with the trace, observation, score, or SDK log.',
      displayOptions: showIngestion('traceCreate', 'spanCreate', 'spanUpdate', 'generationCreate', 'generationUpdate', 'eventCreate', 'scoreCreate', 'sdkLogCreate'),
    },
    {
      displayName: 'Version',
      name: 'version',
      type: 'string',
      default: '',
      description: 'Optional version string stored on the trace or observation.',
      displayOptions: showIngestion('traceCreate', 'spanCreate', 'spanUpdate', 'generationCreate', 'generationUpdate', 'eventCreate'),
    },
    {
      displayName: 'Level',
      name: 'level',
      type: 'string',
      default: '',
      placeholder: 'info',
      description: 'Optional log or observation level.',
      displayOptions: showIngestion('spanCreate', 'spanUpdate', 'generationCreate', 'generationUpdate', 'eventCreate'),
    },
    {
      displayName: 'Status Message',
      name: 'statusMessage',
      type: 'string',
      default: '',
      description: 'Optional status message attached to the observation or event.',
      displayOptions: showIngestion('spanCreate', 'spanUpdate', 'generationCreate', 'generationUpdate', 'eventCreate'),
    },
    {
      displayName: 'Model',
      name: 'model',
      type: 'string',
      default: '',
      description: 'Model name used for the generation event.',
      displayOptions: showIngestionBasic('generationCreate', 'generationUpdate'),
    },
    {
      displayName: 'Generation Observation ID',
      name: 'generationObservationId',
      type: 'string',
      default: '',
      placeholder: 'abcdef1234567890_gen',
      description: 'Optional custom observation id for the generated LLM call in Finalize Span.',
      displayOptions: showIngestion('finalizeSpan'),
    },
    {
      displayName: 'Model Parameters JSON',
      name: 'modelParametersJson',
      type: 'string',
      default: '',
      placeholder: '{"temperature":0.2}',
      description: 'JSON model parameters stored with the generation.',
      displayOptions: showIngestion('generationCreate', 'generationUpdate'),
    },
    {
      displayName: 'Prompt Name',
      name: 'promptName',
      type: 'string',
      default: '',
      description: 'Prompt name linked to the generation.',
      displayOptions: showIngestionBasic('generationCreate', 'generationUpdate', 'finalizeSpan'),
    },
    {
      displayName: 'Prompt Name',
      name: 'promptName',
      type: 'string',
      default: '',
      description: 'Prompt name to fetch from Langfuse.',
      displayOptions: showPublicApiBasic('getPrompt'),
    },
    {
      displayName: 'Prompt Label',
      name: 'promptLabel',
      type: 'string',
      default: '',
      placeholder: 'production',
      description: 'Optional prompt label query parameter.',
      displayOptions: showPublicApi('getPrompt'),
    },
    {
      displayName: 'Prompt Version',
      name: 'promptVersion',
      type: 'string',
      default: '',
      description: 'Optional prompt version linked to the generation.',
      displayOptions: showIngestionBasic('generationCreate', 'generationUpdate', 'finalizeSpan'),
    },
    {
      displayName: 'Prompt Version',
      name: 'promptVersion',
      type: 'string',
      default: '',
      description: 'Optional prompt version query parameter.',
      displayOptions: showPublicApi('getPrompt'),
    },
    {
      displayName: 'Prompt Labels JSON',
      name: 'promptLabelsJson',
      type: 'string',
      default: '',
      placeholder: '["production"]',
      description: 'JSON array of prompt labels stored with the generation.',
      displayOptions: showIngestion('generationCreate', 'generationUpdate', 'finalizeSpan'),
    },
    {
      displayName: 'Usage Details JSON',
      name: 'usageDetailsJson',
      type: 'string',
      default: '',
      placeholder: '{"prompt_tokens":1,"completion_tokens":2}',
      description: 'JSON usage breakdown stored with the generation.',
      displayOptions: showIngestion('generationCreate', 'generationUpdate'),
    },
    {
      displayName: 'Cost Details JSON',
      name: 'costDetailsJson',
      type: 'string',
      default: '',
      placeholder: '{"total_cost":0.01}',
      description: 'JSON cost breakdown stored with the generation.',
      displayOptions: showIngestion('generationCreate', 'generationUpdate'),
    },
    {
      displayName: 'Completion Start Time',
      name: 'completionStartTime',
      type: 'string',
      default: '',
      description: 'Optional completion start time for the generation.',
      displayOptions: showIngestion('generationCreate', 'generationUpdate'),
    },
    {
      displayName: 'Score ID',
      name: 'scoreId',
      type: 'string',
      default: '',
      description: 'Optional score id for idempotent create/update behavior.',
      displayOptions: showIngestion('scoreCreate'),
    },
    {
      displayName: 'Score ID',
      name: 'scoreId',
      type: 'string',
      default: '',
      description: 'Score id to fetch from Langfuse.',
      displayOptions: showPublicApiBasic('getScore'),
    },
    {
      displayName: 'Score Name',
      name: 'scoreName',
      type: 'string',
      default: '',
      required: true,
      description: 'Score name to store in Langfuse.',
      displayOptions: showIngestionBasic('scoreCreate'),
    },
    {
      displayName: 'Score Value',
      name: 'scoreValue',
      type: 'string',
      default: '',
      required: true,
      description: 'Score value. Use a JSON-compatible number, boolean, string, or text.',
      displayOptions: showIngestionBasic('scoreCreate'),
    },
    {
      displayName: 'Score Data Type',
      name: 'scoreDataType',
      type: 'options',
      default: 'NUMERIC',
      options: [
        { name: 'Numeric', value: 'NUMERIC' },
        { name: 'Boolean', value: 'BOOLEAN' },
        { name: 'Categorical', value: 'CATEGORICAL' },
        { name: 'Text', value: 'TEXT' },
      ],
      description: 'Optional Langfuse score data type.',
      displayOptions: showIngestionBasic('scoreCreate'),
    },
    {
      displayName: 'Score Comment',
      name: 'scoreComment',
      type: 'string',
      default: '',
      description: 'Optional human-readable comment for the score.',
      displayOptions: showIngestion('scoreCreate'),
    },
    {
      displayName: 'Score Config ID',
      name: 'scoreConfigId',
      type: 'string',
      default: '',
      description: 'Optional score config id.',
      displayOptions: showIngestion('scoreCreate'),
    },
    {
      displayName: 'Score Environment',
      name: 'scoreEnvironment',
      type: 'string',
      default: '',
      description: 'Optional environment label for the score.',
      displayOptions: showIngestion('scoreCreate'),
    },
    {
      displayName: 'Score Dataset Run ID',
      name: 'scoreDatasetRunId',
      type: 'string',
      default: '',
      description: 'Optional dataset run id attached to the score.',
      displayOptions: showIngestion('scoreCreate'),
    },
    {
      displayName: 'Score Session ID',
      name: 'scoreSessionId',
      type: 'string',
      default: '',
      description: 'Optional session id attached to the score.',
      displayOptions: showIngestion('scoreCreate'),
    },
    {
      displayName: 'Score Trace ID',
      name: 'scoreTraceId',
      type: 'string',
      default: '',
      description: 'Optional trace id override for the score.',
      displayOptions: showIngestion('scoreCreate'),
    },
    {
      displayName: 'Score Observation ID',
      name: 'scoreObservationId',
      type: 'string',
      default: '',
      description: 'Optional observation id override for the score.',
      displayOptions: showIngestion('scoreCreate'),
    },
    {
      displayName: 'SDK Message',
      name: 'sdkMessage',
      type: 'string',
      default: '',
      description: 'Message written to the SDK log event.',
      displayOptions: showIngestionBasic('sdkLogCreate'),
    },
    {
      displayName: 'SDK Level',
      name: 'sdkLevel',
      type: 'options',
      default: 'info',
      options: [
        { name: 'Debug', value: 'debug' },
        { name: 'Info', value: 'info' },
        { name: 'Warn', value: 'warn' },
        { name: 'Error', value: 'error' },
      ],
      description: 'Log severity for the SDK log event.',
      displayOptions: showIngestionBasic('sdkLogCreate'),
    },
    {
      displayName: 'Queue ID',
      name: 'queueId',
      type: 'string',
      default: '',
      description: 'Annotation queue id to fetch.',
      displayOptions: showPublicApiBasic('getAnnotationQueue'),
    },
    {
      displayName: 'Path',
      name: 'path',
      type: 'string',
      default: '',
      placeholder: '/v2/prompts',
      description: 'Relative Langfuse Public API path for a custom request.',
      displayOptions: showPublicApiBasic('customRequest'),
    },
    {
      displayName: 'Method',
      name: 'method',
      type: 'options',
      default: 'GET',
      options: [
        { name: 'GET', value: 'GET' },
        { name: 'POST', value: 'POST' },
        { name: 'PUT', value: 'PUT' },
        { name: 'PATCH', value: 'PATCH' },
        { name: 'DELETE', value: 'DELETE' },
      ],
      description: 'HTTP method for the custom request.',
      displayOptions: showPublicApiBasic('customRequest'),
    },
    {
      displayName: 'Query JSON',
      name: 'queryJson',
      type: 'string',
      default: '',
      placeholder: '{"page":1,"limit":20}',
      description: 'JSON object converted into query string parameters.',
      displayOptions: showPublicApi('listPrompts', 'listTraces', 'listScores', 'listObservations', 'listAnnotationQueues', 'customRequest'),
    },
    {
      displayName: 'Body JSON',
      name: 'bodyJson',
      type: 'string',
      default: '',
      placeholder: '{"name":"prompt-name"}',
      description: 'JSON request body for Custom Request. Ignored for GET and HEAD requests.',
      displayOptions: showPublicApi('customRequest'),
    },
    {
      displayName: 'Batch JSON',
      name: 'batchJson',
      type: 'string',
      default: '',
      placeholder: '{"batch":[{"id":"evt-1","type":"event-create"}]}',
      description: 'Raw Langfuse ingestion batch sent without mapping fields.',
      displayOptions: showIngestionBasic('batchRaw'),
    },
    {
      displayName: 'Fail On Batch Errors',
      name: 'failOnBatchErrors',
      type: 'boolean',
      default: false,
      description: 'Fail the item when Langfuse returns partial ingestion errors.',
      displayOptions: showIngestion('traceCreate', 'spanCreate', 'spanUpdate', 'generationCreate', 'generationUpdate', 'eventCreate', 'scoreCreate', 'sdkLogCreate', 'batchRaw'),
    },
  ],
};

function asString(value: unknown): string | undefined {
  if (typeof value !== 'string') {
    return undefined;
  }

  const trimmed = value.trim();
  return trimmed ? trimmed : undefined;
}

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
    case 'listAnnotationQueues':
      params.queryJson = getOptionalNodeParameter(context, 'queryJson', itemIndex);
      break;
    case 'getPrompt': {
      const promptName = asString(getOptionalNodeParameter(context, 'promptName', itemIndex));
      const promptLabel = asString(getOptionalNodeParameter(context, 'promptLabel', itemIndex));
      const promptVersion = asString(getOptionalNodeParameter(context, 'promptVersion', itemIndex));
      if (promptName !== undefined) params.promptName = promptName;
      if (promptLabel !== undefined) params.promptLabel = promptLabel;
      if (promptVersion !== undefined) params.promptVersion = promptVersion;
      break;
    }
    case 'getTrace': {
      const traceId = asString(getOptionalNodeParameter(context, 'traceId', itemIndex));
      if (traceId !== undefined) params.traceId = traceId;
      break;
    }
    case 'getScore': {
      const scoreId = asString(getOptionalNodeParameter(context, 'scoreId', itemIndex));
      if (scoreId !== undefined) params.scoreId = scoreId;
      break;
    }
    case 'getAnnotationQueue': {
      const queueId = asString(getOptionalNodeParameter(context, 'queueId', itemIndex));
      if (queueId !== undefined) params.queueId = queueId;
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

function asErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }

  return String(error);
}

export class Langfuse {
  description = description;

  async execute(this: LangfuseExecuteContext) {
    const items = this.getInputData();
    const output: Array<{ json: Record<string, unknown> }> = [];

    for (const [itemIndex] of items.entries()) {
      const resource = this.getNodeParameter('resource', itemIndex) as LangfuseResource;
      const operation = this.getNodeParameter('operation', itemIndex) as LangfuseOperation | LangfusePublicApiOperation;
      const credentials = await this.getCredentials('langfuseApi');

      try {
        if (resource === 'ingestion') {
          const failOnBatchErrors = Boolean(this.getNodeParameter('failOnBatchErrors', itemIndex));
          const params = buildIngestionParameters(this, itemIndex);
          const events = buildEventsForOperation(operation as LangfuseOperation, params);
          const response = await sendLangfuseIngestion({
            baseUrl: credentials.baseUrl,
            publicKey: credentials.publicKey,
            secretKey: credentials.secretKey,
            batch: events,
            ...(credentials.timeoutMs !== undefined ? { timeoutMs: credentials.timeoutMs } : {}),
          });

          if (response.errors.length > 0 && failOnBatchErrors) {
            throw new Error(`Langfuse returned ${response.errors.length} batch error(s) for operation ${operation}`);
          }

          output.push({
            json: {
              resource,
              operation,
              requestUrl: buildIngestionUrl(credentials.baseUrl),
              status: response.status,
              ok: response.ok,
              batchSize: events.length,
              successes: response.successes,
              errors: response.errors,
              raw: response.raw,
            },
          });
          continue;
        }

        const params = buildPublicApiParameters(this, itemIndex, operation as LangfusePublicApiOperation);
        const endpoint = resolveLangfusePublicApiEndpoint(operation as LangfusePublicApiOperation, params);
        const response = await requestLangfusePublicApi({
          baseUrl: credentials.baseUrl,
          publicKey: credentials.publicKey,
          secretKey: credentials.secretKey,
          path: endpoint.path,
          method: endpoint.method,
          ...(endpoint.query !== undefined ? { query: endpoint.query } : {}),
          ...(endpoint.body !== undefined ? { body: endpoint.body } : {}),
          ...(credentials.timeoutMs !== undefined ? { timeoutMs: credentials.timeoutMs } : {}),
        });

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
        });
      } catch (error) {
        if (this.continueOnFail?.()) {
          output.push({
            json: {
              resource,
              operation,
              ok: false,
              error: asErrorMessage(error),
            },
          });
          continue;
        }

        throw error;
      }
    }

    return [output];
  }
}

export { description };
