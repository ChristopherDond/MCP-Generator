import path from "path";
import fs from "fs";

export function validateOutputPath(filePath: string, baseDir: string): void {
  const resolvedPath = path.resolve(filePath);
  const resolvedBase = path.resolve(baseDir);

  if (!resolvedPath.startsWith(resolvedBase + path.sep) && resolvedPath !== resolvedBase) {
    throw new Error(
      `Security error: Output path is outside the allowed directory. Path: ${filePath}, Base: ${baseDir}`
    );
  }
}

export function validatePluginPath(pluginPath: string): void {
  const resolvedPath = path.resolve(pluginPath);

  if (!fs.existsSync(resolvedPath)) {
    throw new Error(`Plugin path does not exist: ${pluginPath}`);
  }

  const stat = fs.lstatSync(resolvedPath);

  if (stat.isSymbolicLink()) {
    throw new Error(`Security error: Plugin path is a symbolic link: ${pluginPath}`);
  }

  if (stat.isDirectory()) {
    return;
  }
  if (stat.isFile() && /\.(js|cjs|mjs)$/.test(resolvedPath)) {
    return;
  }
  throw new Error(`Plugin path must be a directory or a .js file: ${pluginPath}`);
}

export function validateRemoteUrl(urlString: string): void {
  try {
    const url = new URL(urlString);

    if (url.protocol !== "https:") {
      throw new Error("Only HTTPS URLs are allowed for remote specs");
    }

    const hostname = url.hostname;
    
    const privatePatterns = [
      /^localhost$/i,
      /^127\./,
      /^192\.168\./,
      /^10\./,
      /^172\.(1[6-9]|2[0-9]|3[01])\./,
      /^::1$/i,
      /^fc00:/i,
      /^fe80:/i,
      /^169\.254\./,
    ];

    for (const pattern of privatePatterns) {
      if (pattern.test(hostname)) {
        throw new Error(`Security error: Private or local URLs are not allowed: ${urlString}`);
      }
    }
  } catch (err) {
    if (err instanceof Error) {
      throw err;
    }
    throw new Error(`Invalid URL: ${urlString}`);
  }
}

export function validateContentSize(size: number, maxBytes: number = 50 * 1024 * 1024): void {
  if (size > maxBytes) {
    throw new Error(
      `Security error: Content size (${size} bytes) exceeds maximum allowed (${maxBytes} bytes)`
    );
  }
}

export function parseContentLength(value: string | null): number | undefined {
  if (value === null || value === undefined) return undefined;
  const trimmed = String(value).trim();
  if (!trimmed) return undefined;
  const parsed = Number(trimmed);
  if (!Number.isFinite(parsed) || parsed < 0 || !Number.isInteger(parsed)) return undefined;
  return parsed;
}

type BodySource =
  | { text: () => Promise<string>; body?: { getReader: () => { read: () => Promise<{ done: boolean; value?: unknown }>; releaseLock?: () => void; cancel?: () => Promise<void> } } | null }
  | (() => Promise<string>)
  | AsyncIterable<string | Uint8Array>;

export async function readBodyWithLimit(
  source: BodySource,
  contentLength?: number | null,
  maxBytes: number = 50 * 1024 * 1024
): Promise<string> {
  if (typeof contentLength === "number") validateContentSize(contentLength, maxBytes);
  if (typeof source === "function") {
    const text = await source();
    validateContentSize(Buffer.byteLength(text, "utf-8"), maxBytes);
    return text;
  }
  if (typeof (source as AsyncIterable<unknown>)[Symbol.asyncIterator] === "function") {
    let size = 0;
    const chunks: string[] = [];
    const decoder = new TextDecoder();
    for await (const chunk of source as AsyncIterable<string | Uint8Array>) {
      const text = typeof chunk === "string" ? chunk : decoder.decode(chunk, { stream: true });
      size += Buffer.byteLength(text, "utf-8");
      validateContentSize(size, maxBytes);
      chunks.push(text);
    }
    chunks.push(decoder.decode());
    return chunks.join("");
  }
  const res = source as { text: () => Promise<string>; body?: { getReader: () => { read: () => Promise<{ done: boolean; value?: unknown }>; releaseLock?: () => void } } | null };
  if (res.body && typeof res.body.getReader === "function") {
    const reader = res.body.getReader();
    try {
      let size = 0;
      const chunks: string[] = [];
      const decoder = new TextDecoder();
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        const text = typeof value === "string" ? value : decoder.decode(value as Uint8Array, { stream: true });
        size += Buffer.byteLength(text, "utf-8");
        validateContentSize(size, maxBytes);
        chunks.push(text);
      }
      chunks.push(decoder.decode());
      return chunks.join("");
    } finally {
      if (typeof reader.releaseLock === "function") reader.releaseLock();
    }
  }
  const text = await res.text();
  validateContentSize(Buffer.byteLength(text, "utf-8"), maxBytes);
  return text;
}

