#!/usr/bin/env node
import { Command } from "commander";
import chalk from "chalk";
import ora from "ora";
import path from "path";
import { generate, validateSpec } from "../core/generator";
import type { GeneratorOptions, Lang } from "../core/types";
import { fetchSpecToCwd, listKnownSpecs, getSpecInfo } from "../core/registry";
import { buildWatchGeneratorOptions } from "./watch-options";
import type { SecurityReport } from "../core/security-lint";
import fs from "fs";
import inquirer from "inquirer";

const SUPPORTED_LANGS: Lang[] = ["typescript", "python", "go"];
const SUPPORTED_EXTS = [".json", ".yaml", ".yml"];

const VERSION = (() => {
  try {
    return require("../../package.json").version as string;
  } catch {
    return "0.0.0";
  }
})();

function resolveInput(input: string): string {
  if (input.startsWith("http://") || input.startsWith("https://")) return input;
  return path.resolve(input);
}

function validateLang(lang: string): asserts lang is Lang {
  if (!SUPPORTED_LANGS.includes(lang as Lang)) {
    console.error(
      chalk.red(`\n  ✗ Unsupported language: "${lang}". Choose: ${SUPPORTED_LANGS.join(" | ")}\n`)
    );
    process.exit(1);
  }
}

function validateInputExt(input: string): void {
  if (input.startsWith("http")) return;
  const ext = path.extname(input).toLowerCase();
  if (!SUPPORTED_EXTS.includes(ext)) {
    console.error(
      chalk.red(`\n  ✗ Unsupported file extension: "${ext}". Accepted: ${SUPPORTED_EXTS.join(", ")}\n`)
    );
    process.exit(1);
  }
}

const program = new Command();

program
  .name("mcp-gen")
  .description("OpenAPI to MCP Server generator")
  .version(VERSION);

