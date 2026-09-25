const assert = require("node:assert/strict");
const { execFileSync } = require("node:child_process");
const { mkdtempSync, readFileSync, rmSync } = require("node:fs");
const { createRequire } = require("node:module");
const { tmpdir } = require("node:os");
const path = require("node:path");
const { test } = require("node:test");
const { pathToFileURL } = require("node:url");
const { generate } = require("../dist/index.js");

const root = path.resolve(__dirname, "..");

function runNode(args, cwd, timeout) {
  try {
    const output = execFileSync(process.execPath, args, {
      cwd,
      timeout,
      shell: false,
      killSignal: "SIGKILL",
      encoding: "utf8",
      maxBuffer: 2 * 1024 * 1024,
      stdio: ["ignore", "pipe", "pipe"],
    });
    process.stdout.write(output);
  } catch (error) {
    throw new Error(`node ${args.join(" ")} failed\n${error.stdout || ""}\n${error.stderr || ""}`, { cause: error });
  }
}

function runNpm(args, cwd, timeout) {
  assert.ok(process.env.npm_execpath, "Run this test with npm run test:generated");
  runNode([process.env.npm_execpath, ...args], cwd, timeout);
}

test("generated Petstore installs, compiles and serves initialize/tools/list over stdio", { timeout: 300000 }, async () => {
  const out = mkdtempSync(path.join(tmpdir(), "mcp-gen-ts-compile-"));
  let transport;
  let timer;
  try {
    const result = await generate({
      input: path.join(root, "examples/petstore.json"),
      lang: "typescript",
      out,
      force: false,
      incremental: false,
      http: false,
      plugins: [],
    });
    assert.equal(result.success, true, result.errors.join("\n"));
    runNpm(["ci", "--ignore-scripts", "--no-audit", "--no-fund", "--include=dev"], out, 180000);
    runNpm(["ls", "@modelcontextprotocol/sdk", "typescript"], out, 15000);
    const generatedRequire = createRequire(path.join(out, "package.json"));
    const generatedPackage = JSON.parse(readFileSync(path.join(out, "package.json"), "utf8"));
    assert.equal(generatedPackage.scripts.build, "tsc");
    runNode([generatedRequire.resolve("typescript/bin/tsc")], out, 60000);
    process.stdout.write("generated build OK (local tsc, unchanged tsconfig)\n");
    assert.ok(readFileSync(path.join(out, "dist/server.js"), "utf8").includes("StdioServerTransport"));

    const { Client } = await import(pathToFileURL(generatedRequire.resolve("@modelcontextprotocol/sdk/client/index.js")).href);
    const { StdioClientTransport } = await import(pathToFileURL(generatedRequire.resolve("@modelcontextprotocol/sdk/client/stdio.js")).href);
    const client = new Client({ name: "generated-petstore-smoke", version: "1.0.0" }, { capabilities: {} });
    const errors = [];
    client.onerror = (error) => errors.push(error.message);
    transport = new StdioClientTransport({
      command: process.execPath,
      args: [path.join(out, "dist/server.js")],
      cwd: out,
      stderr: "pipe",
    });
    let stderr = "";
    transport.stderr.on("data", (chunk) => {
      stderr = (stderr + chunk.toString()).slice(-8192);
    });
    const smoke = async () => {
      await client.connect(transport, { timeout: 10000 });
      assert.deepEqual(client.getServerVersion(), { name: "pet-store", version: "1.0.0" });
      assert.ok(client.getServerCapabilities().tools);
      const { tools } = await client.listTools(undefined, { timeout: 10000 });
      assert.deepEqual(tools.map((tool) => tool.name).sort(), [
        "delete_pets_petid",
        "get_pets",
        "get_pets_petid",
        "post_pets",
      ]);
      for (const tool of tools) {
        assert.equal(tool.inputSchema.type, "object");
      }
      assert.deepEqual(errors, []);
      process.stdout.write("initialize OK; tools/list OK (4 tools); no tools/call requests\n");
    };
    try {
      await Promise.race([
        smoke(),
        new Promise((_, reject) => {
          timer = setTimeout(() => reject(new Error("stdio smoke exceeded 25000ms")), 25000);
        }),
      ]);
    } catch (error) {
      throw new Error(`stdio smoke failed: ${error.message}\n${stderr}`, { cause: error });
    }
  } finally {
    clearTimeout(timer);
    try {
      await transport?.close();
    } finally {
      rmSync(out, { recursive: true, force: true, maxRetries: 3, retryDelay: 200 });
    }
  }
});
