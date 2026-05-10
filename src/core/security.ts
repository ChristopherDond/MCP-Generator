import path from "path";
import fs from "fs";

/**
 * Validates that a file path is within an allowed directory.
 * Prevents path traversal attacks (e.g., ../../../etc/passwd).
 */
export function validateOutputPath(filePath: string, baseDir: string): void {
  const resolvedPath = path.resolve(filePath);
  const resolvedBase = path.resolve(baseDir);

  if (!resolvedPath.startsWith(resolvedBase + path.sep) && resolvedPath !== resolvedBase) {
    throw new Error(
      `Security error: Output path is outside the allowed directory. Path: ${filePath}, Base: ${baseDir}`
    );
  }
}

/**
 * Validates that a plugin path exists and is a directory.
 * Prevents loading arbitrary code from unexpected locations.
 */
export function validatePluginPath(pluginPath: string): void {
  const resolvedPath = path.resolve(pluginPath);

  if (!fs.existsSync(resolvedPath)) {
    throw new Error(`Plugin path does not exist: ${pluginPath}`);
  }

  const stat = fs.lstatSync(resolvedPath);

  // Reject symbolic links to prevent symlink attacks
  if (stat.isSymbolicLink()) {
    throw new Error(`Security error: Plugin path is a symbolic link: ${pluginPath}`);
  }

  if (!stat.isDirectory()) {
    throw new Error(`Plugin path must be a directory: ${pluginPath}`);
  }
}

/**
 * Validates a remote URL for fetching OpenAPI specs.
 * Only allows HTTPS and known safe domains.
 */
export function validateRemoteUrl(urlString: string): void {
  try {
    const url = new URL(urlString);

    // Only allow HTTPS (enforce encrypted transport)
    if (url.protocol !== "https:") {
      throw new Error("Only HTTPS URLs are allowed for remote specs");
    }

    // Blacklist localhost and private IPs to prevent SSRF attacks
    let hostname = url.hostname;
    
    // Handle IPv6 format - URL.hostname returns it without brackets and normalized
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

/**
 * Validates the size of remote content to prevent DoS attacks.
 * Max size: 50MB
 */
export function validateContentSize(size: number, maxBytes: number = 50 * 1024 * 1024): void {
  if (size > maxBytes) {
    throw new Error(
      `Security error: Content size (${size} bytes) exceeds maximum allowed (${maxBytes} bytes)`
    );
  }
}

/**
 * Validates Content-Type of remote response.
 * Only allows JSON and YAML for OpenAPI specs.
 */
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

/**
 * Sanitizes user input to prevent injection attacks.
 * Removes/escapes potentially dangerous characters.
 */
export function sanitizeInput(input: string, maxLength: number = 256): string {
  if (typeof input !== "string") {
    throw new Error("Input must be a string");
  }

  if (input.length > maxLength) {
    throw new Error(`Input exceeds maximum length of ${maxLength} characters`);
  }

  // Remove null bytes and control characters
  return input.replace(/[\x00-\x08\x0b-\x0c\x0e-\x1f\x7f]/g, "");
}

/**
 * Creates a whitelist of allowed plugin modules.
 * Returns true if plugin is in the whitelist.
 */
export function isPluginWhitelisted(pluginName: string, whitelist: string[]): boolean {
  return whitelist.includes(pluginName);
}

/**
 * Validates that the plugin module exports a valid structure.
 * Prevents malicious modules from executing arbitrary code.
 */
export function validatePluginModule(module: unknown): boolean {
  if (typeof module !== "object" || module === null) {
    return false;
  }

  const moduleObj = module as Record<string, unknown>;

  // Only allow specific exported functions
  const allowedExports = ["registerHandlebars"];
  const exportedKeys = Object.keys(moduleObj);

  for (const key of exportedKeys) {
    if (!allowedExports.includes(key) && !key.startsWith("_")) {
      console.warn(`Warning: Plugin exports unexpected key: ${key}`);
    }
  }

  // If registerHandlebars exists, it must be a function
  if ("registerHandlebars" in moduleObj && typeof moduleObj.registerHandlebars !== "function") {
    throw new Error("Plugin exports invalid registerHandlebars: must be a function");
  }

  return true;
}
