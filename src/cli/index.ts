#!/usr/bin/env node
import { Command } from "commander";
import chalk from "chalk";
import ora from "ora";
import path from "path";
import { generate } from "../core/generator";
import type { GeneratorOptions } from "../core/types";
import { fetchSpecToCwd, listKnownSpecs, getSpecInfo } from "../core/registry";
import fs from "fs";
import inquirer from "inquirer";

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
    const { parseOpenAPI } = await import("../core/parser");
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
        const specs = listKnownSpecs();
        console.log(chalk.bold("\n📚 Known Public Specs (Specs Públicas Conhecidas):\n"));
        for (const k of specs) {
          const info = getSpecInfo(k);
          console.log(chalk.cyan(`  ${k.padEnd(15)}`), info?.description || "");
        }
        console.log("\n" + chalk.dim(`Usage: mcp-gen init --from <key> [--generate -o ./output]`));
        console.log(chalk.dim(`Example: mcp-gen init --from stripe --generate -o ./stripe-mcp\n`));
        return;
      }
      
      const spinner = ora(`Fetching ${key}…`).start();
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
      incremental: true,
      plugins: opts.plugin as string[] | undefined,
    } as Partial<GeneratorOptions>;

    const runGenerate = async () => {
      const options: GeneratorOptions = {
        input,
        lang: commonOptions.lang!,
        out: commonOptions.out!,
        force: false,
        incremental: true,
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

async function interactive(): Promise<void> {
  while (true) {
    const { cmd } = await inquirer.prompt<{ cmd: string }>([
      {
        type: "list",
        name: "cmd",
        message: "Escolha uma ação / Choose an action:",
        choices: [
          { name: "Generate (Generate an MCP server from a spec / Gerar um servidor MCP a partir de uma spec)", value: "generate" },
          { name: "Validate (Validate an OpenAPI spec / Validar uma spec OpenAPI)", value: "validate" },
          { name: "Init (Download a known public spec / Baixar uma spec pública conhecida)", value: "init" },
          { name: "Watch (Watch and auto-regenerate on changes / Observar e regenerar automaticamente)", value: "watch" },
          { name: "Exit (Sair)", value: "exit" },
        ],
      },
    ]);

    if (cmd === "exit") return;

    if (cmd === "generate") {
      const answers = await inquirer.prompt(
        [
          { type: "input", name: "input", message: "Caminho ou URL para o OpenAPI spec (.json|.yaml):" },
          { type: "list", name: "lang", message: "Linguagem alvo:", choices: [...SUPPORTED_LANGS] },
          { type: "input", name: "out", message: "Diretório de saída:", default: "./mcp-server" },
          { type: "confirm", name: "force", message: "Sobrescrever arquivos existentes?", default: false },
          { type: "confirm", name: "incremental", message: "Preservar handlers customizados?", default: false },
          { type: "input", name: "name", message: "Nome do servidor (opcional):", default: "" },
          { type: "input", name: "serverVersion", message: "Versão do servidor (opcional):", default: "" },
        ] as Parameters<typeof inquirer.prompt>[0]
      );

      const input = resolveInput(answers.input as string);
      validateInputExt(input);
      validateLang(answers.lang as string);

      const options: GeneratorOptions = {
        input,
        lang: answers.lang as GeneratorOptions["lang"],
        out: path.resolve(answers.out as string),
        force: Boolean(answers.force),
        incremental: Boolean(answers.incremental),
        plugins: [],
        serverName: answers.name || undefined,
        serverVersion: answers.serverVersion || undefined,
      };

      console.log(chalk.bold("\nmcp-gen") + " — OpenAPI → MCP Server\n");
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
      const { input } = await inquirer.prompt([{ type: "input", name: "input", message: "Caminho ou URL para o OpenAPI spec:" }]);
      const resolved = resolveInput(input as string);
      validateInputExt(resolved);
      const spinner = ora("Validating spec…").start();
      const { parseOpenAPI } = await import("../core/parser");
      try {
        const ast = await parseOpenAPI(resolved);
        spinner.succeed("Spec is valid");
        console.log(chalk.dim(`\n  Tools: ${ast.tools.length}  Models: ${ast.models.length}  Base URL: ${ast.baseUrl}\n`));
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
          message: "Qual spec pública você deseja clonar? / Which public spec?",
          choices: specs.map((k) => ({
            name: `${k.padEnd(15)} — ${getSpecInfo(k)?.description || ""}`,
            value: k,
          })),
        },
      ]);
      
      try {
        const spinner = ora(`Downloading ${key}…`).start();
        const saved = await fetchSpecToCwd(key as string);
        spinner.succeed(`Saved to ${chalk.green(path.basename(saved))}`);
        
        const { autoGen } = await inquirer.prompt([
          {
            type: "confirm",
            name: "autoGen",
            message: "Generate MCP server now? / Gerar servidor MCP agora?",
            default: true,
          },
        ]);
        
        if (autoGen) {
          const { lang, out } = await inquirer.prompt([
            {
              type: "list",
              name: "lang",
              message: "Target language / Linguagem alvo:",
              choices: [...SUPPORTED_LANGS],
            },
            {
              type: "input",
              name: "out",
              message: "Output directory / Diretório de saída:",
              default: `./${key}-mcp`,
            },
          ]);
          
          const options: GeneratorOptions = {
            input: resolveInput(saved),
            lang: lang as GeneratorOptions["lang"],
            out: path.resolve(out as string),
            force: false,
            incremental: false,
          };
          
          const genSpinner = ora("Generating MCP server…").start();
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
              console.log(chalk.bold("Next steps / Próximos passos:\n"));
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
        { type: "input", name: "input", message: "Caminho ou URL para o OpenAPI spec:" },
        { type: "list", name: "lang", message: "Linguagem alvo:", choices: [...SUPPORTED_LANGS] },
        { type: "input", name: "out", message: "Diretório de saída:", default: "./mcp-server" },
      ] as Parameters<typeof inquirer.prompt>[0]);

      const input = resolveInput(answers.input as string);
      validateInputExt(input);
      validateLang(answers.lang as string);

      const commonOptions = {
        lang: answers.lang as GeneratorOptions["lang"],
        out: path.resolve(answers.out as string),
        force: false,
        incremental: false,
        plugins: [],
      } as Partial<GeneratorOptions>;

      const runGenerate = async () => {
        const options: GeneratorOptions = {
          input: answers.input as string,
          lang: commonOptions.lang!,
          out: commonOptions.out!,
          force: false,
          incremental: false,
          plugins: commonOptions.plugins,
        };
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
  }
}

(async () => {
  if (process.argv.length <= 2 && process.stdin.isTTY) {
    await interactive();
    process.exit(0);
  }
  program.parse();
})();
