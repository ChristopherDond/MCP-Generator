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
