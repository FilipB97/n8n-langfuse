import { asString, parseJsonMaybe } from '../../src/langfuse.js';
import {
  runLangfuseAi,
  type OpenAiCredentials,
  type LangfuseAiInput,
} from '../../src/langfuseAi.js';
import type {
  LangfuseExecuteContext,
  NodeDescription,
  NodeInputItem,
} from '../../src/n8n-lite.js';

const description: NodeDescription = {
  displayName: 'Langfuse AI',
  name: 'langfuseAi',
  icon: 'file:langfuse.svg',
  group: ['transform'],
  version: 1,
  description: 'Fetches a Langfuse prompt, calls an AI model, and logs the trace and generation to Langfuse automatically.',
  defaults: { name: 'Langfuse AI' },
  inputs: ['main'],
  outputs: ['main'],
  credentials: [
    { name: 'langfuseApi', required: true },
    { name: 'openAiApi', required: true },
  ],
  properties: [
    {
      displayName: 'Model',
      name: 'model',
      type: 'options',
      default: 'gpt-4o',
      noDataExpression: true,
      options: [
        { name: 'GPT-4o', value: 'gpt-4o', description: 'Most capable multimodal GPT-4 model' },
        { name: 'GPT-4o Mini', value: 'gpt-4o-mini', description: 'Affordable and fast GPT-4o model' },
        { name: 'GPT-4 Turbo', value: 'gpt-4-turbo', description: 'GPT-4 Turbo with vision capabilities' },
        { name: 'GPT-3.5 Turbo', value: 'gpt-3.5-turbo', description: 'Fast and cost-effective' },
      ],
      description: 'OpenAI model to use for the completion',
    },
    {
      displayName: 'User Message',
      name: 'userMessage',
      type: 'string',
      default: '',
      required: true,
      typeOptions: { rows: 4 },
      description: 'Message from the user to send to the model',
    },
    {
      displayName: 'Prompt Name',
      name: 'promptName',
      type: 'string',
      default: '',
      description: 'Name of the Langfuse prompt to fetch and use as the system instruction. Leave blank to skip.',
      placeholder: 'my-system-prompt',
    },
    {
      displayName: 'System Message',
      name: 'systemMessage',
      type: 'string',
      default: '',
      typeOptions: { rows: 3 },
      description: 'System message to send to the model. Ignored when Prompt Name is set.',
    },
    {
      displayName: 'Show Advanced Fields',
      name: 'showAdvancedFields',
      type: 'boolean',
      default: false,
      noDataExpression: true,
      description: 'Whether to show advanced configuration options',
    },
    {
      displayName: 'Previous Messages (JSON)',
      name: 'previousMessagesJson',
      type: 'string',
      default: '',
      typeOptions: { rows: 3 },
      description: 'JSON array of previous conversation messages to continue a multi-turn chat. Each message must have a "role" ("user" or "assistant") and "content" field. Pass the "messages" output from a previous Langfuse AI node to chain turns automatically.',
      placeholder: '[{"role":"user","content":"Hi"},{"role":"assistant","content":"Hello!"}]',
      displayOptions: { show: { showAdvancedFields: [true] } },
    },
    {
      displayName: 'Prompt Label',
      name: 'promptLabel',
      type: 'string',
      default: 'production',
      description: 'Label used when fetching the Langfuse prompt (e.g. production, staging)',
      displayOptions: { show: { showAdvancedFields: [true] } },
    },
    {
      displayName: 'Prompt Version',
      name: 'promptVersion',
      type: 'string',
      default: '',
      description: 'Version number of the Langfuse prompt to fetch. When set, overrides Prompt Label.',
      placeholder: '1',
      displayOptions: { show: { showAdvancedFields: [true] } },
    },
    {
      displayName: 'Prompt Variables (JSON)',
      name: 'promptVariablesJson',
      type: 'string',
      default: '',
      typeOptions: { rows: 2 },
      description: 'JSON object of variables to substitute into the Langfuse prompt template',
      placeholder: '{"name": "Alice", "task": "summarize"}',
      displayOptions: { show: { showAdvancedFields: [true] } },
    },
    {
      displayName: 'Temperature',
      name: 'temperature',
      type: 'string',
      default: '',
      description: 'Sampling temperature between 0 and 2. Leave blank to use the model default.',
      placeholder: '0.7',
      displayOptions: { show: { showAdvancedFields: [true] } },
    },
    {
      displayName: 'Max Tokens',
      name: 'maxTokens',
      type: 'string',
      default: '',
      description: 'Maximum number of tokens to generate. Leave blank to use the model default.',
      placeholder: '1024',
      displayOptions: { show: { showAdvancedFields: [true] } },
    },
    {
      displayName: 'Trace Name',
      name: 'traceName',
      type: 'string',
      default: '',
      description: 'Name to assign to the Langfuse trace. Defaults to the model name when blank.',
      displayOptions: { show: { showAdvancedFields: [true] } },
    },
    {
      displayName: 'Session ID',
      name: 'sessionId',
      type: 'string',
      default: '',
      description: 'Langfuse session ID to group related traces together',
      displayOptions: { show: { showAdvancedFields: [true] } },
    },
    {
      displayName: 'User ID',
      name: 'userId',
      type: 'string',
      default: '',
      description: 'ID of the user associated with this trace',
      displayOptions: { show: { showAdvancedFields: [true] } },
    },
    {
      displayName: 'Tags (JSON)',
      name: 'tagsJson',
      type: 'string',
      default: '',
      description: 'JSON array of tags to attach to the trace',
      placeholder: '["prod", "v1"]',
      displayOptions: { show: { showAdvancedFields: [true] } },
    },
    {
      displayName: 'Environment',
      name: 'environment',
      type: 'string',
      default: '',
      placeholder: 'production',
      description: 'Environment label to attach to the trace and generation',
      displayOptions: { show: { showAdvancedFields: [true] } },
    },
  ],
};

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

