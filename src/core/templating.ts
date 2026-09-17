import Handlebars from "handlebars";
import fs from "fs";
import path from "path";

// Register helpers used across templates

Handlebars.registerHelper("eq", (a: unknown, b: unknown) => a === b);
Handlebars.registerHelper("ne", (a: unknown, b: unknown) => a !== b);
Handlebars.registerHelper("and", (a: unknown, b: unknown) => Boolean(a && b));
Handlebars.registerHelper("or", (a: unknown, b: unknown) => Boolean(a || b));
Handlebars.registerHelper("not", (a: unknown) => !a);
Handlebars.registerHelper("gt", (a: number, b: number) => a > b);
Handlebars.registerHelper("hasBodyParam", (params: Array<{ in: string }>) =>
  (params ?? []).some((p) => p.in === "body")
);

/** snake_case → PascalCase */
Handlebars.registerHelper("pascal", (str: string) => {
  if (typeof str !== "string") return str;
  return str
    .split(/[_\-\s]+/)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join("");
});

/** PascalCase or snake_case → camelCase */
Handlebars.registerHelper("camel", (str: string) => {
  if (typeof str !== "string") return str;
  const pascal = str
    .split(/[_\-\s]+/)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join("");
  return pascal.charAt(0).toLowerCase() + pascal.slice(1);
});

/** Stringify a value as JSON for example responses */
Handlebars.registerHelper("json", (val: unknown) =>
  JSON.stringify(val, null, 2)
);

/** Render a literal: strings get quoted+escaped, everything else is JSON. */
Handlebars.registerHelper("literal", (val: unknown): string => {
  if (typeof val === "string") {
    return '"' + val.replace(/\\/g, "\\\\").replace(/"/g, '\\"') + '"';
  }
  return JSON.stringify(val);
});

/** Filter params by required/optional */
Handlebars.registerHelper(
  "requiredParams",
  (params: Array<{ required: boolean }>) =>
    (params ?? []).filter((p) => p.required)
);

/** Collect unique header parameters across all tools (used to render the client's buildHeaders once). */
Handlebars.registerHelper("allHeaderParams", (tools: Array<{ params: Array<{ name: string; in: string }> }>) => {
  const seen = new Set<string>();
  const out: Array<{ name: string }> = [];
  for (const tool of tools ?? []) {
    for (const p of tool.params ?? []) {
      if (p.in === "header" && !seen.has(p.name)) {
        seen.add(p.name);
        out.push({ name: p.name });
      }
    }
  }
  return out;
});

Handlebars.registerHelper(
  "optionalParams",
  (params: Array<{ required: boolean }>) =>
    (params ?? []).filter((p) => !p.required)
);

/** Map MCP type to TypeScript type string */
Handlebars.registerHelper("tsType", (type: string): string => {
  switch (type) {
    case "number":
      return "number";
    case "boolean":
      return "boolean";
    case "object":
      return "Record<string, unknown>";
    case "array":
      return "unknown[]";
    default:
      return "string";
  }
});

/** Map MCP type to Go type string */
Handlebars.registerHelper("goType", (type: string): string => {
  switch (type) {
    case "number":
      return "float64";
    case "boolean":
      return "bool";
    case "array":
      return "[]any";
    case "object":
      return "map[string]any";
    default:
      return "string";
  }
});

/** Type name → Go type constructor for mcp-go's With<Type> option (String from "string", Number from "number"...). */
Handlebars.registerHelper("pascalGoType", (type: string): string => {
  switch (type) {
    case "number":
      return "Number";
    case "boolean":
      return "Boolean";
    case "object":
      return "Object";
    case "array":
      return "Array";
    default:
      return "String";
  }
});

/** typeof helper so Go enum literals can quote strings vs leave numbers raw. */
Handlebars.registerHelper("typeof", (val: unknown): string => typeof val);

/** Escape a string for a Go double-quoted string literal (\\ \n \r \t \"). */
Handlebars.registerHelper("escapeLiteral", (val: unknown): string => {
  if (val === null || val === undefined) return "";
  const out: string[] = [];
  for (const ch of String(val)) {
    const code = ch.charCodeAt(0);
    if (ch === '"') out.push('\\"');
    else if (ch === "\\") out.push("\\\\");
    else if (ch === "\n") out.push("\\n");
    else if (ch === "\r") out.push("\\r");
    else if (ch === "\t") out.push("\\t");
    else if (code < 0x20 || code === 0x7f) out.push("\\u%04x".replace("%04x", code.toString(16).padStart(4, "0")));
    else out.push(ch);
  }
  return out.join("");
});

/** Map MCP type to Python type annotation. */
Handlebars.registerHelper("pyType", (prop: { type: string; ref?: string; isArray: boolean }): string => {
  const base = prop.ref ?? (() => {
    switch (prop.type) {
      case "number": return "float";
      case "boolean": return "bool";
      case "object": return "dict";
      case "array": return "List[Any]";
      default: return "str";
    }
  })();
  return prop.isArray ? `List[${base}]` : base;
});

/** Escape a string for safe embedding inside a double-quoted string literal.
 *  Escapes backslashes, double quotes, control chars and newlines so arbitrary
 *  OpenAPI descriptions cannot break or inject into generated code. */
Handlebars.registerHelper("escapeText", (val: unknown): string => {
  if (val === null || val === undefined) return "";
  const out: string[] = [];
  for (const ch of String(val)) {
    const code = ch.charCodeAt(0);
    if (ch === '"') out.push('\\"');
    else if (ch === "\\") out.push("\\\\");
    else if (ch === "\n") out.push("\\n");
    else if (ch === "\r") out.push("\\r");
    else if (ch === "\t") out.push("\\t");
    else if (code < 0x20 || code === 0x7f) {
      out.push("\\u" + code.toString(16).padStart(4, "0"));
    } else {
      out.push(ch);
    }
  }
  return out.join("");
});

/** Indent a block of text by N spaces */
Handlebars.registerHelper(
  "indent",
  (text: string, spaces: number) => {
    if (typeof text !== "string") return text;
    const pad = " ".repeat(spaces);
    return text
      .split("\n")
      .map((line) => (line ? pad + line : line))
      .join("\n");
  }
);

const templateCache: Map<string, HandlebarsTemplateDelegate> = new Map();

export function compileTemplate(templatePath: string): HandlebarsTemplateDelegate {
  if (templateCache.has(templatePath)) {
    return templateCache.get(templatePath)!;
  }
  const source = fs.readFileSync(templatePath, "utf-8");
  const compiled = Handlebars.compile(source, { noEscape: true });
  templateCache.set(templatePath, compiled);
  return compiled;
}

export function renderTemplate(
  templatePath: string,
  context: Record<string, unknown>
): string {
  const fn = compileTemplate(templatePath);
  return fn(context);
}

/** Load all .hbs files in a directory as named partials */
export function registerPartials(partialsDir: string): void {
  if (!fs.existsSync(partialsDir)) return;
  const files = fs.readdirSync(partialsDir).filter((f) => f.endsWith(".hbs"));
  for (const file of files) {
    const name = path.basename(file, ".hbs");
    const source = fs.readFileSync(path.join(partialsDir, file), "utf-8");
    Handlebars.registerPartial(name, source);
  }
}
