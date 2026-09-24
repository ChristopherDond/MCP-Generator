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

  it("generates 11 files including a reproducible npm lockfile", async () => {
    const result = await generate({ input: PETSTORE_JSON, lang: "typescript", out: tmpDir, force: true, incremental: false, http: false });
    expect(result.success).toBe(true);
    expect(result.filesCreated).toHaveLength(11);
    expect(result.filesCreated).toContain("package-lock.json");
  });

  it("generates from YAML spec", async () => {
    const result = await generate({ input: PETSTORE_YAML, lang: "typescript", out: tmpDir, force: true, incremental: false, http: false });
    expect(result.success).toBe(true);
    expect(result.filesCreated).toHaveLength(11);
  });

  it("server.ts contains tool names", async () => {
    await generate({ input: PETSTORE_JSON, lang: "typescript", out: tmpDir, force: true, incremental: false, http: false });
    const content = fs.readFileSync(path.join(tmpDir, "src/server.ts"), "utf-8");
    expect(content).toContain("get_pets");
    expect(content).toContain("@@mcp-gen:start:get_pets");
    expect(content).toContain("@@mcp-gen:end:get_pets");
  });

  it("server.ts enforces scoped authContext and blocks raw credentials", async () => {
    await generate({ input: PETSTORE_JSON, lang: "typescript", out: tmpDir, force: true, incremental: false, http: false });
    const content = fs.readFileSync(path.join(tmpDir, "src/server.ts"), "utf-8");
    expect(content).toContain("function ensureNoRawCredentials");
    expect(content).toContain("authContext");
    expect(content).toContain("requiresSpendLimit: true");
    expect(content).toContain("requestId is required for audit logging");
  });

  it("fails on non-empty dir without --force", async () => {
    fs.writeFileSync(path.join(tmpDir, "existing.txt"), "block");
    const result = await generate({ input: PETSTORE_JSON, lang: "typescript", out: tmpDir, force: false, incremental: false, http: false });
    expect(result.success).toBe(false);
  });

  it("allows incremental regeneration into a non-empty dir", async () => {
    fs.writeFileSync(path.join(tmpDir, "existing.txt"), "block");
    const result = await generate({ input: PETSTORE_JSON, lang: "typescript", out: tmpDir, force: false, incremental: true, http: false });
    expect(result.success).toBe(true);
    expect(result.filesCreated.length).toBeGreaterThan(0);
  });
});

// ─── Generator — Python ───────────────────────────────────────────────────────

describe("generate (python)", () => {
  let tmpDir: string;
  beforeEach(() => { tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "mcp-py-")); });
  afterEach(() => { fs.rmSync(tmpDir, { recursive: true, force: true }); });

  it("generates 8 files", async () => {
    const result = await generate({ input: PETSTORE_JSON, lang: "python", out: tmpDir, force: true, incremental: false, http: false });
    expect(result.success).toBe(true);
    expect(result.filesCreated).toHaveLength(8);
  });

  it("server.py contains tool functions with markers", async () => {
    await generate({ input: PETSTORE_JSON, lang: "python", out: tmpDir, force: true, incremental: false, http: false });
    const content = fs.readFileSync(path.join(tmpDir, "server.py"), "utf-8");
    expect(content).toContain("@mcp.tool()");
    expect(content).toContain("async def get_pets");
    expect(content).toContain("@@mcp-gen:start:get_pets");
  });

  it("server.py enforces auth_context policy and blocks raw credentials", async () => {
    await generate({ input: PETSTORE_JSON, lang: "python", out: tmpDir, force: true, incremental: false, http: false });
    const content = fs.readFileSync(path.join(tmpDir, "server.py"), "utf-8");
    expect(content).toContain("def ensure_no_raw_credentials");
    expect(content).toContain("auth_context: Optional[dict] = None");
    expect(content).toContain("requires_spend_limit");
    expect(content).toContain("request_id is required for audit logging");
  });

  it("models.py contains Pydantic models", async () => {
    await generate({ input: PETSTORE_JSON, lang: "python", out: tmpDir, force: true, incremental: false, http: false });
    const content = fs.readFileSync(path.join(tmpDir, "models.py"), "utf-8");
    expect(content).toContain("class Pet(BaseModel)");
    expect(content).toContain("class NewPet(BaseModel)");
  });
});

