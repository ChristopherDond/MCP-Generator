import SwaggerParser from "@apidevtools/swagger-parser";
import type { OpenAPIV3 } from "openapi-types";
import type {
  MCPServerAST,
  MCPTool,
  MCPToolParam,
  MCPModel,
  MCPModelProperty,
} from "./types";

const TS_RESERVED = new Set([
  "break", "case", "catch", "class", "const", "continue", "debugger",
  "default", "delete", "do", "else", "enum", "export", "extends", "false",
  "finally", "for", "function", "if", "import", "in", "instanceof", "new",
  "null", "return", "super", "switch", "this", "throw", "true", "try",
  "typeof", "var", "void", "while", "with", "implements", "interface",
  "let", "package", "private", "protected", "public", "static", "yield",
]);

const PY_RESERVED = new Set([
  "and", "as", "assert", "async", "await", "break", "class", "continue",
  "def", "del", "elif", "else", "except", "finally", "for", "from",
  "global", "if", "import", "in", "is", "lambda", "nonlocal", "not", "or",
  "pass", "raise", "return", "try", "while", "with", "yield",
]);

const GO_RESERVED = new Set([
  "break", "case", "chan", "const", "continue", "default", "defer", "else",
  "fallthrough", "for", "func", "go", "goto", "if", "import", "interface",
  "map", "package", "range", "return", "select", "struct", "switch", "type",
  "var",
]);

const ALL_RESERVED = new Set([...TS_RESERVED, ...PY_RESERVED, ...GO_RESERVED]);

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
      return "object";
    case "array":
      return "array";
    default:
      return "string";
  }
}

/** Map an OpenAPI schema to an MCP tool-argument type, honoring enums. */
function schemaToParamType(
  schema: OpenAPIV3.SchemaObject | OpenAPIV3.ReferenceObject | undefined
): { type: MCPToolParam["type"]; format?: string; enum?: (string | number)[] } {
  if (!schema) return { type: "string" };
  if ("$ref" in schema) {
    // We don't resolve refs here — the template layer uses `schema` when available.
    return { type: "object" };
  }
  const s = schema as OpenAPIV3.SchemaObject;
  const t = openapiTypeToTS(s.type ?? "string") as MCPToolParam["type"];
  return { type: t, format: s.format, enum: s.enum as (string | number)[] | undefined };
}

