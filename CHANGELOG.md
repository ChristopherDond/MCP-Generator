# Changelog

Todas as mudanças notáveis do projeto serão documentadas neste arquivo.

## [2.3.1] - 2026-09-25

### Correções e DX sem breaking

- **Scaffold TypeScript reproduzível**: projetos gerados passam a incluir `package-lock.json`; CI e Docker já usavam `npm ci`, mas não recebiam o lockfile necessário. O smoke agora executa o mesmo `npm ci` dos templates.
- **Precedência de `--force`**: quando `--force` e `--incremental` são usados juntos, o force descarta handlers customizados e arquivos preservados, como a documentação já prometia.
- **Status de `watch --once`**: falhas de parsing, fetch e geração encerram com código 1; sucessos encerram com código 0. A CLI usa o fluxo assíncrono do Commander.
- **Lint reproduzível**: ESLint 10 + typescript-eslint são dependências locais, com flat config mínima e gates na CI e no release. `require()` permanece permitido para não antecipar uma migração ESM.
- **Testes e gates**: 16 suites / 214 testes Jest, 2 testes de exit code da CLI, smoke TypeScript com `npm ci`, smoke Python e `npm pack --dry-run` passaram localmente em 24/09/2026.
- **Publicação**: `2.3.1` publicada no npm como `latest` via Trusted Publisher OIDC, com provenance assinada e GitHub Release `v2.3.1`.

## [2.3.0] - 2026-09-22

### Fase 2 - âncora: destrava o registry (minor)

- **Swagger 2.0**: conversão v2→v3 interna na ingestão (`src/core/parser.ts`: `convertSwagger2ToOpenApi3`, `host`/`basePath`/`schemes` → `servers`, `definitions` → `components.schemas`, body/formData → `requestBody`, `securityDefinitions` → `securitySchemes`). `validate` + `generate` aceitam v2; fixture `examples/swagger-v2-petstore.json`.
- **Registry**: `slack`, `kubernetes`, `digitalocean` de volta (v2 convertido); só `azure` continua removido (fragmento, não spec). `REMOVED_SPECS` só com `azure`.
- **Escala**: fixture `examples/large-scale.json` (180 ops, 10 tags, 2 modelos) + `tests/scale.test.ts` provando `180 → 10 tools` com `--group-by tag` e `path-prefix`; número citável nos READMEs (Benchmark).
- **Testes**: `tests/swagger-v2.test.ts` (7 testes), `tests/scale.test.ts` (3 testes), `tests/fase0.test.ts` atualizado para v2. Suite: 16 suites, 213 testes passando.

## [2.2.0] - 2026-09-21

### Fase 1 - base sólida, sem breaking (minor)

- **`generate --dry-run` + `--json`**: lista tools/modelos/grupos/arquivos sem escrever nada; `--json` devolve resumo legível por máquina (`summary` em `GenerationResult`).
- **`watch` com filtros**: repassa `--include-tags`, `--exclude-tags`, `--path-prefix`, `--include-paths`, `--exclude-paths`, `--operation-allowlist`, `--group-by` (mais `--http`, `--force`/`--incremental`); interativo pergunta filtros e agrupamento; `watch --once` encerra após a primeira geração também em arquivos.
- **Avisos de schemas parciais**: `validate` e `generate` emitem warning por schema quando `$ref` de `allOf` é ignorado ou variante inline de `oneOf`/`anyOf` é descartada (`AST.warnings`).
- **Higiene OSS**: CONTRIBUTING atualizado (v2.2.0, Go já suportado), `MCP_GEN_ALLOW_PLUGINS` documentado nos READMEs.
- **Testes**: `tests/dry-run.test.ts`, `tests/watch-filters.test.ts` (inclui `watch --once` com filtro), `tests/schema-warnings.test.ts`. Suite: 14 suites, 203 testes passando.

## [2.1.5] - 2026-09-20

