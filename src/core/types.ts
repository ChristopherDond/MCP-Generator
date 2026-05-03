import type { OpenAPI, OpenAPIV3 } from "openapi-types";

export interface GeneratorOptions {
  input: string;
  lang: "typescript" | "python";
  out: string;
  force: boolean;
  serverName?: string;
  serverVersion?: string;
}

// Internal AST — decoupled from OpenAPI types so templates are portable
export interface MCPToolParam {
  name: string;
  description: string;
  type: "string" | "number" | "boolean" | "object" | "array";
  required: boolean;
  schema: OpenAPIV3.SchemaObject;
}

export interface MCPTool {
  /** Unique tool name: {method}_{path_slug} e.g. get_users_id */
  name: string;
  description: string;
  method: string;
  path: string;
  params: MCPToolParam[];
  /** Example response from spec, or null */
  exampleResponse: unknown | null;
  /** Tags from the OpenAPI operation */
  tags: string[];
}

export interface MCPModel {
  name: string;
  description: string;
  properties: MCPModelProperty[];
  required: string[];
}

export interface MCPModelProperty {
  name: string;
  type: string;
  description: string;
  nullable: boolean;
  isArray: boolean;
  /** Reference to another model, if applicable */
  ref?: string;
}

export interface MCPServerAST {
  serverName: string;
  serverVersion: string;
  tools: MCPTool[];
  models: MCPModel[];
  info: {
    title: string;
    description: string;
    version: string;
  };
  baseUrl: string;
}

export interface GenerationResult {
  success: boolean;
  outputDir: string;
  filesCreated: string[];
  errors: string[];
  warnings: string[];
}
