import fs from "fs";
import path from "path";
import { validateRemoteUrl, validateContentType, validateContentSize } from "./security";

export const KNOWN_SPECS: Record<string, { url: string; filename?: string; description?: string }> = {
  stripe: {
    url: "https://raw.githubusercontent.com/stripe/openapi/master/openapi/spec3.json",
    filename: "openapi.stripe.json",
    description: "Stripe Payment API — comprehensive payment processing"
  },
  github: {
    url: "https://raw.githubusercontent.com/github/rest-api-description/main/descriptions/api.github.com/api.github.com.json",
    filename: "openapi.github.json",
    description: "GitHub REST API — version control and collaboration platform"
  },
  openai: {
    url: "https://raw.githubusercontent.com/openai/openai-openapi/master/openapi.yaml",
    filename: "openapi.openai.yaml",
    description: "OpenAI API — GPT models, embeddings, and completion endpoints"
  },
  petstore: {
    url: "https://petstore3.swagger.io/api/v3/openapi.json",
    filename: "openapi.petstore.json",
    description: "Swagger Petstore — example API for testing"
  },
  twilio: {
    url: "https://raw.githubusercontent.com/twilio/twilio-oai/main/spec/json/twilio_openapi_v1.json",
    filename: "openapi.twilio.json",
    description: "Twilio Communications API — SMS, voice, video, messaging"
  },
  shopify: {
    url: "https://shopify.dev/api/admin-rest/2024-01/openapi.json",
    filename: "openapi.shopify.json",
    description: "Shopify Admin API — e-commerce platform management"
  },
};

export const REMOVED_SPECS: Record<string, string> = {
  slack: "Slack only publishes OpenAPI v2 (slack_web_openapi_v2.json). mcp-gen supports OpenAPI v3 only for now. Track Swagger 2.0 support in the v2.3.0 roadmap.",
  kubernetes: "Kubernetes publishes OpenAPI v2 at api/openapi-spec/swagger.json. mcp-gen supports OpenAPI v3 only for now. Track Swagger 2.0 support in the v2.3.0 roadmap.",
  digitalocean: "DigitalOcean-public.v2.json is OpenAPI v2. mcp-gen supports OpenAPI v3 only for now. Track Swagger 2.0 support in the v2.3.0 roadmap.",
  azure: "The previous azure entry pointed at a common-types fragment (types.json), not a full OpenAPI document. mcp-gen supports OpenAPI v3 only for now.",
};

export async function fetchSpecToCwd(key: string, targetPath?: string): Promise<string> {
  const removed = REMOVED_SPECS[key];
  if (removed) throw new Error(`Registry key "${key}" was removed: ${removed}`);
  const entry = KNOWN_SPECS[key];
  if (!entry) {
    const known = Object.keys(KNOWN_SPECS).join(", ");
    throw new Error(`Unknown registry key: "${key}". Known keys: ${known}. Use 'mcp-gen init --from list' to see them.`);
  }

  // Security: validate URL
  validateRemoteUrl(entry.url);

  // Create abort controller for timeout
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 30000); // 30 seconds

  try {
    const res = await fetch(entry.url, {
      signal: controller.signal,
    });
    
    if (!res.ok) throw new Error(`Failed to fetch ${entry.url}: ${res.status} ${res.statusText}`);

    // Security: validate Content-Type
    const contentType = res.headers.get("content-type");
    validateContentType(contentType);

    // Security: validate content size before reading
    const contentLength = res.headers.get("content-length");
    if (contentLength) {
      validateContentSize(parseInt(contentLength, 10));
    }

    const content = await res.text();
    
    // Security: ensure content size after reading (in case header was missing/wrong)
    validateContentSize(Buffer.byteLength(content, "utf-8"));

    const filename = entry.filename ?? (path.basename(new URL(entry.url).pathname) || "openapi.json");
    const outPath = path.resolve(targetPath ? targetPath : path.join(process.cwd(), filename));
    
    fs.mkdirSync(path.dirname(outPath), { recursive: true });
    fs.writeFileSync(outPath, content, "utf-8");
    return outPath;
  } finally {
    clearTimeout(timeoutId);
  }
}

export function listKnownSpecs(): string[] {
  return Object.keys(KNOWN_SPECS);
}

export function getSpecInfo(key: string): { url: string; filename?: string; description?: string } | null {
  return KNOWN_SPECS[key] ?? null;
}
