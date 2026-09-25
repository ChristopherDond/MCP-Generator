import path from "path";
import fs from "fs";
import type { OpenAPIV3 } from "openapi-types";
import yaml from "js-yaml";

/**
 * MCP Security & Lint Layer
 * 
 * Provides:
 * - Credential scanning (detect raw secrets in specs/handlers)
 * - authContext contract validation
 * - Tool policy enforcement
 * - Lint rules (naming, descriptions, schemas, incremental markers)
 */

export interface SecurityRule {
  id: string;
  severity: "error" | "warning" | "info";
  category: "credentials" | "authcontext" | "policy" | "lint";
  message: string;
  file?: string;
  line?: number;
  suggestion?: string;
}

export interface SecurityReport {
  rules: SecurityRule[];
  summary: {
    errors: number;
    warnings: number;
    info: number;
  };
  passed: boolean;
}

/** Keywords that indicate raw credentials (blocked by default) */
export const RAW_CREDENTIAL_KEYWORDS = [
  "authorization",
  "token",
  "access_token",
  "api_key",
  "apikey",
  "x-api-key",
  "x_api_key",
  "client_secret",
  "client_id",
  "refresh_token",
  "password",
  "secret",
  "bearer",
  "basic",
  "jwt",
  "private_key",
  "ssh_key",
];

/** Reserved words that shouldn't be tool names */
export const RESERVED_TOOL_NAMES = [
  "new", "delete", "class", "function", "var", "let", "const",
  "if", "else", "for", "while", "switch", "case", "default",
  "try", "catch", "finally", "throw", "return", "await",
  "async", "yield", "import", "export", "from", "as",
  "typeof", "instanceof", "in", "of", "void", "null",
  "undefined", "true", "false", "this", "super", "extends",
  "implements", "interface", "type", "enum", "package",
  "private", "protected", "public", "static", "abstract",
];

/** Expected authContext fields */
export const EXPECTED_AUTH_CONTEXT_FIELDS = [
  "tokenId",
  "principal",
  "expiresAt",
  "allowedTools",
  "endpointAllowlist",
  "spendLimitUsd",
  "spendUsedUsd",
  "revoked",
  "requestId",
];

/** Scan a string for credential-like patterns */
export function scanForCredentials(
  content: string,
  filePath: string = "unknown"
): SecurityRule[] {
  const rules: SecurityRule[] = [];
  const lines = content.split("\n");

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const lowerLine = line.toLowerCase();

    // Check for credential keywords
    for (const keyword of RAW_CREDENTIAL_KEYWORDS) {
      const regex = new RegExp(`\\b${keyword}\\b`, "i");
      if (regex.test(lowerLine)) {
        // Skip if it's in a comment about blocking credentials
        if (lowerLine.includes("block") || lowerLine.includes("deny") || 
            lowerLine.includes("not allowed") || lowerLine.includes("forbidden") ||
            lowerLine.includes("raw_credential") || lowerLine.includes("rawcredential")) {
          continue;
        }

        rules.push({
          id: `SEC-CRED-${keyword.toUpperCase()}`,
          severity: "warning",
          category: "credentials",
          message: `Potential raw credential keyword "${keyword}" found`,
          file: filePath,
          line: i + 1,
          suggestion: "Use authContext scoped metadata instead of raw credentials",
        });
      }
    }

    // Check for actual secret patterns (high entropy strings, common prefixes)
    const secretPatterns = [
      { pattern: /sk_[a-zA-Z0-9]{20,}/g, type: "sk_" },
      { pattern: /pk_[a-zA-Z0-9]{20,}/g, type: "pk_" },
      { pattern: /ghp_[a-zA-Z0-9]{36}/g, type: "github_pat" },
      { pattern: /gho_[a-zA-Z0-9]{36}/g, type: "github_oauth" },
      { pattern: /ghu_[a-zA-Z0-9]{36}/g, type: "github_user" },
      { pattern: /glpat-[a-zA-Z0-9]{20,}/g, type: "gitlab_pat" },
      { pattern: /xoxb-[a-zA-Z0-9-]{20,}/g, type: "slack_bot" },
      { pattern: /xoxp-[a-zA-Z0-9-]{20,}/g, type: "slack_user" },
      { pattern: /ya29\.[a-zA-Z0-9_-]{20,}/g, type: "google_oauth" },
      { pattern: /eyJ[a-zA-Z0-9_-]{10,}\.[a-zA-Z0-9_-]{10,}\.[a-zA-Z0-9_-]{10,}/g, type: "jwt" },
      { pattern: /AKIA[0-9A-Z]{16}/g, type: "aws_access_key" },
      { pattern: /[a-zA-Z0-9/+=]{40}/g, type: "base64_secret" },
    ];

    for (const { pattern, type } of secretPatterns) {
      const matches = line.match(pattern);
      if (matches) {
        rules.push({
          id: `SEC-SECRET-${type.toUpperCase()}`,
          severity: "error",
          category: "credentials",
          message: `Potential ${type} secret detected`,
          file: filePath,
          line: i + 1,
          suggestion: "Remove secrets from source code; use environment variables or secret manager",
        });
      }
    }
  }

  return rules;
}

