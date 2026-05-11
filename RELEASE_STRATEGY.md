# Release Strategy - MCP-Generator v2.0.0

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
npm info mcp-gen versions
npm view mcp-gen@1.0.0-rc.1
```

### 4. Anunciar (Product Hunt, Twitter, etc.)
Veja [PRODUCT_HUNT.md](./PRODUCT_HUNT.md)

## Automated Release Workflow

O GitHub Actions workflow (`release.yml`) automatiza:
- ✅ Build e testes
- ✅ Publicação no npm (com tag `rc`)
- ✅ Criação de release no GitHub
- ✅ Validação de changelog

**Trigger**: Push de tags seguindo padrão `v*.*.*-rc.*`

## CI/CD Pipeline

```
Push tag v1.0.0-rc.1
    ↓
GitHub Actions (release.yml)
    ├→ npm ci
    ├→ npm run build
    ├→ npm test
    ├→ npm publish --tag rc
    └→ Create Release on GitHub
    ↓
Available on npm as @latest and @rc
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
