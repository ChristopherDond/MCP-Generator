# Notas de release

## Estado e fontes

A versão do pacote permanece `2.1.1`, e a tag mais recente é `v2.1.1`. Este documento não anuncia uma nova versão nem uma nova tag. O pacote `mcp-gen` não está publicado no npm: a tentativa de instalação retorna E404, conforme o status informado pelo mantenedor. Uma tag Git ou um workflow de publicação não comprova disponibilidade no registry.

Estas notas confrontam o [CHANGELOG](CHANGELOG.md) com os diffs reais `v2.1.0..v2.1.1` e `v2.1.1..1629696`, além das alterações locais de empacotamento e CI. O changelog histórico não foi alterado; suas afirmações sobre publicação e segurança não devem ser tomadas como confirmação do estado atual.

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
- `1629696`: alteração da sintaxe do `if` referente a `NPM_TOKEN` no workflow de release. Ainda era uma referência direta a `secrets` na condição; os ajustes locais abaixo substituem essa abordagem.
- Nenhum template mudou nesse intervalo. Esses commits posteriores à tag não constituem uma nova versão publicada.

## Ajustes atuais de preparação, ainda sem tag

As alterações locais abaixo são de build, empacotamento e automação; não adicionam funcionalidades aos servidores gerados e não fazem parte do conteúdo histórico da tag `v2.1.1`.

### Build e pacote

- `copy-templates` usa uma chamada inline de Node.js a `fs.cpSync`, com cópia recursiva de `src/templates` para `dist/templates`. Não depende mais de `xcopy` nem de comandos de cópia específicos do shell.
- A allowlist `files` inclui `dist/`, `examples/`, `README.md`, `README.pt-BR.md`, `CHANGELOG.md`, `RELEASE_NOTES.md`, `SECURITY.md`, `SECURITY.pt-BR.md` e `LICENSE`. O npm também inclui seu manifesto automaticamente.
- `prepack` executa `npm run build`, preparando o código compilado e os templates antes do empacotamento.
- `package-lock.json` deixa de ser ignorado e passa a ser versionado com metadados alinhados a `2.1.1`, permitindo o fluxo `npm ci` com dependências fixadas pelo lockfile.
- `npm run release` agora executa somente build e testes, removendo a chamada ao inexistente `scripts/release.js`. Esse comando não aumenta versão nem faz push.
- **Os comandos explícitos `release:patch` e `release:rc` continuam presentes e podem aumentar a versão e fazer push de commits/tags.** `scripts/release.sh` e `scripts/release.bat` também permanecem, com operações de atualização de versão, push e criação de release no GitHub. Não são comandos de verificação local e não foram executados nesta tarefa.

### CI e release

- A nova CI é acionada por pushes em qualquer branch e por pull requests, em `ubuntu-latest` com Node.js 20.
- Executa `npm ci`, `npx tsc --noEmit`, testes, build e `npm pack` real. Instala o tarball em um diretório temporário e verifica `--version` e `validate` usando o exemplo Petstore incluído no pacote.
- O smoke test verifica instalação e execução básica do tarball; não compila nem executa servidores gerados em todas as linguagens. A CI não publica no npm e não testa Windows/macOS.
- O workflow separado de release mantém o mesmo gatilho de tags estáveis (`v[0-9]+.[0-9]+.[0-9]+`). A presença de lógica de RC no arquivo não amplia esse gatilho.
- A variável de ambiente booleana `HAS_NPM_TOKEN` representa apenas a presença do segredo. O passo de publicação usa `if: env.HAS_NPM_TOKEN == 'true'`, em vez de consultar `secrets` diretamente no `if`. Isso não confirma que o pacote já foi publicado.

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

O fluxo acima corresponde ao checkout com os ajustes atuais e seu lockfile, não a um checkout isolado da tag histórica. Enquanto esses ajustes não estiverem no remoto, um novo clone não os receberá. A geração cria arquivos; não instala dependências nem inicia o servidor gerado.

Nos READMEs, `mcp-gen` é uma abreviação de `node dist/cli/index.js` na raiz do repositório. Opcionalmente, `npm link` após o build cria o comando apontando para o checkout local, alterando os links globais do npm sem depender de uma publicação de `mcp-gen` no registry. Não há fluxo de instalação desta CLI via pip confirmado.

## Limitações

- A análise de segurança é estática, baseada em padrões de texto: pode gerar falsos positivos e deixar problemas passar. Um relatório aprovado não garante segurança nem prontidão para produção.
- Encontrar nomes de políticas ou funções no texto não comprova sua execução nem valida autorização, TTL, limites financeiros, revogação ou persistência de auditoria. Esses controles precisam de revisão e integração com um backend confiável.
- Os servidores gerados são scaffolds e exigem testes e revisão antes do deploy; não há garantia de segurança ou de equivalência entre os targets.
- OpenAPI v2 não é suportado. Unions geradas de `oneOf`/`anyOf`/`discriminator` não fornecem validação completa em runtime. Streaming/resources/prompts ainda não estão implementados.
