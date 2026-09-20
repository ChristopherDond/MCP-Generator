# Notas de release

## 2.1.5 - Fase 0 (2026-09-20)

Merge do PR #4 (`christopherdondici/fix/fase-0-p0-fixes`) sobre a 2.1.4.

- TypeScript com query string real (`get_pets({ limit: 5 })` → `/pets?limit=5`).
- Python com `_build_query` / `_build_headers` no modo `--http`.
- Go com modo `--http` ligado no `APIClient` (sem stub).
- Registry só v3, com guia para chaves removidas (`slack`, `kubernetes`, `digitalocean`, `azure`) e erro acionável para spec v2.
- Validação: `npm run build` ok, `npm test` 11 suites / 196 testes, incluindo `tests/fase0.test.ts` (8 testes).

Para publicar: `npm install -g @christopher_dondici/mcp-gen@2.1.5` após `npm publish --access public` ou via tag `v2.1.5` no workflow de release.

## Estado e fontes

A versão `2.1.2` do pacote `@christopher_dondici/mcp-gen` está preparada para release e ainda não foi publicada, com `package.json` e `package-lock.json` alinhados. O npm recusou `mcp-gen` por similaridade com `mcpgen`; a renomeação mantém a versão, o binário `mcp-gen` e o repositório. A publicação no npm não foi verificada; estas notas não confirmam publicação nem criação de tag. Uma tag Git ou um workflow de publicação não comprova disponibilidade no registry.

A 2.1.2 reúne correções de build, empacotamento, CI e dependências, sem novas funcionalidades de runtime. Estas notas preservam o histórico da 2.1.1, confrontando o [CHANGELOG](CHANGELOG.md) com os diffs `v2.1.0..v2.1.1` e `v2.1.1..1629696`, e descrevem separadamente a preparação da 2.1.2. As seções históricas do changelog não foram alteradas; suas afirmações sobre publicação e segurança não confirmam o estado atual.

## Funcionalidade histórica da v2.1.1

Comparação: `v2.1.0..v2.1.1`.

- Inclusão de `src/core/security-lint.ts`, com análise estática de padrões semelhantes a credenciais, referências a `authContext`, identificadores de políticas, nomes, descrições, TODO/FIXME e marcadores incrementais. Também há verificações de descrições e exemplos de uma spec encontrada no projeto; isso não equivale a validar integralmente seus schemas.
- Novo comando `security` (alias `sec`) e opção no menu interativo. A sintaxe real exige `-p` ou `--project`, não o caminho posicional mostrado no changelog.
- `--json` imprime o relatório em JSON; a CLI ainda imprime um cabeçalho antes dele, portanto stdout não é JSON puro. Erros encerram com código 1; `--fail-on-warn` também encerra com código 1 quando há avisos.
- Exports de biblioteca: `scanProject`, `formatReport` e os tipos `SecurityRule` e `SecurityReport`.
- Inclusão de 11 testes em `tests/security-lint.test.ts` e configuração explícita de transformação via `ts-jest`.
- Ajustes nos textos e prompts da CLI, com remoção de textos bilíngues em diversos pontos.
- O workflow de release passou a tentar condicionar `npm publish` à presença de `NPM_TOKEN`; a correção atual dessa condição é descrita separadamente abaixo.

Exemplo após compilar o checkout local:

```bash
node dist/cli/index.js security -p ./my-server
node dist/cli/index.js security -p ./my-server --fail-on-warn
```

### Templates: correção em relação ao changelog

**Os templates TypeScript e Python não mudaram entre `v2.1.0` e `v2.1.1`.** As melhorias atribuídas a eles na seção 2.1.1 do changelog não aparecem nesse diff e não são novidades dessa tag.

O template alterado foi `src/templates/go/server.go.hbs`: recebeu `RAW_CREDENTIAL_KEYS`, `TOOL_POLICIES`, `hasRawCredentialKey`, `requireSecurity` e a chamada de verificação nos handlers. Esses elementos são scaffolding e não comprovam uma implementação completa de autorização, auditoria ou revogação.

Go, modo HTTP, enums, parâmetros header/cookie, API de biblioteca e validação detalhada já pertenciam à v2.1.0; não são novidades da v2.1.1.

## Alterações após a tag até 1629696

Comparação: `v2.1.1..1629696`.

- `690de37`: remoção de comentários em `src/cli/index.ts`, `src/core/generator.ts` e `src/core/incremental.ts`, sem mudança de lógica executável nesse diff.
- `1629696`: alteração da sintaxe do `if` referente a `NPM_TOKEN` no workflow de release. Ainda era uma referência direta a `secrets` na condição; a correção incluída na 2.1.2 abaixo substitui essa abordagem.
- Nenhum template mudou nesse intervalo. Esses commits posteriores à tag não constituem uma nova versão publicada.

## Correções incluídas na 2.1.2

As alterações abaixo fazem parte da preparação da 2.1.2 e abrangem build, empacotamento, automação e dependências. Não adicionam funcionalidades aos servidores gerados e não fazem parte do conteúdo histórico da tag `v2.1.1`.

### Build e pacote

