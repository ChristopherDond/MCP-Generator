import fs from "fs";
import os from "os";
import path from "path";
import { parseOpenAPI, convertSwagger2ToOpenApi3 } from "../src/core/parser";
import { generate, validateSpec } from "../src/core/generator";
import { fetchSpecToCwd, KNOWN_SPECS } from "../src/core/registry";

const V2_FIXTURE = path.resolve(__dirname, "../examples/swagger-v2-petstore.json");

describe("2.1 Swagger 2.0 support (Fase 2.1)", () => {
  it("converte body param em requestBody e definitions em schemas", () => {
    const raw = JSON.parse(fs.readFileSync(V2_FIXTURE, "utf-8"));
    const converted: any = convertSwagger2ToOpenApi3(raw);
    expect(converted.openapi).toMatch(/^3\.0\./);
    expect(converted.servers[0].url).toBe("https://petstore.example.com/v1");
    expect(converted.components.schemas["Pet"]).toBeDefined();
    expect(converted.paths["/pets"].post.requestBody).toBeDefined();
    expect(converted.paths["/pets"].post.requestBody.content["application/json"].schema).toEqual({
      $ref: "#/components/schemas/NewPet",
    });
    expect(converted.paths["/pets/{petId}"].get.parameters[0].schema).toMatchObject({ type: "integer" });
    expect(converted.components.securitySchemes["ApiKeyAuth"]).toMatchObject({ type: "apiKey" });
  });

  it("validate passa com fixture v2", async () => {
    const result = await validateSpec(V2_FIXTURE);
    expect(result.valid).toBe(true);
    expect(result.errors).toEqual([]);
    expect(result.tools).toBe(4);
    expect(result.models).toBe(2);
    expect(result.baseUrl).toBe("https://petstore.example.com/v1");
  });

  it("generate passa com fixture v2 (dry-run + real)", async () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "mcp-v2-"));
    try {
      const dry = await generate({
        input: V2_FIXTURE,
        lang: "typescript",
        out: path.join(tmp, "dry"),
        force: false,
        incremental: false,
        http: false,
        dryRun: true,
      });
      expect(dry.success).toBe(true);
      expect(dry.summary!.tools).toBe(4);

      const real = await generate({
        input: V2_FIXTURE,
        lang: "typescript",
        out: path.join(tmp, "real"),
        force: true,
        incremental: false,
        http: false,
      });
      expect(real.success).toBe(true);
      expect(real.errors).toEqual([]);
      const server = fs.readFileSync(path.join(tmp, "real", "src/server.ts"), "utf-8");
      expect(server).toContain("@@mcp-gen:start:get_pets");
    } finally {
      fs.rmSync(tmp, { recursive: true, force: true });
    }
  });

  it("registry tem as entradas v2 com URLs reais", () => {
    for (const key of ["slack", "kubernetes", "digitalocean"]) {
      expect(KNOWN_SPECS[key]).toBeDefined();
      expect(KNOWN_SPECS[key].url).toMatch(/^https:\/\//);
    }
  });

  it.each(["slack", "kubernetes", "digitalocean"])("init --from %s salva a spec (fetch mockado)", async (key) => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "mcp-v2-reg-"));
    const target = path.join(tmpDir, `${key}.json`);
    const v2Body = JSON.stringify({ swagger: "2.0", info: { title: key, version: "1.0.0" }, paths: {} });
    jest.spyOn(global, "fetch").mockResolvedValue({
      ok: true,
      headers: new Headers({ "content-type": "application/json", "content-length": String(v2Body.length) }),
      text: async () => v2Body,
    } as any);
    try {
      const saved = await fetchSpecToCwd(key, target);
      expect(saved).toBe(target);
      expect(JSON.parse(fs.readFileSync(target, "utf-8")).swagger).toBe("2.0");
      // E o arquivo baixado precisa passar no parse (conversão interna).
      const ast = await parseOpenAPI(target);
      expect(ast.tools).toEqual([]);
    } finally {
      jest.restoreAllMocks();
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  });
});

describe("non-JSON request bodies", () => {
  function writeDoc(dir: string, name: string, doc: unknown): string {
    const file = path.join(dir, name);
    fs.writeFileSync(file, JSON.stringify(doc));
    return file;
  }

  it("keeps body param for multipart/form-data", async () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "mcp-multipart-"));
    try {
      const spec = writeDoc(dir, "spec.json", {
        openapi: "3.0.3",
        info: { title: "Upload", version: "1.0.0" },
        servers: [{ url: "https://example.com" }],
        paths: {
          "/upload": {
            post: {
              summary: "Upload file",
              requestBody: {
                required: true,
                content: {
                  "multipart/form-data": {
                    schema: { type: "object", properties: { file: { type: "string", format: "binary" } } },
                  },
                },
              },
              responses: { "200": { description: "ok", content: { "application/json": { example: {} } } } },
            },
          },
        },
      });
      const ast = await parseOpenAPI(spec);
      const tool = ast.tools.find((t) => t.path === "/upload")!;
      expect(tool.params.some((p) => p.name === "body")).toBe(true);
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });

  it("keeps body param for swagger 2.0 formData", async () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "mcp-formdata-"));
    try {
      const spec = writeDoc(dir, "spec.json", {
        swagger: "2.0",
        info: { title: "Form", version: "1.0.0" },
        host: "example.com",
        basePath: "/v1",
        schemes: ["https"],
        paths: {
          "/upload": {
            post: {
              summary: "Upload",
              consumes: ["multipart/form-data"],
              produces: ["application/json"],
              parameters: [
                { name: "file", in: "formData", required: true, type: "file" },
                { name: "note", in: "formData", required: false, type: "string" },
              ],
              responses: { "200": { description: "ok", schema: { type: "object" } } },
            },
          },
        },
      });
      const ast = await parseOpenAPI(spec);
      const tool = ast.tools.find((t) => t.path === "/upload")!;
      expect(tool.params.some((p) => p.name === "body")).toBe(true);
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });

  it("reports swagger 2.0 fidelity warnings through parseOpenAPI", async () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "mcp-v2warn-"));
    try {
      const spec = writeDoc(dir, "spec.json", {
        swagger: "2.0",
        info: { title: "Warn", version: "1.0.0" },
        host: "example.com",
        basePath: "/v1",
        schemes: ["https"],
        paths: {
          "/items": {
            get: {
              summary: "List",
              parameters: [
                { name: "ids", in: "query", required: false, type: "array", items: { type: "string" }, collectionFormat: "ssv" },
                { name: "avatar", in: "query", required: false, type: "file" },
              ],
              responses: { "200": { description: "ok", schema: { type: "object" } } },
            },
          },
        },
      });
      const ast = await parseOpenAPI(spec);
      expect((ast.warnings ?? []).some((w) => w.includes("collectionFormat"))).toBe(true);
      expect((ast.warnings ?? []).some((w) => w.includes("file parameter"))).toBe(true);
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });

  it("extracts example from non-JSON response", async () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "mcp-resp-"));
    try {
      const spec = writeDoc(dir, "spec.json", {
        openapi: "3.0.3",
        info: { title: "Ping", version: "1.0.0" },
        servers: [{ url: "https://example.com" }],
        paths: {
          "/ping": {
            get: {
              summary: "Ping",
              responses: { "200": { description: "ok", content: { "text/plain": { example: "pong" } } } },
            },
          },
        },
      });
      const ast = await parseOpenAPI(spec);
      const tool = ast.tools.find((t) => t.path === "/ping")!;
      expect(tool.exampleResponse).toBe("pong");
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });
});