program
  .command("generate")
  .alias("g")
  .description("Generate an MCP server from an OpenAPI spec (JSON or YAML)")
  .requiredOption("-i, --input <path>", "Path or URL to the OpenAPI spec (.json | .yaml | .yml)")
  .option("-l, --lang <language>", `Target language: ${SUPPORTED_LANGS.join(" | ")}`, "typescript")
  .option("-o, --out <dir>", "Output directory for the generated project", "./mcp-server")
  .option("-f, --force", "Overwrite existing files, ignoring preserved handlers and custom files (skips 3-way merge)", false)
  .option("--incremental", "Preserve custom code between @@mcp-gen markers and <generated:handlers> on re-generation (3-way merge; handlers.custom.* is never overwritten without --force)", false)
  .option("--http", "Generate handlers that call the real API over HTTP instead of returning example stubs", false)
  .option("--env-file <path>", "Path to an .env-style file whose TOKEN/BASE_URL are embedded into the generated client")
  .option("--name <name>", "Override the server name")
  .option("--server-version <version>", "Override the server version")
  .option("--include-tags <tags>", "Comma-separated tags to include (only tools with one of these tags)")
  .option("--exclude-tags <tags>", "Comma-separated tags to exclude")
  .option("--path-prefix <glob>", "Only include operations whose path matches this prefix or glob (/users/**, /pets/*)")
  .option("--include-paths <globs>", "Comma-separated path globs to include (/users/**,/orders/*)")
  .option("--exclude-paths <globs>", "Comma-separated path globs to exclude")
  .option("--operation-allowlist <ops>", "Comma-separated operationIds/tool names/METHOD path list, or path to allowlist file (JSON array or line/comma separated)")
  .option("--group-by <mode>", "Group endpoints into one tool per group: tag | path-prefix")
  .option("--dry-run", "List tools/models/groups/files that would be generated without writing anything", false)
  .option("--json", "Output the generation summary as machine-readable JSON", false)
  .option("--plugin <path>", "Path to a plugin module or folder to load", (val, acc) => {
    if (!acc) return [val];
    acc.push(val);
    return acc;
  }, [] as string[])
  .action(async (opts) => {
    validateLang(opts.lang);
    const input = resolveInput(opts.input);
    validateInputExt(input);

    const plugins = (opts.plugin as string[] | undefined) ?? [];

    const options: GeneratorOptions = {
      input,
      lang: opts.lang as Lang,
      out: path.resolve(opts.out),
      force: opts.force,
      incremental: opts.incremental,
      http: opts.http,
      envFile: opts.envFile,
      plugins,
      serverName: opts.name,
      serverVersion: opts.serverVersion,
      includeTags: opts.includeTags ? [opts.includeTags] : undefined,
      excludeTags: opts.excludeTags ? [opts.excludeTags] : undefined,
      pathPrefix: opts.pathPrefix,
      includePaths: opts.includePaths ? [opts.includePaths] : undefined,
      excludePaths: opts.excludePaths ? [opts.excludePaths] : undefined,
      operationAllowlistFile: opts.operationAllowlist,
      groupBy: opts.groupBy,
      dryRun: Boolean(opts.dryRun),
    };

    if (opts.json) {
      try {
        const result = await generate(options);
        console.log(JSON.stringify({
          success: result.success,
          dryRun: Boolean(result.dryRun),
          summary: result.summary ?? null,
          files: result.filesCreated,
          warnings: result.warnings,
          errors: result.errors,
        }, null, 2));
        if (!result.success) process.exit(1);
      } catch (err: unknown) {
        console.log(JSON.stringify({
          success: false,
          dryRun: Boolean(options.dryRun),
          summary: null,
          files: [],
          warnings: [],
          errors: [err instanceof Error ? err.message : String(err)],
        }, null, 2));
        process.exit(1);
      }
      return;
    }

    console.log(chalk.bold("\nmcp-gen") + ` v${VERSION} — OpenAPI to MCP Server\n`);
    console.log(`  Input:       ${chalk.cyan(options.input)}`);
    console.log(`  Language:    ${chalk.cyan(options.lang)}`);
    console.log(`  Output:      ${chalk.cyan(options.out)}`);
    if (options.http) {
      console.log(`  HTTP mode:   ${chalk.green("on — handlers will call the real API")}`);
    }
    if (options.incremental) {
      console.log(`  Incremental: ${chalk.yellow("on — custom handlers will be preserved")}`);
    }
    console.log();

    const spinner = ora("Parsing OpenAPI spec...").start();

    try {
      const result = await generate(options);

      if (result.warnings.length > 0) {
        spinner.warn("Completed with warnings");
        for (const w of result.warnings) console.log(chalk.yellow(`  ⚠ ${w}`));
        console.log();
      }

      if (!result.success) {
        spinner.fail("Generation failed");
        for (const err of result.errors) console.error(chalk.red(`  ✗ ${err}`));
        process.exit(1);
      }

      spinner.succeed(options.dryRun ? "Dry run complete (no files written)" : "Generation complete");
      if (options.dryRun && result.summary) {
        console.log(chalk.green(`\n  ✓ ${result.summary.tools} tools, ${result.summary.models} models, ${result.summary.groups} groups — ${result.filesCreated.length} files would be created\n`));
      } else {
        console.log(chalk.green(`\n  ✓ ${result.filesCreated.length} files created\n`));
      }
      for (const f of result.filesCreated) {
        console.log(`    ${chalk.dim(result.outputDir + "/")}${f}`);
      }

      if (options.dryRun) {
        return;
      }

      if (result.filesPreserved && result.filesPreserved.length > 0) {
        console.log(chalk.cyan(`\n  ↺ ${result.filesPreserved.length} handler(s) preserved\n`));
        for (const f of result.filesPreserved) console.log(`    ${chalk.dim("↺ ")}${f}`);
      }

      const isTs = options.lang === "typescript";
      const isPy = options.lang === "python";
      console.log(chalk.bold("\nNext steps:\n"));
      console.log(`  cd ${opts.out}`);
      if (isTs) {
        console.log("  npm install");
        console.log("  npm run build");
        console.log("  npm start\n");
      } else if (isPy) {
        console.log("  pip install -r requirements.txt");
        console.log("  python server.py\n");
      } else {
        console.log("  go mod tidy");
        console.log("  go run .\n");
      }
    } catch (err: unknown) {
      spinner.fail("Unexpected error");
      console.error(chalk.red(err instanceof Error ? err.message : String(err)));
      process.exit(1);
    }
  });

