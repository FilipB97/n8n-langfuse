// Generates docs/example-workflow.json — an importable n8n workflow that
// exercises the Langfuse node (v2), laid out as parallel, grouped lanes that
// fan out from a shared Manual Trigger -> Setup -> OpenAI head, so the whole
// demo is readable at a glance instead of one long chain.
import { randomUUID } from 'node:crypto';
import { writeFileSync } from 'node:fs';

const LF = 'n8n-nodes-langfuse-studio.langfuse';
const lfCred = { langfuseApi: { id: 'REPLACE_LANGFUSE_CRED', name: 'Langfuse account' } };

// Layout constants.
const COL = 240; // horizontal spacing between nodes
const HEAD_Y = 0;
const LANE_X0 = 3 * COL; // first lane node sits to the right of the head row
const LANES_Y = { ingestion: 200, reads: 420, datasets: 640, prompts: 860, verify: 1080 };
// Ingestion lane has 11 nodes (indices 0-10); verify starts right after the last one.
const VERIFY_X0 = LANE_X0 + 11 * COL;

const setupRef = (key) => `={{ $('Setup IDs').item.json.${key} }}`;
const openAiJson = "={{ JSON.stringify($('OpenAI Chat').item.json) }}";
const promptJson = "={{ JSON.stringify({ prompt: $('Setup IDs').item.json.prompt }) }}";

// A Langfuse node factory: name + parameters, positioned later.
const lf = (name, parameters) => ({ kind: 'lf', name, parameters });
const plain = (name, type, typeVersion, parameters) => ({ kind: 'plain', name, type, typeVersion, parameters });

// --- Head row (shared setup) ---
const head = [
  plain('Manual Trigger', 'n8n-nodes-base.manualTrigger', 1, {}),
  plain('Setup IDs', 'n8n-nodes-base.set', 3.4, {
    assignments: {
      assignments: [
        { id: 'a1', name: 'traceId', value: '=n8n-demo-{{ $now.toMillis() }}', type: 'string' },
        { id: 'a2', name: 'sessionId', value: "=n8n-session-{{ $now.toFormat('yyyy-LL-dd') }}", type: 'string' },
        { id: 'a3', name: 'spanId', value: '=span-{{ $now.toMillis() }}', type: 'string' },
        { id: 'a4', name: 'genId', value: '=gen-{{ $now.toMillis() }}', type: 'string' },
        { id: 'a5', name: 'scoreId', value: '=score-{{ $now.toMillis() }}', type: 'string' },
        { id: 'a6', name: 'datasetName', value: 'n8n-demo-dataset', type: 'string' },
        { id: 'a7', name: 'datasetItemId', value: '=demo-item-{{ $now.toMillis() }}', type: 'string' },
        { id: 'a8', name: 'runName', value: '=run-{{ $now.toMillis() }}', type: 'string' },
        { id: 'a9', name: 'prompt', value: 'Explain in one sentence why observability matters for LLM applications.', type: 'string' },
      ],
    },
    options: {},
  }),
  plain('OpenAI Chat', '@n8n/n8n-nodes-langchain.openAi', 1.8, {
    modelId: { __rl: true, value: 'gpt-4o-mini', mode: 'list', cachedResultName: 'gpt-4o-mini' },
    messages: { values: [{ content: '={{ $json.prompt }}', role: 'user' }] },
    options: {},
  }),
];

