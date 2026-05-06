import path from "path";
import fs from "fs";
import os from "os";
import { parseOpenAPI } from "../src/core/parser";
import { generate } from "../src/core/generator";
import { extractHandlers, injectHandlers, TS_DEFAULT_STUB_PATTERN } from "../src/core/incremental";

const PETSTORE_JSON = path.resolve(__dirname, "../examples/petstore.json");
const PETSTORE_YAML = path.resolve(__dirname, "../examples/petstore.yaml");

// ─── Parser ──────────────────────────────────────────────────────────────────

describe("parseOpenAPI", () => {
  it("parses JSON spec", async () => {
    const ast = await parseOpenAPI(PETSTORE_JSON);
    expect(ast.tools).toHaveLength(4);
    expect(ast.models).toHaveLength(2);
  });

  it("parses YAML spec and produces identical AST", async () => {
    const json = await parseOpenAPI(PETSTORE_JSON);
    const yaml = await parseOpenAPI(PETSTORE_YAML);
    expect(yaml.tools).toHaveLength(json.tools.length);
    expect(yaml.models).toHaveLength(json.models.length);
    expect(yaml.serverName).toBe(json.serverName);
  });

  it("marks path params as required", async () => {
    const ast = await parseOpenAPI(PETSTORE_JSON);
    const tool = ast.tools.find((t) => t.name === "get_pets_petid")!;
    expect(tool.params.find((p) => p.name === "petId")!.required).toBe(true);
  });

  it("marks query params as optional", async () => {
    const ast = await parseOpenAPI(PETSTORE_JSON);
    const tool = ast.tools.find((t) => t.name === "get_pets")!;
    expect(tool.params.find((p) => p.name === "limit")!.required).toBe(false);
  });

  it("maps integer type to number", async () => {
    const ast = await parseOpenAPI(PETSTORE_JSON);
    const pet = ast.models.find((m) => m.name === "Pet")!;
    expect(pet.properties.find((p) => p.name === "id")!.type).toBe("number");
  });

  it("rejects invalid specs", async () => {
    await expect(parseOpenAPI("/nonexistent/spec.json")).rejects.toThrow();
  });
});

// ─── Generator — TypeScript ───────────────────────────────────────────────────

describe("generate (typescript)", () => {
  let tmpDir: string;
  beforeEach(() => { tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "mcp-ts-")); });
  afterEach(() => { fs.rmSync(tmpDir, { recursive: true, force: true }); });

  it("generates 8 files", async () => {
    const result = await generate({ input: PETSTORE_JSON, lang: "typescript", out: tmpDir, force: true, incremental: false });
    expect(result.success).toBe(true);
    expect(result.filesCreated).toHaveLength(8);
  });

  it("generates from YAML spec", async () => {
    const result = await generate({ input: PETSTORE_YAML, lang: "typescript", out: tmpDir, force: true, incremental: false });
    expect(result.success).toBe(true);
    expect(result.filesCreated).toHaveLength(8);
  });

  it("server.ts contains tool names", async () => {
    await generate({ input: PETSTORE_JSON, lang: "typescript", out: tmpDir, force: true, incremental: false });
    const content = fs.readFileSync(path.join(tmpDir, "src/server.ts"), "utf-8");
    expect(content).toContain("get_pets");
    expect(content).toContain("@@mcp-gen:start:get_pets");
    expect(content).toContain("@@mcp-gen:end:get_pets");
  });

  it("fails on non-empty dir without --force", async () => {
    fs.writeFileSync(path.join(tmpDir, "existing.txt"), "block");
    const result = await generate({ input: PETSTORE_JSON, lang: "typescript", out: tmpDir, force: false, incremental: false });
    expect(result.success).toBe(false);
  });
});

// ─── Generator — Python ───────────────────────────────────────────────────────

describe("generate (python)", () => {
  let tmpDir: string;
  beforeEach(() => { tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "mcp-py-")); });
  afterEach(() => { fs.rmSync(tmpDir, { recursive: true, force: true }); });

  it("generates 6 files", async () => {
    const result = await generate({ input: PETSTORE_JSON, lang: "python", out: tmpDir, force: true, incremental: false });
    expect(result.success).toBe(true);
    expect(result.filesCreated).toHaveLength(6);
  });

  it("server.py contains tool functions with markers", async () => {
    await generate({ input: PETSTORE_JSON, lang: "python", out: tmpDir, force: true, incremental: false });
    const content = fs.readFileSync(path.join(tmpDir, "server.py"), "utf-8");
    expect(content).toContain("@mcp.tool()");
    expect(content).toContain("async def get_pets");
    expect(content).toContain("@@mcp-gen:start:get_pets");
  });

  it("models.py contains Pydantic models", async () => {
    await generate({ input: PETSTORE_JSON, lang: "python", out: tmpDir, force: true, incremental: false });
    const content = fs.readFileSync(path.join(tmpDir, "models.py"), "utf-8");
    expect(content).toContain("class Pet(BaseModel)");
    expect(content).toContain("class NewPet(BaseModel)");
  });
});

// ─── Incremental Engine ───────────────────────────────────────────────────────

describe("incremental", () => {
  it("extracts handlers from marked file", () => {
    const content = `
// @@mcp-gen:start:get_pets
const data = await fetch("/pets");
return { content: [{ type: "text", text: await data.text() }] };
// @@mcp-gen:end:get_pets
`;
    const tmpFile = path.join(os.tmpdir(), "server_test.ts");
    fs.writeFileSync(tmpFile, content);
    const { handlers } = extractHandlers(tmpFile);
    expect(handlers.has("get_pets")).toBe(true);
    expect(handlers.get("get_pets")).toContain("fetch");
    fs.unlinkSync(tmpFile);
  });

  it("returns empty map for non-existent file", () => {
    const { handlers } = extractHandlers("/nonexistent/server.ts");
    expect(handlers.size).toBe(0);
  });

  it("injects custom handler into re-generated content", () => {
    const rendered = `
switch (name) {
  case "get_pets": {
    // @@mcp-gen:start:get_pets
    return { content: [{ type: "text", text: "[]" }] };
    // @@mcp-gen:end:get_pets
  }
}`;
    const extracted = {
      handlers: new Map([["get_pets", '    const r = await fetch("/pets");\n    return { content: [{ type: "text", text: await r.text() }] };']]),
    };
    const { result, preserved } = injectHandlers(rendered, extracted, TS_DEFAULT_STUB_PATTERN);
    expect(result).toContain('fetch("/pets")');
    expect(preserved).toContain("get_pets");
  });

  it("does not inject default stub (not customized)", () => {
    const rendered = `
// @@mcp-gen:start:delete_pet
throw new McpError(ErrorCode.InternalError, "Handler not implemented: delete_pet");
// @@mcp-gen:end:delete_pet
`;
    const extracted = {
      handlers: new Map([["delete_pet", 'throw new McpError(ErrorCode.InternalError, "Handler not implemented: delete_pet");']]),
    };
    const { preserved } = injectHandlers(rendered, extracted, TS_DEFAULT_STUB_PATTERN);
    expect(preserved).not.toContain("delete_pet");
  });
});