program
  .command("validate")
  .alias("v")
  .description("Validate an OpenAPI spec without generating")
  .requiredOption("-i, --input <path>", "Path or URL to the OpenAPI spec")
  .action(async (opts) => {
    const input = resolveInput(opts.input);
    validateInputExt(input);
    const spinner = ora("Validating spec...").start();
    try {
      const result = await validateSpec(input);
      if (!result.valid) {
        spinner.fail("Spec is invalid");
        for (const err of result.errors) console.error(chalk.red(`  ✗ ${err}`));
        process.exit(1);
      }
      spinner.succeed("Spec is valid");
      console.log(chalk.dim(`\n  Tools: ${result.tools}  Models: ${result.models}  Base URL: ${result.baseUrl}\n`));
      if (result.warnings.length > 0) {
        console.log(chalk.yellow(`  ${result.warnings.length} warning(s):`));
        for (const w of result.warnings) console.log(chalk.yellow(`  ⚠ ${w}`));
        console.log();
      }
    } catch (err: unknown) {
      spinner.fail("Validation failed");
      console.error(chalk.red(err instanceof Error ? err.message : String(err)));
      process.exit(1);
    }
  });

program
  .command("init")
  .description("Initialize a local spec from a known public registry (e.g. stripe, github)")
  .requiredOption("--from <key>", "Registry key to fetch spec from. Use 'list' to show known keys")
  .option("--generate", "Run generation after fetching the spec", false)
  .option("-i, --input <path>", "If provided, use this as the saved filename instead of the registry default")
  .option("-l, --lang <language>", `Target language: ${SUPPORTED_LANGS.join(" | ")}`, "typescript")
  .option("-o, --out <dir>", "Output directory for the generated project", "./mcp-server")
  .action(async (opts) => {
    const key = opts.from;
    try {
      if (key === "list") {
        const specs = listKnownSpecs();
        console.log(chalk.bold("\nKnown Public Specs:\n"));
        for (const k of specs) {
          const info = getSpecInfo(k);
          console.log(chalk.cyan(`  ${k.padEnd(15)}`), info?.description || "");
        }
        console.log("\n" + chalk.dim(`Usage: mcp-gen init --from <key> [--generate -o ./output]`));
        console.log(chalk.dim(`Example: mcp-gen init --from stripe --generate -o ./stripe-mcp\n`));
        return;
      }

      const spinner = ora(`Fetching ${key}...`).start();
      const saved = await fetchSpecToCwd(key, opts.input ? resolveInput(opts.input) : undefined);
      spinner.succeed(`Saved spec to ${chalk.green(path.basename(saved))}`);

      if (opts.generate) {
        const input = saved;
        validateInputExt(input);
        const options: GeneratorOptions = {
          input,
          lang: opts.lang as GeneratorOptions["lang"],
          out: path.resolve(opts.out),
          force: false,
          incremental: false,
          http: false,
        };
        const result = await generate(options);
        if (!result.success) {
          for (const err of result.errors) console.error(chalk.red(`  ✗ ${err}`));
          process.exit(1);
        }
      }
    } catch (err: unknown) {
      console.error(chalk.red(err instanceof Error ? err.message : String(err)));
      process.exit(1);
    }
  });

program
  .command("security")
  .alias("sec")
  .description("Scan a generated MCP project for security and lint issues")
  .requiredOption("-p, --project <path>", "Path to the generated MCP project to scan")
  .option("--fail-on-warn", "Exit with code 1 if warnings are found", false)
  .option("--json", "Output results as JSON", false)
  .action(async (opts) => {
    const projectPath = path.resolve(opts.project);

    if (!fs.existsSync(projectPath)) {
      console.error(chalk.red(`\n  ✗ Project not found: ${projectPath}\n`));
      process.exit(1);
    }

    console.log(chalk.bold("\nmcp-gen security") + ` v${VERSION} — Security & Lint Scan\n`);
    console.log(`  Project:    ${chalk.cyan(projectPath)}\n`);

    const { scanProject, formatReport } = await import("../core/security-lint");

    const spinner = ora("Scanning project...").start();

    try {
      const report = await scanProject(projectPath);

      if (opts.json) {
        spinner.stop();
        console.log(JSON.stringify(report, null, 2));
      } else {
        spinner.succeed("Scan complete");
        console.log(formatReport(report));
      }

      if (!report.passed || (opts.failOnWarn && report.summary.warnings > 0)) {
        process.exit(1);
      }
    } catch (err: unknown) {
      spinner.fail("Scan failed");
      console.error(chalk.red(err instanceof Error ? err.message : String(err)));
      process.exit(1);
    }
  });