// --- Lane 1: Ingestion (build a trace, then hand off to the verify lane) ---
const ingestion = [
  lf('Trace Create', { resource: 'trace', operation: 'traceCreate', traceId: setupRef('traceId'), name: 'n8n-demo-trace', inputJson: promptJson, outputJson: openAiJson, showAdvancedFields: true, sessionId: setupRef('sessionId'), tags: 'n8n,demo,langfuse-studio', environment: 'production', metadataJson: '{"source":"n8n","demo":"langfuse-studio"}' }),
  lf('Span Create', { resource: 'span', operation: 'spanCreate', traceId: setupRef('traceId'), name: 'workflow-step', inputJson: promptJson, showAdvancedFields: true, observationId: setupRef('spanId'), startTime: '={{ $now.toISO() }}', environment: 'production' }),
  lf('Span Update', { resource: 'span', operation: 'spanUpdate', traceId: setupRef('traceId'), name: 'workflow-step', showAdvancedFields: true, observationId: setupRef('spanId'), endTime: '={{ $now.toISO() }}', level: 'DEFAULT', statusMessage: 'completed', outputJson: '{"status":"ok"}' }),
  lf('Generation Create', { resource: 'generation', operation: 'generationCreate', traceId: setupRef('traceId'), name: 'openai-generation', model: 'gpt-4o-mini', inputJson: promptJson, outputJson: openAiJson, showAdvancedFields: true, observationId: setupRef('genId'), parentObservationId: setupRef('spanId'), startTime: '={{ $now.toISO() }}', environment: 'production', usageDetailsJson: "={{ JSON.stringify($('OpenAI Chat').item.json.usage ?? $('OpenAI Chat').item.json.tokenUsage ?? {}) }}", modelParametersJson: '{"temperature":0.7}' }),
  lf('Generation Update', { resource: 'generation', operation: 'generationUpdate', traceId: setupRef('traceId'), name: 'openai-generation', model: 'gpt-4o-mini', outputJson: openAiJson, showAdvancedFields: true, observationId: setupRef('genId'), endTime: '={{ $now.toISO() }}', costDetailsJson: '{"total_cost":0.0001}' }),
  lf('Finalize Span', { resource: 'generation', operation: 'finalizeSpan', traceId: setupRef('traceId'), name: 'llm-response', model: 'gpt-4o-mini', promptName: 'n8n-demo-prompt', promptVersion: '1', inputJson: promptJson, outputJson: openAiJson, showAdvancedFields: true, observationId: setupRef('spanId'), endTime: '={{ $now.toISO() }}' }),
  lf('Score Create', { resource: 'score', operation: 'scoreCreate', traceId: setupRef('traceId'), scoreName: 'demo-relevance', scoreValue: '0.9', scoreDataType: 'NUMERIC', showAdvancedFields: true, scoreId: setupRef('scoreId'), scoreComment: 'Automated demo score', scoreEnvironment: 'production' }),
  lf('Event Create', { resource: 'system', operation: 'eventCreate', traceId: setupRef('traceId'), name: 'demo-event', inputJson: '{"event":"user_action"}', showAdvancedFields: true, parentObservationId: setupRef('spanId'), environment: 'production', metadataJson: '{"step":"event-demo"}' }),
  lf('SDK Log', { resource: 'system', operation: 'sdkLogCreate', traceId: setupRef('traceId'), sdkMessage: 'n8n Langfuse Studio demo SDK log', sdkLevel: 'info', showAdvancedFields: true, metadataJson: '{"component":"n8n"}' }),
  lf('Batch Raw', { resource: 'system', operation: 'batchRaw', batchJson: "={{ JSON.stringify({ batch: [ { id: 'evt-' + $now.toMillis(), type: 'event-create', timestamp: $now.toISO(), body: { id: 'batch-' + $now.toMillis(), traceId: $('Setup IDs').item.json.traceId, name: 'raw-batch-event' } } ] }) }}" }),
  plain('Wait for Ingestion', 'n8n-nodes-base.wait', 1.1, { amount: 5 }),
];

// --- Lane 5: Round-trip verification (reads back what Lane 1 wrote, after the Wait) ---
// Positioned to the right of the Wait node so the downward connection is short.
const verify = [
  lf('Get Trace', { resource: 'trace', operation: 'getTrace', traceId: setupRef('traceId') }),
  lf('Get Observation', { resource: 'observation', operation: 'getObservation', observationId: setupRef('spanId') }),
  lf('Get Score', { resource: 'score', operation: 'getScore', scoreId: setupRef('scoreId') }),
  lf('Delete Score', { resource: 'score', operation: 'deleteScore', scoreId: setupRef('scoreId') }),
];

