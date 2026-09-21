import path from "path";
import fs from "fs";
import os from "os";
import { generate } from "../src/core/generator";

const PETSTORE_JSON = path.resolve(__dirname, "../examples/petstore.json");

describe("generate --dry-run summary (Fase 1.1 RED)", () => {
  let tmpDir: string;
  beforeEach(() => {
    tmpDir = path.join(os.tmpdir(), `mcp-dryrun-${Date.now()}-${Math.floor(Math.random() * 1e6)}`);
  });
  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it("lists files without writing anything", async () => {
    const result = await generate({
      input: PETSTORE_JSON,
      lang: "typescript",
      out: tmpDir,
      force: false,
      incremental: false,
      http: false,
      dryRun: true,
    });
    expect(result.success).toBe(true);
    expect(result.dryRun).toBe(true);
    expect(result.filesCreated.length).toBeGreaterThan(0);
    expect(fs.existsSync(tmpDir)).toBe(false);
  });

  it("exposes a machine-readable summary", async () => {
    const result = await generate({
      input: PETSTORE_JSON,
      lang: "typescript",
      out: tmpDir,
      force: false,
      incremental: false,
      http: false,
      dryRun: true,
    });
    expect(result.summary).toBeDefined();
    expect(result.summary).toMatchObject({
      tools: 4,
      models: 2,
      lang: "typescript",
    });
    expect(result.summary!.files).toEqual(result.filesCreated);
  });

  it("honors filters and grouping in the summary", async () => {
    const grouped = await generate({
      input: PETSTORE_JSON,
      lang: "typescript",
      out: tmpDir,
      force: false,
      incremental: false,
      http: false,
      dryRun: true,
      groupBy: "tag",
    });
    expect(grouped.success).toBe(true);
    expect(grouped.summary!.groups).toBe(1);
    expect(grouped.summary!.tools).toBe(1);

    const filtered = await generate({
      input: PETSTORE_JSON,
      lang: "typescript",
      out: tmpDir,
      force: false,
      incremental: false,
      http: false,
      dryRun: true,
      includeTags: ["no-such-tag"],
    });
    expect(filtered.success).toBe(true);
    expect(filtered.summary!.tools).toBe(0);
    expect(fs.existsSync(tmpDir)).toBe(false);
  });
});
