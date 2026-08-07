import type { OpenAPIV3 } from "openapi-types";

export type Lang = "typescript" | "python" | "go";

export interface GeneratorOptions {
  input: string;
  lang: Lang;
  out: string;
  force: boolean;
  incremental: boolean;
  /** When true, generated handlers call the real API (HTTP) instead of returning example stubs. */
  http: boolean;
  /** Load an .env style file for the generated server's credentials. */
  envFile?: string;
  /** Paths to plugin folders or modules that can provide templates/helpers. */
  plugins?: string[];
  /** Optional directory to discover plugins (scanned before core templates). */
  pluginsDir?: string;
  serverName?: string;
  serverVersion?: string;
}

export interface MCPToolParam {
  name: string;
  description: string;
  type: "string" | "number" | "boolean" | "object" | "array";
  /** Where the param lives: path | query | header | cookie | body */
  in: "path" | "query" | "header" | "cookie" | "body";
  required: boolean;
  schema: OpenAPIV3.SchemaObject;
  /** OpenAPI format hint (date-time, uuid, email, int32, ...) used for typing. */
  format?: string;
  /** Populated when the parameter schema is an enum. */
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
}

export interface MCPModel {
  name: string;
  description: string;
  properties: MCPModelProperty[];
  required: string[];
  /** True when the schema is a plain enum (no object properties). */
  isEnum: boolean;
  enumValues?: (string | number)[];
  // For schemas that use oneOf/anyOf
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
  /** Non-empty when any operation requires security. Maps scheme name → info. */
  schemes: Record<string, string>;
}

export interface MCPServerAST {
  serverName: string;
  serverVersion: string;
  /** mcp-gen version, injected at render time by the generator. */
  generatorVersion: string;
  tools: MCPTool[];
  models: MCPModel[];
  info: {
    title: string;
    description: string;
    version: string;
  };
  baseUrl: string;
  /** True when any route declares security requirements. */
  requiresAuth: boolean;
  securitySchemes?: Record<string, OpenAPIV3.SecuritySchemeObject | OpenAPIV3.ReferenceObject>;
}

export interface GenerationResult {
  success: boolean;
  outputDir: string;
  filesCreated: string[];
  filesPreserved: string[];
  errors: string[];
  warnings: string[];
}

export interface ValidateResult {
  valid: boolean;
  tools: number;
  models: number;
  baseUrl: string;
  errors: string[];
  warnings: string[];
}