// ─── Incremental Engine ───────────────────────────────────────────────────────

describe("incremental", () => {
  it.each([
    { lang: "typescript" as const, file: "src/server.ts", prefix: "//", code: '      const message = "preserved";\n      return { content: [{ type: "text", text: message }] };' },
    { lang: "python" as const, file: "server.py", prefix: "#", code: '    message = "preserved"\n    return [{"message": message}]' },
    { lang: "go" as const, file: "main.go", prefix: "//", code: '\t\tmessage := "preserved"\n\t\treturn mcp.NewToolResultText(message), nil' },
  ])("preserves customized $lang handlers through two real regenerations", async ({ lang, file, prefix, code }) => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "mcp-incremental-"));
    const clock = jest.spyOn(Date.prototype, "toISOString").mockReturnValue("2026-01-01T00:00:00.000Z");
    try {
      const options = { input: PETSTORE_JSON, lang, out: tmpDir, force: false, incremental: true, http: false };
      const initial = await generate(options);
      expect(initial.errors).toEqual([]);
      expect(initial.success).toBe(true);
      const serverFile = path.join(tmpDir, file);
      const original = fs.readFileSync(serverFile, "utf-8");
      const block = /^([\t ]*(?:\/\/|#) @@mcp-gen:start:get_pets\r?\n)[\s\S]*?^([\t ]*(?:\/\/|#) @@mcp-gen:end:get_pets\r?$)/m;
      const match = original.match(block);
      expect(match).not.toBeNull();
      const eol = match![1].endsWith("\r\n") ? "\r\n" : "\n";
      const customCode = code.replace(/\n/g, eol);
      const edited = original.replace(block, (_, start, end) => start + customCode + eol + end);
      expect(edited).not.toBe(original);
      fs.writeFileSync(serverFile, edited);

      for (let pass = 0; pass < 2; pass++) {
        const regenerated = await generate({ ...options, incremental: true });
        expect(regenerated.errors).toEqual([]);
        expect(regenerated.success).toBe(true);
        expect(regenerated.filesPreserved).toContain("get_pets");
        const content = fs.readFileSync(serverFile, "utf-8");
        expect(content).toBe(edited);
        expect(extractHandlers(serverFile).handlers.get("get_pets")).toBe(customCode);
        const markerLines = content.split(/\r?\n/).filter((line) => /@@mcp-gen:(start|end):/.test(line));
        expect(markerLines).toHaveLength(8);
        expect(markerLines.every((line) => line.trimStart().startsWith(`${prefix} @@mcp-gen:`))).toBe(true);
      }
    } finally {
      clock.mockRestore();
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  });

  it("lets force discard custom handlers when incremental is also enabled", async () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "mcp-force-"));
    const clock = jest.spyOn(Date.prototype, "toISOString").mockReturnValue("2026-01-01T00:00:00.000Z");
    try {
      const options = { input: PETSTORE_JSON, lang: "typescript" as const, out: tmpDir, force: true, incremental: false, http: false };
      const initial = await generate(options);
      expect(initial.success).toBe(true);

      const serverFile = path.join(tmpDir, "src/server.ts");
      const original = fs.readFileSync(serverFile, "utf-8");
      const block = /^([\t ]*\/\/ @@mcp-gen:start:get_pets\r?\n)[\s\S]*?^([\t ]*\/\/ @@mcp-gen:end:get_pets\r?$)/m;
      const match = original.match(block);
      expect(match).not.toBeNull();
      const eol = match![1].endsWith("\r\n") ? "\r\n" : "\n";
      const edited = original.replace(
        block,
        (_, start, end) => `${start}      throw new Error("custom_force_marker");${eol}${end}`
      );
      fs.writeFileSync(serverFile, edited);

      const regenerated = await generate({ ...options, incremental: true });
      expect(regenerated.success).toBe(true);
      expect(regenerated.filesPreserved).not.toContain("get_pets");
      expect(fs.readFileSync(serverFile, "utf-8")).not.toContain("custom_force_marker");
    } finally {
      clock.mockRestore();
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  });

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
