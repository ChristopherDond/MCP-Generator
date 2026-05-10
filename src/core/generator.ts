import fs from "fs";
import path from "path";
import Handlebars from "handlebars";
import { parseOpenAPI } from "./parser";
import { renderTemplate, registerPartials } from "./templating";
import { extractHandlers, injectHandlers, TS_DEFAULT_STUB_PATTERN, PY_DEFAULT_STUB_PATTERN } from "./incremental";
import type { GeneratorOptions, GenerationResult, MCPServerAST } from "./types";

// From dist/core/generator.js → dist/templates/
const TEMPLATES_ROOT = path.resolve(__dirname, "../templates");

Handlebars.registerHelper(
  "includes",
  (arr: unknown[], val: unknown) => Array.isArray(arr) && arr.includes(val)
);

interface FileSpec {
  templateFile: string;
  outputFile: string;
}

function getTypeScriptFileSpecs(): FileSpec[] {
  return [
    { templateFile: "server.hbs",          outputFile: "src/server.ts" },
    { templateFile: "models.hbs",          outputFile: "src/models.ts" },
    { templateFile: "package.json.hbs",    outputFile: "package.json" },
    { templateFile: "tsconfig.json.hbs",   outputFile: "tsconfig.json" },
    { templateFile: "README.md.hbs",       outputFile: "README.md" },
    { templateFile: "client.hbs",          outputFile: "src/client.ts" },
    { templateFile: "Dockerfile.hbs",      outputFile: "Dockerfile" },
    { templateFile: "ci.yml.hbs",          outputFile: ".github/workflows/ci.yml" },
  ];
}

function getPythonFileSpecs(): FileSpec[] {
  return [
    { templateFile: "server.py.hbs",       outputFile: "server.py" },
    { templateFile: "models.py.hbs",       outputFile: "models.py" },
    { templateFile: "requirements.txt.hbs",outputFile: "requirements.txt" },
    { templateFile: "Dockerfile.hbs",      outputFile: "Dockerfile" },
    { templateFile: "README.md.hbs",       outputFile: "README.md" },
    { templateFile: "ci.yml.hbs",          outputFile: ".github/workflows/ci.yml" },
  ];
}

function ensureDir(dirPath: string): void {
  fs.mkdirSync(dirPath, { recursive: true });
}

function writeFile(filePath: string, content: string, force: boolean): void {
  if (fs.existsSync(filePath) && !force) {
    throw new Error(`File already exists: ${filePath}. Use --force to overwrite.`);
  }
  ensureDir(path.dirname(filePath));
  fs.writeFileSync(filePath, content, "utf-8");
}

export async function generate(options: GeneratorOptions): Promise<GenerationResult> {
  const result: GenerationResult = {
    success: false,
    outputDir: path.resolve(options.out),
    filesCreated: [],
    filesPreserved: [],
    errors: [],
    warnings: [],
  };

  // 1. Parse
  let ast: MCPServerAST;
  try {
    ast = await parseOpenAPI(options.input);
  } catch (err: unknown) {
    result.errors.push(err instanceof Error ? err.message : String(err));
    return result;
  }

  if (options.serverName) ast.serverName = options.serverName;
  if (options.serverVersion) ast.serverVersion = options.serverVersion;

  const stubTools = ast.tools.filter((t) => t.exampleResponse === null);
  if (stubTools.length > 0) {
    result.warnings.push(
      `${stubTools.length} tool(s) have no example response and will throw NotImplemented: ${stubTools.map((t) => t.name).join(", ")}`
    );
  }

  // 2. Select template set
  const isTs = options.lang === "typescript";
  const isPy = options.lang === "python";

  if (!isTs && !isPy) {
    result.errors.push(`Language "${options.lang}" is not supported. Use: typescript | python`);
    return result;
  }

  const langDir = isTs ? "typescript" : "python";

  // Build template roots: plugin-provided templates first (allow overrides), then core templates
  const templateRoots: string[] = [];

  // 2.a Load plugin-provided templates/helpers if any
  const pluginPaths = options.plugins ?? [];
  if (options.pluginsDir) {
    try {
      const scan = fs.readdirSync(path.resolve(options.pluginsDir));
      for (const entry of scan) {
        const candidate = path.resolve(options.pluginsDir, entry);
        if (fs.existsSync(candidate) && fs.lstatSync(candidate).isDirectory()) pluginPaths.push(candidate);
      }
    } catch (e) {
      // ignore
    }
  }

  for (const p of pluginPaths) {
    try {
      const pluginTemplates = path.join(p, "templates", langDir);
      if (fs.existsSync(pluginTemplates)) templateRoots.push(pluginTemplates);

      // If plugin exports a helper registration function, call it
      try {
        // dynamic import: plugin can be a folder with index.js or a module name
        // prefer absolute path
        const modPath = require.resolve(p, { paths: [process.cwd(), __dirname] });
        // eslint-disable-next-line @typescript-eslint/no-var-requires
        const mod = require(modPath);
        if (mod && typeof mod.registerHandlebars === "function") {
          try {
            mod.registerHandlebars(Handlebars);
          } catch (e) {
            // ignore plugin helper failures
          }
        }
      } catch (e) {
        // ignore failure to load plugin module
      }
    } catch (err) {
      // ignore plugin path issues
    }
  }

  const templatesDir = path.join(TEMPLATES_ROOT, langDir);
  templateRoots.push(templatesDir);

  // Register partials from plugin roots first, then core
  for (const root of templateRoots) {
    const partialsDir = path.join(root, "partials");
    registerPartials(partialsDir);
  }

  const fileSpecs = isTs ? getTypeScriptFileSpecs() : getPythonFileSpecs();

  // 3. Check output dir
  if (fs.existsSync(result.outputDir) && !options.force && !options.incremental) {
    const contents = fs.readdirSync(result.outputDir);
    if (contents.length > 0) {
      result.errors.push(
        `Output directory is not empty: ${result.outputDir}. Use --force to overwrite or --incremental to preserve handlers.`
      );
      return result;
    }
  }

  // 4. Incremental — extract existing handlers before overwriting
  const serverFile = isTs
    ? path.join(result.outputDir, "src/server.ts")
    : path.join(result.outputDir, "server.py");

  const extracted = options.incremental
    ? extractHandlers(serverFile)
    : { handlers: new Map() };

  // 5. Render and write
  const context: Record<string, unknown> = {
    ...ast,
    generatedAt: new Date().toISOString(),
    lang: options.lang,
    incremental: options.incremental,
  };

  for (const spec of fileSpecs) {
    // Find the first template file available from plugin roots then core templates
    let templatePath: string | null = null;
    for (const root of templateRoots) {
      const candidate = path.join(root, spec.templateFile);
      if (fs.existsSync(candidate)) {
        templatePath = candidate;
        break;
      }
    }
    if (!templatePath) {
      result.warnings.push(`Template not found, skipping: ${spec.templateFile}`);
      continue;
    }

    try {
      let rendered = renderTemplate(templatePath, context);

      // Apply incremental injection only to the server file
      const isServerFile =
        spec.outputFile === "src/server.ts" || spec.outputFile === "server.py";

      if (options.incremental && isServerFile && extracted.handlers.size > 0) {
        const stubPattern = isTs ? TS_DEFAULT_STUB_PATTERN : PY_DEFAULT_STUB_PATTERN;
        const { result: injected, preserved } = injectHandlers(rendered, extracted, stubPattern);
        rendered = injected;
        result.filesPreserved.push(...preserved);
      }

      const outputPath = path.join(result.outputDir, spec.outputFile);
      writeFile(outputPath, rendered, options.force || options.incremental);
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
