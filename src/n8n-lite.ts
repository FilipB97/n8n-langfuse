import type { LangfuseCredentials } from './langfuse.js';

export interface NodeParameterOption {
  name: string;
  value: string;
  action?: string;
  description?: string;
  routing?: Record<string, unknown>;
}

export interface NodePropertyDisplayOptions {
  show: {
    resource?: string[];
    operation?: string[];
    showAdvancedFields?: boolean[];
    promptType?: string[];
  };
}

export interface NodeProperty {
  displayName: string;
  name: string;
  type: string;
  default?: unknown;
  required?: boolean;
  description?: string;
  placeholder?: string;
  hint?: string;
  noDataExpression?: boolean;
  options?: NodeParameterOption[];
  typeOptions?: Record<string, unknown>;
  displayOptions?: NodePropertyDisplayOptions;
}

export interface NodeDescription {
  displayName: string;
  name: string;
  icon?: string | {
    light: string;
    dark: string;
  };
  group: string[];
  version: number;
  subtitle?: string;
  description: string;
  defaults: {
    name: string;
  };
  polling?: boolean;
  inputs: string[];
  outputs: string[];
  credentials: Array<{
    name: string;
    required: boolean;
  }>;
  properties: NodeProperty[];
}

export interface NodeInputItem {
  json: Record<string, unknown>;
  pairedItem?: { item: number };
}

export interface LangfuseExecuteContext {
  getInputData(): NodeInputItem[];
  getNodeParameter(name: string, index: number): unknown;
  getCredentials(name: string): Promise<LangfuseCredentials>;
  continueOnFail?: () => boolean;
}

export interface LangfusePollContext {
  getNodeParameter(name: string, index?: number): unknown;
  getCredentials(name: string): Promise<LangfuseCredentials>;
  getWorkflowStaticData(type: string): Record<string, unknown>;
  getMode?(): string;
}

export interface TriggerNodeType {
  description: NodeDescription;
  poll(this: LangfusePollContext): Promise<Array<Array<NodeInputItem>> | null>;
}

export interface VersionedNodeVersion {
  description: NodeDescription;
  execute(this: LangfuseExecuteContext): Promise<Array<Array<NodeInputItem>>>;
}

export interface VersionedNodeType {
  description: Omit<NodeDescription, 'version' | 'properties'> & { version: number[] };
  currentVersion: number;
  nodeVersions: Record<number, VersionedNodeVersion>;
  getNodeType(version?: number): VersionedNodeVersion;
}

export interface CredentialProperty {
  displayName: string;
  name: string;
  type: string;
  default?: unknown;
  required?: boolean;
  description?: string;
  typeOptions?: Record<string, unknown>;
}

export interface CredentialDescription {
  name: string;
  displayName: string;
  icon?: string | {
    light: string;
    dark: string;
  };
  documentationUrl: string;
  authenticate?: {
    type: 'generic';
    properties: {
      auth?: {
        username: string;
        password: string;
      };
      header?: Record<string, string>;
      body?: Record<string, string>;
      qs?: Record<string, string>;
    };
  };
  test?: {
    request: {
      baseURL?: string;
      url: string;
    };
  };
  properties: CredentialProperty[];
}
