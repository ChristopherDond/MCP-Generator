import fs from "fs";
import os from "os";
import path from "path";
import { buildWatchGeneratorOptions } from "../src/cli/watch-options";
import { generate } from "../src/core/generator";

const PETSTORE_JSON = path.resolve(__dirname, "../examples/petstore.json");

describe("watch filter passthrough (Fase 1.2)", () => {
  it("repasses filter/group flags into generator options", () => {
    const opts = buildWatchGeneratorOptions("/spec/petstore.json", "/out/dir", {
      lang: "typescript",
      includeTags: "pets",
      excludeTags: "admin",
      pathPrefix: "/pets/**",
      includePaths: "/pets/**",
      excludePaths: "/internal/*",
      operationAllowlist: "listPets",
      groupBy: "tag",
      http: true,
    });
    expect(opts).toMatchObject({
      input: "/spec/petstore.json",
      lang: "typescript",
      includeTags: ["pets"],
      excludeTags: ["admin"],
      pathPrefix: "/pets/**",
      includePaths: ["/pets/**"],
      excludePaths: ["/internal/*"],
      groupBy: "tag",
      http: true,
      incremental: true,
    });
  });

  it("applies filters on the watch --once path", async () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "mcp-watch-"));
    try {
      // Same composition the `watch` command runs: CLI flags -> helper -> generate.
      // (No dist/ spawn: CI runs tests before build, and dist/ is gitignored.)
      const options = buildWatchGeneratorOptions(PETSTORE_JSON, tmp, {
        lang: "typescript",
        operationAllowlist: "listPets",
      });
      const result = await generate(options);
      expect(result.success).toBe(true);
      const server = fs.readFileSync(path.join(tmp, "src/server.ts"), "utf-8");
      expect(server).toContain("@@mcp-gen:start:get_pets");
      expect(server).not.toContain("@@mcp-gen:start:post_pets");
      expect(server).not.toContain("@@mcp-gen:start:get_pets_petid");
    } finally {
      fs.rmSync(tmp, { recursive: true, force: true });
    }
  });
});
