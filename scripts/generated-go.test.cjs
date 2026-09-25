const assert = require("node:assert/strict");
const { execFileSync } = require("node:child_process");
const { mkdtempSync, readFileSync, rmSync } = require("node:fs");
const { tmpdir } = require("node:os");
const path = require("node:path");
const { test } = require("node:test");
const { generate } = require("../dist/index.js");

const root = path.resolve(__dirname, "..");

function run(cmd, args, cwd, timeout) {
  try {
    const output = execFileSync(cmd, args, {
      cwd,
      timeout,
      shell: false,
      killSignal: "SIGKILL",
      encoding: "utf8",
      maxBuffer: 4 * 1024 * 1024,
      stdio: ["ignore", "pipe", "pipe"],
    });
    if (output) process.stdout.write(output);
  } catch (error) {
    throw new Error(
      `${cmd} ${args.join(" ")} failed\n${error.stdout || ""}\n${error.stderr || ""}`,
      { cause: error }
    );
  }
}

test("generated Petstore Go scaffolds and compiles (go build)", { timeout: 300000 }, async () => {
  const out = mkdtempSync(path.join(tmpdir(), "mcp-gen-go-compile-"));
  try {
    const result = await generate({
      input: path.join(root, "examples/petstore.json"),
      lang: "go",
      out,
      force: false,
      incremental: false,
      http: false,
      plugins: [],
    });
    assert.equal(result.success, true, result.errors.join("\n"));
    assert.ok(result.filesCreated.includes("main.go"));
    assert.ok(result.filesCreated.includes("go.mod"));

    const main = readFileSync(path.join(out, "main.go"), "utf8");
    assert.match(main, /@@mcp-gen:start:get_pets/);
    assert.match(main, /ServeStdio/);
    const gomod = readFileSync(path.join(out, "go.mod"), "utf8");
    assert.match(gomod, /mcp-go/);

    run("go", ["version"], out, 30000);
    run("go", ["mod", "tidy"], out, 180000);
    run("go", ["build", "./..."], out, 180000);
    process.stdout.write("generated go build OK\n");
  } finally {
    rmSync(out, { recursive: true, force: true, maxRetries: 3, retryDelay: 200 });
  }
});