function resolveSchemaProperties(
  schema: OpenAPIV3.SchemaObject,
  components: OpenAPIV3.ComponentsObject | undefined,
  visited: Set<OpenAPIV3.SchemaObject> = new Set()
): MCPModelProperty[] {
  // Guard against circular $ref chains (e.g. TreeNode -> children: TreeNode[])
  if (visited.has(schema)) return [];
  visited.add(schema);

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

/** Build a unique, valid identifier for a tool from method + path.
 *  Handles reserved words and name collisions by appending an index. */
function pathToToolName(method: string, path: string, used: Set<string>): string {
  let name = `${method.toLowerCase()}_${path
    .replace(/\//g, "_")
    .replace(/[{}]/g, "")
    .replace(/[^a-zA-Z0-9_]/g, "")
    .replace(/^_/, "")
    .replace(/_+/g, "_")
    .toLowerCase()}`;
  name = name.replace(/-+$/g, "");
  if (ALL_RESERVED.has(name) || name === "") name = `${name || "tool"}_handler`;
  let candidate = name;
  let i = 2;
  while (used.has(candidate)) {
    candidate = `${name}_${i}`;
    i += 1;
  }
  used.add(candidate);
  return candidate;
}

function collectParameters(
  pathItem: OpenAPIV3.PathItemObject,
  operation: OpenAPIV3.OperationObject
): OpenAPIV3.ParameterObject[] {
  const out: OpenAPIV3.ParameterObject[] = [];
  const seen = new Set<string>();
  const all = [...(pathItem.parameters ?? []), ...(operation.parameters ?? [])];
  for (const raw of all) {
    if ("$ref" in raw) continue;
    const p = raw as OpenAPIV3.ParameterObject;
    const key = `${p.in}:${p.name}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(p);
  }
  return out;
}

function buildTools(
  paths: OpenAPIV3.PathsObject,
  components: OpenAPIV3.ComponentsObject | undefined
): MCPTool[] {
  const tools: MCPTool[] = [];
  const usedNames = new Set<string>();
  const METHODS = ["get", "post", "put", "patch", "delete", "head", "options"] as const;
  const REF_SCHEMAS = components?.schemas ?? {};

  for (const [path, pathItem] of Object.entries(paths)) {
    if (!pathItem) continue;

    for (const method of METHODS) {
      const operation = (pathItem as Record<string, unknown>)[method] as
        | OpenAPIV3.OperationObject
        | undefined;
      if (!operation) continue;

      const params: MCPToolParam[] = [];

      // Path + query + header + cookie parameters (path-level merged, deduped)
      for (const rawParam of collectParameters(pathItem, operation)) {
        const param = rawParam as OpenAPIV3.ParameterObject;
        const schema = (param.schema ?? { type: "string" }) as OpenAPIV3.SchemaObject;
        const typed = schemaToParamType(schema);

        params.push({
          name: param.name,
          description: param.description ?? `${param.in} parameter`,
          type: typed.type,
          required: param.required ?? param.in === "path",
          in: (["path", "query", "header", "cookie"].includes(param.in)
            ? param.in
            : "query") as MCPToolParam["in"],
          schema,
          format: typed.format,
          enum: typed.enum,
        });
      }

      // Request body (resolving $ref) → add as "body" param
      let requestBody: OpenAPIV3.RequestBodyObject | undefined;
      const rawBody = operation.requestBody;
      if (rawBody) {
        if ("$ref" in rawBody) {
          const refName = refToName(rawBody.$ref);
          requestBody = (REF_SCHEMAS[refName] as OpenAPIV3.RequestBodyObject) ??
            undefined;
        } else {
          requestBody = rawBody;
        }
      }

      if (requestBody) {
        const jsonSchema = requestBody.content?.["application/json"]?.schema;
        if (jsonSchema) {
          // If body schema is a $ref, use a "body" object whose schema points at the ref name.
          let bodySchema: OpenAPIV3.SchemaObject;
          let bodyEnum: (string | number)[] | undefined;
          let bodyFormat: string | undefined;
          if ("$ref" in jsonSchema) {
            bodySchema = { type: "object" } as OpenAPIV3.SchemaObject;
            const refName = refToName(jsonSchema.$ref);
            // remember ref via format-less trick: store name in description? No — use enum-free schema.
            (bodySchema as OpenAPIV3.SchemaObject & { mcpRef?: string }).mcpRef = refName;
          } else {
            bodySchema = jsonSchema as OpenAPIV3.SchemaObject;
            bodyEnum = bodySchema.enum as (string | number)[] | undefined;
            bodyFormat = bodySchema.format;
          }
          params.push({
            name: "body",
            description: requestBody.description ?? "Request body",
            type: "object",
            required: requestBody.required ?? false,
            in: "body",
            schema: bodySchema,
            format: bodyFormat,
            enum: bodyEnum,
          });
        }
      }

      tools.push({
        name: pathToToolName(method, path, usedNames),
        description:
          operation.summary ??
          operation.description ??
          `${method.toUpperCase()} ${path}`,
        method: method.toUpperCase(),
        path,
        params,
        security: operation.security,
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

    // Enums become real model types (string/number unions)
    if (schema.enum) {
      models.push({
        name,
        description: schema.description ?? "",
        properties: [],
        required: [],
        isEnum: true,
        enumValues: schema.enum as (string | number)[],
      });
      continue;
    }

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
        Object.assign(merged.properties!, (sub as OpenAPIV3.SchemaObject).properties ?? {});
        merged.required = [
          ...(merged.required ?? []),
          ...((sub as OpenAPIV3.SchemaObject).required ?? []),
        ];
      }
      resolvedSchema = merged;
    }

    // Handle oneOf / anyOf by recording referenced component names
    const oneOf: string[] | undefined = schema.oneOf
      ? (schema.oneOf
          .map((s) => {
            if ("$ref" in s) return refToName((s as OpenAPIV3.ReferenceObject).$ref);
            return undefined;
          })
          .filter(Boolean) as string[])
      : undefined;

    const anyOf: string[] | undefined = schema.anyOf
      ? (schema.anyOf
          .map((s) => {
            if ("$ref" in s) return refToName((s as OpenAPIV3.ReferenceObject).$ref);
            return undefined;
          })
          .filter(Boolean) as string[])
      : undefined;

    models.push({
      name,
      description: schema.description ?? "",
      properties: resolveSchemaProperties(resolvedSchema, components),
      required: schema.required ?? [],
      isEnum: false,
      oneOf,
      anyOf,
      discriminator: schema.discriminator ?? null,
    });
  }

  return models;
}

export async function parseOpenAPI(inputPath: string): Promise<MCPServerAST> {
  let api: OpenAPIV3.Document;
  let raw: OpenAPIV3.Document;

  try {
    // parse returns the original document with $ref intact
    raw = (await SwaggerParser.parse(inputPath)) as OpenAPIV3.Document;

    // dereference resolves $refs inline; circular:"ignore" prevents infinite loops
    // on self-referential schemas (e.g. TreeNode { children: TreeNode[] })
    api = (await SwaggerParser.dereference(inputPath, {
      dereference: { circular: "ignore" },
    })) as OpenAPIV3.Document;
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    throw new Error(`OpenAPI validation failed: ${message}`);
  }

  if (!("openapi" in api) || !api.openapi.startsWith("3")) {
    throw new Error(
      `Only OpenAPI v3.x is supported. Got: ${
        "swagger" in api ? (api as Record<string, string>).swagger : "unknown"
      }`
    );
  }

  const tools = buildTools(api.paths ?? {}, api.components);
  // Build models from the raw (non-dereferenced) components so $ref targets
  // like oneOf/anyOf remain as ReferenceObjects and we can extract names.
  const models = buildModels(raw.components);

  const serverName = (api.info.title ?? "mcp-server")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");

  const baseUrl =
    api.servers?.[0]?.url ?? "https://api.example.com";

  const requiresAuth =
    tools.some((t) => t.security && t.security.length > 0) ||
    Boolean(api.components?.securitySchemes &&
      Object.keys(api.components.securitySchemes).length > 0);

  return {
    serverName,
    serverVersion: api.info.version ?? "1.0.0",
    generatorVersion: "",
    tools,
    models,
    info: {
      title: api.info.title ?? "MCP Server",
      description: api.info.description ?? "",
      version: api.info.version ?? "1.0.0",
    },
    baseUrl,
    requiresAuth,
    securitySchemes: api.components?.securitySchemes,
  };
}
