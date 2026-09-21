import { execFileSync } from "child_process";
import fs from "fs";
import os from "os";
import path from "path";
import { buildWatchGeneratorOptions } from "../src/cli/watch-options";

const PETSTORE_JSON = path.resolve(__dirname, "../examples/petstore.json");
const CLI = path.resolve(__dirname, "../dist/cli/index.js");

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

  it("applies filters on watch --once", () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "mcp-watch-"));
    try {
      execFileSync(
        "node",
        [CLI, "watch", "-i", PETSTORE_JSON, "-o", tmp, "--once", "--operation-allowlist", "listPets"],
        { timeout: 90000, stdio: "pipe" }
      );
      const server = fs.readFileSync(path.join(tmp, "src/server.ts"), "utf-8");
      expect(server).toContain("@@mcp-gen:start:get_pets");
      expect(server).not.toContain("@@mcp-gen:start:post_pets");
      expect(server).not.toContain("@@mcp-gen:start:get_pets_petid");
    } finally {
      fs.rmSync(tmp, { recursive: true, force: true });
    }
  });
});
