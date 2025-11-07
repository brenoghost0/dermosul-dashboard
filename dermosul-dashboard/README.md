# Dermosul Dashboard

Front-end da assistente Dermosul (Vite + React + TypeScript) e middleware Express usado nos ambientes local/staging/prod.

## URL dinâmica do storefront

A assistente precisa gerar links de produto que funcionem em qualquer ambiente — por isso a base (origin) é resolvida dinamicamente, seguindo a ordem:

1. `window.location.origin` quando renderizado no navegador.
2. Variáveis de ambiente (primeira encontrada):
   - `BASE_URL`
   - `STAGING_BASE_URL`
   - `DEV_BASE_URL`
3. Fallback para caminho relativo (o front monta a URL completa).

Configure os envs no `.env` ou na plataforma de deploy:

```bash
# Produção
BASE_URL=https://www.minhaloja.com

# Homologação
STAGING_BASE_URL=https://staging.minhaloja.com

# Desenvolvimento (quando o backend está isolado do frontend)
DEV_BASE_URL=http://127.0.0.1:5174
```

> ⚠️ Se nenhum valor estiver definido em ambiente sem `window`, o assistente mantém o caminho relativo `/p/{slug}` e registra um aviso no log. Configure as variáveis acima para evitar isso em produção.

Todos os links do chat trazem UTMs padrão (`utm_source=chat&utm_medium=assistente&utm_campaign=recomendacao`) e são montados pela função `buildProductUrl`, garantindo URLs limpas e encode seguro.

## Executando localmente

```bash
npm install
npm run dev
# backend em paralelo
npm run dev:server
```

### Testes

```bash
npm test
```
