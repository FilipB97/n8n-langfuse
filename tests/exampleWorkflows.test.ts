import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

interface WorkflowNode {
  name: string;
  type: string;
  parameters: Record<string, unknown>;
}

interface Workflow {
  nodes: WorkflowNode[];
  connections: Record<string, { main?: Array<Array<{ node: string }>> }>;
}

function load(relativePath: string): Workflow {
  return JSON.parse(readFileSync(new URL(relativePath, import.meta.url), 'utf8')) as Workflow;
}

const files = ['../docs/example-workflow.json', '../docs/example-eval-workflow.json'];

for (const file of files) {
  test(`${file} is a structurally valid workflow`, () => {
    const workflow = load(file);

    assert.ok(Array.isArray(workflow.nodes) && workflow.nodes.length > 0, 'has nodes');

    const names = workflow.nodes.map((node) => node.name);
    assert.equal(new Set(names).size, names.length, 'node names are unique');

    const nameSet = new Set(names);
    for (const [source, connection] of Object.entries(workflow.connections)) {
      assert.ok(nameSet.has(source), `connection source "${source}" is a real node`);
      for (const group of connection.main ?? []) {
        for (const target of group) {
          assert.ok(nameSet.has(target.node), `connection target "${target.node}" is a real node`);
        }
      }
    }
  });

  test(`${file} Langfuse nodes declare an operation and use Continue On Error`, () => {
    const workflow = load(file);
    const langfuseNodes = workflow.nodes.filter((node) => node.type.includes('langfuse'));
    assert.ok(langfuseNodes.length > 0, 'has Langfuse nodes');

    for (const node of langfuseNodes) {
      assert.equal(typeof node.parameters.operation, 'string', `${node.name} has an operation`);
      assert.equal(
        (node as { onError?: string }).onError,
        'continueRegularOutput',
        `${node.name} continues on error`,
      );
    }
  });
}
