import { asString, buildBasicAuthHeader, LangfuseRequestError, normalizeBaseUrl, parseJsonMaybe } from './langfuse.js';

export type LangfusePublicApiMethod = 'GET' | 'HEAD' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';

export type LangfusePublicApiOperation =
  | 'health'
  | 'listPrompts'
  | 'getPrompt'
  | 'createPrompt'
  | 'listTraces'
  | 'getTrace'
  | 'listScores'
  | 'getScore'
  | 'deleteScore'
  | 'listObservations'
  | 'getObservation'
  | 'listSessions'
  | 'getSession'
  | 'listAnnotationQueues'
  | 'getAnnotationQueue'
  | 'listAnnotationQueueItems'
  | 'listScoreConfigs'
  | 'getScoreConfig'
  | 'listDatasets'
  | 'getDataset'
  | 'createDataset'
  | 'listDatasetItems'
  | 'getDatasetItem'
  | 'createDatasetItem'
  | 'deleteDatasetItem'
  | 'listDatasetRuns'
  | 'getDatasetRun'
  | 'deleteDatasetRun'
  | 'createDatasetRunItem'
  | 'customRequest';

export interface LangfusePublicApiRequestOptions {
  baseUrl: string;
  publicKey: string;
  secretKey: string;
  path: string;
  method?: LangfusePublicApiMethod;
  query?: Record<string, string | number | boolean | undefined>;
  body?: unknown;
  timeoutMs?: number;
  fetchImpl?: typeof fetch;
  signal?: AbortSignal;
}

export interface LangfusePublicApiResponse {
  status: number;
  ok: boolean;
  raw: unknown;
  data: unknown;
}

export interface LangfusePublicApiParameters {
  promptName?: string;
  promptLabel?: string;
  promptVersion?: string;
  promptType?: string;
  promptText?: string;
  promptChatJson?: unknown;
  promptLabels?: unknown;
  promptTags?: unknown;
  promptConfigJson?: unknown;
  promptCommitMessage?: string;
  traceId?: string;
  scoreId?: string;
  observationId?: string;
  queueId?: string;
  sessionId?: string;
  scoreConfigId?: string;
  datasetName?: string;
  datasetItemId?: string;
  runName?: string;
  datasetDescription?: string;
  datasetItemStatus?: string;
  sourceTraceId?: string;
  sourceObservationId?: string;
  runDescription?: string;
  inputJson?: unknown;
  expectedOutputJson?: unknown;
  metadataJson?: unknown;
  path?: string;
  method?: LangfusePublicApiMethod;
  queryJson?: unknown;
  bodyJson?: unknown;
}

function buildQueryString(query?: Record<string, string | number | boolean | undefined>): string {
  if (!query) {
    return '';
  }

  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(query)) {
    if (value !== undefined) {
      params.set(key, String(value));
    }
  }

  const queryString = params.toString();
  return queryString ? `?${queryString}` : '';
}

export function buildLangfusePublicApiUrl(baseUrl: string, path: string, query?: Record<string, string | number | boolean | undefined>): string {
  const normalized = normalizeBaseUrl(baseUrl);
  const prefix = normalized.endsWith('/api/public') ? normalized : `${normalized}/api/public`;
  const resolvedPath = path.startsWith('/') ? path : `/${path}`;
  return `${prefix}${resolvedPath}${buildQueryString(query)}`;
}

function asQueryObject(value: unknown): Record<string, string | number | boolean | undefined> | undefined {
  const parsed = parseJsonMaybe(value);
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    return undefined;
  }

  return parsed as Record<string, string | number | boolean | undefined>;
}

function asRequestBody(value: unknown): unknown {
  if (typeof value === 'string' && value.trim() === '') {
    return undefined;
  }

  return parseJsonMaybe(value);
}

function asStringArray(value: unknown): string[] | undefined {
  if (value === undefined || value === null) {
    return undefined;
  }

  if (Array.isArray(value)) {
    return value.map(String);
  }

  const parsed = parseJsonMaybe(value);
  if (Array.isArray(parsed)) {
    return parsed.map(String);
  }

  if (typeof parsed === 'string') {
    const items = parsed
      .split(',')
      .map((item) => item.trim())
      .filter((item) => item.length > 0);
    return items.length > 0 ? items : undefined;
  }

  return undefined;
}

function methodAllowsBody(method: LangfusePublicApiMethod): boolean {
  return method !== 'GET' && method !== 'HEAD';
}

