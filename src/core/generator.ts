import fs from "fs";
import path from "path";
import { parseOpenAPI } from "./parser.js";
import { renderTemplate, registerPartials } from "./templating.js";
import type { GeneratorOptions, GenerationResult, MCPServerAST } from "./types.js";

// From dist/core/generator.js → dist/templates/
const TEMPLATES_ROOT = path.resolve(__dirname, "../templates");

interface FileSpec {
  templateFile: string;
  outputFile: string;
  outputDir?: string; // subdirectory inside project output, e.g. ".github/workflows"
}

function getTypeScriptFileSpecs(): FileSpec[] {
  return [
    { templateFile: "server.hbs", outputFile: "src/server.ts" },
    { templateFile: "models.hbs", outputFile: "src/models.ts" },
    { templateFile: "package.json.hbs", outputFile: "package.json" },
    { templateFile: "tsconfig.json.hbs", outputFile: "tsconfig.json" },
    { templateFile: "README.md.hbs", outputFile: "README.md" },
    { templateFile: "Dockerfile.hbs", outputFile: "Dockerfile" },
    { templateFile: "ci.yml.hbs", outputFile: ".github/workflows/ci.yml" },
  ];
}

function ensureDir(dirPath: string): void {
  fs.mkdirSync(dirPath, { recursive: true });
}

function writeFile(filePath: string, content: string, force: boolean): void {
  if (fs.existsSync(filePath) && !force) {
    throw new Error(
      `File already exists: ${filePath}. Use --force to overwrite.`
    );
  }
  ensureDir(path.dirname(filePath));
  fs.writeFileSync(filePath, content, "utf-8");
}

// Add a helper 'includes' for Handlebars that checks array membership
// (registered here so it has access to runtime data)
import Handlebars from "handlebars";
Handlebars.registerHelper(
  "includes",
  (arr: unknown[], val: unknown) => Array.isArray(arr) && arr.includes(val)
);

export async function generate(
  options: GeneratorOptions
): Promise<GenerationResult> {
  const result: GenerationResult = {
    success: false,
    outputDir: path.resolve(options.out),
    filesCreated: [],
    errors: [],
    warnings: [],
  };

  // 1. Parse and validate the OpenAPI spec
  let ast: MCPServerAST;
  try {
    ast = await parseOpenAPI(options.input);
  } catch (err: unknown) {
    result.errors.push(err instanceof Error ? err.message : String(err));
    return result;
  }

  // Override server name/version if provided
  if (options.serverName) ast.serverName = options.serverName;
  if (options.serverVersion) ast.serverVersion = options.serverVersion;

  // Warn about tools with no example response (handlers will throw NotImplemented)
  const stubTools = ast.tools.filter((t) => t.exampleResponse === null);
  if (stubTools.length > 0) {
    result.warnings.push(
      `${stubTools.length} tool(s) have no example response and will throw NotImplemented: ${stubTools
        .map((t) => t.name)
        .join(", ")}`
    );
  }

  // 2. Select templates for the target language
  if (options.lang !== "typescript") {
    result.errors.push(
      `Language "${options.lang}" not yet supported. Only "typescript" is implemented in this version.`
    );
    return result;
  }

  const templatesDir = path.join(TEMPLATES_ROOT, "typescript");
  const partialsDir = path.join(templatesDir, "partials");
  registerPartials(partialsDir);

  const fileSpecs = getTypeScriptFileSpecs();

  // 3. Check output directory
  if (fs.existsSync(result.outputDir) && !options.force) {
    const contents = fs.readdirSync(result.outputDir);
    if (contents.length > 0) {
      result.errors.push(
        `Output directory is not empty: ${result.outputDir}. Use --force to overwrite.`
      );
      return result;
    }
  }

  // 4. Render and write each file
  const context: Record<string, unknown> = {
    ...ast,
    generatedAt: new Date().toISOString(),
    lang: options.lang,
  };

  for (const spec of fileSpecs) {
    const templatePath = path.join(templatesDir, spec.templateFile);

    if (!fs.existsSync(templatePath)) {
      result.warnings.push(`Template not found, skipping: ${spec.templateFile}`);
      continue;
    }

    try {
      const rendered = renderTemplate(templatePath, context);
      const outputPath = path.join(result.outputDir, spec.outputFile);
      writeFile(outputPath, rendered, options.force);
      result.filesCreated.push(spec.outputFile);
    } catch (err: unknown) {
      result.errors.push(
        `Error rendering ${spec.templateFile}: ${err instanceof Error ? err.message : String(err)}`
      );
    }
  }

  result.success = result.errors.length === 0;
  return result;
}
