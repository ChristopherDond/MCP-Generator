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

const execFileAsync = promisify(execFile);

interface ReceivedRequest {
  method: string | undefined;
  url: string | undefined;
  contentType: string | undefined;
  body: string;
}

describe("generated TypeScript HTTP client JSON body", () => {
  let tmpDir: string;
  let clientUrl: string;
  const received: ReceivedRequest[] = [];
  const server = createServer((req, res) => {
    const chunks: Buffer[] = [];
    req.on("data", (chunk: Buffer) => chunks.push(chunk));
    req.on("end", () => {
      received.push({
        method: req.method,
        url: req.url,
        contentType: req.headers["content-type"],
        body: Buffer.concat(chunks).toString("utf-8"),
      });
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ ok: true }));
    });
  });

  beforeAll(async () => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "mcp-http-body-"));
    await new Promise<void>((resolve, reject) => {
      server.once("error", reject);
      server.listen(0, "127.0.0.1", () => {
        server.off("error", reject);
        resolve();
      });
    });
    const baseUrl = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
    const operation = (required: boolean) => ({
      requestBody: {
        required,
        content: {
          "application/json": {
            schema: {
              type: "object",
              nullable: true,
              properties: {
                message: { type: "string" },
                count: { type: "integer" },
                enabled: { type: "boolean" },
              },
            },
          },
        },
      },
      responses: { "200": { description: "Accepted" } },
    });
    const input = path.join(tmpDir, "openapi.json");
    fs.writeFileSync(input, JSON.stringify({
      openapi: "3.0.3",
      info: { title: "HTTP body integration", version: "1.0.0" },
      servers: [{ url: baseUrl }],
      paths: {
        "/required": { post: operation(true) },
        "/optional": { post: operation(false) },
        "/empty": { post: { responses: { "200": { description: "Accepted" } } } },
      },
    }));
    const out = path.join(tmpDir, "generated");
    const result = await generate({
      input, lang: "typescript", out, force: false, incremental: false, http: true,
    });
    expect(result.errors).toEqual([]);
    expect(result.success).toBe(true);
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
    const diagnostics = ts.getPreEmitDiagnostics(program);
    expect(diagnostics.map((d) => ts.flattenDiagnosticMessageText(d.messageText, "\n"))).toEqual([]);
    expect(program.emit().emitSkipped).toBe(false);
    clientUrl = pathToFileURL(path.join(out, "dist/client.js")).href;
  }, 30000);

  afterAll(async () => {
    try {
      if (server.listening) {
        await new Promise<void>((resolve, reject) => {
          server.close((error) => error ? reject(error) : resolve());
          server.closeAllConnections();
        });
      }
    } finally {
      if (tmpDir) fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  });

  const payload = { message: "Olá HTTP", count: 0, enabled: false };
  const cases: Array<{ name: string; route: string; params?: Record<string, unknown>; body: unknown }> = [
    { name: "sends required JSON body", route: "required", params: { body: payload }, body: payload },
    { name: "sends optional JSON body", route: "optional", params: { body: payload }, body: payload },
    { name: "omits absent optional body", route: "optional", body: undefined },
    { name: "omits undefined optional body", route: "optional", params: { body: undefined }, body: undefined },
    { name: "preserves explicit JSON null", route: "optional", params: { body: null }, body: null },
    { name: "omits body when the operation has no requestBody", route: "empty", params: { body: payload }, body: undefined },
  ];

  it.each(cases)("$name", async ({ route, params, body }) => {
    received.length = 0;
    const script = `
      import { ApiClient } from ${JSON.stringify(clientUrl)};
      const client = new ApiClient();
      const params = ${params === undefined ? "undefined" :
        Object.hasOwn(params, "body") && params.body === undefined ? "{ body: undefined }" : JSON.stringify(params)};
      process.stdout.write(JSON.stringify(await client[${JSON.stringify(`post_${route}`)}](params)));
    `;
    const { stdout } = await execFileAsync(process.execPath, ["--input-type=module", "-e", script], {
      timeout: 5000,
    });
    expect(received).toEqual([{
      method: "POST",
      url: `/${route}`,
      contentType: body === undefined ? undefined : "application/json",
      body: body === undefined ? "" : JSON.stringify(body),
    }]);
    if (body !== undefined) expect(JSON.parse(received[0].body)).toEqual(body);
    expect(JSON.parse(stdout)).toEqual({ ok: true });
  }, 10000);
});