- `publishConfig.access` é `public` para o pacote scoped. O tarball da 2.1.2 se chama `christopher_dondici-mcp-gen-2.1.2.tgz` e a instalação local usa `node_modules/@christopher_dondici/mcp-gen`.
- Para o pacote final, use um clone ou worktree limpo fora do checkout de desenvolvimento; `prepack` não remove arquivos antigos nem caches já existentes em `dist/`.
- `copy-templates` usa uma chamada inline de Node.js a `fs.cpSync`, com cópia recursiva de `src/templates` para `dist/templates`. Não depende mais de `xcopy` nem de comandos de cópia específicos do shell.
- A allowlist `files` inclui `dist/`, `examples/`, `README.md`, `README.pt-BR.md`, `CHANGELOG.md`, `RELEASE_NOTES.md`, `SECURITY.md`, `SECURITY.pt-BR.md` e `LICENSE`. O npm também inclui seu manifesto automaticamente.
- `prepack` executa `npm run build`, preparando o código compilado e os templates antes do empacotamento.
- `package-lock.json` deixa de ser ignorado e passa a ser versionado com metadados alinhados a `2.1.2`, permitindo o fluxo `npm ci` com dependências fixadas pelo lockfile.
- `repository.url` usa o formato normalizado `git+https://github.com/ChristopherDond/MCP-Generator.git`.
- `npm run release` agora executa somente build e testes, removendo a chamada ao inexistente `scripts/release.js`. Esse comando não aumenta versão nem faz push.
- **Os comandos explícitos `release:patch` e `release:rc` continuam presentes e podem aumentar a versão e fazer push de commits/tags.** `scripts/release.sh` e `scripts/release.bat` também permanecem, com operações de atualização de versão, push e criação de release no GitHub. Não são comandos de verificação local e não foram executados nesta tarefa.

### CI e release

- A nova CI é acionada por pushes em qualquer branch e por pull requests, em `ubuntu-latest` com Node.js 20.
- Executa `npm ci`, `npx tsc --noEmit`, testes, build e `npm pack` real. Instala o tarball em um diretório temporário e verifica `--version` e `validate` usando o exemplo Petstore incluído no pacote.
- O smoke test verifica instalação e execução básica do tarball; não compila nem executa servidores gerados em todas as linguagens. A CI não publica no npm e não testa Windows/macOS.
- O workflow separado de release mantém o mesmo gatilho de tags estáveis (`v[0-9]+.[0-9]+.[0-9]+`). Verifica nome scoped, acesso público e correspondência entre tag e versão; executa typecheck, testes, build, pack e smoke test antes da publicação.
- A publicação usa `--access public` sobre o mesmo tarball validado, também anexado à release GitHub. A lógica de RC inalcançável foi removida. Uma release GitHub sem publicação npm continua possível quando o segredo não está disponível; não comprova publicação no registry.
- A variável de ambiente booleana `HAS_NPM_TOKEN` representa apenas a presença do segredo. O passo de publicação usa `if: env.HAS_NPM_TOKEN == 'true'`, em vez de consultar `secrets` diretamente no `if`. Isso não confirma que o pacote já foi publicado.

### Dependências

- Atualizações fixadas no lockfile da 2.1.2: `fast-uri` 3.1.8, `hono` 4.13.8, `js-yaml` 4.3.2 e `qs` 6.16.0. Resultados de auditoria dependem da data da consulta; essas versões não são uma garantia de ausência de vulnerabilidades.

## Uso local

Com Git, Node.js 20+ e npm 9+ instalados:

```bash
git clone https://github.com/ChristopherDond/MCP-Generator.git
cd MCP-Generator
npm ci
npm run build
node dist/cli/index.js --version
node dist/cli/index.js generate -i examples/petstore.yaml -l typescript -o ./my-server
node dist/cli/index.js validate -i examples/petstore.yaml
```

O fluxo acima usa a branch `main`, com as correções de build e empacotamento incluídas na 2.1.2, não um checkout isolado da tag histórica `v2.1.1`. A geração cria arquivos; não instala dependências nem inicia o servidor gerado.

Quando a versão 2.1.2 for publicada e sua disponibilidade no npm for confirmada, a instalação pelo registry poderá ser feita com `npm install -g @christopher_dondici/mcp-gen@2.1.2`. Até essa confirmação, use o fluxo pelo código-fonte.

Nos READMEs, `mcp-gen` é uma abreviação de `node dist/cli/index.js` na raiz do repositório. Opcionalmente, `npm link` após o build cria o comando apontando para o checkout local, alterando os links globais do npm sem depender de uma publicação de `@christopher_dondici/mcp-gen` no registry. Não há fluxo de instalação desta CLI via pip confirmado.

## Limitações

- A análise de segurança é estática, baseada em padrões de texto: pode gerar falsos positivos e deixar problemas passar. Um relatório aprovado não garante segurança nem prontidão para produção.
- Encontrar nomes de políticas ou funções no texto não comprova sua execução nem valida autorização, TTL, limites financeiros, revogação ou persistência de auditoria. Esses controles precisam de revisão e integração com um backend confiável.
- Os servidores gerados são scaffolds e exigem testes e revisão antes do deploy; não há garantia de segurança ou de equivalência entre os targets.
- OpenAPI v2 não é suportado. Unions geradas de `oneOf`/`anyOf`/`discriminator` não fornecem validação completa em runtime. Streaming/resources/prompts ainda não estão implementados.
