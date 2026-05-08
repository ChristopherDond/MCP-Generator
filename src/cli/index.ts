#!/usr/bin/env node
import { Command } from "commander";
import chalk from "chalk";
import ora from "ora";
import path from "path";
import { generate } from "../core/generator.js";
import type { GeneratorOptions } from "../core/types.js";
import { fetchSpecToCwd, listKnownSpecs } from "../core/registry.js";
import fs from "fs";

const SUPPORTED_LANGS = ["typescript", "python"] as const;
const SUPPORTED_EXTS = [".json", ".yaml", ".yml"];

function resolveInput(input: string): string {
  if (input.startsWith("http://") || input.startsWith("https://")) return input;
  return path.resolve(input);
}

function validateLang(lang: string): asserts lang is GeneratorOptions["lang"] {
  if (!SUPPORTED_LANGS.includes(lang as GeneratorOptions["lang"])) {
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
  .description("OpenAPI → MCP Server generator")
  .version("0.2.0");

program
  .command("generate")
  .alias("g")
  .description("Generate an MCP server from an OpenAPI spec (JSON or YAML)")
  .requiredOption("-i, --input <path>", "Path or URL to the OpenAPI spec (.json | .yaml | .yml)")
  .option("-l, --lang <language>", `Target language: ${SUPPORTED_LANGS.join(" | ")}`, "typescript")
  .option("-o, --out <dir>", "Output directory for the generated project", "./mcp-server")
  .option("-f, --force", "Overwrite existing files without prompting", false)
  .option("--incremental", "Preserve custom handler code on re-generation (@@mcp-gen markers)", false)
  .option("--name <name>", "Override the server name")
  .option("--server-version <version>", "Override the server version")
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
      lang: opts.lang as GeneratorOptions["lang"],
      out: path.resolve(opts.out),
      force: opts.force,
      incremental: opts.incremental,
      plugins,
      serverName: opts.name,
      serverVersion: opts.serverVersion,
    };

    console.log(chalk.bold("\nmcp-gen") + " — OpenAPI → MCP Server\n");
    console.log(`  Input:       ${chalk.cyan(options.input)}`);
    console.log(`  Language:    ${chalk.cyan(options.lang)}`);
    console.log(`  Output:      ${chalk.cyan(options.out)}`);
    if (options.incremental) {
      console.log(`  Incremental: ${chalk.yellow("on — custom handlers will be preserved")}`);
    }
    console.log();

    const spinner = ora("Parsing OpenAPI spec…").start();

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

      spinner.succeed("Generation complete");
      console.log(chalk.green(`\n  ✓ ${result.filesCreated.length} files created\n`));
      for (const f of result.filesCreated) {
        console.log(`    ${chalk.dim(result.outputDir + "/")}${f}`);
      }

      if (result.filesPreserved && result.filesPreserved.length > 0) {
        console.log(chalk.cyan(`\n  ↺ ${result.filesPreserved.length} handler(s) preserved\n`));
        for (const f of result.filesPreserved) console.log(`    ${chalk.dim("↺ ")}${f}`);
      }

      const isTs = options.lang === "typescript";
      console.log(chalk.bold("\nNext steps:\n"));
      console.log(`  cd ${opts.out}`);
      console.log(isTs ? "  npm install" : "  pip install -r requirements.txt");
      if (isTs) console.log("  npm run build");
      console.log(isTs ? "  npm start\n" : "  python server.py\n");
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
    const spinner = ora("Validating spec…").start();
    const { parseOpenAPI } = await import("../core/parser.js");
    try {
      const ast = await parseOpenAPI(input);
      spinner.succeed("Spec is valid");
      console.log(chalk.dim(`\n  Tools: ${ast.tools.length}  Models: ${ast.models.length}  Base URL: ${ast.baseUrl}\n`));
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
        console.log(listKnownSpecs().join("\n"));
        return;
      }
      const saved = await fetchSpecToCwd(key);
      console.log(chalk.green(`Saved spec to ${saved}`));
      if (opts.generate) {
        const input = resolveInput(opts.input ?? saved);
        validateInputExt(input);
        const options: GeneratorOptions = {
          input,
          lang: opts.lang as GeneratorOptions["lang"],
          out: path.resolve(opts.out),
          force: false,
          incremental: false,
        };
        await generate(options);
      }
    } catch (err: unknown) {
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
  .action(async (opts) => {
    const input = resolveInput(opts.input);
    validateInputExt(input);
    validateLang(opts.lang);

    const commonOptions = {
      lang: opts.lang as GeneratorOptions["lang"],
      out: path.resolve(opts.out),
      force: false,
      incremental: false,
      plugins: opts.plugin as string[] | undefined,
    } as Partial<GeneratorOptions>;

    const runGenerate = async () => {
      const options: GeneratorOptions = {
        input: opts.input,
        lang: commonOptions.lang!,
        out: commonOptions.out!,
        force: false,
        incremental: false,
        plugins: commonOptions.plugins,
      };
      console.log(chalk.dim(`[watch] regenerating from ${opts.input} → ${options.out}`));
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

    // If input is http(s) — poll for changes
    if (opts.input.startsWith("http://") || opts.input.startsWith("https://")) {
      let last = "";
      const interval = Number(opts.interval) || 30000;
      console.log(chalk.dim(`[watch] polling ${opts.input} every ${interval}ms`));
      const check = async () => {
        try {
          const r = await fetch(opts.input);
          if (!r.ok) throw new Error(`HTTP ${r.status}`);
          const body = await r.text();
          if (!last) {
            last = body;
            await runGenerate();
            if (opts.once) process.exit(0);
            return;
          }
          if (body !== last) {
            last = body;
            await runGenerate();
            if (opts.once) process.exit(0);
          }
        } catch (e) {
          console.error(chalk.red(String(e)));
        }
      };
      await check();
      setInterval(check, interval);
      return;
    }

    // Local file — fs.watch
    const abs = path.resolve(opts.input);
    if (!fs.existsSync(abs)) {
      console.error(chalk.red(`File not found: ${abs}`));
      process.exit(1);
    }

    let timeout: NodeJS.Timeout | null = null;
    const watcher = fs.watch(abs, async () => {
      if (timeout) clearTimeout(timeout);
      timeout = setTimeout(async () => {
        await runGenerate();
        if (opts.once) {
          watcher.close();
          process.exit(0);
        }
      }, 200);
    });

    console.log(chalk.dim(`[watch] watching ${abs}`));
    // run once initially
    await runGenerate();
  });

program.parse();
