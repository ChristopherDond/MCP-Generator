#!/usr/bin/env node
import { Command } from "commander";
import chalk from "chalk";
import ora from "ora";
import path from "path";
import { generate } from "../core/generator.js";
import type { GeneratorOptions } from "../core/types.js";

const program = new Command();

program
  .name("mcp-gen")
  .description("OpenAPI → MCP Server generator")
  .version("0.1.0");

program
  .command("generate")
  .alias("g")
  .description("Generate an MCP server from an OpenAPI spec")
  .requiredOption(
    "-i, --input <path>",
    "Path or URL to the OpenAPI spec (JSON or YAML)"
  )
  .option(
    "-l, --lang <language>",
    "Target language: typescript | python",
    "typescript"
  )
  .option(
    "-o, --out <dir>",
    "Output directory for the generated project",
    "./mcp-server"
  )
  .option("-f, --force", "Overwrite existing files without prompting", false)
  .option("--name <name>", "Override the server name (default: derived from spec title)")
  .option("--version <version>", "Override the server version")
  .action(async (opts) => {
    const options: GeneratorOptions = {
      input: opts.input,
      lang: opts.lang as GeneratorOptions["lang"],
      out: path.resolve(opts.out),
      force: opts.force,
      serverName: opts.name,
      serverVersion: opts.version,
    };

    console.log(chalk.bold("\nmcp-gen") + " — OpenAPI → MCP Server\n");
    console.log(`  Input:    ${chalk.cyan(options.input)}`);
    console.log(`  Language: ${chalk.cyan(options.lang)}`);
    console.log(`  Output:   ${chalk.cyan(options.out)}\n`);

    const spinner = ora("Parsing OpenAPI spec…").start();

    try {
      const result = await generate(options);

      if (result.warnings.length > 0) {
        spinner.warn("Completed with warnings");
        for (const w of result.warnings) {
          console.log(chalk.yellow(`  ⚠ ${w}`));
        }
        console.log();
      }

      if (!result.success) {
        spinner.fail("Generation failed");
        for (const err of result.errors) {
          console.error(chalk.red(`  ✗ ${err}`));
        }
        process.exit(1);
      }

      spinner.succeed("Generation complete");
      console.log(chalk.green(`\n  ✓ ${result.filesCreated.length} files created\n`));

      for (const f of result.filesCreated) {
        console.log(`    ${chalk.dim(result.outputDir + "/")}${f}`);
      }

      console.log(chalk.bold("\nNext steps:\n"));
      console.log(`  cd ${opts.out}`);
      console.log("  npm install");
      console.log("  npm run build");
      console.log("  npm start\n");

      if (result.warnings.length > 0) {
        console.log(
          chalk.yellow(
            `  ${result.warnings.length} tool(s) return NotImplemented — add real handlers in src/server.ts\n`
          )
        );
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
    const spinner = ora("Validating spec…").start();
    const { parseOpenAPI } = await import("../core/parser.js");

    try {
      const ast = await parseOpenAPI(opts.input);
      spinner.succeed("Spec is valid");
      console.log(
        chalk.dim(
          `\n  Tools: ${ast.tools.length}  Models: ${ast.models.length}  Base URL: ${ast.baseUrl}\n`
        )
      );
    } catch (err: unknown) {
      spinner.fail("Validation failed");
      console.error(chalk.red(err instanceof Error ? err.message : String(err)));
      process.exit(1);
    }
  });

program.parse();
