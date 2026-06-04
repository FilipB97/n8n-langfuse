import { asString, withRetry } from './langfuse.js';
import { requestLangfusePublicApi } from './langfusePublicApi.js';
import type { LangfusePollContext, NodeInputItem } from './n8n-lite.js';

export type LangfuseTriggerEvent = 'trace' | 'score' | 'observation';

/**
 * Each pollable event maps to a Public API list endpoint plus the name of its
 * time-filter query parameter. Traces and scores filter by `fromTimestamp`,
 * while observations filter by `fromStartTime`.
 */
const EVENT_CONFIG: Record<LangfuseTriggerEvent, { path: string; timeParam: string }> = {
  trace: { path: '/traces', timeParam: 'fromTimestamp' },
  score: { path: '/v2/scores', timeParam: 'fromTimestamp' },
  observation: { path: '/v2/observations', timeParam: 'fromStartTime' },
};

const MANUAL_LIMIT = 1;
const POLL_LIMIT = 100;

function resolveEvent(value: unknown): LangfuseTriggerEvent {
  const event = asString(value);
  if (event === 'score' || event === 'observation') {
    return event;
  }
  return 'trace';
}

function extractItems(payload: unknown): Array<Record<string, unknown>> {
  if (Array.isArray(payload)) {
    return payload as Array<Record<string, unknown>>;
  }
  if (payload && typeof payload === 'object') {
    const data = (payload as { data?: unknown }).data;
    if (Array.isArray(data)) {
      return data as Array<Record<string, unknown>>;
    }
  }
  return [];
}

function getId(item: Record<string, unknown>): string | undefined {
  return typeof item.id === 'string' ? item.id : undefined;
}

function toItems(records: Array<Record<string, unknown>>): Array<Array<NodeInputItem>> {
  return [records.map((json) => ({ json }))];
}

/**
 * Poll Langfuse for new records of the selected event type.
 *
 * - First poll (no stored cursor) establishes a baseline and emits nothing.
 * - Subsequent polls request records since the last poll and de-duplicate by id
 *   against the previous boundary, so inclusive time filters do not re-emit.
 * - Manual mode (the editor's "fetch test event") returns one recent record
 *   without touching the stored cursor.
 */
export async function pollLangfuse(context: LangfusePollContext): Promise<Array<Array<NodeInputItem>> | null> {
  const event = resolveEvent(context.getNodeParameter('event'));
  const config = EVENT_CONFIG[event];
  const credentials = await context.getCredentials('langfuseApi');
  const isManual = context.getMode?.() === 'manual';

  const staticData = context.getWorkflowStaticData('node');
  const lastPolledAt = typeof staticData.lastPolledAt === 'string' ? staticData.lastPolledAt : undefined;
  const seenIds = Array.isArray(staticData.seenIds) ? (staticData.seenIds as string[]) : [];

  const now = new Date().toISOString();
  const query: Record<string, string | number> = { limit: isManual ? MANUAL_LIMIT : POLL_LIMIT };
  if (!isManual && lastPolledAt !== undefined) {
    query[config.timeParam] = lastPolledAt;
  }

  const response = await withRetry(() =>
    requestLangfusePublicApi({
      baseUrl: credentials.baseUrl,
      publicKey: credentials.publicKey,
      secretKey: credentials.secretKey,
      path: config.path,
      method: 'GET',
      query,
      ...(credentials.timeoutMs !== undefined ? { timeoutMs: credentials.timeoutMs } : {}),
    }),
  );

  const records = extractItems(response.data);

  if (isManual) {
    return records.length > 0 ? toItems(records) : null;
  }

  const boundaryIds = records.map(getId).filter((id): id is string => id !== undefined);

  if (lastPolledAt === undefined) {
    // Baseline poll: remember where we are, but do not flood with history.
    staticData.lastPolledAt = now;
    staticData.seenIds = boundaryIds;
    return null;
  }

  const fresh = records.filter((record) => {
    const id = getId(record);
    return id === undefined || !seenIds.includes(id);
  });

  staticData.lastPolledAt = now;
  staticData.seenIds = boundaryIds;

  return fresh.length > 0 ? toItems(fresh) : null;
}
