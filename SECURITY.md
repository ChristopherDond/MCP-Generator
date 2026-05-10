# Security Policy

## Overview

This document outlines the security measures and practices implemented in the MCP Generator project.

## Security Features

### 1. Path Traversal Protection
- All output file paths are validated to prevent directory traversal attacks
- Uses `validateOutputPath()` to ensure files are written only to the intended output directory
- Rejects paths that attempt to access parent directories

### 2. Plugin Security
- By default, dynamic plugin code loading is **disabled**
- Plugins can only provide templates, not arbitrary code execution
- To enable plugin code loading (not recommended for untrusted sources):
  ```bash
  MCP_GEN_ALLOW_PLUGINS=true mcp-gen generate --plugin ./my-plugin ...
  ```
- Plugin modules are validated for safe exports
- Symbolic links are rejected to prevent symlink attacks

### 3. Remote URL Validation
- Only HTTPS URLs are allowed for fetching OpenAPI specs
- Private/local IP addresses and localhost are blocked (SSRF prevention)
- Content-Type validation (only JSON/YAML allowed)
- Content-Length validation (max 50MB)
- 30-second timeout on remote fetches

### 4. Input Sanitization
- User inputs are sanitized to remove null bytes and control characters
- Length limits enforced on user-provided strings

## Vulnerability Fixes

### Fixed Issues
- ✅ Remote Code Execution via plugin loading - **MITIGATED**: Dynamic code loading disabled by default
- ✅ Path traversal - **FIXED**: All output paths validated
- ✅ SSRF attacks - **FIXED**: URL validation and IP filtering
- ✅ Dependency vulnerabilities - **FIXED**: All packages audited and updated

## Best Practices

### For Users
1. Keep the project updated: `npm audit fix`
2. Do not enable `MCP_GEN_ALLOW_PLUGINS` with untrusted sources
3. Validate OpenAPI specs from unknown sources before generation
4. Use `--force` carefully when overwriting existing projects

### For Developers
1. Run `npm audit` before committing
2. Add security tests for new features
3. Never suppress security warnings
4. Review security.ts for validation functions before adding new file operations

## Security Audit Checklist

- [x] Path traversal protection
- [x] Plugin execution control
- [x] Remote URL validation
- [x] Dependency vulnerability scanning
- [x] Input sanitization
- [ ] Code signing (future)
- [ ] Security headers (future)

## Reporting Security Issues

If you discover a security vulnerability, please email security@example.com instead of using the issue tracker.

## References

- [OWASP Path Traversal](https://owasp.org/www-community/attacks/Path_Traversal)
- [OWASP SSRF](https://owasp.org/www-community/attacks/Server-Side_Request_Forgery)
- [OWASP Code Injection](https://owasp.org/www-community/attacks/Code_Injection)
