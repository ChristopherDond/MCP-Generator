import fs from "fs";
import path from "path";
import Handlebars from "handlebars";
import { parseOpenAPI } from "./parser";
import { renderTemplate, registerPartials } from "./templating";
import { extractHandlers, injectHandlers, TS_DEFAULT_STUB_PATTERN, PY_DEFAULT_STUB_PATTERN } from "./incremental";
import { validateOutputPath, validatePluginPath, validatePluginModule } from "./security";
import type { GeneratorOptions, GenerationResult, ValidateResult, MCPServerAST, Lang } from "./types";

// From dist/core/generator.js → dist/templates/
const TEMPLATES_ROOT = path.resolve(__dirname, "../templates");

const PKG_VERSION = (() => {
  try {
    return require("../package.json").version as string;
  } catch {
    return "0.0.0";
  }
})();

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

function getGoFileSpecs(): FileSpec[] {
  return [
    { templateFile: "server.go.hbs",       outputFile: "main.go" },
    { templateFile: "models.go.hbs",       outputFile: "models.go" },
    { templateFile: "client.go.hbs",       outputFile: "client.go" },
    { templateFile: "go.mod.hbs",          outputFile: "go.mod" },
    { templateFile: "README.md.hbs",       outputFile: "README.md" },
    { templateFile: "Dockerfile.hbs",      outputFile: "Dockerfile" },
    { templateFile: "ci.yml.hbs",          outputFile: ".github/workflows/ci.yml" },
  ];
}

function ensureDir(dirPath: string): void {
  fs.mkdirSync(dirPath, { recursive: true });
}

function writeFile(filePath: string, content: string, force: boolean, baseDir?: string): void {
  if (fs.existsSync(filePath) && !force) {
    throw new Error(`File already exists: ${filePath}. Use --force to overwrite.`);
  }
  // Validate path to prevent traversal attacks
  if (baseDir) {
    validateOutputPath(filePath, baseDir);
  }
  ensureDir(path.dirname(filePath));
  fs.writeFileSync(filePath, content, "utf-8");
}

function loadEnvFile(filePath: string | undefined): Record<string, string> {
  if (!filePath) return {};
  const abs = path.resolve(filePath);
  if (!fs.existsSync(abs)) return {};
  const out: Record<string, string> = {};
  for (const line of fs.readFileSync(abs, "utf-8").split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq).trim();
    let val = trimmed.slice(eq + 1).trim();
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
      val = val.slice(1, -1);
    }
    if (key) out[key] = val;
  }
  return out;
}

export async function validateSpec(input: string): Promise<ValidateResult> {
  const result: ValidateResult = {
    valid: false,
    tools: 0,
    models: 0,
    baseUrl: "",
    errors: [],
    warnings: [],
  };
  try {
    const ast = await parseOpenAPI(input);
    result.valid = true;
    result.tools = ast.tools.length;
    result.models = ast.models.length;
    result.baseUrl = ast.baseUrl;

    const seenNames = new Map<string, number>();
    for (const t of ast.tools) {
      seenNames.set(t.name, (seenNames.get(t.name) ?? 0) + 1);
    }
    for (const [name, count] of seenNames) {
      if (count > 1) result.warnings.push(`Tool name collision resolved: "${name}" appears ${count}x (unique suffixes added)`);
    }

    const noExample = ast.tools.filter((t) => t.exampleResponse === null);
    if (noExample.length > 0) {
      result.warnings.push(
        `${noExample.length} tool(s) have no example response: ${noExample.map((t) => t.name).join(", ")}`
      );
    }
  } catch (err: unknown) {
    result.errors.push(err instanceof Error ? err.message : String(err));
  }
  return result;
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

  ast.generatorVersion = PKG_VERSION;
  if (options.serverName) ast.serverName = options.serverName;
  if (options.serverVersion) ast.serverVersion = options.serverVersion;

  const stubTools = ast.tools.filter((t) => t.exampleResponse === null && !options.http);
  if (stubTools.length > 0) {
    result.warnings.push(
      `${stubTools.length} tool(s) have no example response and will throw NotImplemented: ${stubTools.map((t) => t.name).join(", ")}`
    );
  }

  // 2. Select template set
  const isTs = options.lang === "typescript";
  const isPy = options.lang === "python";
  const isGo = options.lang === "go";

  if (!isTs && !isPy && !isGo) {
    result.errors.push(`Language "${options.lang}" is not supported. Use: typescript | python | go`);
    return result;
  }

  const langDir = isTs ? "typescript" : isPy ? "python" : "go";

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
      // Security: validate plugin path to prevent path traversal
      validatePluginPath(p);

      const pluginTemplates = path.join(p, "templates", langDir);
      if (fs.existsSync(pluginTemplates)) templateRoots.push(pluginTemplates);

      // Security: Only load plugin modules if explicitly in safe mode
      // By default, only templates are loaded, not dynamic code
      if (process.env.MCP_GEN_ALLOW_PLUGINS === "true") {
        try {
          // dynamic import: plugin can be a folder with index.js or a module name
          // prefer absolute path
          const modPath = require.resolve(p, { paths: [process.cwd(), __dirname] });
          // eslint-disable-next-line @typescript-eslint/no-var-requires
          const mod = require(modPath);

          if (mod) {
            // Security: validate plugin module structure
            validatePluginModule(mod);

            if (typeof mod.registerHandlebars === "function") {
              try {
                mod.registerHandlebars(Handlebars);
              } catch (e) {
                result.warnings.push(`Failed to register plugin helpers from ${p}: ${e instanceof Error ? e.message : String(e)}`);
              }
            }
          }
        } catch (e) {
          result.warnings.push(`Failed to load plugin module from ${p}: ${e instanceof Error ? e.message : String(e)}`);
        }
      }
    } catch (err) {
      result.errors.push(`Invalid plugin path: ${p} - ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  const templatesDir = path.join(TEMPLATES_ROOT, langDir);
  templateRoots.push(templatesDir);

  // Register partials from plugin roots first, then core
  for (const root of templateRoots) {
    const partialsDir = path.join(root, "partials");
    registerPartials(partialsDir);
  }

  const fileSpecs = isTs ? getTypeScriptFileSpecs() : isPy ? getPythonFileSpecs() : getGoFileSpecs();

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
    : isPy
      ? path.join(result.outputDir, "server.py")
      : path.join(result.outputDir, "main.go");

  const extracted = options.incremental
    ? extractHandlers(serverFile)
    : { handlers: new Map() };

  // 5. Render and write
  const env = loadEnvFile(options.envFile);

  const context: Record<string, unknown> = {
    ...ast,
    generatedAt: new Date().toISOString(),
    lang: options.lang,
    langDir,
    incremental: options.incremental,
    http: options.http,
    env,
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
        spec.outputFile === "src/server.ts" ||
        spec.outputFile === "server.py" ||
        spec.outputFile === "main.go";

      if (options.incremental && isServerFile && extracted.handlers.size > 0) {
        const stubPattern = isTs ? TS_DEFAULT_STUB_PATTERN : PY_DEFAULT_STUB_PATTERN;
        const { result: injected, preserved } = injectHandlers(rendered, extracted, stubPattern);
        rendered = injected;
        result.filesPreserved.push(...preserved);
      }

      const outputPath = path.join(result.outputDir, spec.outputFile);
      writeFile(outputPath, rendered, options.force || options.incremental, result.outputDir);
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
