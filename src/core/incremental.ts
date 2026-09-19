import fs from "fs";

/**
 * Marker format embedded in generated server files:
 *
 * TypeScript:
 *   // @@mcp-gen:start:get_pets
 *   return { content: [{ type: "text", text: "..." }] };
 *   // @@mcp-gen:end:get_pets
 *
 * Python:
 *   # @@mcp-gen:start:get_pets
 *   return [{"id": 1}]
 *   # @@mcp-gen:end:get_pets
 */

const MARKER_START = (name: string) => `@@mcp-gen:start:${name}`;
const MARKER_END = (name: string) => `@@mcp-gen:end:${name}`;

export const GENERATED_REGION_START = "<generated:handlers>";
export const GENERATED_REGION_END = "</generated:handlers>";

export const CUSTOM_FILES = [
  "src/handlers.custom.ts",
  "handlers_custom.py",
  "handlers_custom.go",
];

export function isCustomFile(outputFile: string): boolean {
  return CUSTOM_FILES.some((f) => outputFile === f || outputFile.endsWith("/" + f));
}

export interface ExtractedHandlers {
  /** Map of tool name → custom code block (the lines between start/end markers) */
  handlers: Map<string, string>;
}

/**
 * Extracts all @@mcp-gen:start/end blocks from an existing generated file.
 * Returns an empty map if the file doesn't exist or has no markers.
 */
export function extractHandlers(filePath: string): ExtractedHandlers {
  const handlers = new Map<string, string>();

  if (!fs.existsSync(filePath)) return { handlers };

  const content = fs.readFileSync(filePath, "utf-8");
  const lines = content.split("\n");

  let currentTool: string | null = null;
  const buffer: string[] = [];

  for (const line of lines) {
    const legacyStart = line.match(/@@mcp-gen:start:(\S+)/);
    const guardStart = line.match(/<generated:handlers:([^>]+)>/);
    const startName = legacyStart?.[1] ?? guardStart?.[1];
    if (startName && !currentTool) {
      currentTool = startName.trim();
      buffer.length = 0;
      continue;
    }

    const isEnd =
      /@@mcp-gen:end:/.test(line) || /<\/generated:handlers/.test(line);
    if (isEnd && currentTool) {
      handlers.set(currentTool, buffer.join("\n").trimEnd());
      currentTool = null;
      buffer.length = 0;
      continue;
    }

    if (currentTool) {
      buffer.push(line);
    }
  }

  return { handlers };
}

/**
 * Given a rendered template string and a map of extracted handlers,
 * replaces the content between @@mcp-gen markers with the preserved custom code.
 *
 * Only replaces handlers that:
 * - Exist in the extracted map (i.e. user modified them from the default stub)
 * - Are not identical to the generated stub (avoids no-op replacements)
 */
export function injectHandlers(
  rendered: string,
  extracted: ExtractedHandlers,
  defaultStubPattern: RegExp
): { result: string; preserved: string[] } {
  if (extracted.handlers.size === 0) return { result: rendered, preserved: [] };

  const preserved: string[] = [];
  let result = rendered;

  for (const [toolName, customCode] of extracted.handlers.entries()) {
    const startMarker = MARKER_START(toolName);
    const endMarker = MARKER_END(toolName);

    const startIdx = result.indexOf(startMarker);
    const endIdx = result.indexOf(endMarker);

    if (startIdx === -1 || endIdx === -1) continue;

    const afterStart = result.indexOf("\n", startIdx) + 1;
    const endLineStart = result.lastIndexOf("\n", endIdx) + 1;
    const lineEnding = result[afterStart - 2] === "\r" ? "\r\n" : "\n";
    const freshCode = result.slice(afterStart, endLineStart).trimEnd();

    if (customCode.trim() === freshCode.trim()) continue;

    if (defaultStubPattern.test(customCode.trim())) continue;

    result = result.slice(0, afterStart) + customCode + lineEnding + result.slice(endLineStart);
    preserved.push(toolName);
  }

  return { result, preserved };
}

/** Default stub patterns — code that was never customized by the user */
export const TS_DEFAULT_STUB_PATTERN =
  /throw new McpError\(ErrorCode\.InternalError.*Handler not implemented/;

export const PY_DEFAULT_STUB_PATTERN =
  /raise NotImplementedError/;
