export { generate, validateSpec } from "./core/generator";
export { parseOpenAPI } from "./core/parser";
export { extractHandlers, injectHandlers } from "./core/incremental";
export { listKnownSpecs, getSpecInfo, fetchSpecToCwd, KNOWN_SPECS } from "./core/registry";
export type {
  GeneratorOptions,
  GenerationResult,
  ValidateResult,
  MCPServerAST,
  MCPTool,
  MCPToolParam,
  MCPModel,
  Lang,
} from "./core/types";