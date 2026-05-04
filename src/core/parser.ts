import SwaggerParser from "@apidevtools/swagger-parser";
import type { OpenAPIV3 } from "openapi-types";
import type {
  MCPServerAST,
  MCPTool,
  MCPToolParam,
  MCPModel,
  MCPModelProperty,
} from "./types.js";

// Resolve a $ref string to its component name: "#/components/schemas/User" → "User"
function refToName(ref: string): string {
  return ref.split("/").pop() ?? ref;
}

function openapiTypeToTS(type: string): string {
  switch (type) {
    case "integer":
    case "number":
      return "number";
    case "boolean":
      return "boolean";
    case "object":
      return "Record<string, unknown>";
    default:
      return "string";
  }
}

function resolveSchemaProperties(
  schema: OpenAPIV3.SchemaObject,
  components: OpenAPIV3.ComponentsObject | undefined
): MCPModelProperty[] {
  const props: MCPModelProperty[] = [];
  if (!schema.properties) return props;

  for (const [name, rawProp] of Object.entries(schema.properties)) {
    const prop = rawProp as OpenAPIV3.SchemaObject | OpenAPIV3.ReferenceObject;

    if ("$ref" in prop) {
      props.push({
        name,
        type: refToName(prop.$ref),
        description: "",
        nullable: false,
        isArray: false,
        ref: refToName(prop.$ref),
      });
      continue;
    }

    const isArray = prop.type === "array";
    let itemRef: string | undefined;
    let type: string = prop.type ? openapiTypeToTS(prop.type) : "string";

    if (isArray && prop.items) {
      const items = prop.items as OpenAPIV3.SchemaObject | OpenAPIV3.ReferenceObject;
      if ("$ref" in items) {
        itemRef = refToName(items.$ref);
        type = itemRef;
      } else {
        type = (items as OpenAPIV3.SchemaObject).type ?? "string";
      }
    }

    props.push({
      name,
      type: isArray ? `${type}[]` : type,
      description: prop.description ?? "",
      nullable: prop.nullable ?? false,
      isArray,
      ref: itemRef,
    });
  }

  return props;
}

function extractExampleResponse(
  operation: OpenAPIV3.OperationObject
): unknown | null {
  const responses = operation.responses;
  if (!responses) return null;

  const successCode = Object.keys(responses).find(
    (c) => c.startsWith("2") || c === "default"
  );
  if (!successCode) return null;

  const response = responses[successCode] as OpenAPIV3.ResponseObject;
  if (!response?.content) return null;

  const jsonContent = response.content["application/json"];
  if (!jsonContent) return null;

  // Try example first, then schema example
  if (jsonContent.example) return jsonContent.example;
  if (jsonContent.schema && !("$ref" in jsonContent.schema)) {
    return (jsonContent.schema as OpenAPIV3.SchemaObject).example ?? null;
  }

  return null;
}

