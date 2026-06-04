import { pollLangfuse } from '../../src/langfuseTrigger.js';
import type { LangfusePollContext, NodeDescription, NodeInputItem, TriggerNodeType } from '../../src/n8n-lite.js';

const description: NodeDescription = {
  displayName: 'Langfuse Trigger',
  name: 'langfuseTrigger',
  icon: 'file:langfuse.svg',
  group: ['trigger'],
  version: 1,
  subtitle: '={{$parameter["event"]}}',
  description: 'Starts the workflow when new Langfuse records appear',
  defaults: { name: 'Langfuse Trigger' },
  polling: true,
  inputs: [],
  outputs: ['main'],
  credentials: [{ name: 'langfuseApi', required: true }],
  properties: [
    {
      displayName: 'Event',
      name: 'event',
      type: 'options',
      default: 'trace',
      noDataExpression: true,
      options: [
        { name: 'New Observation', value: 'observation', description: 'Trigger when new observations are created' },
        { name: 'New Score', value: 'score', description: 'Trigger when new scores are created' },
        { name: 'New Trace', value: 'trace', description: 'Trigger when new traces are created' },
      ],
      description: 'Which Langfuse records should start the workflow',
    },
  ],
};

export class LangfuseTrigger implements TriggerNodeType {
  description = description;

  async poll(this: LangfusePollContext): Promise<Array<Array<NodeInputItem>> | null> {
    return pollLangfuse(this);
  }
}

// Named export for metadata tests and n8n tooling.
export { description };
