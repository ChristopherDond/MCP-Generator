# Política de Segurança

## Visão Geral

Este documento descreve as medidas e práticas de segurança implementadas no projeto MCP Generator.

## Recursos de Segurança

### 1. Proteção contra Path Traversal
- Todos os caminhos de arquivo de saída são validados para prevenir ataques de travessia de diretório
- Usa `validateOutputPath()` para garantir que os arquivos sejam gravados apenas no diretório de saída pretendido
- Rejeita caminhos que tentam acessar diretórios pai

### 2. Segurança de Plugins
- Por padrão, o carregamento dinâmico de código de plugin está **desabilitado**
- Os plugins podem fornecer apenas templates, não execução arbitrária de código
- Para ativar o carregamento de código de plugin (não recomendado para fontes não confiáveis):
  ```bash
  MCP_GEN_ALLOW_PLUGINS=true mcp-gen generate --plugin ./meu-plugin ...
  ```
- Módulos de plugin são validados para exportações seguras
- Links simbólicos são rejeitados para prevenir ataques de symlink

### 3. Validação de URL Remota
- Apenas URLs HTTPS são permitidas para buscar specs OpenAPI
- Endereços IP privados e localhost são bloqueados (prevenção de SSRF)
- Validação de Content-Type (apenas JSON/YAML permitidos)
- Validação de Content-Length (máximo 50MB)
- Timeout de 30 segundos em buscas remotas

### 4. Sanitização de Entrada
- Entradas do usuário são sanitizadas para remover bytes nulos e caracteres de controle
- Limites de comprimento aplicados em strings fornecidas pelo usuário

## Correções de Vulnerabilidades

### Problemas Corrigidos
- ✅ Execução Remota de Código via carregamento de plugin - **MITIGADO**: Carregamento dinâmico desabilitado por padrão
- ✅ Path traversal - **CORRIGIDO**: Todos os caminhos de saída validados
- ✅ Ataques SSRF - **CORRIGIDO**: Validação de URL e filtragem de IP
- ✅ Vulnerabilidades de dependência - **CORRIGIDO**: Todos os pacotes auditados e atualizados

### Achado dev-only conhecido (sem impacto em runtime)

- `js-yaml@3.15.1` (GHSA-2883-xcg3-v3hh, high) aparece só na árvore dev, via
  `ts-jest → babel-plugin-istanbul → @istanbuljs/load-nyc-config` (`^3.13.1`).
  O runtime usa `js-yaml@4.3.2` direto e está limpo.
- `brace-expansion@1.1.18` (GHSA-q2hr-2g5m-vwhr, GHSA-qhr7-859c-m2p7, GHSA-6j4f-fj2g-mc7p, high)
  aparece só na árvore dev, via `jest → @jest/core → @jest/reporters → glob@7.2.3 → minimatch@3.1.5`.
  O runtime não tem essa cadeia e está limpo.
- A cópia vulnerável só é carregada quando o `load-nyc-config` lê um arquivo
  `.nycrc.yml`/`.nycrc.yaml`. O projeto não tem esse arquivo e nunca roda Jest com
  `--coverage`, então o caminho é inalcançável na CI e nos artefatos publicados.
- `npm audit --omit=dev` retorna zero vulnerabilidades. Sem pin de `overrides` e sem
  upgrade amplo do Jest na linha 2.3.x por esse achado dev-only; só será revisto se
  coverage for adotado ou o Jest for atualizado por outro motivo.

## Melhores Práticas

### Para Usuários
1. Mantenha o projeto atualizado: `npm audit fix`
2. Não ative `MCP_GEN_ALLOW_PLUGINS` com fontes não confiáveis
3. Valide specs OpenAPI de fontes desconhecidas antes de gerar
4. Use `--force` com cuidado ao sobrescrever projetos existentes

### Para Desenvolvedores
1. Execute `npm audit` antes de fazer commit
2. Adicione testes de segurança para novas funcionalidades
3. Nunca suprima avisos de segurança
4. Revise security.ts para funções de validação antes de adicionar novas operações de arquivo

## Lista de Verificação de Auditoria de Segurança

- [x] Proteção contra path traversal
- [x] Controle de execução de plugins
- [x] Validação de URL remota
- [x] Verificação de vulnerabilidades de dependência
- [x] Sanitização de entrada
- [ ] Assinatura de código (futuro)
- [ ] Headers de segurança (futuro)

## Reportando Problemas de Segurança

Se você descobrir uma vulnerabilidade de segurança, por favor abra um relato confidencial via [GitHub Security Advisories](https://github.com/ChristopherDond/MCP-Generator/security/advisories/new) ou [abra uma issue](https://github.com/ChristopherDond/MCP-Generator/issues) sem detalhes de exploit em vez de comentar em local público.

## Referências

- [OWASP Path Traversal](https://owasp.org/www-community/attacks/Path_Traversal)
- [OWASP SSRF](https://owasp.org/www-community/attacks/Server-Side_Request_Forgery)
- [OWASP Injeção de Código](https://owasp.org/www-community/attacks/Code_Injection)
- [CWE-22: Improper Limitation of a Pathname to a Restricted Directory](https://cwe.mitre.org/data/definitions/22.html)
- [CWE-918: Server-Side Request Forgery (SSRF)](https://cwe.mitre.org/data/definitions/918.html)