/** Validate authContext structure in generated code */
export function validateAuthContext(
  content: string,
  filePath: string = "unknown"
): SecurityRule[] {
  const rules: SecurityRule[] = [];
  const lines = content.split("\n");

  let hasAuthContextParam = false;
  let hasAuthContextValidation = false;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // Check for auth_context parameter in tool handlers
    if (line.includes("auth_context") || line.includes("authContext")) {
      hasAuthContextParam = true;
    }

    // Check for require_security or similar validation call
    if (line.includes("require_security") || line.includes("requireSecurity") ||
        line.includes("validate_auth") || line.includes("validateAuth")) {
      hasAuthContextValidation = true;
    }
  }

  if (hasAuthContextParam && !hasAuthContextValidation) {
    rules.push({
      id: "SEC-AUTHCTX-NO-VALIDATION",
      severity: "warning",
      category: "authcontext",
      message: "authContext parameter present but no validation call found",
      file: filePath,
      suggestion: "Call require_security() or validateAuth() with authContext",
    });
  }

  return rules;
}

/** Validate tool policies are defined */
export function validateToolPolicies(
  content: string,
  filePath: string = "unknown"
): SecurityRule[] {
  const rules: SecurityRule[] = [];
  const lines = content.split("\n");

  let hasToolPolicies = false;
  let hasRawCredentialCheck = false;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    if (line.includes("TOOL_POLICIES") || line.includes("toolPolicies")) {
      hasToolPolicies = true;
    }

    if (line.includes("RAW_CREDENTIAL_KEYS") || line.includes("rawCredentialKeys")) {
      hasRawCredentialCheck = true;
    }
  }

  if (!hasToolPolicies) {
    rules.push({
      id: "LINT-NO-TOOL-POLICIES",
      severity: "info",
      category: "policy",
      message: "No TOOL_POLICIES defined — consider adding per-tool security policies",
      file: filePath,
      suggestion: "Define toolPolicies with requires_ttl, requires_spend_limit, etc.",
    });
  }

  if (!hasRawCredentialCheck) {
    rules.push({
      id: "LINT-NO-RAW-CREDENTIAL-CHECK",
      severity: "warning",
      category: "credentials",
      message: "No raw credential keyword blocking defined",
      file: filePath,
      suggestion: "Add RAW_CREDENTIAL_KEYS set and check in require_security",
    });
  }

  return rules;
}

/** Lint naming conventions */
export function lintNaming(
  content: string,
  filePath: string = "unknown"
): SecurityRule[] {
  const rules: SecurityRule[] = [];
  const lines = content.split("\n");

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // Check for snake_case function names in TypeScript (should be camelCase)
    if (filePath.endsWith(".ts") || filePath.endsWith(".js")) {
      const fnMatch = line.match(/^\s*(async\s+)?function\s+([a-z_][a-z0-9_]*)/);
      if (fnMatch && fnMatch[2].includes("_")) {
        rules.push({
          id: "LINT-TS-SNAKE-CASE",
          severity: "info",
          category: "lint",
          message: `Function "${fnMatch[2]}" uses snake_case; prefer camelCase in TypeScript`,
          file: filePath,
          line: i + 1,
          suggestion: "Rename to camelCase (e.g., get_user → getUser)",
        });
      }
    }

    // Check for PascalCase variable names
    const varMatch = line.match(/(?:const|let|var)\s+([A-Z][a-zA-Z0-9]*)\s*=/);
    if (varMatch && !varMatch[1].match(/^[A-Z_]+$/)) {
      // Allow UPPER_CASE constants
      rules.push({
        id: "LINT-PASCAL-VAR",
        severity: "info",
        category: "lint",
        message: `Variable "${varMatch[1]}" uses PascalCase; prefer camelCase`,
        file: filePath,
        line: i + 1,
        suggestion: "Use camelCase for variables",
      });
    }
  }

  return rules;
}

