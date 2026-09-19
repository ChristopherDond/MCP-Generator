const assert = require("node:assert/strict");
const { execFileSync, spawnSync } = require("node:child_process");
const { mkdirSync, readFileSync, rmSync } = require("node:fs");
const path = require("node:path");
const { test } = require("node:test");
const { generate } = require("../dist/index.js");

const root = path.resolve(__dirname, "..");
const PYTHON = process.env.PYTHON || (process.platform === "win32" ? "python" : "python3");

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

function hasUv() {
  const found = spawnSync(process.platform === "win32" ? "uv.exe" : "uv", ["--version"], {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  });
  return found.status === 0;
}

function venvPython(out) {
  return process.platform === "win32"
    ? path.join(out, ".venv", "Scripts", "python.exe")
    : path.join(out, ".venv", "bin", "python");
}

test("generated Petstore compiles (py_compile) and serves initialize/tools/list over stdio", { timeout: 300000 }, async () => {
  const out = path.join(root, "scripts", `.tmp-py-${process.pid}-${Date.now()}`);
  mkdirSync(out, { recursive: true });
  let transport;
  let timer;
  try {
    const result = await generate({
      input: path.join(root, "examples/petstore.json"),
      lang: "python",
      out,
      force: false,
      incremental: false,
      http: false,
      plugins: [],
    });
    assert.equal(result.success, true, result.errors.join("\n"));

    const requirements = readFileSync(path.join(out, "requirements.txt"), "utf8");
    assert.match(requirements, /mcp\[cli\]/);
    const serverSrc = readFileSync(path.join(out, "server.py"), "utf8");
    assert.match(serverSrc, /FastMCP/);

    run(PYTHON, ["-m", "py_compile", "server.py", "models.py"], out, 60000);
    process.stdout.write("generated py_compile OK\n");

    const venvDir = path.join(out, ".venv");
    const vpy = venvPython(out);
    if (hasUv()) {
      run(process.platform === "win32" ? "uv.exe" : "uv", ["venv", venvDir], out, 60000);
      run(
        process.platform === "win32" ? "uv.exe" : "uv",
        ["pip", "install", "--python", vpy, "-r", "requirements.txt"],
        out,
        180000
      );
    } else {
      run(PYTHON, ["-m", "venv", venvDir], out, 60000);
      run(vpy, ["-m", "pip", "install", "-r", "requirements.txt"], out, 180000);
    }
    run(vpy, ["-c", "from mcp.server.fastmcp import FastMCP; print('FAST_MCP_OK')"], out, 30000);

    const { Client } = await import("@modelcontextprotocol/sdk/client/index.js");
    const { StdioClientTransport } = await import("@modelcontextprotocol/sdk/client/stdio.js");
    const client = new Client({ name: "generated-petstore-py-smoke", version: "1.0.0" }, { capabilities: {} });
    transport = new StdioClientTransport({
      command: vpy,
      args: [path.join(out, "server.py")],
      cwd: out,
      stderr: "pipe",
    });
    let stderr = "";
    transport.stderr.on("data", (chunk) => {
      stderr = (stderr + chunk.toString()).slice(-8192);
    });
    const smoke = async () => {
      await client.connect(transport, { timeout: 15000 });
      assert.equal(client.getServerVersion().name, "pet-store");
      assert.ok(client.getServerCapabilities().tools);
      const { tools } = await client.listTools(undefined, { timeout: 15000 });
      assert.deepEqual(tools.map((tool) => tool.name).sort(), [
        "delete_pets_petid",
        "get_pets",
        "get_pets_petid",
        "post_pets",
      ]);
      process.stdout.write("initialize OK; tools/list OK (4 tools); no tools/call requests\n");
    };
    try {
      await Promise.race([
        smoke(),
        new Promise((_, reject) => {
          timer = setTimeout(() => reject(new Error("stdio smoke exceeded 60000ms")), 60000);
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
