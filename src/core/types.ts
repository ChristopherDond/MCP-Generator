import type { OpenAPIV3 } from "openapi-types";

export type Lang = "typescript" | "python" | "go";

export type GroupByMode = "tag" | "path-prefix";

export interface GeneratorOptions {
  input: string;
  lang: Lang;
  out: string;
  force: boolean;
  incremental: boolean;
  http: boolean;
  envFile?: string;
  plugins?: string[];
  pluginsDir?: string;
  serverName?: string;
  serverVersion?: string;
  includeTags?: string[];
  excludeTags?: string[];
  pathPrefix?: string;
  includePaths?: string[];
  excludePaths?: string[];
  operationAllowlist?: string[];
  operationAllowlistFile?: string;
  groupBy?: GroupByMode;
  dryRun?: boolean;
}

export interface MCPToolParam {
  name: string;
  description: string;
  type: "string" | "number" | "boolean" | "object" | "array";
  in: "path" | "query" | "header" | "cookie" | "body";
  required: boolean;
  schema: OpenAPIV3.SchemaObject;
  format?: string;
  enum?: (string | number)[];
}

export interface MCPTool {
  name: string;
  description: string;
  method: string;
  path: string;
  params: MCPToolParam[];
  security?: OpenAPIV3.SecurityRequirementObject[];
  exampleResponse: unknown | null;
  tags: string[];
  operationId?: string;
  isGroup?: boolean;
  groupKey?: string;
  groupMode?: GroupByMode;
  groupMembers?: MCPTool[];
}

export interface MCPToolGroup {
  name: string;
  key: string;
  mode: GroupByMode;
  members: string[];
}

export interface MCPModel {
  name: string;
  description: string;
  properties: MCPModelProperty[];
  required: string[];
  isEnum: boolean;
  enumValues?: (string | number)[];
  oneOf?: string[];
  anyOf?: string[];
  discriminator?: {
    propertyName: string;
    mapping?: Record<string, string>;
  } | null;
}

export interface MCPModelProperty {
  name: string;
  type: string;
  description: string;
  nullable: boolean;
  isArray: boolean;
  ref?: string;
}

export interface MCPAuth {
  baseUrl: string;
  schemes: Record<string, string>;
}

export interface MCPServerAST {
  serverName: string;
  serverVersion: string;
  generatorVersion: string;
  tools: MCPTool[];
  groups?: MCPToolGroup[];
  models: MCPModel[];
  info: {
    title: string;
    description: string;
    version: string;
  };
  baseUrl: string;
  requiresAuth: boolean;
  securitySchemes?: Record<string, OpenAPIV3.SecuritySchemeObject | OpenAPIV3.ReferenceObject>;
  warnings?: string[];
}

export interface GenerationSummary {
  tools: number;
  models: number;
  groups: number;
  files: string[];
  outputDir: string;
  lang: Lang;
  serverName: string;
  serverVersion: string;
}

export interface GenerationResult {
  success: boolean;
  outputDir: string;
  filesCreated: string[];
  filesPreserved: string[];
  errors: string[];
  warnings: string[];
  dryRun?: boolean;
  summary?: GenerationSummary;
}

export interface ValidateResult {
  valid: boolean;
  tools: number;
  models: number;
  baseUrl: string;
  errors: string[];
  warnings: string[];
}