# Estratégia de release — MCP-Generator

> **Estado em 25/09/2026:** `2.3.2` é a release publicada (npm `latest` + GitHub Release `v2.3.2`, via OIDC).

## Versionamento

Seguimos [Semantic Versioning](https://semver.org/):

- **Patch (`2.3.x`)**: correções, testes, documentação, DX e automação sem mudança incompatível.
- **Minor (`2.x.0`)**: recursos compatíveis dentro da API existente.
- **Major (`3.0.0`)**: somente para uma mudança real e deliberada, nunca por marketing.

Operações que publicam ou alteram estado remoto — `git push`, `npm publish`, criação/publicação de GitHub Release e merge de PR — exigem confirmação do maintainer.

## Gate local obrigatório

Executar a partir da branch candidata limpa:

```bash
npm ci
npm run lint
npx tsc --noEmit
npm test -- --runInBand
npm run build
npm run test:cli
npm run test:generated
npm run test:generated:py
npm run test:generated:go
npm pack --dry-run --json
```

Critérios de aceite:

- suíte Jest e smokes verdes;
- `package.json` e `package-lock.json` na mesma versão;
- `npm pack --dry-run` contendo `dist/`, templates, exemplos e documentação necessários;
- changelog e notas coerentes com o estado real;
- nenhuma alteração 3.0 incluída.

## Fluxo oficial de publicação

O projeto usa um único caminho: tag estável → GitHub Actions → npm OIDC → GitHub Release.

1. Revisar todos os commits e o diff completo.
2. Atualizar versão, changelog, READMEs e notas se ainda necessário.
3. Após autorização, enviar a branch e a tag correspondente.
4. O workflow valida metadados, lint, typecheck, testes, build, pack e smoke do tarball.
5. O mesmo tarball é publicado no npm com Trusted Publisher OIDC e anexado à GitHub Release.

```bash
npm view @christopher_dondici/mcp-gen version
gh release view v<versão>
gh run list --workflow release.yml --limit 5
```

Não executar `npm publish` manual em paralelo e não reintroduzir `NPM_TOKEN` no caminho oficial.

## Workflow OIDC

`.github/workflows/release.yml`:

- dispara em tags estáveis `v[0-9]+.[0-9]+.[0-9]+`;
- exige `contents: write`, `packages: write` e `id-token: write`;
- confere nome do pacote, acesso público e igualdade entre tag e `package.json`;
- executa lint, typecheck, testes, build, pack e smoke do tarball;
- publica com `npm publish --access public --provenance` via Trusted Publisher;
- cria a GitHub Release com o tarball validado.

A criação de tag é o gatilho. Uma tag local, um commit local ou um plano de release não provam publicação no npm.

## Recuperação

- Se o npm publicar e a criação da GitHub Release falhar, não rode o workflow novamente. Confirme a versão no registry, reconstrua o tarball do mesmo commit e crie somente a GitHub Release com autorização explícita.
- Se o workflow falhar por causa transitória antes de publicar, use `gh run rerun` para repetir o mesmo commit e tag.
- Se for necessária uma correção de código ou configuração depois da tag, prepare um novo patch, por exemplo `2.3.3`; não mova uma tag já enviada.
- Versões npm são imutáveis. Se a versão já existir no registry, não force nem incremente silenciosamente; pare e confirme a intenção.

## Backlog técnico pós-2.3.2

- Regenerar `src/templates/typescript/package-lock.json.hbs` via npm sempre que os ranges de dependência do scaffold TypeScript mudarem; o lock é um snapshot fixado, não um arquivo gerado em runtime.
- Resolver a auditoria dev-only de `js-yaml` sem upgrade amplo do Jest.
- Revisar placeholders e documentação de scaffolds gerados.
- Manter feedback do Codex for OSS em patches pequenos e verificáveis.

## Regra para 3.0

Não iniciar 3.0 sem confirmação explícita. Gatilhos legítimos possíveis:

- usar `operationId` como naming default;
- mover autenticação exclusivamente para middleware;
- exigir Node 22+ ou migrar para ESM;
- remover flags ou APIs depreciadas.

Sem um desses gatilhos, continuar em patches 2.3.x.
