// Generates docs/example-eval-workflow.json — an importable n8n workflow that
// runs a full Langfuse dataset-run evaluation loop over multiple test cases.
import { writeFileSync } from 'node:fs';

const LF = 'n8n-nodes-langfuse-studio.langfuse';
const lfCred = { langfuseApi: { id: 'REPLACE_LANGFUSE_CRED', name: 'Langfuse account' } };

const buildTestCases = `const cfg = $('Set Run Config').first().json;
const stamp = Date.now();
const cases = [
  { question: 'What is the capital of France? Answer with one word.', expected: 'Paris' },
  { question: 'What is 2 + 2? Answer with just the number.', expected: '4' },
  { question: 'Which planet is known as the Red Planet? One word.', expected: 'Mars' },
];
return cases.map((c, i) => ({
  json: {
    datasetName: cfg.datasetName,
    runName: cfg.runName,
    question: c.question,
    expected: c.expected,
    itemId: 'eval-' + stamp + '-' + i,
    traceId: 'eval-trace-' + stamp + '-' + i,
  },
}));`;

const grade = `const tc = $('Build Test Cases').item.json;
const out = $json;
const answer = (out.message && out.message.content) || out.text || out.content || (typeof out === 'string' ? out : JSON.stringify(out));
const expected = String(tc.expected || '');
const match = String(answer).toLowerCase().includes(expected.toLowerCase()) ? 1 : 0;
return {
  json: {
    datasetName: tc.datasetName,
    runName: tc.runName,
    question: tc.question,
    expected: expected,
    itemId: tc.itemId,
    traceId: tc.traceId,
    answer: String(answer),
    score: match,
  },
};`;

const sticky = `## Langfuse Studio — Dataset Evaluation

Runs a full **LLM evaluation loop** with Langfuse datasets:

1. **Create Dataset** once.
2. **Build Test Cases** fans out into several cases (question + expected answer).
3. **OpenAI Chat** answers each question.
4. **Grade** compares the answer to the expected value (exact-match → 1/0).
5. Per case: **Create Trace** → **Create Dataset Item** (upsert) → **Create Run Item** (links the item + trace into the run) → **Score Result** (attaches the grade to the trace).
6. **Get Dataset Run** reads the run back.

### Before running
1. Install the community node \`n8n-nodes-langfuse-studio\` (>= 1.3.0).
2. Set your **Langfuse API** credential on every Langfuse node.
3. Set your **OpenAI** credential on the OpenAI Chat node.

### Notes
- Each case flows through as its own item; \`pairedItem\` keeps the per-case ids
  aligned, so every Langfuse node reads its values from \`$('Grade').item\`.
- Dataset Public API writes are synchronous, so the run is readable immediately.
  The score is sent via async ingestion, so it may appear in the run a moment later.
- Every Langfuse node uses *Continue On Error*, so one failure never stops the run.`;

