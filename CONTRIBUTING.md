# Contributing to MCP-Generator

> **Also available in:** [Português (Contribuindo)](#contribuindo-para-mcp-generator-português)

Thank you for considering contributing to `mcp-gen`! This document provides guidelines to help the project evolve.

## 🚀 We're Production Ready!

We've just released **v2.0.0** and are actively welcoming community contributions:

- 🐛 **Found a bug?** Open an [Issue](https://github.com/ChristopherDond/MCP-Generator/issues)
- 💡 **Have a suggestion?** Start a [Discussion](https://github.com/ChristopherDond/MCP-Generator/discussions)
- ✨ **Want to contribute?** Follow the steps below

## Getting Started

### 1. Fork & Clone

```bash
git clone https://github.com/YOUR_USERNAME/MCP-Generator.git
cd MCP-Generator
npm install
```

### 2. Create a Branch

For features:
```bash
git checkout -b feature/your-feature-name
```

For bugfixes:
```bash
git checkout -b fix/your-fix-name
```

For documentation:
```bash
git checkout -b docs/your-doc-name
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

Click the "Compare & Pull Request" button on GitHub and describe:
- What changed
- Why
- How to test

## Code Style

We follow project conventions:

### TypeScript
- Use `const` by default
- Explicit type annotations for parameters/returns
- No `any` — use generic types when possible
- Files in `src/` with `.ts` extension

### Commits
We use [Conventional Commits](https://www.conventionalcommits.org/):

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

### High Priority
- 🐛 **Critical bugs** that break generation
- ⚠️ **Generated code issues** (wrong types, syntax errors)
- 🔒 **Security** vulnerabilities
- 📖 **Documentation** gaps

### Medium Priority
- 💬 **UX improvements** in the CLI
- ✨ **Minor features** well-thought-out
- 🧪 **Test coverage** improvements
- 🎨 **Code quality** enhancements

### Lower Priority (for future versions)
- 🌐 New languages (Go, Rust)
- 🧩 Plugin system enhancements
- 🚀 Performance optimizations
- 🎯 Very specific use cases

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

Before submitting PR, test manually:

```bash
# TypeScript generation
node dist/cli/index.js generate \
  -i examples/petstore.json \
  -l typescript \
  -o /tmp/manual-ts \
  --force

# Verify:
# ✓ server.ts created
# ✓ models.ts generated with correct types
# ✓ npm build works
# ✓ Types are correct

# Python generation  
node dist/cli/index.js generate \
  -i examples/petstore.yaml \
  -l python \
  -o /tmp/manual-py \
  --force

# Verify:
# ✓ server.py created
# ✓ models.py generated with Pydantic
# ✓ Python syntax valid

# Incremental update
node dist/cli/index.js generate \
  -i examples/petstore.json \
  -o /tmp/manual-ts \
  --incremental

# Verify:
# ✓ Code between @@mcp-gen markers preserved
```

## Documentation

When adding a feature, please update:

1. **Code comments** for complex functions
2. **README.md** if it's a user-facing feature
3. **CHANGELOG.md** for releases
4. **Type definitions** in `src/types.ts`

## Questions?

- 💬 **GitHub Discussions**: General ideas and questions
- 🐛 **GitHub Issues**: Specific bugs
- 📧 **Email**: Contact maintainers

## Code of Conduct

Keep the community respectful:
- Constructive feedback
- No spam or offensive content
- Assume good intent
- Report abuse to maintainers

## License

By contributing, you agree your contributions are licensed under the MIT License (see [LICENSE](./LICENSE)).

---

## Code Review Process

### Before Merge

PRs need:
- ✅ CI checks passing (tests, build, lint)
- ✅ At least 1 review approval
- ✅ Commits squashed if multiple fixups
- ✅ Commit message follows Conventional Commits

### Review Criteria

Reviewers check:
- 🎯 Code aligns with roadmap
- 🧪 Tests adequate
- 📚 Documentation updated
- 🔒 No security vulnerabilities
- 🎨 Code style consistent
- ⚡ Performance reasonable

## Release Process

We release when features are ready:
- **v2.x.y**: New features and patches
- **v3.0.0**: Breaking changes (future)

Releases are automated via GitHub Actions.

---

Thanks for contributing! 🎉

---

---

# Contribuindo para MCP-Generator (Português)

Obrigado por considerar contribuir para `mcp-gen`! Este documento fornece diretrizes para ajudar o projeto a evoluir.

## 🚀 Produção Pronta!

Lançamos **v2.0.0** e estamos ativamente acolhendo contribuições da comunidade:

- 🐛 **Encontrou um bug?** Abra uma [Issue](https://github.com/ChristopherDond/MCP-Generator/issues)
- 💡 **Tem uma sugestão?** Comece uma [Discussion](https://github.com/ChristopherDond/MCP-Generator/discussions)
- ✨ **Quer contribuir?** Siga os passos abaixo

## Como Começar

### 1. Fork & Clone

```bash
git clone https://github.com/SEU_USUARIO/MCP-Generator.git
cd MCP-Generator
npm install
```

### 2. Crie uma Branch

Para features:
```bash
git checkout -b feature/sua-feature
```

Para correções:
```bash
git checkout -b fix/sua-correcao
```

Para documentação:
```bash
git checkout -b docs/sua-documentacao
```

### 3. Faça as Mudanças

```bash
# Build
npm run build

# Teste localmente
npm test

# Execute CLI
npm run dev
```

### 4. Teste suas Mudanças

```bash
# Execute teste específico
npm test -- generator.test.ts

# Tente com exemplos
node dist/cli/index.js generate -i examples/petstore.json -o /tmp/test-ts --force
node dist/cli/index.js generate -i examples/petstore.yaml -l python -o /tmp/test-py --force
```

### 5. Commit & Push

```bash
git add .
git commit -m "feat: descreva sua feature"
git push origin sua-branch
```

### 6. Abra um Pull Request

Clique no botão "Compare & Pull Request" no GitHub e descreva:
- O que mudou
- Por quê
- Como testar

## Estilo de Código

Seguimos as convenções do projeto:

### TypeScript
- Use `const` por padrão
- Type annotations explícitas para parâmetros/retorno
- Sem `any` — use tipos genéricos quando possível
- Arquivos em `src/` com extensão `.ts`

### Commits
Usamos [Conventional Commits](https://www.conventionalcommits.org/):

```
feat: adicione suporte para discriminator em oneOf
fix: corrija o tratamento de parâmetros nulos
docs: esclareça exemplos da CLI
test: adicione testes de integração para Stripe API
refactor: simplifique lógica do parser
```

### Organização de Arquivos

```
src/
├── cli/              # Comandos CLI
├── core/             # Lógica principal do gerador
├── templates/        # Templates Handlebars
└── types.ts          # Tipos compartilhados

tests/                # Testes Jest
examples/             # Specs de exemplo
.github/workflows/    # GitHub Actions
```

## O Que Procuramos

### Alta Prioridade
- 🐛 **Bugs críticos** que quebram a geração
- ⚠️ **Problemas no código gerado** (tipos incorretos, erros de syntax)
- 🔒 **Vulnerabilidades de segurança**
- 📖 **Gaps na documentação**

### Prioridade Média
- 💬 **Melhorias UX** na CLI
- ✨ **Features menores** bem pensadas
- 🧪 **Melhorias em cobertura** de testes
- 🎨 **Melhorias de qualidade** de código

### Prioridade Menor (para versões futuras)
- 🌐 Novas linguagens (Go, Rust)
- 🧩 Melhorias no sistema de plugins
- 🚀 Otimizações de performance
- 🎯 Casos de uso muito específicos

## Testes

### Executar Todos os Testes
```bash
npm test
```

### Executar Teste Específico
```bash
npm test -- generator.test.ts
```

### Coverage
```bash
npm test -- --coverage
```

### Checklist de Testes Manuais

Antes de submeter PR, teste manualmente:

```bash
# Geração TypeScript
node dist/cli/index.js generate \
  -i examples/petstore.json \
  -l typescript \
  -o /tmp/manual-ts \
  --force

# Verifique:
# ✓ server.ts criado
# ✓ models.ts gerado com tipos corretos
# ✓ npm build funciona
# ✓ Tipos estão corretos

# Geração Python  
node dist/cli/index.js generate \
  -i examples/petstore.yaml \
  -l python \
  -o /tmp/manual-py \
  --force

# Verifique:
# ✓ server.py criado
# ✓ models.py gerado com Pydantic
# ✓ Syntax Python válido

# Atualização incremental
node dist/cli/index.js generate \
  -i examples/petstore.json \
  -o /tmp/manual-ts \
  --incremental

# Verifique:
# ✓ Código entre markers @@mcp-gen preservado
```

## Documentação

Ao adicionar uma feature, por favor atualize:

1. **Comentários de código** para funções complexas
2. **README.md** se for uma feature visível ao usuário
3. **CHANGELOG.md** para releases
4. **Type definitions** em `src/types.ts`

## Dúvidas?

- 💬 **GitHub Discussions**: Ideias e perguntas gerais
- 🐛 **GitHub Issues**: Bugs específicos
- 📧 **Email**: Contate os maintainers

## Código de Conduta

Mantenha a comunidade respeitosa:
- Feedback construtivo
- Sem spam ou conteúdo ofensivo
- Assuma boa intenção
- Reporte abuso aos maintainers

## Licença

Ao contribuir, você concorda que suas contribuições estão licenciadas sob a Licença MIT (veja [LICENSE](./LICENSE)).

---

## Processo de Code Review

### Antes do Merge

PRs precisam de:
- ✅ Checks de CI passando (testes, build, lint)
- ✅ Pelo menos 1 review approval
- ✅ Commits squashed se houver múltiplos fixups
- ✅ Commit message seguindo Conventional Commits

### Critérios de Review

Reviewers verificam:
- 🎯 Código alinhado com roadmap
- 🧪 Testes adequados
- 📚 Documentação atualizada
- 🔒 Sem vulnerabilidades de segurança
- 🎨 Estilo de código consistente
- ⚡ Performance razoável

## Processo de Release

Lançamos quando features estão prontas:
- **v2.x.y**: Novas features e patches
- **v3.0.0**: Breaking changes (futuro)

Releases são automatizadas via GitHub Actions.

---

Obrigado por contribuir! 🎉
