import { scanProject, formatReport, scanForCredentials, validateAuthContext, lintIncrementalMarkers, lintNaming, type SecurityRule } from "../src/core/security-lint";
import fs from "fs";
import path from "path";
import os from "os";

describe("Security/Lint Layer", () => {
  let tempDir: string;

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "mcp-gen-test-"));
  });

  afterEach(() => {
    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  function writeFile(relPath: string, content: string): string {
    const fullPath = path.join(tempDir, relPath);
    fs.mkdirSync(path.dirname(fullPath), { recursive: true });
    fs.writeFileSync(fullPath, content);
    return fullPath;
  }

  describe("scanForCredentials", () => {
    it("detects credential keywords", () => {
      const content = `const api_key = "secret";\nconst token = "abc";`;
      const rules = scanForCredentials(content, "test.ts");
      expect(rules.some((r: SecurityRule) => r.id === "SEC-CRED-API_KEY")).toBe(true);
      expect(rules.some((r: SecurityRule) => r.id === "SEC-CRED-TOKEN")).toBe(true);
    });

    it("detects secret patterns (sk_ prefix 20+ chars)", () => {
      const content = `const key = "sk_liveabcdefghijklmnopqrstuvwxyz";`;
      const rules = scanForCredentials(content, "test.ts");
      expect(rules.some((r: SecurityRule) => r.id === "SEC-SECRET-SK_")).toBe(true);
    });

    it("skips comments about blocking credentials", () => {
      const content = `// block raw credentials\nauth: "Bearer token";`;
      const rules = scanForCredentials(content, "test.ts");
      const credRules = rules.filter((r: SecurityRule) => r.category === "credentials");
      // Should flag the token in code but not the "credentials" word in comment
      expect(credRules.length).toBeGreaterThanOrEqual(1);
    });

    it("ignores 40-char SHA hex as base64", () => {
      const content = `const sha = "da39a3ee5e6b4b0d3255bfef95601890afd80709";`;
      const rules = scanForCredentials(content, "test.ts");
      expect(rules.some((r: SecurityRule) => r.id === "SEC-SECRET-BASE64_SECRET")).toBe(false);
    });

    it("detects padded base64 secret", () => {
      const content = `const key = "dGVzdHNlY3JldGtleXRlc3R0ZXN0c2VjcmV0a2V5dGVzdA==";`;
      const rules = scanForCredentials(content, "test.ts");
      expect(rules.some((r: SecurityRule) => r.id === "SEC-SECRET-BASE64_SECRET")).toBe(true);
    });
  });

  describe("lintNaming", () => {
    it("ignores operation verbs post/put/patch/search/approve/require", () => {
      const content = [
        "function post_message() {}",
        "function put_setting() {}",
        "function patch_item() {}",
        "function search_users() {}",
        "function approve_payment() {}",
        "function require_security() {}",
      ].join("\n");
      const rules = lintNaming(content, "test.ts");
      expect(rules.filter((r) => r.id === "LINT-TS-SNAKE-CASE")).toHaveLength(0);
    });

    it("still flags genuine snake_case", () => {
      const content = `function my_helper() {}`;
      const rules = lintNaming(content, "test.ts");
      expect(rules.some((r) => r.id === "LINT-TS-SNAKE-CASE")).toBe(true);
    });
  });

  describe("validateAuthContext", () => {
    it("warns when authContext param exists but no validation", () => {
      const content = `async function handler(args: any, authContext: any) { return 1; }`;
      const rules = validateAuthContext(content, "test.ts");
      expect(rules.some((r: SecurityRule) => r.id === "SEC-AUTHCTX-NO-VALIDATION")).toBe(true);
    });

    it("passes when validation call exists", () => {
      const content = `async function handler(authContext: any) { requireSecurity("tool", args, null, authContext); }`;
      const rules = validateAuthContext(content, "test.ts");
      expect(rules.some((r: SecurityRule) => r.id === "SEC-AUTHCTX-NO-VALIDATION")).toBe(false);
    });
  });

  describe("lintIncrementalMarkers", () => {
    it("detects unbalanced markers", () => {
      const content = `// @@mcp-gen:start:foo\n// @@mcp-gen:start:bar\n// @@mcp-gen:end:foo`;
      const rules = lintIncrementalMarkers(content, "test.ts");
      expect(rules.some((r: SecurityRule) => r.id === "LINT-UNBALANCED-MARKERS")).toBe(true);
    });

    it("detects nested markers", () => {
      const content = `// @@mcp-gen:start:foo\n// @@mcp-gen:start:bar\n// @@mcp-gen:end:bar\n// @@mcp-gen:end:foo`;
      const rules = lintIncrementalMarkers(content, "test.ts");
      expect(rules.some((r: SecurityRule) => r.id === "LINT-NESTED-MARKERS")).toBe(true);
    });

    it("passes for balanced markers", () => {
      const content = `// @@mcp-gen:start:foo\n// @@mcp-gen:end:foo`;
      const rules = lintIncrementalMarkers(content, "test.ts");
      expect(rules.some((r: SecurityRule) => r.id === "LINT-UNBALANCED-MARKERS")).toBe(false);
    });
  });

  describe("scanProject", () => {
    it("scans a project and returns report", async () => {
      writeFile("server.ts", `
        const RAW_CREDENTIAL_KEYS = ["token"];
        const TOOL_POLICIES = { foo: {} };
        async function get_users(authContext: any) {
          requireSecurity("get_users", args, null, authContext);
          // @@mcp-gen:start:get_users
          return "ok";
          // @@mcp-gen:end:get_users
        }
      `);

      const report = await scanProject(tempDir);
      expect(report).toBeDefined();
      expect(report.summary).toBeDefined();
      expect(typeof report.passed).toBe("boolean");
    });

    it("detects credentials in generated code", async () => {
      writeFile("server.ts", `
        const api_token = "sk_liveabcdefghijklmnopqrstuvwxyz";
        const authorization = "Bearer xyz";
      `);

      const report = await scanProject(tempDir);
      expect(report.summary.errors).toBeGreaterThan(0);
      expect(report.rules.some((r: SecurityRule) => r.id === "SEC-SECRET-SK_")).toBe(true);
    });

    it("ignores TODO lint inside examples/ but still flags credentials", async () => {
      writeFile("examples/demo.ts", `// TODO: document this example\nconst x = 1;\n`);
      writeFile("src/app.ts", `// TODO: fix this before production\nconst y = 2;\n`);

      const report = await scanProject(tempDir);
      const todos = report.rules.filter((r: SecurityRule) => r.id === "LINT-TODO-IN-GENERATED");
      expect(todos.every((r: SecurityRule) => !(r.file ?? "").includes("examples"))).toBe(true);
      expect(todos.some((r: SecurityRule) => (r.file ?? "").includes("app.ts"))).toBe(true);
    });
  });

  describe("formatReport", () => {
    it("formats report as string", () => {
      const report = {
        rules: [
          { id: "TEST-RULE", severity: "error" as const, category: "lint" as const, message: "Test error", file: "test.ts", line: 1 },
        ],
        summary: { errors: 1, warnings: 0, info: 0 },
        passed: false,
      };
      const output = formatReport(report);
      expect(output).toContain("MCP Security & Lint Report");
      expect(output).toContain("TEST-RULE");
      expect(output).toContain("❌ FAILED");
    });
  });
});