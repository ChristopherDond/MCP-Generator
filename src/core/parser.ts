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

export function shortHash(input: string): string {
  let hash = 5381;
  for (let i = 0; i < input.length; i++) {
    hash = ((hash << 5) + hash + input.charCodeAt(i)) >>> 0;
  }
  return hash.toString(16).padStart(8, "0").slice(0, 6);
}

export function sanitizeToolName(raw: string): string {
  let name = raw
    .replace(/([a-z0-9])([A-Z])/g, "$1_$2")
    .replace(/[^a-zA-Z0-9_]/g, "_")
    .replace(/_+/g, "_")
    .replace(/^_|_$/g, "")
    .toLowerCase();
  if (ALL_RESERVED.has(name) || name === "") name = `${name || "tool"}_handler`;
  return name;
}

export function resolveToolName(
  operationId: string | undefined,
  method: string,
  path: string,
  used: Set<string>
): string {
  void operationId;
  let base = `${method.toLowerCase()}_${path
    .replace(/\//g, "_")
    .replace(/[{}]/g, "")
    .replace(/[^a-zA-Z0-9_]/g, "")
    .replace(/^_/, "")
    .replace(/_+/g, "_")
    .toLowerCase()}`;
  base = base.replace(/-+$/g, "");
  if (ALL_RESERVED.has(base) || base === "") base = `${base || "tool"}_handler`;
  if (!used.has(base)) {
    used.add(base);
    return base;
  }
  const withMethod = `${base}_${method.toLowerCase()}`;
  if (!used.has(withMethod)) {
    used.add(withMethod);
    return withMethod;
  }
  const withHash = `${base}_${shortHash(`${method.toUpperCase()} ${path}`)}`;
  if (!used.has(withHash)) {
    used.add(withHash);
    return withHash;
  }
  let candidate = withHash;
  let i = 2;
  while (used.has(candidate)) {
    candidate = `${withHash}_${i}`;
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
        name: resolveToolName(operation.operationId, method, path, usedNames),
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
        operationId: operation.operationId,
      });
    }
  }

  return tools;
}

function buildModels(
  components: OpenAPIV3.ComponentsObject | undefined
): { models: MCPModel[]; warnings: string[] } {
  if (!components?.schemas) return { models: [], warnings: [] };

  const models: MCPModel[] = [];
  const warnings: string[] = [];

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
        if ("$ref" in sub) {
          warnings.push(
            `Schema "${name}": allOf $ref "${(sub as OpenAPIV3.ReferenceObject).$ref}" ignored — referenced properties are not merged (partial allOf support)`
          );
          continue;
        }
        Object.assign(merged.properties!, (sub as OpenAPIV3.SchemaObject).properties ?? {});
        merged.required = [
          ...(merged.required ?? []),
          ...((sub as OpenAPIV3.SchemaObject).required ?? []),
        ];
      }
      resolvedSchema = merged;
    }

    // Handle oneOf / anyOf by recording referenced component names
    // (inline variants have no $ref name to reference — flag them instead of dropping silently)
    if (schema.oneOf) {
      const inlineOneOf = schema.oneOf.filter(
        (s) => !("$ref" in s)
      ).length;
      if (inlineOneOf > 0) {
        warnings.push(
          `Schema "${name}": oneOf has ${inlineOneOf} inline variant(s) ignored — only $ref variants become union members`
        );
      }
    }
    if (schema.anyOf) {
      const inlineAnyOf = schema.anyOf.filter(
        (s) => !("$ref" in s)
      ).length;
      if (inlineAnyOf > 0) {
        warnings.push(
          `Schema "${name}": anyOf has ${inlineAnyOf} inline variant(s) ignored — only $ref variants become union members`
        );
      }
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

  return { models, warnings };
}