export function resolveLangfusePublicApiEndpoint(
  operation: LangfusePublicApiOperation,
  params: LangfusePublicApiParameters,
): {
  path: string;
  method: LangfusePublicApiMethod;
  query?: Record<string, string | number | boolean | undefined>;
  body?: unknown;
} {
  switch (operation) {
    case 'health':
      return {
        path: '/health',
        method: 'GET',
      };
    case 'listPrompts':
      {
        const query = asQueryObject(params.queryJson);
        return {
        path: '/v2/prompts',
        method: 'GET',
        ...(query !== undefined ? { query } : {}),
      };
      }
    case 'getPrompt': {
      const promptName = asString(params.promptName);
      if (promptName === undefined) {
        throw new Error('promptName is required for getPrompt');
      }

      return {
        path: `/v2/prompts/${encodeURIComponent(promptName)}`,
        method: 'GET',
        ...(params.promptLabel !== undefined || params.promptVersion !== undefined
          ? {
              query: {
                ...(params.promptLabel !== undefined ? { label: params.promptLabel } : {}),
                ...(params.promptVersion !== undefined ? { version: params.promptVersion } : {}),
              },
            }
          : {}),
      };
    }
    case 'createPrompt': {
      const name = asString(params.promptName);
      if (name === undefined) {
        throw new Error('promptName is required for createPrompt');
      }

      const type = asString(params.promptType) ?? 'text';
      const body: Record<string, unknown> = { name, type };

      if (type === 'chat') {
        const chat = asRequestBody(params.promptChatJson);
        if (chat === undefined) {
          throw new Error('promptChatJson is required for chat prompts');
        }
        body.prompt = chat;
      } else {
        const text = asString(params.promptText);
        if (text === undefined) {
          throw new Error('promptText is required for text prompts');
        }
        body.prompt = text;
      }

      const labels = asStringArray(params.promptLabels);
      if (labels !== undefined) body.labels = labels;
      const tags = asStringArray(params.promptTags);
      if (tags !== undefined) body.tags = tags;
      const config = asRequestBody(params.promptConfigJson);
      if (config !== undefined) body.config = config;
      const commitMessage = asString(params.promptCommitMessage);
      if (commitMessage !== undefined) body.commitMessage = commitMessage;

      return {
        path: '/v2/prompts',
        method: 'POST',
        body,
      };
    }
    case 'listTraces':
      {
        const query = asQueryObject(params.queryJson);
        return {
        path: '/traces',
        method: 'GET',
        ...(query !== undefined ? { query } : {}),
      };
      }
    case 'getTrace': {
      const traceId = asString(params.traceId);
      if (traceId === undefined) {
        throw new Error('traceId is required for getTrace');
      }

      return {
        path: `/traces/${encodeURIComponent(traceId)}`,
        method: 'GET',
      };
    }
    case 'listScores':
      {
        const query = asQueryObject(params.queryJson);
        return {
        path: '/v2/scores',
        method: 'GET',
        ...(query !== undefined ? { query } : {}),
      };
      }
    case 'getScore': {
      const scoreId = asString(params.scoreId);
      if (scoreId === undefined) {
        throw new Error('scoreId is required for getScore');
      }

      return {
        path: `/v2/scores/${encodeURIComponent(scoreId)}`,
        method: 'GET',
      };
    }
    case 'deleteScore': {
      const scoreId = asString(params.scoreId);
      if (scoreId === undefined) {
        throw new Error('scoreId is required for deleteScore');
      }

      return {
        path: `/v2/scores/${encodeURIComponent(scoreId)}`,
        method: 'DELETE',
      };
    }
    case 'listObservations':
      {
        const query = asQueryObject(params.queryJson);
        return {
        path: '/v2/observations',
        method: 'GET',
        ...(query !== undefined ? { query } : {}),
      };
      }
    case 'getObservation': {
      const observationId = asString(params.observationId);
      if (observationId === undefined) {
        throw new Error('observationId is required for getObservation');
      }

      return {
        path: `/v2/observations/${encodeURIComponent(observationId)}`,
        method: 'GET',
      };
    }
    case 'listSessions':
      {
        const query = asQueryObject(params.queryJson);
        return {
          path: '/sessions',
          method: 'GET',
          ...(query !== undefined ? { query } : {}),
        };
      }
    case 'listAnnotationQueues':
      {
        const query = asQueryObject(params.queryJson);
        return {
        path: '/annotation-queues',
        method: 'GET',
        ...(query !== undefined ? { query } : {}),
      };
      }
    case 'getAnnotationQueue': {
      const queueId = asString(params.queueId);
      if (queueId === undefined) {
        throw new Error('queueId is required for getAnnotationQueue');
      }

      return {
        path: `/annotation-queues/${encodeURIComponent(queueId)}`,
        method: 'GET',
      };
    }
    case 'listAnnotationQueueItems': {
      const queueId = asString(params.queueId);
      if (queueId === undefined) {
        throw new Error('queueId is required for listAnnotationQueueItems');
      }

      const query = asQueryObject(params.queryJson);
      return {
        path: `/annotation-queues/${encodeURIComponent(queueId)}/items`,
        method: 'GET',
        ...(query !== undefined ? { query } : {}),
      };
    }
    case 'getSession': {
      const sessionId = asString(params.sessionId);
      if (sessionId === undefined) {
        throw new Error('sessionId is required for getSession');
      }

      return {
        path: `/sessions/${encodeURIComponent(sessionId)}`,
        method: 'GET',
      };
    }
    case 'listScoreConfigs': {
      const query = asQueryObject(params.queryJson);
      return {
        path: '/score-configs',
        method: 'GET',
        ...(query !== undefined ? { query } : {}),
      };
    }
    case 'getScoreConfig': {
      const scoreConfigId = asString(params.scoreConfigId);
      if (scoreConfigId === undefined) {
        throw new Error('scoreConfigId is required for getScoreConfig');
      }

      return {
        path: `/score-configs/${encodeURIComponent(scoreConfigId)}`,
        method: 'GET',
      };
    }
    case 'listDatasets':
      {
        const query = asQueryObject(params.queryJson);
        return {
          path: '/v2/datasets',
          method: 'GET',
          ...(query !== undefined ? { query } : {}),
        };
      }
    case 'getDataset': {
      const datasetName = asString(params.datasetName);
      if (datasetName === undefined) {
        throw new Error('datasetName is required for getDataset');
      }

      return {
        path: `/v2/datasets/${encodeURIComponent(datasetName)}`,
        method: 'GET',
      };
    }
    case 'createDataset': {
      const datasetName = asString(params.datasetName);
      if (datasetName === undefined) {
        throw new Error('datasetName is required for createDataset');
      }

      const body: Record<string, unknown> = { name: datasetName };
      const description = asString(params.datasetDescription);
      if (description !== undefined) body.description = description;
      const metadata = asRequestBody(params.metadataJson);
      if (metadata !== undefined) body.metadata = metadata;

      return {
        path: '/v2/datasets',
        method: 'POST',
        body,
      };
    }
    case 'listDatasetItems':
      {
        const query = asQueryObject(params.queryJson);
        return {
          path: '/dataset-items',
          method: 'GET',
          ...(query !== undefined ? { query } : {}),
        };
      }
    case 'getDatasetItem': {
      const datasetItemId = asString(params.datasetItemId);
      if (datasetItemId === undefined) {
        throw new Error('datasetItemId is required for getDatasetItem');
      }

      return {
        path: `/dataset-items/${encodeURIComponent(datasetItemId)}`,
        method: 'GET',
      };
    }
    case 'createDatasetItem': {
      const datasetName = asString(params.datasetName);
      if (datasetName === undefined) {
        throw new Error('datasetName is required for createDatasetItem');
      }

      const body: Record<string, unknown> = { datasetName };
      const input = asRequestBody(params.inputJson);
      if (input !== undefined) body.input = input;
      const expectedOutput = asRequestBody(params.expectedOutputJson);
      if (expectedOutput !== undefined) body.expectedOutput = expectedOutput;
      const metadata = asRequestBody(params.metadataJson);
      if (metadata !== undefined) body.metadata = metadata;
      const sourceTraceId = asString(params.sourceTraceId);
      if (sourceTraceId !== undefined) body.sourceTraceId = sourceTraceId;
      const sourceObservationId = asString(params.sourceObservationId);
      if (sourceObservationId !== undefined) body.sourceObservationId = sourceObservationId;
      const id = asString(params.datasetItemId);
      if (id !== undefined) body.id = id;
      const status = asString(params.datasetItemStatus);
      if (status !== undefined) body.status = status;

      return {
        path: '/dataset-items',
        method: 'POST',
        body,
      };
    }
    case 'deleteDatasetItem': {
      const datasetItemId = asString(params.datasetItemId);
      if (datasetItemId === undefined) {
        throw new Error('datasetItemId is required for deleteDatasetItem');
      }

      return {
        path: `/dataset-items/${encodeURIComponent(datasetItemId)}`,
        method: 'DELETE',
      };
    }
    case 'listDatasetRuns': {
      const datasetName = asString(params.datasetName);
      if (datasetName === undefined) {
        throw new Error('datasetName is required for listDatasetRuns');
      }

      const query = asQueryObject(params.queryJson);
      return {
        path: `/datasets/${encodeURIComponent(datasetName)}/runs`,
        method: 'GET',
        ...(query !== undefined ? { query } : {}),
      };
    }
    case 'getDatasetRun': {
      const datasetName = asString(params.datasetName);
      const runName = asString(params.runName);
      if (datasetName === undefined) {
        throw new Error('datasetName is required for getDatasetRun');
      }
      if (runName === undefined) {
        throw new Error('runName is required for getDatasetRun');
      }

      return {
        path: `/datasets/${encodeURIComponent(datasetName)}/runs/${encodeURIComponent(runName)}`,
        method: 'GET',
      };
    }
    case 'deleteDatasetRun': {
      const datasetName = asString(params.datasetName);
      const runName = asString(params.runName);
      if (datasetName === undefined) {
        throw new Error('datasetName is required for deleteDatasetRun');
      }
      if (runName === undefined) {
        throw new Error('runName is required for deleteDatasetRun');
      }

      return {
        path: `/datasets/${encodeURIComponent(datasetName)}/runs/${encodeURIComponent(runName)}`,
        method: 'DELETE',
      };
    }
    case 'createDatasetRunItem': {
      const runName = asString(params.runName);
      const datasetItemId = asString(params.datasetItemId);
      if (runName === undefined) {
        throw new Error('runName is required for createDatasetRunItem');
      }
      if (datasetItemId === undefined) {
        throw new Error('datasetItemId is required for createDatasetRunItem');
      }

      const body: Record<string, unknown> = { runName, datasetItemId };
      const traceId = asString(params.traceId);
      if (traceId !== undefined) body.traceId = traceId;
      const observationId = asString(params.observationId);
      if (observationId !== undefined) body.observationId = observationId;
      const runDescription = asString(params.runDescription);
      if (runDescription !== undefined) body.runDescription = runDescription;
      const metadata = asRequestBody(params.metadataJson);
      if (metadata !== undefined) body.metadata = metadata;

      return {
        path: '/dataset-run-items',
        method: 'POST',
        body,
      };
    }
    case 'customRequest': {
      const path = asString(params.path);
      if (path === undefined) {
        throw new Error('path is required for customRequest');
      }

      const query = asQueryObject(params.queryJson);
      const method = (params.method ?? 'GET') as LangfusePublicApiMethod;
      const body = methodAllowsBody(method) ? asRequestBody(params.bodyJson) : undefined;

      return {
        path,
        method,
        ...(query !== undefined ? { query } : {}),
        ...(body !== undefined ? { body } : {}),
      };
    }
  }
}

