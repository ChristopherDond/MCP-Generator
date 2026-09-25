const assert = require("node:assert/strict");
const { spawnSync } = require("node:child_process");
const { mkdtempSync, rmSync, writeFileSync } = require("node:fs");
const { tmpdir } = require("node:os");
const path = require("node:path");
const { test } = require("node:test");

const root = path.resolve(__dirname, "..");
const cli = path.join(root, "dist/cli/index.js");

function runWatch(input, out) {
  return spawnSync(
    process.execPath,
    [cli, "watch", "--input", input, "--out", out, "--lang", "typescript", "--once"],
    {
      cwd: root,
      encoding: "utf8",
      shell: false,
      timeout: 30000,
    }
  );
}

test("watch --once exits with failure when generation fails", { timeout: 40000 }, () => {
  const dir = mkdtempSync(path.join(tmpdir(), "mcp-cli-watch-"));
  const input = path.join(dir, "invalid.json");
  const out = path.join(dir, "output");
  writeFileSync(input, "{ invalid json", "utf8");

  try {
    const result = runWatch(input, out);
    assert.equal(result.error, undefined);
    assert.equal(
      result.status,
      1,
      `expected status 1\nstdout:\n${result.stdout}\nstderr:\n${result.stderr}`
    );
    assert.match(`${result.stdout}\n${result.stderr}`, /Generation failed/);
  } finally {
    rmSync(dir, { recursive: true, force: true, maxRetries: 3, retryDelay: 100 });
  }
});

test("watch --once exits with failure when URL fetch fails", { timeout: 40000 }, () => {
  const dir = mkdtempSync(path.join(tmpdir(), "mcp-cli-watch-url-"));
  const out = path.join(dir, "output");
  const input = "http://127.0.0.1:9/spec.json";

  try {
    const result = runWatch(input, out);
    assert.equal(result.error, undefined);
    assert.equal(
      result.status,
      1,
      `expected status 1\nstdout:\n${result.stdout}\nstderr:\n${result.stderr}`
    );
  } finally {
    rmSync(dir, { recursive: true, force: true, maxRetries: 3, retryDelay: 100 });
  }
});

test("watch --once exits successfully after generating a valid spec", { timeout: 40000 }, () => {
  const out = mkdtempSync(path.join(tmpdir(), "mcp-cli-watch-out-"));

  try {
    const result = runWatch(path.join(root, "examples/petstore.json"), out);
    assert.equal(result.error, undefined);
    assert.equal(
      result.status,
      0,
      `expected status 0\nstdout:\n${result.stdout}\nstderr:\n${result.stderr}`
    );
    assert.match(result.stdout, /generated 11 files/);
  } finally {
    rmSync(out, { recursive: true, force: true, maxRetries: 3, retryDelay: 100 });
  }
});