### Fase 0 - correções P0 (PR #4)

- **TypeScript**: cliente gerado serializa query params (`queryNames` + `URLSearchParams`). Exemplo: `get_pets({ limit: 5 })` chama `/pets?limit=5`.
- **Python**: `server.py` gerado com `_build_query` / `_build_headers` e `kwargs["params"]` no modo `--http`, inclusive em tools agrupadas.
- **Go**: modo `--http` ligado no client real (`__client.do("GET", "/pets"...`), com `q.Encode()`, `PathEscape` e guards de `nil`. Remove stubs `not yet wired`.
- **Registry**: só v3 (`stripe`, `github`, `openai`, `petstore`, `twilio`, `shopify`). Chaves `slack`, `kubernetes`, `digitalocean`, `azure` removidas com mensagem de orientação. Chave desconhecida lista `Known keys`. Spec v2 falha com `Only OpenAPI v3`.
- **Testes**: 8 novos em `tests/fase0.test.ts`. Suite: 11 suites, 196 testes passando.

## [2.1.4] - 2026-09-19

### Filtros, agrupamento e preservação incremental (PR #3)

(A tag `v2.1.3` foi substituída antes de chegar ao npm; tudo abaixo saiu na 2.1.4.)

- **Filtros de path com globs**: `--path-prefix "/users/**"`, `--include-paths`, `--exclude-paths`; `--operation-allowlist op1,op2` inline (arquivo continua suportado).
- **Agregação com `--group-by tag | path-prefix`**: uma tool lógica por tag ou segmento de path, com roteamento interno por `action` (nome da operação + method).
- **Dedup de nomes**: em colisão, sufixa com o method e depois com hash curto do path.
- **Guardas incrementais**: regiões `<generated:handlers>` mais marcadores `@@mcp-gen` por tool, merge 3-way com `--incremental`, `--force` para sobrescrever.
- **Middleware de auth separado** (`src/auth.ts`, `auth.py`, `auth.go`) gerado a partir de `securitySchemes`, e arquivos `handlers.custom.*` que nunca são sobrescritos sem `--force`.
- **Fix**: middleware de auth gerado com default para specs sem `securitySchemes`.

## [2.1.2] - 2026-09-17

### Packaging & Distribution

- `@christopher_dondici/mcp-gen` 2.1.2 released on npm
- Scoped npm name after rejection of `mcp-gen` for similarity to `mcpgen`; version, `mcp-gen` binary and repository unchanged
- Public scoped publication configured; CI and release install and validate the scoped tarball before publication
- Build, packaging, CI, and dependency fixes only; no new runtime features
- Portable template copy (`fs.cpSync`) replacing Windows-only `xcopy`
- Versioned `package-lock.json` enabling `npm ci`
- Package `files` allowlist + `prepack` build so tarballs are complete
- Release workflow gates `npm publish` on `HAS_NPM_TOKEN` env instead of `secrets` in `if`
- New CI workflow: typecheck, tests, build, `npm pack` and tarball install smoke test on push/PR
- Dependency updates: fast-uri 3.1.8, hono 4.13.8, js-yaml 4.3.2, qs 6.16.0
- Package and lockfile versions aligned to 2.1.2; repository URL normalized to the official `git+https` format
- English/Portuguese READMEs and `RELEASE_NOTES.md` aligned with 2.1.2 preparation, source quick start, and conditional npm installation; 2.1.1 history preserved

---

## [2.1.1] - 2026-08-07

### 🛡️ MCP Security & Lint Layer (New)

- **Security scanning** (`mcp-gen security <path>`): Scans generated MCP projects for:
  - Raw credential detection (API keys, tokens, secrets, JWTs, AWS keys, etc.)
  - `authContext` contract validation (scoped metadata vs raw credentials)
  - Tool policy enforcement (TTL, spend limits, revocation, audit logging)
