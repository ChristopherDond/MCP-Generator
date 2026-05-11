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

## Próximas fases

- **rc.2, rc.3**: Incorporar feedback, correções críticas
- **v1.0.0 (final)**: Quando pronto para produção
