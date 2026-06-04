import { asString, buildBasicAuthHeader, LangfuseRequestError, normalizeBaseUrl, parseJsonMaybe } from './langfuse.js';

export type LangfusePublicApiMethod = 'GET' | 'HEAD' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';

export type LangfusePublicApiOperation =
  | 'health'
  | 'listPrompts'
  | 'getPrompt'
  | 'listTraces'
  | 'getTrace'
  | 'listScores'
  | 'getScore'
  | 'deleteScore'
  | 'listObservations'
  | 'getObservation'
  | 'listSessions'
  | 'listAnnotationQueues'
  | 'getAnnotationQueue'
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
  traceId?: string;
  scoreId?: string;
  observationId?: string;
  queueId?: string;
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
