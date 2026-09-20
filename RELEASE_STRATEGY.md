# Release Strategy - MCP-Generator

A versão `@christopher_dondici/mcp-gen@2.1.5` reúne a Fase 0 (PR #4) sobre a 2.1.4 já publicada. O binário continua `mcp-gen`. Os exemplos de RC abaixo são históricos e não devem ser executados para preparar a 2.1.5; publicar, aumentar versão e enviar commits/tags exigem autorização separada.

## Versioning

Usamos [Semantic Versioning](https://semver.org/):
- **v0.x.y**: Versões de desenvolvimento
- **v1.0.0-rc.1 → rc.N**: Release candidates
- **v1.0.0**: Release stable

## Release Checklist

### 1. Preparação Local
```bash
# Sincronizar com main
git checkout main
git pull origin main

# Atualizar versão no package.json (manualmente ou via script)
npm version prerelease --preid=rc

# Build e testes
npm run build
npm run test
```

### 2. Criar Release no GitHub
```bash
git push origin main --tags
```

Ou manualmente via GitHub CLI:
```bash
gh release create v1.0.0-rc.1 \
  --title "MCP-Generator v1.0.0-rc.1" \
  --notes "First release candidate"
```

### 3. Publicar no npm
```bash
npm publish --tag rc
```

Verificar:
```bash
npm info @christopher_dondici/mcp-gen versions
npm view @christopher_dondici/mcp-gen@2.1.5
```

### 4. Anunciar (Product Hunt, Twitter, etc.)
Veja [PRODUCT_HUNT.md](./PRODUCT_HUNT.md)

## Automated Release Workflow

O GitHub Actions workflow (`release.yml`) automatiza:
- Verificação do nome scoped, acesso público e versão correspondente à tag
- Typecheck, testes e build em checkout limpo
- Pack e instalação isolada do tarball, com `--version` e validação Petstore
- Publicação pública do tarball validado somente quando `NPM_TOKEN` está disponível
- Criação de release no GitHub com o tarball anexado

**Trigger**: Push de tags estáveis seguindo o padrão `v[0-9]+.[0-9]+.[0-9]+`. Não publica RC nem valida changelog. A criação de release GitHub não comprova publicação npm.

## CI/CD Pipeline

```
Push tag estável (somente com autorização)
    ↓
GitHub Actions (release.yml)
    ├→ npm ci e verificação dos metadados
    ├→ npx tsc --noEmit
    ├→ npm test
    ├→ npm run build
    ├→ npm pack e smoke test isolado
    ├→ npm publish <tarball> --access public (se houver NPM_TOKEN)
    └→ Create Release on GitHub com tarball
    ↓
Verificar disponibilidade de @christopher_dondici/mcp-gen no npm
```

## Comunicação

- **npm**: Publicado com tag `rc`
- **GitHub**: Release com notas
- **Social**: Twitter, Dev.to, Product Hunt, Hacker News
- **Docs**: Atualizar README com status RC

## Timeline de Lançamento

### Pre-Launch (T-3 a T-1)
```
T-3 days: Preparar screenshots, vídeo de demo, blog post
T-2 days: Review documentação, testar builds
T-1 days: Agendar social media, preparar submissão PH
```

### Release Day (T-0)
```
T-0 00:00 GMT: npm version prerelease --preid=rc
T-0 00:01 GMT: git push origin main --tags
T-0 00:02 GMT: Monitorar GitHub Actions
T-0 00:10 GMT: Verificar publicação npm
T-0 12:01 AM PT: LAUNCH on Product Hunt 🚀
```

### Launch Day (T+0 a T+24h)
```
T+0 (12:01 AM PT):  Submeter no Product Hunt
T+1h:               Compartilhar no Twitter
T+2h:               Responder primeiros comentários
T+6h:               Verificar métricas (objetivo: top 5)
T+12h:              Continuar monitorando
T+24h:              Dia 1 wrap-up, preparar Dia 2
```

### Week 1 (T+1 a T+7)
```
T+1:  Incorporar feedback, começar trabalho em rc.2
T+7:  Análise completa, preparar próxima iteração
```

## Próximas fases

- **rc.2, rc.3**: Incorporar feedback, correções críticas
- **v1.0.0 (final)**: Quando pronto para produção

---

**Nota**: Para detalhes específicos de publicação no Product Hunt, veja [PRODUCT_HUNT_GUIDE.md](./PRODUCT_HUNT_GUIDE.md)