- **Lint checks**: Naming conventions, empty descriptions, TODO/FIXME in generated code, incremental marker balance, schema completeness
- **JSON output** (`--json`) for CI/CD integration
- **Fail-on-warn** (`--fail-on-warn`) for strict pipelines
- **Interactive mode** support in CLI
- **Library API exports**: `scanProject`, `formatReport`, `SecurityRule`, `SecurityReport`
- **11 new tests** covering credential scanning, authContext validation, incremental markers, project scanning, report formatting

### 🔧 Generated Template Improvements

- **TypeScript**: Enhanced `RAW_CREDENTIAL_KEYS` + `TOOL_POLICIES` with per-tool policies, `requireSecurity` helper
- **Python**: Complete authContext validation with `require_security`, raw credential blocking
- **Go**: Full security layer with `RAW_CREDENTIAL_KEYS` map, `TOOL_POLICIES` struct, `hasRawCredentialKey`, `requireSecurity`

---

## [2.1.0] - 2026-08-07

### 🚀 Major Features

- **Go target (new language)**: Generate MCP servers using `mark3labs/mcp-go` with full parity — `main.go`, `models.go`, `client.go`, `go.mod`, `README.md`, `Dockerfile`, GitHub Actions CI.
- **HTTP mode (`--http`)**: Generated handlers call the **real API** over HTTP (`fetch` / `httpx` / `net/http`) instead of returning example stubs. Controlled by `--http` flag or `--env-file` for credential injection.
- **Library API (programmatic usage)**: Export `generate`, `validateSpec`, `parseOpenAPI`, `extractHandlers`, `injectHandlers`, `listKnownSpecs`, `fetchSpecToCwd` + all types from `src/index.ts`.
- **Rich `validate` command**: Detailed warnings for tool-name collisions, missing examples, unsupported schemas, duplicate operations, etc.
- **Parser v3**: Full `$ref` resolution in parameters & requestBody; header/cookie params included; real enum union types (TypeScript `type X = "a" | "b"`, Python `Literal`, Go `type X = string` + `var` constants); unique tool names with collision suffixes; reserved-word sanitization (`new`, `delete`, `class`, etc. → `new_`).
- **Safe description escaping**: Central `escapeText` helper prevents template injection/breakage from arbitrary OpenAPI descriptions.
- **CLI version sync**: Single source of truth in `package.json`; CLI reads version at runtime.
- **Interactive HTTP prompts**: When `--http` is used without `--env-file`, prompts ask for BASE_URL and TOKEN.

### 🐛 Fixes

- Tool-name collisions resolved with unique `_<hash>` suffixes
- Reserved words in tool names sanitized
- `$ref` in parameters/requestBody no longer silently skipped
- Header/cookie parameters now included in tool signatures
- Enums emitted as real union types (not loose `string`)
- Descriptions with special chars (quotes, newlines) no longer break templates
- Go `mcp.PropertyOption` API corrected (`mcp.Description`, `mcp.Required`)
- Python `_call_api` made `async` (was sync with `async with`)

### 📚 Documentation

- README updated with Go target, `--http` mode, library API, authContext contract, programmatic usage
- CHANGELOG v2.1.0 entry

### ⚠️ Known Limitations

- OpenAPI v2 (Swagger) not supported — v3.x only
- `oneOf`/`anyOf`/`discriminator` generate union types but no runtime validation
- Streaming/resources/prompts not yet implemented

---

## [2.0.0] - 2026-05-11

### 🎉 Major Release 2.0

Este é o release v2.0.0 de `mcp-gen` — uma versão completa e estável compilada de 7 semanas de desenvolvimento, pronta para produção.

### ✨ Features

- **OpenAPI v3 Parser**: Suporte completo a OpenAPI v3.0.0, v3.0.1, v3.0.2, v3.0.3, v3.1.0
  - `oneOf`, `anyOf`, `discriminator` support
  - Schema validation com `@apidevtools/swagger-parser`
  - JSON e YAML inputs

