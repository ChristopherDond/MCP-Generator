import path from "path";
import type { GeneratorOptions } from "../core/types";

export interface WatchCliOptions {
  lang?: string;
  out?: string;
  force?: boolean;
  incremental?: boolean;
  http?: boolean;
  plugins?: string[];
  includeTags?: string;
  excludeTags?: string;
  pathPrefix?: string;
  includePaths?: string;
  excludePaths?: string;
  operationAllowlist?: string;
  groupBy?: string;
}

/** Build generator options for `watch` runs, repassing filter/group flags. */
export function buildWatchGeneratorOptions(
  input: string,
  outDir: string,
  cli: WatchCliOptions
): GeneratorOptions {
  return {
    input,
    lang: (cli.lang ?? "typescript") as GeneratorOptions["lang"],
    out: path.resolve(outDir),
    force: Boolean(cli.force),
    incremental: cli.incremental ?? true,
    http: Boolean(cli.http),
    plugins: cli.plugins,
    includeTags: cli.includeTags ? [cli.includeTags] : undefined,
    excludeTags: cli.excludeTags ? [cli.excludeTags] : undefined,
    pathPrefix: cli.pathPrefix,
    includePaths: cli.includePaths ? [cli.includePaths] : undefined,
    excludePaths: cli.excludePaths ? [cli.excludePaths] : undefined,
    operationAllowlistFile: cli.operationAllowlist,
    groupBy: cli.groupBy as GeneratorOptions["groupBy"],
  };
}
