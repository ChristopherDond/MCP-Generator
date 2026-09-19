import fs from "fs";
import path from "path";
import Handlebars from "handlebars";
import { parseOpenAPI } from "./parser";
import { renderTemplate, registerPartials } from "./templating";
import { extractHandlers, injectHandlers, isCustomFile, TS_DEFAULT_STUB_PATTERN, PY_DEFAULT_STUB_PATTERN } from "./incremental";
import { validateOutputPath, validatePluginPath, validatePluginModule } from "./security";
import { parseTagList, parsePathList, parseGroupBy, loadOperationAllowlistFile, resolveAllowlistValue, filterTools, groupTools, toGroupMetadata } from "./filter-group";
import type { GeneratorOptions, GenerationResult, ValidateResult, MCPServerAST, Lang, GroupByMode } from "./types";

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
    { templateFile: "auth.hbs",            outputFile: "src/auth.ts" },
    { templateFile: "handlers.custom.hbs", outputFile: "src/handlers.custom.ts" },
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
    { templateFile: "auth.py.hbs",         outputFile: "auth.py" },
    { templateFile: "handlers_custom.py.hbs", outputFile: "handlers_custom.py" },
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
    { templateFile: "auth.go.hbs",         outputFile: "auth.go" },
    { templateFile: "handlers_custom.go.hbs", outputFile: "handlers_custom.go" },
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

  let groupBy: GroupByMode | undefined;
  try {
    groupBy = parseGroupBy(options.groupBy);
  } catch (err: unknown) {
    result.errors.push(err instanceof Error ? err.message : String(err));
    return result;
  }
  let allowlist: string[] = [];
  try {
    allowlist = [...parseTagList(options.operationAllowlist ?? [])];
    if (options.operationAllowlistFile) {
      const resolved = resolveAllowlistValue(options.operationAllowlistFile);
      if (resolved.file) allowlist.push(...loadOperationAllowlistFile(resolved.file));
      else allowlist.push(...resolved.inline);
    }
  } catch (err: unknown) {
    result.errors.push(err instanceof Error ? err.message : String(err));
    return result;
  }
  ast.tools = filterTools(ast.tools, {
    includeTags: parseTagList(options.includeTags ?? []),
    excludeTags: parseTagList(options.excludeTags ?? []),
    pathPrefix: options.pathPrefix ?? "",
    includePaths: parsePathList(options.includePaths ?? []),
    excludePaths: parsePathList(options.excludePaths ?? []),
    allowlist,
  });
  if (groupBy) {
    const grouped = groupTools(ast.tools, groupBy);
    ast.groups = toGroupMetadata(grouped);
    ast.tools = grouped;
  } else {
    ast.groups = [];
  }

  const stubTools = ast.tools.filter((t) => t.exampleResponse === null && !options.http && !t.isGroup);
  if (stubTools.length > 0) {
    result.warnings.push(
      `${stubTools.length} tool(s) have no example response and will throw NotImplemented: ${stubTools.map((t) => t.name).join(", ")}`
    );
  }

  const isTs = options.lang === "typescript";
  const isPy = options.lang === "python";
  const isGo = options.lang === "go";

  if (!isTs && !isPy && !isGo) {
    result.errors.push(`Language "${options.lang}" is not supported. Use: typescript | python | go`);
    return result;
  }

  const langDir = isTs ? "typescript" : isPy ? "python" : "go";

  const templateRoots: string[] = [];

  const pluginPaths = options.plugins ?? [];
  if (options.pluginsDir) {
    try {
      const scan = fs.readdirSync(path.resolve(options.pluginsDir));
      for (const entry of scan) {
        const candidate = path.resolve(options.pluginsDir, entry);
        if (fs.existsSync(candidate) && fs.lstatSync(candidate).isDirectory()) pluginPaths.push(candidate);
      }
    } catch (e) {
    }
  }

  for (const p of pluginPaths) {
    try {
      validatePluginPath(p);

      const pluginTemplates = path.join(p, "templates", langDir);
      if (fs.existsSync(pluginTemplates)) templateRoots.push(pluginTemplates);

      if (process.env.MCP_GEN_ALLOW_PLUGINS === "true") {
        try {
          const modPath = require.resolve(p, { paths: [process.cwd(), __dirname] });
          const mod = require(modPath);

          if (mod) {
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

  for (const root of templateRoots) {
    const partialsDir = path.join(root, "partials");
    registerPartials(partialsDir);
  }

  const fileSpecs = isTs ? getTypeScriptFileSpecs() : isPy ? getPythonFileSpecs() : getGoFileSpecs();

  if (fs.existsSync(result.outputDir) && !options.force && !options.incremental) {
    const contents = fs.readdirSync(result.outputDir);
    if (contents.length > 0) {
      result.errors.push(
        `Output directory is not empty: ${result.outputDir}. Use --force to overwrite or --incremental to preserve handlers.`
      );
      return result;
    }
  }

  const serverFile = isTs
    ? path.join(result.outputDir, "src/server.ts")
    : isPy
      ? path.join(result.outputDir, "server.py")
      : path.join(result.outputDir, "main.go");

  const extracted = options.incremental
    ? extractHandlers(serverFile)
    : { handlers: new Map() };

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
      if (isCustomFile(spec.outputFile) && fs.existsSync(outputPath) && !options.force) {
        result.warnings.push(`Skipped custom file (never overwritten without --force): ${spec.outputFile}`);
        continue;
      }
      const existing = fs.existsSync(outputPath) ? fs.readFileSync(outputPath, "utf-8") : null;
      writeFile(outputPath, rendered, options.force || options.incremental, result.outputDir);
      if (existing !== null && isServerFile && existing !== rendered && !options.force && options.incremental) {
        result.warnings.push(`Merged ${spec.outputFile}: custom handlers preserved (3-way: base stub vs custom vs new template). Use --force to ignore.`);
      }
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
