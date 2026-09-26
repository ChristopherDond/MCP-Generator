import fs from "fs";
import os from "os";
import path from "path";
import { generate } from "../src/core/generator";

function writeSpec(dir: string): string {
  const spec = {
    openapi: "3.0.3",
    info: { title: "Env test", version: "1.0.0" },
    servers: [{ url: "https://example.com" }],
    paths: {
      "/pets": {
        get: {
          summary: "List pets",
          operationId: "listPets",
          responses: { "200": { description: "ok" } },
        },
      },
    },
  };
  const file = path.join(dir, "spec.json");
  fs.writeFileSync(file, JSON.stringify(spec));
  return file;
}

describe("env-file validation", () => {
  let dir: string;
  let spec: string;
  beforeEach(() => {
    dir = fs.mkdtempSync(path.join(os.tmpdir(), "mcp-env-"));
    spec = writeSpec(dir);
  });
  afterEach(() => { fs.rmSync(dir, { recursive: true, force: true }); });

  it("fails with explicit error when env-file does not exist", async () => {
    const out = path.join(dir, "out");
    const missing = path.join(dir, "missing.env");
    const result = await generate({
      input: spec,
      lang: "typescript",
      out,
      force: true,
      incremental: false,
      http: false,
      envFile: missing,
    });
    expect(result.success).toBe(false);
    expect(result.errors.join(" ")).toMatch(/env-file|Env file/i);
  });

  it("loads env-file when it exists", async () => {
    const out = path.join(dir, "out");
    const envFile = path.join(dir, ".env");
    fs.writeFileSync(envFile, "TOKEN=abc123\n");
    const result = await generate({
      input: spec,
      lang: "typescript",
      out,
      force: true,
      incremental: false,
      http: false,
      envFile,
    });
    expect(result.success).toBe(true);
  });
});
