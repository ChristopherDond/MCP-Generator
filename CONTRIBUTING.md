# Contributing to MCP-Generator

Obrigado por considerar contribuir para `mcp-gen`! Este documento fornece diretrizes para ajudar o projeto a evoluir.

## 🚀 We're in Release Candidate Phase!

Estamos em **v1.0.0-rc.1** e acolhemos feedback entusiasmado durante este período crítico:

- 🐛 **Encontrou um bug?** Abra uma [Issue](https://github.com/ChristopherDond/MCP-Generator/issues)
- 💡 **Tem uma sugestão?** Comece uma [Discussion](https://github.com/ChristopherDond/MCP-Generator/discussions)
- ✨ **Quer contribuir?** Siga os passos abaixo

## Getting Started

### 1. Fork & Clone

```bash
git clone https://github.com/YOUR_USERNAME/MCP-Generator.git
cd MCP-Generator
npm install
```

### 2. Create a Branch

Para RC feedback:
```bash
git checkout -b feedback/your-issue-name
```

Para features:
```bash
git checkout -b feature/your-feature-name
```

Para bugfixes:
```bash
git checkout -b fix/your-fix-name
```

### 3. Make Changes

```bash
# Build
npm run build

# Test locally
npm test

# Run CLI
npm run dev
```

### 4. Test Your Changes

```bash
# Run specific test file
npm test -- generator.test.ts

# Try with examples
node dist/cli/index.js generate -i examples/petstore.json -o /tmp/test-ts --force
node dist/cli/index.js generate -i examples/petstore.yaml -l python -o /tmp/test-py --force
```

### 5. Commit & Push

```bash
git add .
git commit -m "feat: add your feature description"
git push origin your-branch-name
```

### 6. Open a Pull Request

Clique no botão "Compare & Pull Request" no GitHub e descreva:
- O que changed
- Por quê
- Como testar

## Code Style

Seguimos as convenções do projeto:

### TypeScript
- Use `const` por padrão
- Type annotations explícitas para parâmetros/retorno
- Sem `any` — use tipos genéricos quando possível
- Arquivos `.ts` em `src/`

### Commits
Usamos [Conventional Commits](https://www.conventionalcommits.org/):

```
feat: add support for discriminator in oneOf
fix: handle null parameters correctly
docs: clarify CLI examples
test: add integration tests for Stripe API
refactor: simplify parser logic
```

### File Organization

```
src/
├── cli/              # CLI commands
├── core/             # Core generator logic
├── templates/        # Handlebars templates
└── types.ts          # Shared types

tests/                # Jest test files
examples/             # Example specs
.github/workflows/    # GitHub Actions
```

## What We're Looking For

### High Priority (RC Feedback)
- 🐛 **Critical bugs** que quebram geração
- ⚠️ **Generated code issues** (tipos incorretos, syntax errors)
- 🔒 **Security** problemas
- 📖 **Documentation** gaps

### Medium Priority
- 💬 **UX improvements** na CLI
- ✨ **Minor features** bem pensadas
- 🧪 **Test coverage** melhorias
- 🎨 **Code quality** enhancements

### Lower Priority (para v1.0.0+)
- 🌐 Novos languages (Go, Rust)
- 🧩 Plugin system
- 🚀 Performance optimizations
- 🎯 Casos de uso muito específicos

## Testing

### Run All Tests
```bash
npm test
```

### Run Specific Test
```bash
npm test -- generator.test.ts
```

### Coverage
```bash
npm test -- --coverage
```

### Manual Testing Checklist

Antes de submeter PR, teste manualmente:

```bash
# TypeScript generation
node dist/cli/index.js generate \
  -i examples/petstore.json \
  -l typescript \
  -o /tmp/manual-ts \
  --force

# Verificar:
# ✓ server.ts criado
# ✓ models.ts gerado com tipos corretos
# ✓ npm build funciona
# ✓ Tipos estão corretos

# Python generation  
node dist/cli/index.js generate \
  -i examples/petstore.yaml \
  -l python \
  -o /tmp/manual-py \
  --force

# Verificar:
# ✓ server.py criado
# ✓ models.py gerado com Pydantic
# ✓ Python syntax válido

# Incremental update
node dist/cli/index.js generate \
  -i examples/petstore.json \
  -o /tmp/manual-ts \
  --incremental

# Verificar:
# ✓ Código entre @@mcp-gen markers preservado
```

## Documentation

Quando adicionar uma feature, please update:

1. **Code comments** para funções complexas
2. **README.md** se é uma feature visível ao usuário
3. **CHANGELOG.md** para releases
4. **Type definitions** em `src/types.ts`

## Questions?

- 💬 **GitHub Discussions**: Ideias e perguntas gerais
- 🐛 **GitHub Issues**: Bugs específicos
- 📧 **Email**: [Se aplicável]

## Conduct

Mantenha a comunidade respeitosa:
- Feedback construtivo
- Sem spam ou conteúdo ofensivo
- Assuma boa intenção
- Reporte abuso aos maintainers

## RC.1 Special Thanks 🙏

Early testers and contributors durante o RC period ganham:
- 🏆 Credit no CHANGELOG
- ⭐ Featured em Discussions
- 📢 Shout-out em social media

## License

By contributing, você concorda que suas contribuições estão licenciadas sob MIT License (veja [LICENSE](./LICENSE)).

---

## Processo de Code Review

### Antes do Merge

PRs precisam de:
- ✅ CI checks passando (tests, build, lint)
- ✅ Pelo menos 1 review approval
- ✅ Commits squashed se houver múltiplos fixups
- ✅ Commit message seguindo Conventional Commits

### Review Criteria

Reviewers checam:
- 🎯 Code aligns com roadmap
- 🧪 Tests adequados
- 📚 Documentation updated
- 🔒 Sem vulnerabilidades de security
- 🎨 Code style consistente
- ⚡ Performance reasonable

## Releases

RC funding cycle:
- **RC.1**: Agora! Teste e feedback
- **RC.2**: 1-2 semanas, incorporar feedback crítico
- **RC.N**: Conforme necessário
- **v1.0.0**: Quando estiver pronto para produção

---

Obrigado por contribuir! 🎉