const nodes = [
  {
    parameters: { content: sticky, height: 520, width: 560 },
    id: '00000000-0000-0000-0000-0000000000s1',
    name: 'README',
    type: 'n8n-nodes-base.stickyNote',
    typeVersion: 1,
    position: [-360, -300],
  },
  {
    parameters: {},
    id: '00000000-0000-0000-0000-000000000001',
    name: 'Manual Trigger',
    type: 'n8n-nodes-base.manualTrigger',
    typeVersion: 1,
    position: [0, 300],
  },
  {
    parameters: {
      assignments: {
        assignments: [
          { id: 'c1', name: 'datasetName', value: 'n8n-eval-demo', type: 'string' },
          { id: 'c2', name: 'runName', value: "=run-{{ $now.toFormat('yyyyLLdd-HHmmss') }}", type: 'string' },
        ],
      },
      options: {},
    },
    id: '00000000-0000-0000-0000-000000000002',
    name: 'Set Run Config',
    type: 'n8n-nodes-base.set',
    typeVersion: 3.4,
    position: [200, 300],
  },
  {
    parameters: {
      resource: 'dataset',
      operation: 'createDataset',
      datasetName: '={{ $json.datasetName }}',
      showAdvancedFields: true,
      datasetDescription: 'Demo evaluation dataset created from n8n',
    },
    id: '00000000-0000-0000-0000-000000000003',
    name: 'Create Dataset',
    type: LF,
    typeVersion: 2,
    position: [400, 300],
    credentials: lfCred,
    onError: 'continueRegularOutput',
  },
  {
    parameters: { mode: 'runOnceForAllItems', jsCode: buildTestCases },
    id: '00000000-0000-0000-0000-000000000004',
    name: 'Build Test Cases',
    type: 'n8n-nodes-base.code',
    typeVersion: 2,
    position: [600, 300],
  },
  {
    parameters: {
      modelId: { __rl: true, value: 'gpt-4o-mini', mode: 'list', cachedResultName: 'gpt-4o-mini' },
      messages: { values: [{ content: '={{ $json.question }}', role: 'user' }] },
      options: {},
    },
    id: '00000000-0000-0000-0000-000000000005',
    name: 'OpenAI Chat',
    type: '@n8n/n8n-nodes-langchain.openAi',
    typeVersion: 1.8,
    position: [800, 300],
    credentials: { openAiApi: { id: 'REPLACE_OPENAI_CRED', name: 'OpenAi account' } },
    onError: 'continueRegularOutput',
  },
  {
    parameters: { mode: 'runOnceForEachItem', jsCode: grade },
    id: '00000000-0000-0000-0000-000000000006',
    name: 'Grade',
    type: 'n8n-nodes-base.code',
    typeVersion: 2,
    position: [1000, 300],
  },
  {
    parameters: {
      resource: 'trace',
      operation: 'traceCreate',
      traceId: "={{ $('Grade').item.json.traceId }}",
      name: 'eval-case',
      inputJson: "={{ JSON.stringify({ question: $('Grade').item.json.question }) }}",
      outputJson: "={{ JSON.stringify({ answer: $('Grade').item.json.answer }) }}",
    },
    id: '00000000-0000-0000-0000-000000000007',
    name: 'Create Trace',
    type: LF,
    typeVersion: 2,
    position: [1200, 300],
    credentials: lfCred,
    onError: 'continueRegularOutput',
  },
  {
    parameters: {
      resource: 'datasetItem',
      operation: 'createDatasetItem',
      datasetName: "={{ $('Grade').item.json.datasetName }}",
      inputJson: "={{ JSON.stringify({ question: $('Grade').item.json.question }) }}",
      expectedOutputJson: "={{ JSON.stringify({ answer: $('Grade').item.json.expected }) }}",
      showAdvancedFields: true,
      datasetItemId: "={{ $('Grade').item.json.itemId }}",
    },
    id: '00000000-0000-0000-0000-000000000008',
    name: 'Create Dataset Item',
    type: LF,
    typeVersion: 2,
    position: [1400, 300],
    credentials: lfCred,
    onError: 'continueRegularOutput',
  },
  {
    parameters: {
      resource: 'datasetRun',
      operation: 'createDatasetRunItem',
      runName: "={{ $('Grade').item.json.runName }}",
      datasetItemId: "={{ $('Grade').item.json.itemId }}",
      traceId: "={{ $('Grade').item.json.traceId }}",
    },
    id: '00000000-0000-0000-0000-000000000009',
    name: 'Create Run Item',
    type: LF,
    typeVersion: 2,
    position: [1600, 300],
    credentials: lfCred,
    onError: 'continueRegularOutput',
  },
  {
    parameters: {
      resource: 'score',
      operation: 'scoreCreate',
      traceId: "={{ $('Grade').item.json.traceId }}",
      scoreName: 'exact_match',
      scoreValue: "={{ $('Grade').item.json.score }}",
      scoreDataType: 'NUMERIC',
      showAdvancedFields: true,
      scoreComment: "={{ 'answer: ' + $('Grade').item.json.answer }}",
    },
    id: '00000000-0000-0000-0000-000000000010',
    name: 'Score Result',
    type: LF,
    typeVersion: 2,
    position: [1800, 300],
    credentials: lfCred,
    onError: 'continueRegularOutput',
  },
  {
    parameters: {
      resource: 'datasetRun',
      operation: 'getDatasetRun',
      datasetName: "={{ $('Grade').item.json.datasetName }}",
      runName: "={{ $('Grade').item.json.runName }}",
    },
    id: '00000000-0000-0000-0000-000000000011',
    name: 'Get Dataset Run',
    type: LF,
    typeVersion: 2,
    position: [2000, 300],
    credentials: lfCred,
    onError: 'continueRegularOutput',
  },
];

const link = (from, to) => ({ [from]: { main: [[{ node: to, type: 'main', index: 0 }]] } });
const connections = Object.assign(
  {},
  link('Manual Trigger', 'Set Run Config'),
  link('Set Run Config', 'Create Dataset'),
  link('Create Dataset', 'Build Test Cases'),
  link('Build Test Cases', 'OpenAI Chat'),
  link('OpenAI Chat', 'Grade'),
  link('Grade', 'Create Trace'),
  link('Create Trace', 'Create Dataset Item'),
  link('Create Dataset Item', 'Create Run Item'),
  link('Create Run Item', 'Score Result'),
  link('Score Result', 'Get Dataset Run'),
);

const workflow = {
  name: 'Langfuse Studio — Dataset Evaluation',
  nodes,
  connections,
  pinData: {},
  settings: { executionOrder: 'v1' },
};

writeFileSync(new URL('../docs/example-eval-workflow.json', import.meta.url), JSON.stringify(workflow, null, 2) + '\n');
console.log('wrote docs/example-eval-workflow.json with', nodes.length, 'nodes');
