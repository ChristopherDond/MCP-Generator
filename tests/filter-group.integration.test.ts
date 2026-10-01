import fs from "fs";
import os from "os";
import path from "path";
import { generate } from "../src/core/generator";

function writeSpec(dir: string): string {
  const spec = {
    openapi: "3.0.3",
    info: { title: "Two tags", version: "1.0.0" },
    servers: [{ url: "https://example.com" }],
    paths: {
      "/pets": {
        get: {
          summary: "List pets",
          tags: ["pets"],
          responses: { "200": { description: "ok", content: { "application/json": { example: [] } } } },
        },
        post: {
          summary: "Create pet",
          tags: ["pets"],
          responses: { "200": { description: "ok", content: { "application/json": { example: {} } } } },
        },
      },
      "/orders": {
        get: {
          summary: "List orders",
          tags: ["orders"],
          responses: { "200": { description: "ok", content: { "application/json": { example: [] } } } },
        },
      },
    },
  };
  const file = path.join(dir, "spec.json");
  fs.writeFileSync(file, JSON.stringify(spec));
  return file;
}

describe("generation filters", () => {
  let dir: string;
  let spec: string;
  beforeEach(() => {
    dir = fs.mkdtempSync(path.join(os.tmpdir(), "mcp-filter-"));
    spec = writeSpec(dir);
  });
  afterEach(() => { fs.rmSync(dir, { recursive: true, force: true }); });

  it("generates all tools without filters", async () => {
    const out = path.join(dir, "out");
    const result = await generate({ input: spec, lang: "typescript", out, force: true, incremental: false, http: false });
    expect(result.success).toBe(true);
    const server = fs.readFileSync(path.join(out, "src/server.ts"), "utf-8");
    expect(server).toContain("get_pets");
    expect(server).toContain("post_pets");
    expect(server).toContain("get_orders");
  });

  it("includes only requested tag", async () => {
    const out = path.join(dir, "out");
    await generate({ input: spec, lang: "typescript", out, force: true, incremental: false, http: false, includeTags: ["pets"] });
    const server = fs.readFileSync(path.join(out, "src/server.ts"), "utf-8");
    expect(server).toContain("get_pets");
    expect(server).toContain("post_pets");
    expect(server).not.toContain("get_orders");
  });

  it("excludes requested tag", async () => {
    const out = path.join(dir, "out");
    await generate({ input: spec, lang: "typescript", out, force: true, incremental: false, http: false, excludeTags: ["orders"] });
    const server = fs.readFileSync(path.join(out, "src/server.ts"), "utf-8");
    expect(server).toContain("get_pets");
    expect(server).not.toContain("get_orders");
  });

  it("filters by path prefix", async () => {
    const out = path.join(dir, "out");
    await generate({ input: spec, lang: "typescript", out, force: true, incremental: false, http: false, pathPrefix: "/orders" });
    const server = fs.readFileSync(path.join(out, "src/server.ts"), "utf-8");
    expect(server).not.toContain("get_pets");
    expect(server).toContain("get_orders");
  });

  it("filters by operation allowlist", async () => {
    const out = path.join(dir, "out");
    await generate({ input: spec, lang: "typescript", out, force: true, incremental: false, http: false, operationAllowlist: ["get_orders"] });
    const server = fs.readFileSync(path.join(out, "src/server.ts"), "utf-8");
    expect(server).not.toContain("get_pets");
    expect(server).toContain("get_orders");
  });

  it("filters by operation allowlist file", async () => {
    const allow = path.join(dir, "allow.json");
    fs.writeFileSync(allow, JSON.stringify(["get_pets"]));
    const out = path.join(dir, "out");
    await generate({ input: spec, lang: "typescript", out, force: true, incremental: false, http: false, operationAllowlistFile: allow });
    const server = fs.readFileSync(path.join(out, "src/server.ts"), "utf-8");
    expect(server).toContain("get_pets");
    expect(server).not.toContain("get_orders");
  });

  it("fails on invalid group mode", async () => {
    const out = path.join(dir, "out");
    const result = await generate({ input: spec, lang: "typescript", out, force: true, incremental: false, http: false, groupBy: "nope" as never });
    expect(result.success).toBe(false);
    expect(result.errors.join(" ")).toMatch(/Invalid --group-by/);
  });

  it("fails on missing allowlist file", async () => {
    const out = path.join(dir, "out");
    const result = await generate({ input: spec, lang: "typescript", out, force: true, incremental: false, http: false, operationAllowlistFile: path.join(dir, "missing.txt") });
    expect(result.success).toBe(false);
    expect(result.errors.join(" ")).toMatch(/Allowlist file not found/);
  });
});