// --- Lane 2: Public API reads (existing project data, independent of this run) ---
const reads = [
  lf('Health', { resource: 'system', operation: 'health' }),
  lf('List Traces', { resource: 'trace', operation: 'listTraces', showAdvancedFields: true, queryJson: '{"limit":5}' }),
  lf('List Observations', { resource: 'observation', operation: 'listObservations', showAdvancedFields: true, queryJson: '{"limit":5}' }),
  lf('List Scores', { resource: 'score', operation: 'listScores', showAdvancedFields: true, queryJson: '{"limit":5}' }),
  lf('List Sessions', { resource: 'session', operation: 'listSessions', showAdvancedFields: true, queryJson: '{"limit":5}' }),
  lf('List Annotation Queues', { resource: 'queue', operation: 'listAnnotationQueues', showAdvancedFields: true, queryJson: '{"limit":5}' }),
  lf('Get Annotation Queue', { resource: 'queue', operation: 'getAnnotationQueue', queueId: '={{ $json.data?.[0]?.id }}' }),
  lf('Custom Request', { resource: 'system', operation: 'customRequest', path: '/v2/scores', method: 'GET', showAdvancedFields: true, queryJson: '{"limit":1}' }),
];

// --- Lane 3: Datasets (the evaluation building blocks) ---
const datasets = [
  lf('Create Dataset', { resource: 'dataset', operation: 'createDataset', datasetName: setupRef('datasetName'), showAdvancedFields: true, datasetDescription: 'Demo dataset created from n8n' }),
  lf('Create Dataset Item', { resource: 'datasetItem', operation: 'createDatasetItem', datasetName: setupRef('datasetName'), inputJson: promptJson, expectedOutputJson: '{"answer":"observability matters"}', showAdvancedFields: true, datasetItemId: setupRef('datasetItemId') }),
  lf('List Dataset Items', { resource: 'datasetItem', operation: 'listDatasetItems', showAdvancedFields: true, queryJson: "={{ JSON.stringify({ datasetName: $('Setup IDs').item.json.datasetName, limit: 5 }) }}" }),
  lf('Create Run Item', { resource: 'datasetRun', operation: 'createDatasetRunItem', runName: setupRef('runName'), datasetItemId: setupRef('datasetItemId'), traceId: setupRef('traceId') }),
  lf('List Dataset Runs', { resource: 'datasetRun', operation: 'listDatasetRuns', datasetName: setupRef('datasetName') }),
  lf('Get Dataset Run', { resource: 'datasetRun', operation: 'getDatasetRun', datasetName: setupRef('datasetName'), runName: setupRef('runName') }),
];

// --- Lane 4: Prompts (create -> list -> drill down) ---
const prompts = [
  lf('Create Prompt', { resource: 'prompt', operation: 'createPrompt', promptName: 'n8n-demo-prompt', promptType: 'text', promptText: 'Answer the question: {{question}}', showAdvancedFields: true, promptLabels: 'production', promptCommitMessage: 'created from the n8n demo' }),
  lf('List Prompts', { resource: 'prompt', operation: 'listPrompts', showAdvancedFields: true, queryJson: '{"limit":5}' }),
  lf('Get Prompt', { resource: 'prompt', operation: 'getPrompt', promptName: '={{ $json.data?.[0]?.name }}' }),
];

const laneDefs = [
  { key: 'ingestion', title: '1 · Ingestion (writes + wait)', color: 5, nodes: ingestion, xStart: LANE_X0 },
  { key: 'reads', title: '2 · Public API reads (existing data)', color: 4, nodes: reads, xStart: LANE_X0 },
  { key: 'datasets', title: '3 · Datasets (evaluation building blocks)', color: 3, nodes: datasets, xStart: LANE_X0 },
  { key: 'prompts', title: '4 · Prompts (create → list → get)', color: 6, nodes: prompts, xStart: LANE_X0 },
  { key: 'verify', title: '5 · Round-trip verification (Get / Delete)', color: 5, nodes: verify, xStart: VERIFY_X0 },
];

// --- Materialize nodes + positions ---
const nodes = [];