function rewriteV2Ref(ref: string): string {
  return ref
    .replace(/^#\/definitions\//, "#/components/schemas/")
    .replace(/^#\/parameters\//, "#/components/parameters/")
    .replace(/^#\/responses\//, "#/components/responses/");
}

function deepRewriteV2Refs(node: unknown): unknown {
  if (Array.isArray(node)) return node.map(deepRewriteV2Refs);
  if (node && typeof node === "object") {
    const rec = node as Record<string, unknown>;
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(rec)) {
      if (k === "$ref" && typeof v === "string") out[k] = rewriteV2Ref(v);
      else out[k] = deepRewriteV2Refs(v);
    }
    return out;
  }
  return node;
}

function v2ParamToV3Schema(p: Record<string, unknown>): Record<string, unknown> {
  const schema: Record<string, unknown> = {};
  for (const k of ["type", "format", "items", "enum", "default", "maximum", "minimum", "maxLength", "minLength", "pattern", "maxItems", "minItems", "uniqueItems", "multipleOf", "exclusiveMaximum", "exclusiveMinimum"]) {
    if (p[k] !== undefined) schema[k] = deepRewriteV2Refs(p[k]);
  }
  if (Object.keys(schema).length === 0) schema["type"] = "string";
  return schema;
}

/** Minimal Swagger 2.0 → OpenAPI 3.0.3 conversion (mantém o resto do pipeline intacto). */
export function convertSwagger2ToOpenApi3(swagger: Record<string, any>): OpenAPIV3.Document {
  const consumesGlobal: string[] = Array.isArray(swagger.consumes) ? swagger.consumes : [];
  const producesGlobal: string[] = Array.isArray(swagger.produces) ? swagger.produces : [];
  const defaultConsume = consumesGlobal[0] ?? "application/json";
  const defaultProduce = producesGlobal[0] ?? "application/json";

  const servers: OpenAPIV3.ServerObject[] = [];
  if (typeof swagger.host === "string" && swagger.host) {
    const scheme = Array.isArray(swagger.schemes) && swagger.schemes.length > 0 ? swagger.schemes[0] : "https";
    const basePath = typeof swagger.basePath === "string" ? swagger.basePath : "/";
    servers.push({ url: `${scheme}://${swagger.host}${basePath}` });
  } else if (Array.isArray(swagger.servers) && swagger.schemes) {
    for (const s of swagger.servers) servers.push(s);
  }

  const components: Record<string, any> = {};
  if (swagger.definitions) {
    components["schemas"] = deepRewriteV2Refs(swagger.definitions);
  }
  if (swagger.securityDefinitions) {
    const schemes: Record<string, any> = {};
    for (const [name, def] of Object.entries(swagger.securityDefinitions as Record<string, any>)) {
      if (def.type === "basic") schemes[name] = { type: "http", scheme: "basic" };
      else if (def.type === "apiKey") schemes[name] = { type: "apiKey", in: def.in, name: def.name };
      else if (def.type === "oauth2") {
        const flow = def.flow;
        const scopes = def.scopes ?? {};
        const flows: Record<string, any> = {};
        if (flow === "implicit") flows["implicit"] = { authorizationUrl: def.authorizationUrl ?? "", scopes };
        else if (flow === "password") flows["password"] = { tokenUrl: def.tokenUrl ?? "", scopes };
        else if (flow === "application") flows["clientCredentials"] = { tokenUrl: def.tokenUrl ?? "", scopes };
        else flows["authorizationCode"] = { authorizationUrl: def.authorizationUrl ?? "", tokenUrl: def.tokenUrl ?? "", scopes };
        schemes[name] = { type: "oauth2", flows };
      } else schemes[name] = deepRewriteV2Refs(def);
    }
    components["securitySchemes"] = schemes;
  }
  if (swagger.parameters) {
    const params: Record<string, any> = {};
    for (const [name, p] of Object.entries(swagger.parameters as Record<string, any>)) {
      const pp = p as Record<string, any>;
      if (pp.in === "body") {
        // Guarda como requestBody para referência futura; alias em parameters não é válido em v3,
        // mas o rewrite aponta #/parameters/ → #/components/parameters/, então mantemos um alias simples.
        params[name] = {
          name: pp.name ?? name,
          in: "query",
          required: Boolean(pp.required),
          schema: { type: "object" },
          description: pp.description ?? "",
        };
      } else {
        params[name] = {
          name: pp.name ?? name,
          in: pp.in ?? "query",
          description: pp.description ?? "",
          required: Boolean(pp.required),
          schema: v2ParamToV3Schema(pp),
        };
      }
    }
    components["parameters"] = params;
  }
  if (swagger.responses) {
    const resps: Record<string, any> = {};
    for (const [name, r] of Object.entries(swagger.responses as Record<string, any>)) {
      const rr = r as Record<string, any>;
      if (rr.schema) {
        resps[name] = {
          description: rr.description ?? "",
          content: { [defaultProduce]: { schema: deepRewriteV2Refs(rr.schema) } },
        };
      } else resps[name] = deepRewriteV2Refs(rr);
    }
    components["responses"] = resps;
  }

  const paths: Record<string, any> = {};
  for (const [p, pathItem] of Object.entries(swagger.paths ?? {})) {
    const outItem: Record<string, any> = {};
    for (const [method, rawOp] of Object.entries((pathItem as Record<string, any>) ?? {})) {
      if (!["get", "post", "put", "delete", "options", "head", "patch"].includes(method)) {
        outItem[method] = deepRewriteV2Refs(rawOp);
        continue;
      }
      const op = rawOp as Record<string, any>;
      const opConsumes: string[] = Array.isArray(op.consumes) ? op.consumes : consumesGlobal;
      const opProduces: string[] = Array.isArray(op.produces) ? op.produces : producesGlobal;
      const mimeConsume = opConsumes[0] ?? defaultConsume;
      const mimeProduce = opProduces[0] ?? defaultProduce;

      const outOp: Record<string, any> = { ...deepRewriteV2Refs(op) as Record<string, any> };
      const v2Params: any[] = Array.isArray(op.parameters) ? op.parameters : [];
      const newParams: any[] = [];
      let requestBody: Record<string, any> | undefined;
      const formParams: any[] = [];

      for (const rawP of v2Params) {
        const pp = rawP as Record<string, any>;
        if (pp.$ref) {
          newParams.push({ ...pp, $ref: rewriteV2Ref(pp.$ref as string) });
          continue;
        }
        if (pp.in === "body") {
          requestBody = {
            description: pp.description ?? "",
            required: Boolean(pp.required),
            content: { [mimeConsume]: { schema: deepRewriteV2Refs(pp.schema ?? {}) } },
          };
        } else if (pp.in === "formData") {
          formParams.push(pp);
        } else {
          newParams.push({
            name: pp.name,
            in: pp.in,
            description: pp.description ?? "",
            required: pp.in === "path" ? true : Boolean(pp.required),
            schema: v2ParamToV3Schema(pp),
          });
        }
      }
      if (formParams.length > 0) {
        const hasFile = formParams.some((f) => f.type === "file");
        const mime = hasFile ? "multipart/form-data" : "application/x-www-form-urlencoded";
        const props: Record<string, any> = {};
        const required: string[] = [];
        for (const f of formParams) {
          props[f.name] = f.type === "file" ? { type: "string", format: "binary" } : v2ParamToV3Schema(f);
          if (f.required) required.push(f.name);
        }
        requestBody = {
          content: { [mime]: { schema: { type: "object", properties: props, ...(required.length ? { required } : {}) } } },
        };
      }
      if (requestBody) outOp["requestBody"] = requestBody;
      outOp["parameters"] = newParams;

      const v2Responses: Record<string, any> = (op.responses ?? {}) as Record<string, any>;
      const newResponses: Record<string, any> = {};
      for (const [code, r] of Object.entries(v2Responses)) {
        const rr = (deepRewriteV2Refs(r) ?? {}) as Record<string, any>;
        if (rr.schema) {
          newResponses[code] = {
            description: rr.description ?? "",
            ...(rr.headers ? { headers: rr.headers } : {}),
            content: { [mimeProduce]: { schema: rr.schema } },
          };
        } else {
          newResponses[code] = { description: rr.description ?? "", ...rr };
          delete (newResponses[code] as Record<string, any>)["schema"];
        }
      }
      outOp["responses"] = newResponses;
      delete outOp["consumes"];
      delete outOp["produces"];
      outItem[method] = outOp;
    }
    paths[p] = outItem;
  }

  return {
    openapi: "3.0.3",
    info: swagger.info ?? { title: "mcp-server", version: "1.0.0" },
    servers: servers.length > 0 ? servers : [{ url: "https://api.example.com" }],
    paths,
    components: Object.keys(components).length > 0 ? (components as OpenAPIV3.ComponentsObject) : undefined,
    security: swagger.security,
    tags: swagger.tags,
    externalDocs: swagger.externalDocs,
  } as unknown as OpenAPIV3.Document;
}

export function isSwagger2Document(doc: unknown): boolean {
  const rec = doc as Record<string, unknown>;
  return !!rec && typeof rec["swagger"] === "string" && String(rec["swagger"]).startsWith("2");
}

export async function parseOpenAPI(inputPath: string): Promise<MCPServerAST> {
  let api: OpenAPIV3.Document;
  let raw: OpenAPIV3.Document;

  try {
    // parse returns the original document with $ref intact
    const parsed = (await SwaggerParser.parse(inputPath)) as unknown as Record<string, unknown>;

    if (isSwagger2Document(parsed)) {
      const converted = convertSwagger2ToOpenApi3(parsed as Record<string, any>);
      raw = converted;
      // dereference resolves $refs inline; circular:"ignore" prevents infinite loops
      // on self-referential schemas (e.g. TreeNode { children: TreeNode[] })
      api = (await SwaggerParser.dereference(JSON.parse(JSON.stringify(converted)) as any, {
        dereference: { circular: "ignore" },
      }) as unknown) as OpenAPIV3.Document;
    } else {
      raw = parsed as unknown as OpenAPIV3.Document;
      api = (await SwaggerParser.dereference(inputPath, {
        dereference: { circular: "ignore" },
      })) as OpenAPIV3.Document;
    }
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    throw new Error(`OpenAPI validation failed: ${message}`);
  }

  if (!("openapi" in api) || !api.openapi.startsWith("3")) {
    const rec = api as unknown as Record<string, unknown>;
    const got =
      "swagger" in api
        ? `swagger ${String(rec["swagger"] ?? "unknown")}`
        : "openapi" in api
          ? String(rec["openapi"] ?? "unknown")
          : "unknown";
    throw new Error(
      `Only OpenAPI v3.x and Swagger 2.0 are supported. Got: ${got}.`
    );
  }

  const tools = buildTools(api.paths ?? {}, api.components);
  // Build models from the raw (non-dereferenced) components so $ref targets
  // like oneOf/anyOf remain as ReferenceObjects and we can extract names.
  const { models, warnings } = buildModels(raw.components);

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
    warnings,
  };
}