/** Lint descriptions */
export function lintDescriptions(
  content: string,
  filePath: string = "unknown"
): SecurityRule[] {
  const rules: SecurityRule[] = [];
  const lines = content.split("\n");

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // Check for empty descriptions in tool definitions
    if (line.includes("WithDescription") || line.includes("withDescription")) {
      if (line.includes('""') || line.includes("''") || line.includes('""') || 
          line.match(/WithDescription\(\s*\)/)) {
        rules.push({
          id: "LINT-EMPTY-DESCRIPTION",
          severity: "warning",
          category: "lint",
          message: "Empty description found",
          file: filePath,
          line: i + 1,
          suggestion: "Provide a meaningful description for the tool/parameter",
        });
      }
    }

    // Check for TODO/FIXME in generated code
    if (line.match(/TODO|FIXME|XXX|HACK/i)) {
      rules.push({
        id: "LINT-TODO-IN-GENERATED",
        severity: "info",
        category: "lint",
        message: "TODO/FIXME comment in generated code",
        file: filePath,
        line: i + 1,
        suggestion: "Remove or resolve before production",
      });
    }
  }

  return rules;
}

/** Lint incremental markers */
export function lintIncrementalMarkers(
  content: string,
  filePath: string = "unknown"
): SecurityRule[] {
  const rules: SecurityRule[] = [];
  const lines = content.split("\n");

  let startCount = 0;
  let endCount = 0;
  const startLines: number[] = [];
  const endLines: number[] = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    if (line.includes("@@mcp-gen:start:")) {
      startCount++;
      startLines.push(i + 1);
    }

    if (line.includes("@@mcp-gen:end:")) {
      endCount++;
      endLines.push(i + 1);
    }
  }

  if (startCount !== endCount) {
    rules.push({
      id: "LINT-UNBALANCED-MARKERS",
      severity: "error",
      category: "lint",
      message: `Unbalanced incremental markers: ${startCount} start, ${endCount} end`,
      file: filePath,
      suggestion: "Each @@mcp-gen:start: must have matching @@mcp-gen:end:",
    });
  }

  // Check for nested markers (which shouldn't happen)
  for (const start of startLines) {
    const matchingEnd = endLines.find(e => e > start);
    if (matchingEnd) {
      const between = lines.slice(start, matchingEnd);
      const nestedStart = between.findIndex(l => l.includes("@@mcp-gen:start:"));
      if (nestedStart >= 0) {
        rules.push({
          id: "LINT-NESTED-MARKERS",
          severity: "warning",
          category: "lint",
          message: "Nested incremental markers detected",
          file: filePath,
          line: start + nestedStart,
          suggestion: "Flatten marker structure; one start/end per tool",
        });
      }
    }
  }

  return rules;
}

/** Lint schema usage */
export function lintSchemas(
  spec: OpenAPIV3.Document,
  filePath: string = "spec"
): SecurityRule[] {
  const rules: SecurityRule[] = [];

  if (!spec.paths) return rules;

  for (const [path, pathItem] of Object.entries(spec.paths)) {
    if (!pathItem) continue;

    const methods = ["get", "post", "put", "patch", "delete", "head", "options", "trace"];
    for (const method of methods) {
      const op = pathItem[method as keyof typeof pathItem] as OpenAPIV3.OperationObject | undefined;
      if (!op) continue;

      // Check for missing summary/description
      if (!op.summary && !op.description) {
        rules.push({
          id: "LINT-NO-OP-DESCRIPTION",
          severity: "warning",
          category: "lint",
          message: `Operation ${method.toUpperCase()} ${path} has no summary or description`,
          file: filePath,
          suggestion: "Add summary and description for better generated tool docs",
        });
      }

      // Check for missing examples in responses
      if (op.responses) {
        for (const [status, response] of Object.entries(op.responses)) {
          if (response && "content" in response) {
            const resp = response as OpenAPIV3.ResponseObject;
            if (resp.content) {
              for (const media of Object.values(resp.content)) {
                if (media && !media.example && !media.examples) {
                  rules.push({
                    id: "LINT-NO-RESPONSE-EXAMPLE",
                    severity: "info",
                    category: "lint",
                    message: `Response ${status} for ${method.toUpperCase()} ${path} has no example`,
                    file: filePath,
                    suggestion: "Add example to enable stub handlers",
                  });
                }
              }
            }
          }
        }
      }
    }
  }

  return rules;
}

