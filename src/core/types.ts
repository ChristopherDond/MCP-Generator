import type { OpenAPIV3 } from "openapi-types";

export interface GeneratorOptions {
  input: string;
  lang: "typescript" | "python";
  out: string;
  force: boolean;
  incremental: boolean;
  serverName?: string;
  serverVersion?: string;
}

export interface MCPToolParam {
  name: string;
  description: string;
  type: "string" | "number" | "boolean" | "object" | "array";
  required: boolean;
  schema: OpenAPIV3.SchemaObject;
}

export interface MCPTool {
  name: string;
  description: string;
  method: string;
  path: string;
  params: MCPToolParam[];
  exampleResponse: unknown | null;
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
  filesPreserved: string[];
  errors: string[];
  warnings: string[];
}