export async function requestLangfusePublicApi(options: LangfusePublicApiRequestOptions): Promise<LangfusePublicApiResponse> {
  const fetchImpl = options.fetchImpl ?? fetch;
  const url = buildLangfusePublicApiUrl(options.baseUrl, options.path, options.query);
  const method = options.method ?? 'GET';
  const headers: Record<string, string> = {
    Authorization: buildBasicAuthHeader(options.publicKey, options.secretKey),
  };

  let body: string | undefined;
  if (methodAllowsBody(method) && options.body !== undefined) {
    headers['Content-Type'] = 'application/json';
    body = JSON.stringify(options.body);
  }

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
      () => controller.abort(new Error(`Langfuse request timed out after ${options.timeoutMs}ms`)),
      options.timeoutMs,
    );
  }

  try {
    const response = await fetchImpl(url, {
      method,
      headers,
      ...(body !== undefined ? { body } : {}),
      signal: controller.signal,
    });

    const text = await response.text();
    let raw: unknown = {};
    if (text) {
      try {
        raw = JSON.parse(text) as unknown;
      } catch (error) {
        throw new Error(`Langfuse public API response was not valid JSON: ${(error as Error).message}`);
      }
    }

    if (!response.ok) {
      throw new LangfuseRequestError(
        `Langfuse public API request failed with status ${response.status}`,
        response.status,
        raw,
      );
    }

    return {
      status: response.status,
      ok: response.ok,
      raw,
      data: raw,
    };
  } finally {
    if (timeout) {
      clearTimeout(timeout);
    }
  }
}
