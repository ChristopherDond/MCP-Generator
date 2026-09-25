# Notas de release

> **Status em 24/09/2026:** `2.3.0` é a versão publicada no npm. A `2.3.1` está preparada e verificada localmente, mas ainda não recebeu push, tag, publicação npm nem GitHub Release.

## 2.3.1 — Preparada, não publicada

Patch sem breaking changes, focada em DX, OSS hygiene e confiabilidade de automação.

### Correções

- Projetos TypeScript gerados agora incluem `package-lock.json`. A CI e o Docker gerados já usavam `npm ci`; o scaffold agora fornece o lockfile necessário para um checkout limpo.
- `--force` passa a prevalecer sobre `--incremental` quando as duas flags são fornecidas. Handlers customizados e arquivos preservados são descartados como a documentação promete.
- `watch --once` propaga falhas de fetch, parse e geração: código 1 em erro e código 0 em sucesso. O comando também usa o fluxo assíncrono do Commander.
- O lint deixou de depender de um binário ambiente. ESLint 10 e typescript-eslint são dependências locais, com flat config mínima e sem regras amplas de formatação.

### DX e OSS hygiene

- O smoke TypeScript executa o mesmo `npm ci` usado pelos templates gerados.
- CI e release agora executam lint, typecheck, testes, build e smokes relevantes.
- `require()` continua permitido para preservar o runtime CommonJS em Node 20; migração ESM fica reservada para uma breaking future.

### Validação local

- `npm ci`: ok.
- `npm run lint`: ok.
- `npx tsc --noEmit`: ok.
- `npm test -- --runInBand`: 16 suites, 214 testes, todos passando.
- `npm run test:cli`: 2 testes de exit code, todos passando.
- `npm run test:generated`: scaffold TypeScript instala com `npm ci`, compila e atende `initialize`/`tools/list`.
- `npm run test:generated:py`: scaffold Python compila e atende `initialize`/`tools/list`.
- `npm pack --dry-run --json`: pacote `2.3.1` gerado com 89 arquivos.
- `npm audit --omit=dev`: zero vulnerabilidades. A auditoria completa aponta uma vulnerabilidade high apenas em `js-yaml` 3.x, transitiva do Jest e restrita a ferramentas de desenvolvimento; nenhum upgrade amplo foi aplicado.

### Publicação pendente

Push, tag e publicação exigem autorização explícita. O caminho oficial continua sendo:

1. Enviar os commits da branch para `main`.
2. Criar e enviar a tag `v2.3.1`.
3. Aguardar `.github/workflows/release.yml` validar, publicar via Trusted Publisher OIDC e criar a GitHub Release.
4. Confirmar com `npm view @christopher_dondici/mcp-gen version` e `gh release view v2.3.1`.

Não usar publicação manual paralela nem `NPM_TOKEN`; o workflow atual usa OIDC.

## 2.3.0 — Publicada em 22/09/2026

- Suporte a Swagger 2.0 com conversão interna para OpenAPI 3.
- Registry com `slack`, `kubernetes` e `digitalocean` reativados; `azure` continua removido.
- Benchmark `examples/large-scale.json`: 180 operações → 10 tools com agrupamento.
- Validação histórica: 16 suites e 213 testes.

Instalação publicada: `npm install -g @christopher_dondici/mcp-gen@2.3.0`.

## 2.2.0 — Publicada em 21/09/2026

- `generate --dry-run` e resumo `--json`.
- Filtros e agrupamento no `watch` e no modo interativo.
- Avisos para schemas parcialmente suportados.
- Melhorias de CONTRIBUTING e documentação do gate de plugins.

## 2.1.5 — Publicada em 20/09/2026

- Query string e headers reais nos clientes gerados TypeScript/Python.
- Modo HTTP do Go ligado ao cliente real.
- Registry com mensagens de erro acionáveis durante a Fase 0 v3-only.

## Limitações conhecidas

- A conversão de Swagger 2.0 pode perder construções exóticas.
- Unions `oneOf`/`anyOf`/`discriminator` não validam schemas completos em runtime.
- A análise de segurança é estática e não substitui revisão, testes ou backend de autorização.
- Streaming, resources e prompts ainda não estão implementados.
- O histórico detalhado de versões permanece em [CHANGELOG.md](CHANGELOG.md).
