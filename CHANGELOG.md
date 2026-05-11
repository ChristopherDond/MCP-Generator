# Changelog

Todas as mudanças notáveis do projeto serão documentadas neste arquivo.

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