export class LangfuseAi {
  description = description;

  async execute(this: LangfuseExecuteContext): Promise<Array<Array<NodeInputItem>>> {
    const langfuseCreds = await this.getCredentials('langfuseApi');
    const openAiCreds = await this.getCredentials('openAiApi') as unknown as OpenAiCredentials;
    const items = this.getInputData();
    const results: NodeInputItem[] = [];

    for (const [itemIndex] of items.entries()) {
      try {
        const model = asString(this.getNodeParameter('model', itemIndex)) ?? 'gpt-4o';
        const userMessage = asString(this.getNodeParameter('userMessage', itemIndex)) ?? '';
        const promptName = asString(getOptionalNodeParameter(this, 'promptName', itemIndex));
        const systemMessage = asString(getOptionalNodeParameter(this, 'systemMessage', itemIndex));
        const showAdvanced = this.getNodeParameter('showAdvancedFields', itemIndex) as boolean;

        let previousMessages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }> | undefined;
        let promptLabel: string | undefined;
        let promptVersion: string | undefined;
        let promptVariables: Record<string, string> | undefined;
        let temperature: number | undefined;
        let maxTokens: number | undefined;
        let traceName: string | undefined;
        let sessionId: string | undefined;
        let userId: string | undefined;
        let tags: string[] | undefined;
        let environment: string | undefined;

        if (showAdvanced) {
          const prevMsgRaw = getOptionalNodeParameter(this, 'previousMessagesJson', itemIndex);
          if (prevMsgRaw) {
            const parsed = parseJsonMaybe(prevMsgRaw);
            if (Array.isArray(parsed)) {
              previousMessages = (parsed as unknown[]).filter(
                (m): m is { role: 'system' | 'user' | 'assistant'; content: string } =>
                  typeof m === 'object' && m !== null &&
                  typeof (m as Record<string, unknown>).role === 'string' &&
                  typeof (m as Record<string, unknown>).content === 'string',
              );
            }
          }

          promptLabel = asString(getOptionalNodeParameter(this, 'promptLabel', itemIndex));
          promptVersion = asString(getOptionalNodeParameter(this, 'promptVersion', itemIndex));

          const promptVarsRaw = getOptionalNodeParameter(this, 'promptVariablesJson', itemIndex);
          if (promptVarsRaw) {
            const parsed = parseJsonMaybe(promptVarsRaw);
            if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
              promptVariables = Object.fromEntries(
                Object.entries(parsed as Record<string, unknown>).map(([k, v]) => [k, String(v)]),
              );
            }
          }

          const tempRaw = asString(getOptionalNodeParameter(this, 'temperature', itemIndex));
          if (tempRaw) {
            const parsed = parseFloat(tempRaw);
            if (!isNaN(parsed)) temperature = parsed;
          }

          const maxTokensRaw = asString(getOptionalNodeParameter(this, 'maxTokens', itemIndex));
          if (maxTokensRaw) {
            const parsed = parseInt(maxTokensRaw, 10);
            if (!isNaN(parsed) && parsed > 0) maxTokens = parsed;
          }

          traceName = asString(getOptionalNodeParameter(this, 'traceName', itemIndex));
          sessionId = asString(getOptionalNodeParameter(this, 'sessionId', itemIndex));
          userId = asString(getOptionalNodeParameter(this, 'userId', itemIndex));
          environment = asString(getOptionalNodeParameter(this, 'environment', itemIndex));

          const tagsRaw = getOptionalNodeParameter(this, 'tagsJson', itemIndex);
          if (tagsRaw) {
            const parsed = parseJsonMaybe(tagsRaw);
            if (Array.isArray(parsed)) {
              tags = (parsed as unknown[]).filter((t): t is string => typeof t === 'string');
            }
          }
        }

        const input: LangfuseAiInput = {
          model,
          userMessage,
          ...(promptName ? { promptName } : systemMessage ? { systemMessage } : {}),
          ...(previousMessages?.length ? { previousMessages } : {}),
          ...(promptName && promptLabel ? { promptLabel } : {}),
          ...(promptName && promptVersion ? { promptVersion } : {}),
          ...(promptVariables ? { promptVariables } : {}),
          ...(temperature !== undefined ? { temperature } : {}),
          ...(maxTokens !== undefined ? { maxTokens } : {}),
          ...(traceName ? { traceName } : {}),
          ...(sessionId ? { sessionId } : {}),
          ...(userId ? { userId } : {}),
          ...(tags?.length ? { tags } : {}),
          ...(environment ? { environment } : {}),
        };

        const result = await runLangfuseAi(input, langfuseCreds, openAiCreds);

        results.push({
          json: {
            content: result.content,
            traceId: result.traceId,
            generationId: result.generationId,
            model: result.model,
            messages: result.messages,
            usage: result.usage,
          },
          pairedItem: { item: itemIndex },
        });
      } catch (error) {
        if (this.continueOnFail?.()) {
          results.push({
            json: { error: error instanceof Error ? error.message : String(error) },
            pairedItem: { item: itemIndex },
          });
        } else {
          throw error;
        }
      }
    }

    return [results];
  }
}

export { description };
