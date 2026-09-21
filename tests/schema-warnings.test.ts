import path from "path";
import fs from "fs";
import os from "os";
import { parseOpenAPI } from "../src/core/parser";
import { generate, validateSpec } from "../src/core/generator";

function writePartialSpec(): string {
  const spec = {
    openapi: "3.0.3",
    info: { title: "Partial", version: "1.0.0" },
    servers: [{ url: "https://example.com" }],
    paths: {
      "/things": {
        get: {
          operationId: "listThings",
          responses: {
            "200": {
              description: "ok",
              content: {
                "application/json": {
                  schema: { type: "array", items: { $ref: "#/components/schemas/Base" } },
                  example: [],
                },
              },
            },
          },
        },
      },
    },
    components: {
      schemas: {
        Base: {
          type: "object",
          properties: { id: { type: "integer" } },
        },
        Extended: {
          allOf: [
            { $ref: "#/components/schemas/Base" },
            { type: "object", properties: { extra: { type: "string" } } },
          ],
        },
        Choice: {
          oneOf: [
            { $ref: "#/components/schemas/Base" },
            { type: "object", properties: { inline: { type: "string" } } },
          ],
        },
      },
    },
  };
  const file = path.join(os.tmpdir(), `mcp-partial-${Date.now()}-${Math.floor(Math.random() * 1e6)}.json`);
  fs.writeFileSync(file, JSON.stringify(spec), "utf-8");
  return file;
}

describe("partial schema support warnings (Fase 1.3)", () => {
  let specFile: string;
  beforeEach(() => {
    specFile = writePartialSpec();
  });
  afterEach(() => {
    fs.rmSync(specFile, { force: true });
  });

  it("parseOpenAPI reports Extended (allOf $ref) and Choice (oneOf inline)", async () => {
    const ast = await parseOpenAPI(specFile);
    expect(ast.warnings!.join("\n")).toMatch(/Extended/);
    expect(ast.warnings!.join("\n")).toMatch(/Choice/);
  });

  it("validate and generate (dry-run) surface the same warnings", async () => {
    const validation = await validateSpec(specFile);
    expect(validation.valid).toBe(true);
    expect(validation.warnings.join("\n")).toMatch(/Extended/);
    expect(validation.warnings.join("\n")).toMatch(/Choice/);

    const tmp = path.join(os.tmpdir(), `mcp-partial-out-${Date.now()}`);
    const gen = await generate({
      input: specFile,
      lang: "typescript",
      out: tmp,
      force: true,
      incremental: false,
      http: false,
      dryRun: true,
    });
    expect(gen.success).toBe(true);
    expect(gen.warnings.join("\n")).toMatch(/Extended/);
    expect(gen.warnings.join("\n")).toMatch(/Choice/);
  });
});