export function validateContentType(contentType: string | null): void {
  if (!contentType) {
    throw new Error("Security error: Content-Type header is missing");
  }

  const validTypes = ["application/json", "application/yaml", "text/yaml", "text/plain"];
  const baseType = contentType.split(";")[0].toLowerCase();

  if (!validTypes.includes(baseType)) {
    throw new Error(`Security error: Invalid Content-Type for OpenAPI spec: ${contentType}`);
  }
}

export interface FetchRetryOptions {
  fetchImpl?: typeof fetch;
  retries?: number;
  baseDelayMs?: number;
  timeoutMs?: number;
}

const RETRYABLE_STATUS = new Set([408, 425, 429, 500, 502, 503, 504]);

export interface HttpFetchError extends Error {
  status: number;
}

function httpError(res: Response): HttpFetchError {
  const err = new Error(`HTTP ${res.status} ${res.statusText}`) as HttpFetchError;
  err.status = res.status;
  return err;
}

function isNonRetryable(err: unknown): boolean {
  return (
    err instanceof Error &&
    typeof (err as HttpFetchError).status === "number" &&
    !RETRYABLE_STATUS.has((err as HttpFetchError).status)
  );
}

export async function fetchWithRetry(url: string, options: FetchRetryOptions = {}): Promise<Response> {
  const fetchImpl = options.fetchImpl ?? fetch;
  const retries = options.retries ?? 0;
  const baseDelayMs = options.baseDelayMs ?? 500;
  const timeoutMs = options.timeoutMs ?? 30000;
  let lastError: unknown;

  for (let attempt = 0; attempt <= retries; attempt++) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const res = await fetchImpl(url, { signal: controller.signal });
      if (res.ok) return res;
      lastError = httpError(res);
    } catch (e) {
      lastError = e;
    } finally {
      clearTimeout(timeoutId);
    }
    if (isNonRetryable(lastError)) throw lastError;
    if (attempt < retries) {
      const delay = baseDelayMs * 2 ** attempt;
      await new Promise((r) => setTimeout(r, delay));
    }
  }

  throw lastError instanceof Error ? lastError : new Error(String(lastError));
}

export function sanitizeInput(input: string, maxLength: number = 256): string {
  if (typeof input !== "string") {
    throw new Error("Input must be a string");
  }

  if (input.length > maxLength) {
    throw new Error(`Input exceeds maximum length of ${maxLength} characters`);
  }

  return input.replace(/[\x00-\x08\x0b-\x0c\x0e-\x1f\x7f]/g, "");
}

export function isPluginWhitelisted(pluginName: string, whitelist: string[]): boolean {
  return whitelist.includes(pluginName);
}

export function validatePluginModule(module: unknown): boolean {
  if (typeof module !== "object" || module === null) {
    return false;
  }

  const moduleObj = module as Record<string, unknown>;

  const allowedExports = ["registerHandlebars"];
  const exportedKeys = Object.keys(moduleObj);

  for (const key of exportedKeys) {
    if (!allowedExports.includes(key) && !key.startsWith("_")) {
      console.warn(`Warning: Plugin exports unexpected key: ${key}`);
    }
  }

  if ("registerHandlebars" in moduleObj && typeof moduleObj.registerHandlebars !== "function") {
    throw new Error("Plugin exports invalid registerHandlebars: must be a function");
  }

  return true;
}
