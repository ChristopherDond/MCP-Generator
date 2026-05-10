import {
  validateOutputPath,
  validatePluginPath,
  validateRemoteUrl,
  validateContentSize,
  validateContentType,
  sanitizeInput,
  isPluginWhitelisted,
  validatePluginModule,
} from "../src/core/security";
import path from "path";
import fs from "fs";
import os from "os";

describe("Security Validations", () => {
  describe("validateOutputPath", () => {
    it("should allow files within the base directory", () => {
      const baseDir = "/project";
      const filePath = "/project/src/file.ts";
      expect(() => validateOutputPath(filePath, baseDir)).not.toThrow();
    });

    it("should reject path traversal attempts", () => {
      const baseDir = "/project";
      const filePath = "/project/../../../etc/passwd";
      expect(() => validateOutputPath(filePath, baseDir)).toThrow(
        /Security error: Output path is outside the allowed directory/
      );
    });

    it("should reject paths outside base directory", () => {
      const baseDir = "/project";
      const filePath = "/other/file.ts";
      expect(() => validateOutputPath(filePath, baseDir)).toThrow(
        /Security error: Output path is outside the allowed directory/
      );
    });
  });

  describe("validatePluginPath", () => {
    it("should accept valid plugin directories", () => {
      const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "plugin-"));
      try {
        expect(() => validatePluginPath(tmpDir)).not.toThrow();
      } finally {
        fs.rmSync(tmpDir, { recursive: true });
      }
    });

    it("should reject non-existent paths", () => {
      expect(() => validatePluginPath("/nonexistent/plugin")).toThrow(
        /Plugin path does not exist/
      );
    });

    it("should reject file paths (not directories)", () => {
      const tmpFile = path.join(os.tmpdir(), "test-file.txt");
      fs.writeFileSync(tmpFile, "test");
      try {
        expect(() => validatePluginPath(tmpFile)).toThrow(
          /Plugin path must be a directory/
        );
      } finally {
        fs.unlinkSync(tmpFile);
      }
    });
  });

  describe("validateRemoteUrl", () => {
    it("should accept valid HTTPS URLs", () => {
      expect(() =>
        validateRemoteUrl("https://raw.githubusercontent.com/owner/repo/file.json")
      ).not.toThrow();
    });

    it("should reject HTTP URLs (require HTTPS)", () => {
      expect(() => validateRemoteUrl("http://example.com/file.json")).toThrow(
        /Only HTTPS URLs are allowed/
      );
    });

    it("should reject localhost URLs (SSRF)", () => {
      expect(() => validateRemoteUrl("https://localhost:8000/file.json")).toThrow(
        /Private or local URLs are not allowed/
      );
    });

    it("should reject 127.0.0.1 (SSRF)", () => {
      expect(() => validateRemoteUrl("https://127.0.0.1/file.json")).toThrow(
        /Private or local URLs are not allowed/
      );
    });

    it("should reject private IP ranges (SSRF)", () => {
      expect(() => validateRemoteUrl("https://192.168.1.1/file.json")).toThrow(
        /Private or local URLs are not allowed/
      );
      expect(() => validateRemoteUrl("https://10.0.0.1/file.json")).toThrow(
        /Private or local URLs are not allowed/
      );
      expect(() => validateRemoteUrl("https://172.16.0.1/file.json")).toThrow(
        /Private or local URLs are not allowed/
      );
    });
  });

  describe("validateContentSize", () => {
    it("should accept content within size limit", () => {
      expect(() => validateContentSize(1024 * 1024)).not.toThrow(); // 1MB
    });

    it("should reject content exceeding size limit", () => {
      const maxSize = 50 * 1024 * 1024; // 50MB
      expect(() => validateContentSize(maxSize + 1)).toThrow(
        /Security error: Content size.*exceeds maximum allowed/
      );
    });
  });

  describe("validateContentType", () => {
    it("should accept JSON content type", () => {
      expect(() => validateContentType("application/json")).not.toThrow();
      expect(() => validateContentType("application/json; charset=utf-8")).not.toThrow();
    });

    it("should accept YAML content types", () => {
      expect(() => validateContentType("application/yaml")).not.toThrow();
      expect(() => validateContentType("text/yaml")).not.toThrow();
    });

    it("should reject other content types", () => {
      expect(() => validateContentType("text/html")).toThrow(
        /Security error: Invalid Content-Type/
      );
      expect(() => validateContentType("application/javascript")).toThrow(
        /Security error: Invalid Content-Type/
      );
    });

    it("should reject missing content type", () => {
      expect(() => validateContentType(null)).toThrow(
        /Security error: Content-Type header is missing/
      );
    });
  });

  describe("sanitizeInput", () => {
    it("should allow normal strings", () => {
      const input = "my-server-name";
      expect(sanitizeInput(input)).toBe(input);
    });

    it("should remove null bytes", () => {
      const input = "test\x00malicious";
      const result = sanitizeInput(input);
      expect(result).not.toContain("\x00");
    });

    it("should remove control characters", () => {
      const input = "test\x01\x02\x03";
      const result = sanitizeInput(input);
      expect(result).not.toContain("\x01");
    });

    it("should reject excessively long input", () => {
      const longInput = "a".repeat(257);
      expect(() => sanitizeInput(longInput)).toThrow(/Input exceeds maximum length/);
    });
  });

  describe("isPluginWhitelisted", () => {
    it("should allow whitelisted plugins", () => {
      const whitelist = ["@org/plugin-a", "@org/plugin-b"];
      expect(isPluginWhitelisted("@org/plugin-a", whitelist)).toBe(true);
    });

    it("should reject non-whitelisted plugins", () => {
      const whitelist = ["@org/plugin-a"];
      expect(isPluginWhitelisted("@org/plugin-b", whitelist)).toBe(false);
    });
  });

  describe("validatePluginModule", () => {
    it("should accept modules with valid registerHandlebars function", () => {
      const module = {
        registerHandlebars: () => {},
      };
      expect(() => validatePluginModule(module)).not.toThrow();
    });

    it("should reject modules with invalid registerHandlebars", () => {
      const module = {
        registerHandlebars: "not a function",
      };
      expect(() => validatePluginModule(module)).toThrow(
        /Plugin exports invalid registerHandlebars/
      );
    });

    it("should accept modules with private exports (starting with _)", () => {
      const module = {
        _internal: "value",
      };
      expect(() => validatePluginModule(module)).not.toThrow();
    });

    it("should warn about unexpected exports", () => {
      const consoleSpy = jest.spyOn(console, "warn").mockImplementation();
      const module = {
        unexpectedExport: "value",
      };
      validatePluginModule(module);
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining("exports unexpected key")
      );
      consoleSpy.mockRestore();
    });
  });
});
