import fs from "fs";
import path from "path";

export const KNOWN_SPECS: Record<string, { url: string; filename?: string }> = {
  stripe: { url: "https://raw.githubusercontent.com/stripe/openapi/master/openapi/spec3.json", filename: "openapi.stripe.json" },
  github: { url: "https://raw.githubusercontent.com/github/rest-api-description/main/descriptions/api.github.com/api.github.com.json", filename: "openapi.github.json" },
};

export async function fetchSpecToCwd(key: string): Promise<string> {
  const entry = KNOWN_SPECS[key];
  if (!entry) throw new Error(`Unknown registry key: ${key}`);

  const res = await fetch(entry.url);
  if (!res.ok) throw new Error(`Failed to fetch ${entry.url}: ${res.status} ${res.statusText}`);

  const content = await res.text();
  const filename = entry.filename ?? (path.basename(new URL(entry.url).pathname) || "openapi.json");
  const outPath = path.resolve(process.cwd(), filename);
  fs.writeFileSync(outPath, content, "utf-8");
  return outPath;
}

export function listKnownSpecs(): string[] {
  return Object.keys(KNOWN_SPECS);
}