describe("generation grouping", () => {
  let dir: string;
  let spec: string;
  beforeEach(() => {
    dir = fs.mkdtempSync(path.join(os.tmpdir(), "mcp-group-"));
    spec = writeSpec(dir);
  });
  afterEach(() => { fs.rmSync(dir, { recursive: true, force: true }); });

  it("filters one tag and groups the other", async () => {
    const out = path.join(dir, "out");
    const result = await generate({
      input: spec,
      lang: "typescript",
      out,
      force: true,
      incremental: false,
      http: false,
      includeTags: ["pets"],
      groupBy: "tag",
    });
    expect(result.success).toBe(true);
    const server = fs.readFileSync(path.join(out, "src/server.ts"), "utf-8");
    expect(server).toContain("pets_group");
    expect(server).toContain("@@mcp-gen:start:pets_group");
    expect(server).toContain("@@mcp-gen:end:pets_group");
    expect(server).toContain('case "get_pets"');
    expect(server).toContain('case "post_pets"');
    expect(server).not.toContain("get_orders");
  });

  it("groups by path prefix with switch delegation", async () => {
    const out = path.join(dir, "out");
    await generate({ input: spec, lang: "typescript", out, force: true, incremental: false, http: false, groupBy: "path-prefix" });
    const server = fs.readFileSync(path.join(out, "src/server.ts"), "utf-8");
    expect(server).toContain("pets_group");
    expect(server).toContain("orders_group");
    expect(server).toContain("switch (__action)");
    expect(server).toContain("Unknown action");
  });

  it("preserves custom grouped handlers on incremental regen", async () => {
    const out = path.join(dir, "out");
    const options = { input: spec, lang: "typescript" as const, out, force: false, incremental: true, http: false, includeTags: ["pets"], groupBy: "tag" as const };
    await generate(options);
    const serverFile = path.join(out, "src/server.ts");
    const original = fs.readFileSync(serverFile, "utf-8");
    const markerStart = "// @@mcp-gen:start:pets_group";
    const markerEnd = "// @@mcp-gen:end:pets_group";
    expect(original).toContain(markerStart);
    expect(original).toContain(markerEnd);
    const edited = original.replace(
      new RegExp(`${markerStart.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}[\\s\\S]*?${markerEnd.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}`),
      `${markerStart}\n      const preserved = "group-custom";\n      return { content: [{ type: "text", text: preserved }] };\n      ${markerEnd}`
    );
    fs.writeFileSync(serverFile, edited);
    const regen = await generate({ ...options });
    expect(regen.success).toBe(true);
    expect(regen.filesPreserved).toContain("pets_group");
    expect(fs.readFileSync(serverFile, "utf-8")).toContain("group-custom");
  });

  it("keeps markers balanced in grouped output", async () => {
    const out = path.join(dir, "out");
    await generate({ input: spec, lang: "typescript", out, force: true, incremental: false, http: false, groupBy: "tag" });
    const server = fs.readFileSync(path.join(out, "src/server.ts"), "utf-8");
    const starts = server.match(/@@mcp-gen:start:/g) ?? [];
    const ends = server.match(/@@mcp-gen:end:/g) ?? [];
    expect(starts.length).toBe(ends.length);
    expect(starts.length).toBe(2);
  });

  it("exposes action enum for grouped tools", async () => {
    const out = path.join(dir, "out");
    await generate({ input: spec, lang: "typescript", out, force: true, incremental: false, http: false, groupBy: "tag" });
    const server = fs.readFileSync(path.join(out, "src/server.ts"), "utf-8");
    expect(server).toContain("get_pets");
    expect(server).toContain("post_pets");
    expect(server).toContain("action");
  });
});
