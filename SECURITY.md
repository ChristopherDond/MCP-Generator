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

### Known dev-only finding (no runtime impact)

- `js-yaml@3.15.1` (GHSA-2883-xcg3-v3hh, high) appears only in the dev tree, pulled by
  `ts-jest → babel-plugin-istanbul → @istanbuljs/load-nyc-config` (`^3.13.1`).
  Runtime uses `js-yaml@4.3.2` directly and is clean.
- `brace-expansion@1.1.18` (GHSA-q2hr-2g5m-vwhr, GHSA-qhr7-859c-m2p7, GHSA-6j4f-fj2g-mc7p, high)
  appears only in the dev tree, pulled by `jest → @jest/core → @jest/reporters → glob@7.2.3 → minimatch@3.1.5`.
  Runtime has no such chain and is clean.
- The vulnerable copy is loaded only when `load-nyc-config` parses a `.nycrc.yml`/`.nycrc.yaml`
  file. This project has no such file and never runs Jest with `--coverage`, so the code path
  is unreachable in CI and in published artifacts.
- `npm audit --omit=dev` reports zero vulnerabilities. No `overrides` pin and no broad Jest
  upgrade are applied on the 2.3.x line for this dev-only finding; it is revisited only if
  coverage reporting is adopted or Jest is upgraded for another reason.

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

If you discover a security vulnerability, please open a confidential report via [GitHub Security Advisories](https://github.com/ChristopherDond/MCP-Generator/security/advisories/new) or [open an issue](https://github.com/ChristopherDond/MCP-Generator/issues) without exploit details instead of using a public tracker comment.

## References

- [OWASP Path Traversal](https://owasp.org/www-community/attacks/Path_Traversal)
- [OWASP SSRF](https://owasp.org/www-community/attacks/Server-Side_Request_Forgery)
- [OWASP Code Injection](https://owasp.org/www-community/attacks/Code_Injection)
