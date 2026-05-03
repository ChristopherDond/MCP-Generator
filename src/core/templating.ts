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

/** Filter params by required/optional */
Handlebars.registerHelper(
  "requiredParams",
  (params: Array<{ required: boolean }>) =>
    (params ?? []).filter((p) => p.required)
);

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
