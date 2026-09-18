import fs from "fs";
import type { MCPTool, MCPToolGroup, MCPToolParam, GroupByMode } from "./types";

export function parseTagList(value?: string | string[]): string[] {
  if (value === undefined || value === null) return [];
  const items = Array.isArray(value) ? value : [value];
  const out: string[] = [];
  for (const entry of items) {
    if (entry === undefined || entry === null) continue;
    for (const part of String(entry).split(",")) {
      const trimmed = part.trim();
      if (trimmed) out.push(trimmed);
    }
  }
  return out;
}

export function parseGroupBy(value?: string): GroupByMode | undefined {
  if (value === undefined || value === null) return undefined;
  const normalized = String(value).trim();
  if (!normalized) return undefined;
  if (normalized === "tag" || normalized === "path-prefix") return normalized;
  throw new Error(`Invalid --group-by mode: "${value}". Use: tag | path-prefix`);
}

export function loadOperationAllowlistFile(filePath?: string): string[] {
  if (!filePath) return [];
  const resolved = String(filePath).trim();
  if (!resolved) return [];
  if (!fs.existsSync(resolved)) throw new Error(`Allowlist file not found: ${resolved}`);
  const raw = fs.readFileSync(resolved, "utf-8").trim();
  if (!raw) return [];
  if (raw.startsWith("[") || raw.startsWith("{")) {
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) throw new Error(`Allowlist file must contain a JSON array: ${resolved}`);
    return (parsed as unknown[]).map((v) => String(v).trim()).filter(Boolean);
  }
  return raw.split(/[\r\n,]+/).map((s) => s.trim()).filter(Boolean);
}

function matchesAllowlist(tool: MCPTool, allow: Set<string>): boolean {
  if (allow.has(tool.name)) return true;
  if (tool.operationId && allow.has(tool.operationId)) return true;
  if (allow.has(`${tool.method} ${tool.path}`)) return true;
  if (allow.has(`${tool.method}:${tool.path}`)) return true;
  return false;
}

export function filterTools(
  tools: MCPTool[],
  opts: { includeTags?: string[]; excludeTags?: string[]; pathPrefix?: string; allowlist?: string[] }
): MCPTool[] {
  const include = (opts.includeTags ?? []).map((s) => s.trim()).filter(Boolean);
  const exclude = (opts.excludeTags ?? []).map((s) => s.trim()).filter(Boolean);
  const prefix = (opts.pathPrefix ?? "").trim();
  const allowRaw = (opts.allowlist ?? []).map((s) => String(s).trim()).filter(Boolean);
  const allow = new Set(allowRaw);
  return tools.filter((tool) => {
    if (include.length > 0 && !tool.tags.some((t) => include.includes(t))) return false;
    if (exclude.length > 0 && tool.tags.some((t) => exclude.includes(t))) return false;
    if (prefix && !tool.path.startsWith(prefix)) return false;
    if (allow.size > 0 && !matchesAllowlist(tool, allow)) return false;
    return true;
  });
}

function sanitizeKey(key: string): string {
  const cleaned = key.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "");
  if (!cleaned) return "group";
  if (/^[0-9]/.test(cleaned)) return `g_${cleaned}`;
  return cleaned;
}

function prefixKeyForPath(path: string): string {
  const segments = path.split("/").map((s) => s.trim()).filter(Boolean);
  if (segments.length === 0) return "root";
  return segments[0];
}

function groupKeyForTool(tool: MCPTool, mode: GroupByMode): string {
  if (mode === "tag") {
    if (tool.tags.length > 0) return tool.tags[0];
    return "untagged";
  }
  return prefixKeyForPath(tool.path);
}

export function groupTools(tools: MCPTool[], mode: GroupByMode): MCPTool[] {
  const buckets = new Map<string, MCPTool[]>();
  for (const tool of tools) {
    const key = groupKeyForTool(tool, mode);
    const list = buckets.get(key);
    if (list) list.push(tool);
    else buckets.set(key, [tool]);
  }
  const used = new Set(tools.map((t) => t.name));
  const out: MCPTool[] = [];
  for (const [key, members] of buckets.entries()) {
    const base = sanitizeKey(key);
    let candidate = `${base}_group`;
    let i = 2;
    while (used.has(candidate)) {
      candidate = `${base}_group_${i}`;
      i += 1;
    }
    used.add(candidate);
    const memberNames = members.map((m) => m.name);
    const actionParam: MCPToolParam = {
      name: "action",
      description: `Action for ${key}`,
      type: "string",
      in: "query",
      required: true,
      schema: { type: "string", enum: memberNames } as MCPToolParam["schema"],
      enum: memberNames,
    };
    const union = new Map<string, MCPToolParam>();
    for (const member of members) {
      for (const param of member.params) {
        if (param.name === "action") continue;
        const dedupe = `${param.in}:${param.name}`;
        if (union.has(dedupe)) continue;
        union.set(dedupe, { ...param, required: false });
      }
    }
    const groupPath = `/group/${base}`;
    out.push({
      name: candidate,
      description: `Group ${key} with ${members.length} operations: ${memberNames.join(", ")}`,
      method: "GROUP",
      path: groupPath,
      params: [actionParam, ...union.values()],
      security: undefined,
      exampleResponse: null,
      tags: mode === "tag" ? [key] : [],
      isGroup: true,
      groupKey: key,
      groupMode: mode,
      groupMembers: members.map((m) => ({ ...m })),
    });
  }
  return out;
}

export function toGroupMetadata(grouped: MCPTool[]): MCPToolGroup[] {
  return grouped
    .filter((t) => t.isGroup)
    .map((t) => ({
      name: t.name,
      key: t.groupKey ?? "",
      mode: (t.groupMode ?? "tag") as GroupByMode,
      members: (t.groupMembers ?? []).map((m) => m.name),
    }));
}
