import type { CredentialDescription } from '../src/n8n-lite.js';

const description: CredentialDescription = {
  name: 'langfuseApi',
  displayName: 'Langfuse API',
  icon: 'file:langfuse.svg',
  documentationUrl: 'https://api.reference.langfuse.com/#tag/ingestion',
  authenticate: {
    type: 'generic',
    properties: {
      auth: {
        username: '={{$credentials.publicKey}}',
        password: '={{$credentials.secretKey}}',
      },
    },
  },
  test: {
    request: {
      baseURL: '={{$credentials?.baseUrl}}',
      url: '/api/public/v2/prompts?limit=1',
    },
  },
  properties: [
    {
      displayName: 'Base URL',
      name: 'baseUrl',
      type: 'string',
      default: 'https://cloud.langfuse.com',
      description: 'Langfuse cloud or self-hosted base URL without the /api/public suffix.',
    },
    {
      displayName: 'Public Key',
      name: 'publicKey',
      type: 'string',
      default: '',
      required: true,
      typeOptions: {
        password: true,
      },
      description: 'Langfuse public API key used as the Basic Auth username.',
    },
    {
      displayName: 'Secret Key',
      name: 'secretKey',
      type: 'string',
      default: '',
      required: true,
      typeOptions: {
        password: true,
      },
      description: 'Langfuse secret API key used as the Basic Auth password.',
    },
    {
      displayName: 'Timeout MS',
      name: 'timeoutMs',
      type: 'number',
      default: 30000,
      description: 'Request timeout in milliseconds for Langfuse ingestion calls.',
    },
  ],
};

export class LangfuseApi {
  name = description.name;
  displayName = description.displayName;
  documentationUrl = description.documentationUrl;
  properties = description.properties;
}

export { description };