/** Main security/lint scan for a generated project */
export async function scanProject(projectPath: string): Promise<SecurityReport> {
  const allRules: SecurityRule[] = [];

  // Scan all files in project
  const files = findFiles(projectPath, [".ts", ".js", ".py", ".go", ".json", ".yaml", ".yml"]);

  for (const file of files) {
    const content = fs.readFileSync(file, "utf-8");
    const relativePath = path.relative(projectPath, file);

    // Credential scanning
    allRules.push(...scanForCredentials(content, relativePath));

    // AuthContext validation
    allRules.push(...validateAuthContext(content, relativePath));

    // Tool policies
    allRules.push(...validateToolPolicies(content, relativePath));

    // Naming conventions
    allRules.push(...lintNaming(content, relativePath));

    // Descriptions
    allRules.push(...lintDescriptions(content, relativePath));

    // Incremental markers
    allRules.push(...lintIncrementalMarkers(content, relativePath));
  }

  // Scan OpenAPI spec if present
  const specFiles = findFiles(projectPath, [".json", ".yaml", ".yml"])
    .filter(f => f.includes("openapi") || f.includes("swagger") || f.includes("api"));

  for (const specFile of specFiles.slice(0, 1)) { // Only first spec
    try {
      const specContent = fs.readFileSync(specFile, "utf-8");
      const spec = specFile.endsWith(".json") 
        ? JSON.parse(specContent) 
        : yaml.load(specContent);
      allRules.push(...lintSchemas(spec, path.relative(projectPath, specFile)));
    } catch {
      // Ignore parse errors
    }
  }

  const summary = {
    errors: allRules.filter(r => r.severity === "error").length,
    warnings: allRules.filter(r => r.severity === "warning").length,
    info: allRules.filter(r => r.severity === "info").length,
  };

  return {
    rules: allRules,
    summary,
    passed: summary.errors === 0,
  };
}

/** Find files with given extensions */
function findFiles(dir: string, extensions: string[]): string[] {
  const results: string[] = [];
  
  function walk(currentDir: string) {
    const entries = fs.readdirSync(currentDir, { withFileTypes: true });
    
    for (const entry of entries) {
      const fullPath = path.join(currentDir, entry.name);
      
      if (entry.isDirectory()) {
        // Skip node_modules, .git, dist, build
        if (![".git", "node_modules", "dist", "build", "__pycache__", ".github"].includes(entry.name)) {
          walk(fullPath);
        }
      } else if (entry.isFile()) {
        if (extensions.some(ext => entry.name.endsWith(ext))) {
          results.push(fullPath);
        }
      }
    }
  }

  walk(dir);
  return results;
}

/** Format report for console output */
export function formatReport(report: SecurityReport): string {
  const lines: string[] = [];
  
  lines.push("");
  lines.push("═══════════════════════════════════════════");
  lines.push("  MCP Security & Lint Report");
  lines.push("═══════════════════════════════════════════");
  lines.push("");
  lines.push(`  Errors:   ${report.summary.errors}`);
  lines.push(`  Warnings: ${report.summary.warnings}`);
  lines.push(`  Info:     ${report.summary.info}`);
  lines.push(`  Status:   ${report.passed ? "✅ PASSED" : "❌ FAILED"}`);
  lines.push("");

  if (report.rules.length === 0) {
    lines.push("  No issues found.");
    return lines.join("\n");
  }

  // Group by category
  const byCategory: Record<string, SecurityRule[]> = {};
  for (const rule of report.rules) {
    if (!byCategory[rule.category]) byCategory[rule.category] = [];
    byCategory[rule.category].push(rule);
  }

  for (const [category, rules] of Object.entries(byCategory)) {
    lines.push(`  ${category.toUpperCase()}:`);
    for (const rule of rules) {
      const icon = rule.severity === "error" ? "✗" : rule.severity === "warning" ? "⚠" : "ℹ";
      const loc = rule.file ? ` (${rule.file}${rule.line ? `:${rule.line}` : ""})` : "";
      lines.push(`    ${icon} [${rule.id}] ${rule.message}${loc}`);
      if (rule.suggestion) {
        lines.push(`       → ${rule.suggestion}`);
      }
    }
    lines.push("");
  }

  return lines.join("\n");
}