program
  .command("watch")
  .description("Watch a spec (file or URL) and regenerate on changes")
  .requiredOption("-i, --input <path>", "Path or URL to the OpenAPI spec to watch")
  .option("-l, --lang <language>", `Target language: ${SUPPORTED_LANGS.join(" | ")}`, "typescript")
  .option("-o, --out <dir>", "Output directory for the generated project", "./mcp-server")
  .option("--once", "Run generation once on first change then exit", false)
  .option("--interval <ms>", "Polling interval for URL inputs (ms)", "30000")
  .option("--plugin <path>", "Path to a plugin module or folder to load", (val, acc) => {
    if (!acc) return [val];
    acc.push(val);
    return acc;
  }, [] as string[])
  .option("-f, --force", "Overwrite existing files on regeneration", false)
  .option("--incremental", "Preserve custom handlers on regeneration", true)
  .option("--no-incremental", "Disable handler preservation on regeneration")
  .option("--http", "Generate handlers that call the real API over HTTP", false)
  .option("--include-tags <tags>", "Comma-separated tags to include (only tools with one of these tags)")
  .option("--exclude-tags <tags>", "Comma-separated tags to exclude")
  .option("--path-prefix <glob>", "Only include operations whose path matches this prefix or glob (/users/**, /pets/*)")
  .option("--include-paths <globs>", "Comma-separated path globs to include (/users/**,/orders/*)")
  .option("--exclude-paths <globs>", "Comma-separated path globs to exclude")
  .option("--operation-allowlist <ops>", "Comma-separated operationIds/tool names/METHOD path list, or path to allowlist file")
  .option("--group-by <mode>", "Group endpoints into one tool per group: tag | path-prefix")
  .action(async (opts) => {
    const input = resolveInput(opts.input);
    validateInputExt(input);
    validateLang(opts.lang);

    const runGenerate = async (): Promise<boolean> => {
      const options: GeneratorOptions = buildWatchGeneratorOptions(input, path.resolve(opts.out), {
        lang: opts.lang,
        force: opts.force,
        incremental: opts.incremental,
        http: opts.http,
        plugins: opts.plugin as string[] | undefined,
        includeTags: opts.includeTags,
        excludeTags: opts.excludeTags,
        pathPrefix: opts.pathPrefix,
        includePaths: opts.includePaths,
        excludePaths: opts.excludePaths,
        operationAllowlist: opts.operationAllowlist,
        groupBy: opts.groupBy,
      });
      console.log(chalk.dim(`[watch] regenerating from ${opts.input} → ${options.out}`));
      try {
        const res = await generate(options);
        if (!res.success) {
          console.error(chalk.red("Generation failed:"));
          for (const e of res.errors) console.error(chalk.red(`  ${e}`));
          return false;
        }
        console.log(chalk.green(`[watch] generated ${res.filesCreated.length} files`));
        return true;
      } catch (e: unknown) {
        console.error(chalk.red(String(e)));
        return false;
      }
    };

    if (opts.input.startsWith("http://") || opts.input.startsWith("https://")) {
      let last = "";
      const interval = Number(opts.interval) || 30000;
      console.log(chalk.dim(`[watch] polling ${opts.input} every ${interval}ms`));
      const check = async (): Promise<boolean> => {
        try {
          const r = await fetch(opts.input);
          if (!r.ok) throw new Error(`HTTP ${r.status}`);
          const body = await r.text();
          if (!last) {
            last = body;
            return runGenerate();
          }
          if (body !== last) {
            last = body;
            return runGenerate();
          }
          return true;
        } catch (e) {
          console.error(chalk.red(String(e)));
          return false;
        }
      };
      const initialSuccess = await check();
      if (opts.once) {
        process.exitCode = initialSuccess ? 0 : 1;
        return;
      }
      setInterval(check, interval);
      return;
    }

    const abs = path.resolve(opts.input);
    if (!fs.existsSync(abs)) {
      console.error(chalk.red(`File not found: ${abs}`));
      process.exit(1);
    }

    let timeout: NodeJS.Timeout | null = null;
    const watcher = fs.watch(abs, async () => {
      if (timeout) clearTimeout(timeout);
      timeout = setTimeout(async () => {
        const success = await runGenerate();
        if (opts.once) {
          watcher.close();
          process.exitCode = success ? 0 : 1;
        }
      }, 200);
    });

    console.log(chalk.dim(`[watch] watching ${abs}`));
    const initialSuccess = await runGenerate();
    if (opts.once) {
      watcher.close();
      process.exitCode = initialSuccess ? 0 : 1;
    }
  });