function pathToToolName(method: string, path: string): string {
  // GET /users/{id}/posts → get_users_id_posts
  const slug = path
    .replace(/\//g, "_")
    .replace(/[{}]/g, "")
    .replace(/[^a-zA-Z0-9_]/g, "")
    .replace(/^_/, "")
    .replace(/_+/g, "_")
    .toLowerCase();
  return `${method.toLowerCase()}_${slug}`;
}

function buildTools(
  paths: OpenAPIV3.PathsObject,
  components: OpenAPIV3.ComponentsObject | undefined
): MCPTool[] {
  const tools: MCPTool[] = [];
  const METHODS = ["get", "post", "put", "patch", "delete", "head", "options"] as const;

  for (const [path, pathItem] of Object.entries(paths)) {
    if (!pathItem) continue;

    for (const method of METHODS) {
      const operation = (pathItem as Record<string, unknown>)[method] as
        | OpenAPIV3.OperationObject
        | undefined;
      if (!operation) continue;

      const params: MCPToolParam[] = [];

      // Path + query parameters
      const allParams = [
        ...(pathItem.parameters ?? []),
        ...(operation.parameters ?? []),
      ];

      for (const rawParam of allParams) {
        if ("$ref" in rawParam) continue;
        const param = rawParam as OpenAPIV3.ParameterObject;
        const schema = (param.schema ?? { type: "string" }) as OpenAPIV3.SchemaObject;

        params.push({
          name: param.name,
          description: param.description ?? `${param.in} parameter`,
          type: openapiTypeToTS(schema.type ?? "string") as MCPToolParam["type"],
          required: param.required ?? param.in === "path",
          schema,
        });
      }

      // Request body → add as "body" param
      if (operation.requestBody && !("$ref" in operation.requestBody)) {
        const body = operation.requestBody as OpenAPIV3.RequestBodyObject;
        const jsonSchema = body.content?.["application/json"]?.schema;
        if (jsonSchema && !("$ref" in jsonSchema)) {
          params.push({
            name: "body",
            description: body.description ?? "Request body",
            type: "object",
            required: body.required ?? false,
            schema: jsonSchema as OpenAPIV3.SchemaObject,
          });
        }
      }

      tools.push({
        name: pathToToolName(method, path),
        description:
          operation.summary ??
          operation.description ??
          `${method.toUpperCase()} ${path}`,
        method: method.toUpperCase(),
        path,
        params,
        exampleResponse: extractExampleResponse(operation),
        tags: operation.tags ?? [],
      });
    }
  }

  return tools;
}

function buildModels(
  components: OpenAPIV3.ComponentsObject | undefined
): MCPModel[] {
  if (!components?.schemas) return [];

  const models: MCPModel[] = [];

  for (const [name, rawSchema] of Object.entries(components.schemas)) {
    if ("$ref" in rawSchema) continue;
    const schema = rawSchema as OpenAPIV3.SchemaObject;

    // Skip enums — they're rendered as literals in templates
    if (schema.enum) continue;

    // Handle allOf (simple merge, no polymorphism in MVP)
    let resolvedSchema = schema;
    if (schema.allOf) {
      const merged: OpenAPIV3.SchemaObject = {
        type: "object",
        properties: {},
        required: [],
      };
      for (const sub of schema.allOf) {
        if ("$ref" in sub) continue;
        const subSchema = sub as OpenAPIV3.SchemaObject;
        Object.assign(merged.properties!, subSchema.properties ?? {});
        merged.required = [
          ...(merged.required ?? []),
          ...(subSchema.required ?? []),
        ];
      }
      merged.required = Array.from(new Set([...(schema.required ?? []), ...(merged.required ?? [])]));
      resolvedSchema = merged;
    }

    models.push({
      name,
      description: schema.description ?? "",
      properties: resolveSchemaProperties(resolvedSchema, components),
      required: resolvedSchema.required ?? [],
    });
  }

  return models;
}

export async function parseOpenAPI(inputPath: string): Promise<MCPServerAST> {
  let api: OpenAPIV3.Document;

  try {
    api = (await SwaggerParser.validate(inputPath)) as OpenAPIV3.Document;
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    throw new Error(`OpenAPI validation failed: ${message}`);
  }

  if (!("openapi" in api) || !api.openapi.startsWith("3")) {
    throw new Error(
      `Only OpenAPI v3.x is supported. Got: ${"swagger" in api ? (api as Record<string, string>).swagger : "unknown"}`
    );
  }

  const tools = buildTools(api.paths ?? {}, api.components);
  const models = buildModels(api.components);

  const serverName = (api.info.title ?? "mcp-server")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");

  const baseUrl =
    api.servers?.[0]?.url ?? "https://api.example.com";

  return {
    serverName,
    serverVersion: api.info.version ?? "1.0.0",
    tools,
    models,
    info: {
      title: api.info.title ?? "MCP Server",
      description: api.info.description ?? "",
      version: api.info.version ?? "1.0.0",
    },
    baseUrl,
  };
}
