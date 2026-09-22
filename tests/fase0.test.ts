import fs from "fs";
import os from "os";
import path from "path";
import { execFile } from "child_process";
import { createServer } from "http";
import { AddressInfo } from "net";
import { pathToFileURL } from "url";
import { promisify } from "util";
import ts from "typescript";
import { generate } from "../src/core/generator";
import { parseOpenAPI } from "../src/core/parser";
import { fetchSpecToCwd, KNOWN_SPECS, listKnownSpecs } from "../src/core/registry";

const execFileAsync = promisify(execFile);
const PETSTORE = path.resolve(__dirname, "../examples/petstore.json");

describe("0.1 query params", () => {
  it("typescript client serializes query string", async () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "mcp-fase0-ts-"));
    try {
      const res = await generate({ input: PETSTORE, lang: "typescript", out: tmp, force: true, incremental: false, http: true });
      expect(res.errors).toEqual([]);
      const client = fs.readFileSync(path.join(tmp, "src/client.ts"), "utf-8");
      expect(client).toContain("queryNames");
      expect(client).toContain("URLSearchParams");
      expect(client).toContain("get_pets");
      expect(client).toContain('"limit"');
    } finally {
      fs.rmSync(tmp, { recursive: true, force: true });
    }
  });

  it("get_pets(limit=5) calls /pets?limit=5", async () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "mcp-fase0-q-"));
    const received: string[] = [];
    const server = createServer((req, res) => {
      req.resume();
      req.on("end", () => {
        received.push(req.url ?? "");
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ ok: true }));
      });
    });
    try {
      await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
      const base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
      const input = path.join(tmp, "openapi.json");
      fs.writeFileSync(input, JSON.stringify({
        openapi: "3.0.3",
        info: { title: "t", version: "1.0.0" },
        servers: [{ url: base }],
        paths: {
          "/pets": {
            get: {
              parameters: [{ name: "limit", in: "query", schema: { type: "integer" } }],
              responses: { "200": { description: "ok" } },
            },
          },
        },
      }));
      const out = path.join(tmp, "gen");
      const res = await generate({ input, lang: "typescript", out, force: true, incremental: false, http: true });
      expect(res.errors).toEqual([]);
      const program = ts.createProgram([path.join(out, "src/client.ts")], {
        target: ts.ScriptTarget.ES2022,
        module: ts.ModuleKind.NodeNext,
        moduleResolution: ts.ModuleResolutionKind.NodeNext,
        lib: ["lib.es2022.d.ts", "lib.dom.d.ts"],
        types: [],
        strict: true,
        noEmitOnError: true,
        outDir: path.join(out, "dist"),
      });
      expect(ts.getPreEmitDiagnostics(program).map((d) => ts.flattenDiagnosticMessageText(d.messageText, "\n"))).toEqual([]);
      expect(program.emit().emitSkipped).toBe(false);
      const url = pathToFileURL(path.join(out, "dist/client.js")).href;
      const script = `import { ApiClient } from ${JSON.stringify(url)}; const c = new ApiClient(); process.stdout.write(JSON.stringify(await c.get_pets({ limit: 5 })));`;
      await execFileAsync(process.execPath, ["--input-type=module", "-e", script], { timeout: 5000 });
      expect(received).toEqual(["/pets?limit=5"]);
    } finally {
      await new Promise<void>((resolve) => server.close(() => resolve()));
      fs.rmSync(tmp, { recursive: true, force: true });
    }
  }, 30000);

  it("python server passes query and headers", async () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "mcp-fase0-py-"));
    try {
      const res = await generate({ input: PETSTORE, lang: "python", out: tmp, force: true, incremental: false, http: true });
      expect(res.errors).toEqual([]);
      const content = fs.readFileSync(path.join(tmp, "server.py"), "utf-8");
      expect(content).toContain("def _build_query");
      expect(content).toContain("def _build_headers");
      expect(content).toContain('kwargs["params"]');
      expect(content).toContain('_build_query(request_args, ["limit"');
    } finally {
      fs.rmSync(tmp, { recursive: true, force: true });
    }
  });
});

describe("0.2 go http mode", () => {
  it("wires client instead of stub", async () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "mcp-fase0-go-"));
    try {
      const res = await generate({ input: PETSTORE, lang: "go", out: tmp, force: true, incremental: false, http: true });
      expect(res.errors).toEqual([]);
      const main = fs.readFileSync(path.join(tmp, "main.go"), "utf-8");
      const client = fs.readFileSync(path.join(tmp, "client.go"), "utf-8");
      expect(main).not.toContain("not yet wired");
      expect(client).not.toContain("not yet wired");
      expect(main).toContain('__client.do("GET", "/pets"');
      expect(client).toContain("q.Encode()");
      expect(client).toContain("PathEscape");
    } finally {
      fs.rmSync(tmp, { recursive: true, force: true });
    }
  });
});

describe("0.3 registry", () => {
  it("keeps v3 specs plus converted v2 specs (Fase 2: v2 reativado)", () => {
    expect(listKnownSpecs()).toEqual(expect.arrayContaining(["stripe", "github", "openai", "petstore", "twilio", "shopify"]));
    // Fase 2 (2.1): slack/kubernetes/digitalocean voltam como v2 convertido.
    expect(listKnownSpecs()).toEqual(expect.arrayContaining(["slack", "kubernetes", "digitalocean"]));
    expect(KNOWN_SPECS["azure"]).toBeUndefined();
  });

  it("removed keys fail with guidance", async () => {
    await expect(fetchSpecToCwd("azure")).rejects.toThrow(/was removed/i);
  });

  it("unknown keys list known keys", async () => {
    await expect(fetchSpecToCwd("nope")).rejects.toThrow(/Known keys/);
  });

  it("v2 specs are converted (Fase 2: não falham mais)", async () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "mcp-fase0-v2-"));
    try {
      const spec = path.join(tmp, "swagger.json");
      fs.writeFileSync(spec, JSON.stringify({
        swagger: "2.0",
        info: { title: "t", version: "1.0.0" },
        paths: {},
      }));
      const ast = await parseOpenAPI(spec);
      expect(ast.tools).toEqual([]);
    } finally {
      fs.rmSync(tmp, { recursive: true, force: true });
    }
  });
});