- **Code Generation**
  - TypeScript: ESM com tipos completos
  - Python: FastMCP com Pydantic v2
  - Incremental generation com marcadores `@@mcp-gen:start/end`
  - Preservação de código customizado entre regenerações

- **CLI & Tools**
  - 4 comandos principais: `generate`, `validate`, `init`, `watch`
  - CLI interativa com `inquirer`
  - Registry pré-configurado com 10+ APIs públicas
  - Support para plugins customizados
  - Watch mode com polling de URLs

- **API Registry**
  - Stripe Payment API
  - GitHub REST API
  - Slack Web API
  - OpenAI API
  - Petstore (exemplo)
  - Twilio Communications API
  - Shopify Admin API
  - Kubernetes API
  - DigitalOcean API
  - Azure Resource Manager API

- **Deployment Ready**
  - Dockerfile gerado automaticamente
  - GitHub Actions CI/CD template
  - package.json / requirements.txt configurados
  - tsconfig.json / Python environment ready

### 🐛 Fixes

- Remoção de dependências desnecessárias
- Melhor tratamento de erros no parser
- Validação mais robusta de specs inválidas
- Tratamento correto de parâmetros opcionais

### 📚 Documentation

- README completo com quick start
- Documentação em Português (README.pt-BR.md)
- CLI help com exemplos
- Guia de plugins
- Roadmap transparente

### ⚠️ Known Limitations

- OpenAPI v2 (Swagger) não suportado — apenas v3.x
- `oneOf` / `anyOf` com múltiplos níveis pode ter edge cases
- Copy templates no Windows requer `xcopy` (já configurado)
- Performance: Specs muito grandes (>50MB) podem ser lentas

### 🔧 Technical Details

- Node.js 20+ requerido
- Handlebars v4.7+ para templating
- MCP SDK v1.0.0+
- Testes com Jest
- TypeScript 5.4+

### 📦 Versioning

A partir de `v1.0.0-rc.1`:
- Versão RC: `v1.0.0-rc.N`
- Versão final: `v1.0.0`
- npm tag: `@rc` para release candidates, `@latest` para stable

Publicado em npm como:
```bash
npm install mcp-gen@rc          # v1.0.0-rc.1
npm install mcp-gen@latest      # Quando v1.0.0 for lançado
```

### 🙏 Thanks

- Comunidade MCP por feedback
- Anthropic pelos docs e SDK
- OpenAPI initiative pela spec
- Contribuidores early testers

### 📖 For RC Testing

Se você está testando a RC, por favor:

1. **Report Issues**: Use [GitHub Issues](https://github.com/ChristopherDond/MCP-Generator/issues)
2. **Share Feedback**: [Discussions](https://github.com/ChristopherDond/MCP-Generator/discussions)
3. **Try Examples**: Rode `mcp-gen init --from stripe --generate -o ./stripe-mcp`
4. **Test Registry**: Experimente diferentes APIs

### 🚀 Next Steps (RC → v1.0.0)

Planejado para RC.2 e beyond:

- [ ] Plugin system com melhor documentação
- [ ] Suporte a OpenAPI v3.1 discriminator melhorado
- [ ] Mais templates (Go, Rust, outros?)
- [ ] Performance improvements
- [ ] Integração com ferramentas populares
- [ ] Type inference melhorado para complex schemas

---

## [0.1.0] - 2026-04-01

### Initial Development

Project initialization com conceito básico.

---

## Versioning

Seguimos [Semantic Versioning](https://semver.org/):
- **MAJOR.MINOR.PATCH** para releases estáveis
- **MAJOR.MINOR.PATCH-rc.N** para release candidates
- **MAJOR.MINOR.PATCH-alpha.N** para alpha versions

## How to Contribute

Veja [CONTRIBUTING.md](./CONTRIBUTING.md) (quando criado) ou abra uma discussion em GitHub Issues.