async function interactive(): Promise<void> {
  while (true) {
    const { cmd } = await inquirer.prompt<{ cmd: string }>([
      {
        type: "list",
        name: "cmd",
        message: "Choose an action:",
        choices: [
          { name: "Generate (Generate an MCP server from a spec)", value: "generate" },
          { name: "Validate (Validate an OpenAPI spec)", value: "validate" },
          { name: "Init (Download a known public spec)", value: "init" },
          { name: "Watch (Watch and auto-regenerate on changes)", value: "watch" },
          { name: "Security (Scan project for security/lint issues)", value: "security" },
          { name: "Exit", value: "exit" },
        ],
      },
    ]);

    if (cmd === "exit") return;

    if (cmd === "generate") {
      const answers = await inquirer.prompt([
        { type: "input", name: "input", message: "Path or URL to the OpenAPI spec (.json|.yaml):" },
        { type: "list", name: "lang", message: "Target language:", choices: [...SUPPORTED_LANGS] },
        { type: "input", name: "out", message: "Output directory:", default: "./mcp-server" },
        { type: "confirm", name: "force", message: "Overwrite existing files?", default: false },
        { type: "confirm", name: "incremental", message: "Preserve custom handlers?", default: false },
        { type: "confirm", name: "http", message: "Generate real HTTP handlers?", default: false },
        { type: "input", name: "name", message: "Server name (optional):", default: "" },
        { type: "input", name: "serverVersion", message: "Server version (optional):", default: "" },
        { type: "input", name: "includeTags", message: "Only include these tags (comma-separated, optional):", default: "" },
        { type: "input", name: "excludeTags", message: "Exclude these tags (comma-separated, optional):", default: "" },
        { type: "input", name: "pathPrefix", message: "Only include paths matching this prefix/glob (optional):", default: "" },
        { type: "list", name: "groupBy", message: "Group endpoints?", choices: ["none", "tag", "path-prefix"], default: "none" },
      ]);

      const input = resolveInput(answers.input as string);
      validateInputExt(input);
      validateLang(answers.lang as string);

      const options: GeneratorOptions = {
        input,
        lang: answers.lang as GeneratorOptions["lang"],
        out: path.resolve(answers.out as string),
        force: Boolean(answers.force),
        incremental: Boolean(answers.incremental),
        http: Boolean(answers.http),
        plugins: [],
        serverName: answers.name || undefined,
        serverVersion: answers.serverVersion || undefined,
        includeTags: answers.includeTags ? [answers.includeTags as string] : undefined,
        excludeTags: answers.excludeTags ? [answers.excludeTags as string] : undefined,
        pathPrefix: (answers.pathPrefix as string) || undefined,
        groupBy: answers.groupBy === "none" ? undefined : (answers.groupBy as GeneratorOptions["groupBy"]),
      };

      console.log(chalk.bold("\nmcp-gen") + " — OpenAPI to MCP Server\n");
      const spinner = ora("Parsing OpenAPI spec...").start();
      try {
        const result = await generate(options);
        if (result.warnings.length > 0) {
          spinner.warn("Completed with warnings");
          for (const w of result.warnings) console.log(chalk.yellow(`  ⚠ ${w}`));
          console.log();
        }
        if (!result.success) {
          spinner.fail("Generation failed");
          for (const err of result.errors) console.error(chalk.red(`  ✗ ${err}`));
        } else {
          spinner.succeed("Generation complete");
          console.log(chalk.green(`\n  ✓ ${result.filesCreated.length} files created\n`));
        }
      } catch (err: unknown) {
        spinner.fail("Unexpected error");
        console.error(chalk.red(err instanceof Error ? err.message : String(err)));
      }
    }

    if (cmd === "validate") {
      const { input } = await inquirer.prompt([{ type: "input", name: "input", message: "Path or URL to the OpenAPI spec:" }]);
      const resolved = resolveInput(input as string);
      validateInputExt(resolved);
      const spinner = ora("Validating spec...").start();
      try {
        const { parseOpenAPI } = await import("../core/parser");
        const ast = await parseOpenAPI(resolved);
        spinner.succeed("Spec is valid");
        console.log(chalk.dim(`\n  Tools: ${ast.tools.length}  Models: ${ast.models.length}  Base URL: ${ast.baseUrl}\n`));
        for (const w of ast.warnings ?? []) console.log(chalk.yellow(`  ⚠ Partial schema support: ${w}`));
        if ((ast.warnings ?? []).length > 0) console.log();
      } catch (err: unknown) {
        spinner.fail("Validation failed");
        console.error(chalk.red(err instanceof Error ? err.message : String(err)));
      }
    }

    if (cmd === "init") {
      const specs = listKnownSpecs();
      const { key } = await inquirer.prompt([
        {
          type: "list",
          name: "key",
          message: "Which public spec?",
          choices: specs.map((k) => ({
            name: `${k.padEnd(15)} — ${getSpecInfo(k)?.description || ""}`,
            value: k,
          })),
        },
      ]);

      try {
        const spinner = ora(`Downloading ${key}...`).start();
        const saved = await fetchSpecToCwd(key as string);
        spinner.succeed(`Saved to ${chalk.green(path.basename(saved))}`);

        const { autoGen } = await inquirer.prompt([
          {
            type: "confirm",
            name: "autoGen",
            message: "Generate MCP server now?",
            default: true,
          },
        ]);

        if (autoGen) {
          const { lang, out } = await inquirer.prompt([
            {
              type: "list",
              name: "lang",
              message: "Target language:",
              choices: [...SUPPORTED_LANGS],
            },
            {
              type: "input",
              name: "out",
              message: "Output directory:",
              default: `./${key}-mcp`,
            },
          ]);

          const options: GeneratorOptions = {
            input: resolveInput(saved),
            lang: lang as GeneratorOptions["lang"],
            out: path.resolve(out as string),
            force: false,
            incremental: false,
            http: false,
          };

          const genSpinner = ora("Generating MCP server...").start();
          try {
            const result = await generate(options);
            if (result.warnings.length > 0) {
              genSpinner.warn("Generated with warnings");
              for (const w of result.warnings) console.log(chalk.yellow(`  ⚠ ${w}`));
            }
            if (!result.success) {
              genSpinner.fail("Generation failed");
              for (const err of result.errors) console.error(chalk.red(`  ✗ ${err}`));
            } else {
              genSpinner.succeed("MCP server generated!");
              console.log(chalk.green(`\n  ✓ ${result.filesCreated.length} files created\n`));
              console.log(chalk.bold("Next steps:\n"));
              console.log(`  cd ${out as string}`);
              console.log(lang === "typescript" ? "  npm install && npm run build\n" : "  pip install -r requirements.txt\n");
            }
          } catch (err: unknown) {
            genSpinner.fail("Generation error");
            console.error(chalk.red(err instanceof Error ? err.message : String(err)));
          }
        }
      } catch (err: unknown) {
        console.error(chalk.red(err instanceof Error ? err.message : String(err)));
      }
    }

    if (cmd === "watch") {
      const answers = await inquirer.prompt([
        { type: "input", name: "input", message: "Path or URL to the OpenAPI spec:" },
        { type: "list", name: "lang", message: "Target language:", choices: [...SUPPORTED_LANGS] },
        { type: "input", name: "out", message: "Output directory:", default: "./mcp-server" },
        { type: "confirm", name: "http", message: "Generate real HTTP handlers?", default: false },
        { type: "input", name: "includeTags", message: "Only include these tags (comma-separated, optional):", default: "" },
        { type: "input", name: "excludeTags", message: "Exclude these tags (comma-separated, optional):", default: "" },
        { type: "input", name: "pathPrefix", message: "Only include paths matching this prefix/glob (optional):", default: "" },
        { type: "list", name: "groupBy", message: "Group endpoints?", choices: ["none", "tag", "path-prefix"], default: "none" },
      ]);

      const input = resolveInput(answers.input as string);
      validateInputExt(input);
      validateLang(answers.lang as string);

      const runGenerate = async () => {
        const options: GeneratorOptions = buildWatchGeneratorOptions(input, path.resolve(answers.out as string), {
          lang: answers.lang as string,
          http: Boolean(answers.http),
          includeTags: (answers.includeTags as string) || undefined,
          excludeTags: (answers.excludeTags as string) || undefined,
          pathPrefix: (answers.pathPrefix as string) || undefined,
          groupBy: answers.groupBy === "none" ? undefined : (answers.groupBy as string),
        });
        console.log(chalk.dim(`[watch] regenerating from ${answers.input} → ${options.out}`));
        try {
          const res = await generate(options);
          if (!res.success) {
            console.error(chalk.red("Generation failed:"));
            for (const e of res.errors) console.error(chalk.red(`  ${e}`));
          } else {
            console.log(chalk.green(`[watch] generated ${res.filesCreated.length} files`));
          }
        } catch (e: unknown) {
          console.error(chalk.red(String(e)));
        }
      };

      if (answers.input.startsWith("http://") || answers.input.startsWith("https://")) {
        console.log(chalk.dim(`[watch] polling ${answers.input} every 30000ms`));
        let last = "";
        const check = async () => {
          try {
            const r = await fetch(answers.input as string);
            if (!r.ok) throw new Error(`HTTP ${r.status}`);
            const body = await r.text();
            if (!last) {
              last = body;
              await runGenerate();
              return;
            }
            if (body !== last) {
              last = body;
              await runGenerate();
            }
          } catch (e) {
            console.error(chalk.red(String(e)));
          }
        };
        await check();
        setInterval(check, 30000);
      } else {
        const abs = path.resolve(answers.input as string);
        if (!fs.existsSync(abs)) {
          console.error(chalk.red(`File not found: ${abs}`));
        } else {
          let timeout: NodeJS.Timeout | null = null;
          const watcher = fs.watch(abs, async () => {
            if (timeout) clearTimeout(timeout);
            timeout = setTimeout(async () => {
              await runGenerate();
            }, 200);
          });
          console.log(chalk.dim(`[watch] watching ${abs}`));
          await runGenerate();
        }
      }
    }

    if (cmd === "security") {
      const { project } = await inquirer.prompt([
        { type: "input", name: "project", message: "Path to the generated MCP project to scan:" },
      ]);
      const projectPath = path.resolve(project as string);
      if (!fs.existsSync(projectPath)) {
        console.error(chalk.red(`\n  ✗ Project not found: ${projectPath}\n`));
        continue;
      }

      console.log(chalk.bold("\nmcp-gen security") + ` v${VERSION} — Security & Lint Scan\n`);
      console.log(`  Project:    ${chalk.cyan(projectPath)}\n`);

      const { scanProject, formatReport } = await import("../core/security-lint");
      const spinner = ora("Scanning project...").start();

      try {
        const report = await scanProject(projectPath);
        spinner.succeed("Scan complete");
        console.log(formatReport(report));
      } catch (err: unknown) {
        spinner.fail("Scan failed");
        console.error(chalk.red(err instanceof Error ? err.message : String(err)));
      }
    }
  }
}

(async () => {
  if (process.argv.length <= 2 && process.stdin.isTTY) {
    await interactive();
    process.exit(0);
  }
  await program.parseAsync();
})();