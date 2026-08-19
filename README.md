

# MCP-Generator

> **Also available in:** [Português (Versão em Português)](README.pt-BR.md)

Generate MCP servers from OpenAPI specs.

> **Status**: 🚀 Version `v2.1.1` Released! [View changes](https://github.com/ChristopherDond/MCP-Generator/releases/tag/v2.1.1)

`mcp-gen` turns an OpenAPI v3 spec into an MCP server in **TypeScript**, **Python**, or **Go**. It maps each route to a tool, generates typed models (including enums, oneOf/anyOf), and keeps custom code when you regenerate.

## Quick start

```bash
npm install
npm run build
```

Generate a server from a local spec:

```bash
mcp-gen generate -i examples/petstore.json -l typescript -o ./my-server
```

Validate a spec without generating files:

```bash
mcp-gen validate -i examples/petstore.yaml
```

Run the interactive CLI if you prefer prompts:

```bash
npm run dev
```

## What it does

```mermaid
sequenceDiagram
    participant User
    participant CLI
    participant Parser
    participant Generator
    participant Output

    User->>CLI: mcp-gen generate --input api.yaml --lang go
    CLI->>Parser: validate and parse OpenAPI v3 (JSON or YAML)
    Parser->>Generator: internal AST (tools, models, examples)
    Generator->>Output: render Handlebars templates
    Output-->>User: TypeScript, Python, or Go MCP server project
```

Each route becomes an MCP tool with:

- typed input from parameters (path, query, header, cookie, body) and request bodies
- example responses from the spec
- enum / oneOf / anyOf / discriminator schema support
- real HTTP client mode (`--http`) that calls the actual API
- scoped authContext contract (blocks raw credentials by default)
- optional incremental code preservation

## Requirements

- Node.js 20+
- npm 9+ or yarn
- (Optional) Python 3.8+ for Python projects
- (Optional) Go 1.22+ for Go projects

To install globally:

```bash
npm install -g mcp-gen
```

## Installation

```bash
git clone https://github.com/ChristopherDond/MCP-Generator.git
cd MCP-Generator
npm install
npm run build
```

## CLI

### Commands

- `mcp-gen generate` or `mcp-gen g` creates a server from a spec.
- `mcp-gen validate` or `mcp-gen v` checks a spec with detailed warnings (name collisions, missing examples, unsupported schemas).
- `mcp-gen init` downloads a known public spec and can generate a project.
- `mcp-gen watch` watches a file or URL and regenerates on changes.

### Generate

```bash
mcp-gen generate -i ./api/openapi.yaml -l typescript -o ./my-server
mcp-gen generate -i ./api/openapi.yaml -l python -o ./my-server
mcp-gen generate -i ./api/openapi.yaml -l go -o ./my-server
```

**Useful flags:**

- `--force`, `-f` overwrites existing files.
- `--incremental` keeps code between `@@mcp-gen:start` and `@@mcp-gen:end`.
- `--http` generates handlers that **call the real API** over HTTP instead of returning example stubs.
- `--env-file <path>` embeds TOKEN/BASE_URL from a .env-style file into the generated client.
- `--name <name>` sets the server name.
- `--server-version <version>` sets the server version.
- `--plugin <path>` loads a plugin module or folder (can be repeated).

### Validate (v2.1+)

```bash
mcp-gen validate -i ./api/openapi.yaml
```

Outputs a rich report:

```
Spec is valid
  Tools: 12  Models: 8  Base URL: https://api.example.com

  2 warning(s):
  ⚠ Tool name collision resolved: "get_users" appears 2x (unique suffixes added)
  ⚠ 3 tool(s) have no example response: get_users_id, delete_user, patch_user
```

### Init

`init` uses the built-in registry:

```bash
mcp-gen init --from list
mcp-gen init --from stripe
mcp-gen init --from stripe --generate -o ./stripe-mcp
```

Available registry keys:

| Key | Description |
|-----|-------------|
| `stripe` | Stripe Payment API |
| `github` | GitHub REST API |
| `slack` | Slack Web API |
| `openai` | OpenAI API |
| `petstore` | Swagger Petstore example |
| `twilio` | Twilio Communications API |
| `shopify` | Shopify Admin API |
| `kubernetes` | Kubernetes API |
| `digitalocean` | DigitalOcean API |
| `azure` | Azure Resource Manager API |

### Watch

```bash
mcp-gen watch -i ./api/openapi.yaml -o ./my-server
mcp-gen watch -i https://example.com/spec.json --interval 60000
```

For URL inputs, `--interval <ms>` controls the polling interval. `--once` runs generation once and exits after the first change.

## Plugins

Plugins can override templates and register extra Handlebars helpers.

Basic structure:

- `templates/typescript/...`, `templates/python/...`, or `templates/go/...` for `.hbs` template overrides
- `index.js` that exports `registerHandlebars(handlebars)` for custom helpers

Example:

```bash
mcp-gen generate -i ./api/openapi.yaml --plugin ./my-plugin
mcp-gen watch -i ./api/openapi.yaml --plugin ./my-plugin
```

Plugin templates override core templates when they use the same path under `templates/<lang>/`.

## Generated project structure

**TypeScript:**

```
my-server/
├── src/
│   ├── server.ts        # MCP server — tool definitions + handlers
│   ├── models.ts        # TypeScript interfaces from OpenAPI schemas (enums, unions)
│   └── client.ts        # HTTP client (used in --http mode)
├── .github/
│   └── workflows/
│       └── ci.yml
├── Dockerfile
├── package.json
├── tsconfig.json
└── README.md
```

**Python:**

```
my-server/
├── server.py            # FastMCP server — tool definitions + handlers
├── models.py            # Pydantic models from OpenAPI schemas (enums, unions)
├── requirements.txt
├── .github/
│   └── workflows/
│       └── ci.yml
├── Dockerfile
└── README.md
```

**Go (new in v2.1):**

```
my-server/
├── main.go              # MCP server using mark3labs/mcp-go
├── models.go            # Go types from OpenAPI schemas (enums, unions)
├── client.go            # HTTP client (used in --http mode)
├── go.mod
├── .github/
│   └── workflows/
│       └── ci.yml
├── Dockerfile
└── README.md
```

---

## Connect to Claude Desktop

**TypeScript:**

```json
{
  "mcpServers": {
    "my-server": {
      "command": "node",
      "args": ["/absolute/path/to/my-server/dist/server.js"]
    }
  }
}
```

**Python:**

```json
{
  "mcpServers": {
    "my-server": {
      "command": "python",
      "args": ["/absolute/path/to/my-server/server.py"]
    }
  }
}
```

**Go:**

```json
{
  "mcpServers": {
    "my-server": {
      "command": "go",
      "args": ["run", "/absolute/path/to/my-server/main.go"]
    }
  }
}
```

Restart Claude Desktop. Your API tools appear automatically.

---

## Security & `authContext` Contract

The generated tools expect **scoped authorization metadata** (not raw credentials):

```json
{
  "tokenId": "tok_abc123",
  "principal": "user:42",
  "expiresAt": "2026-05-11T14:00:00Z",
  "allowedTools": ["get_orders"],
  "endpointAllowlist": ["GET /orders"],
  "spendLimitUsd": 5,
  "spendUsedUsd": 1.2,
  "revoked": false,
  "requestId": "req_01J..."
}
```

The scaffold blocks arguments like `token`, `authorization`, `api_key`, `client_secret`, `password`, `secret` by default.

**Quick example (env var):**

```bash
# Linux / macOS
export TOKEN=your_api_key_here

# Windows (PowerShell)
$env:TOKEN='your_api_key_here'
```

For advanced integrations and management, consider Cohesivity.ai as a backend for auth, storage, and revocation policies.

---

## Implement handlers

Generated files return spec examples by default. Replace stubs with real logic.

**TypeScript** (`src/server.ts`):

```typescript
case "get_users_id": {
  // @@mcp-gen:start:get_users_id
  const user = await db.users.findById(args.id);
  return { content: [{ type: "text", text: JSON.stringify(user) }] };
  // @@mcp-gen:end:get_users_id
}
```

**Python** (`server.py`):

```python
@mcp.tool()
async def get_users_id(id: float, auth_context: dict | None = None) -> Any:
    # @@mcp-gen:start:get_users_id
    user = await db.users.find_by_id(id)
    return user
    # @@mcp-gen:end:get_users_id
```

**Go** (`main.go`):

```go
s.AddTool(get_users_idTool, func(ctx context.Context, request mcp.CallToolRequest) (*mcp.CallToolResult, error) {
    // @@mcp-gen:start:get_users_id
    return jsonSerialize(jsonExample(`{"id": 1, "name": "Alice"}`))
    // @@mcp-gen:end:get_users_id
})
```

Code between `@@mcp-gen:start` and `@@mcp-gen:end` markers is preserved when you re-run `generate --incremental`.

---

## Programmatic API (Library Mode)

```typescript
import { generate, validateSpec, parseOpenAPI } from "mcp-gen";

const result = await generate({
  input: "./api/openapi.yaml",
  lang: "typescript",
  out: "./my-server",
  force: true,
  incremental: false,
  http: false,
});

const validation = await validateSpec("./api/openapi.yaml");
console.log(validation.tools, validation.models, validation.warnings);
```

---

## Development

```bash
npm test
npx tsc --noEmit

# TypeScript example
node dist/cli/index.js generate --input examples/petstore.json --out /tmp/ts-test --force

# Python example
node dist/cli/index.js generate --input examples/petstore.yaml --lang python --out /tmp/py-test --force

# Go example
node dist/cli/index.js generate --input examples/petstore.json --lang go --out /tmp/go-test --force

# HTTP mode (real API calls)
node dist/cli/index.js generate --input examples/petstore.json --lang typescript --out /tmp/ts-http --force --http

# Incremental example
node dist/cli/index.js generate --input examples/petstore.json --out /tmp/ts-test --incremental
```

---

## Roadmap

| Week | Status | Scope |
|------|--------|-------|
| 0–1 | ✅ Done | CLI, OpenAPI v3 parser, TypeScript generator, 7-file scaffold |
| 2 | ✅ Done | YAML input, Python/FastMCP target, incremental generation |
| 3 | ✅ Done | `oneOf`/`anyOf` support, auth stubs, integration tests |
| 4 | ✅ Done | Interactive CLI mode, npm/pip publish |
| 5 | ✅ Done | `mcp-gen init --from stripe` — built-in spec registry |
| 6 | ✅ Done | Release candidate `v1.0.0-rc.1` — in testing, feedback welcome! |
| 7+ | 📋 Planned | **v2.1**: Go target, HTTP mode, enums, header/cookie params, library API, rich validate |
| 8+ | 📋 Planned | Streaming/resources/prompts, OpenAPI v2, more registries |

---

## Known limitations

- OpenAPI v2 (Swagger) is not supported — v3.x only
- `oneOf` / `anyOf` / `discriminator` schemas generate union types but no runtime validation
- `copy-templates` script uses `xcopy` on Windows (works in CI)

---

## License

MIT © 2026 - Christopher D.