function materialize(spec, position) {
  const base = { id: randomUUID(), name: spec.name, position };
  if (spec.kind === 'lf') {
    return { parameters: spec.parameters, ...base, type: LF, typeVersion: 2, credentials: lfCred, onError: 'continueRegularOutput' };
  }
  const node = { parameters: spec.parameters, ...base, type: spec.type, typeVersion: spec.typeVersion };
  if (spec.type === '@n8n/n8n-nodes-langchain.openAi') {
    node.credentials = { openAiApi: { id: 'REPLACE_OPENAI_CRED', name: 'OpenAi account' } };
    node.onError = 'continueRegularOutput';
  }
  return node;
}

head.forEach((spec, i) => nodes.push(materialize(spec, [i * COL, HEAD_Y])));

for (const lane of laneDefs) {
  const y = LANES_Y[lane.key];
  const x0 = lane.xStart ?? LANE_X0;
  lane.nodes.forEach((spec, i) => nodes.push(materialize(spec, [x0 + i * COL, y])));
}

// --- Lane background sticky notes + README ---
const stickies = [
  {
    parameters: {
      content: '## Langfuse Studio — grouped demo\n\nManual Trigger → **Setup IDs** → **OpenAI Chat**, then a fan-out into five lanes you can read at a glance:\n\n1. **Ingestion** — build a trace (span/generation/score/event/log/batch), then Wait.\n2. **Public API reads** — health and list endpoints over existing data.\n3. **Datasets** — create a dataset, item, and run item, then read the run.\n4. **Prompts** — create a prompt, list, and fetch it.\n5. **Round-trip verification** — reads back the trace/observation/score written in lane 1, then deletes the demo score.\n\n### Setup\n1. Install `n8n-nodes-langfuse-studio`.\n2. Set your **Langfuse API** credential on every Langfuse node.\n3. Set your **OpenAI** credential on OpenAI Chat.\n\nEvery Langfuse node uses *Continue On Error*, so one failure never stops a lane. Langfuse ingestion is async — a 5s Wait precedes the round-trip reads, but a Get may still 404 on very fast runs; that is expected.',
      height: 320,
      width: 460,
    },
    id: randomUUID(),
    name: 'README',
    type: 'n8n-nodes-base.stickyNote',
    typeVersion: 1,
    position: [-40, -360],
  },
];

for (const lane of laneDefs) {
  const y = LANES_Y[lane.key];
  const x0 = lane.xStart ?? LANE_X0;
  const width = lane.nodes.length * COL + 60;
  stickies.push({
    parameters: { content: `### ${lane.title}`, height: 200, width, color: lane.color },
    id: randomUUID(),
    name: `Lane: ${lane.key}`,
    type: 'n8n-nodes-base.stickyNote',
    typeVersion: 1,
    position: [x0 - 80, y - 110],
  });
}

// --- Connections ---
const connection = (node) => ({ node, type: 'main', index: 0 });
const connections = {};
const linkChain = (chainNodes) => {
  for (let i = 0; i < chainNodes.length - 1; i++) {
    connections[chainNodes[i].name] = { main: [[connection(chainNodes[i + 1].name)]] };
  }
};

linkChain(head);
// Fan out from OpenAI Chat into the first node of lanes 1–4 (not verify, which starts after the Wait).
const fanOutLanes = laneDefs.filter((lane) => lane.key !== 'verify');
connections['OpenAI Chat'] = { main: [fanOutLanes.map((lane) => connection(lane.nodes[0].name))] };
for (const lane of laneDefs) {
  linkChain(lane.nodes);
}
// Wire the end of lane 1 (Wait for Ingestion) into the start of lane 5 (verify).
connections['Wait for Ingestion'] = { main: [[connection(verify[0].name)]] };

const workflow = {
  name: 'Langfuse Studio — grouped demo',
  nodes: [...stickies, ...nodes],
  connections,
  pinData: {},
  settings: { executionOrder: 'v1' },
};

writeFileSync(new URL('../docs/example-workflow.json', import.meta.url), JSON.stringify(workflow, null, 2) + '\n');
console.log('wrote docs/example-workflow.json with', nodes.length, 'nodes across', laneDefs.length, 'lanes (5 visible lanes + head row)');
