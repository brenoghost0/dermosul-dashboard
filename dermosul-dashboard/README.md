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

## VPS / banco de produção

Ambiente principal fica em `root@191.252.110.64` (Ubuntu 20.04, docker-compose em `/root/dermosul`). Alguns comandos úteis:

```bash
# containers
docker ps -a

# banco
docker-compose exec db psql -U postgres -d dermosul -c 'SELECT COUNT(*) FROM "products";'

# restauração rápida (usa dumps em /root/backups ou /root/dermosul/db_backups)
docker-compose exec db psql -U postgres -c "CREATE DATABASE dermosul;"
gunzip -c /root/backups/dermosul-YYYY-MM-DD.sql.gz | docker-compose exec -T db psql -U postgres -d dermosul
```

### Backups e automações

- Dumps diários (`pg_dump`) às 03h em `/root/backups/dermosul-*.sql.gz`.
- Script `scripts/backup-dermosul.sh` gera cópia adicional em `/root/dermosul/db_backups`.
- `scripts/verify-db-health.sh` roda 01h, registra contagem em `db_backups/verify.log` e alerta se não houver dump recente.
- Snapshot físico do volume Postgres pode ser criado em `/root/backups/volume/pgdata-YYYY-MM-DD-HHMM.tgz` com:

  ```bash
  mkdir -p /root/backups/volume
  docker run --rm -v dermosul_pgdata:/data -v /root/backups/volume:/backup alpine \
    tar czf /backup/pgdata-$(date +%F-%H%M).tgz -C /data .
  ```

### Auto-restore periódico

Para evitar ficar com o site vazio quando o volume some, há um script que verifica o banco e restaura automaticamente do dump mais recente:

```
/root/dermosul/scripts/auto-restore-if-missing.sh
```

- Registra as execuções em `db_backups/auto-restore.log`.
- Cron configurado a cada 15 min:

  ```
  */15 * * * * /root/dermosul/scripts/auto-restore-if-missing.sh
  ```

Caso precise refazer:

```bash
cat <<'EOF' > /root/dermosul/scripts/auto-restore-if-missing.sh
#!/bin/bash
set -euo pipefail

APP_DIR=/root/dermosul
COMPOSE="docker-compose -f $APP_DIR/docker-compose.yml"
LOG="$APP_DIR/db_backups/auto-restore.log"
mkdir -p "$APP_DIR/db_backups"

log() { echo "[$(date '+%F %T')] $1" | tee -a "$LOG"; }

if $COMPOSE exec -T db psql -U postgres -d dermosul -c 'SELECT COUNT(*) FROM "products";' >/dev/null 2>&1; then
  log "Banco OK."
  exit 0
fi

log "Banco ausente/falho. Iniciando restauração..."
$COMPOSE exec db psql -U postgres -c "CREATE DATABASE dermosul;" >/dev/null 2>&1 || true
LATEST_DUMP=$(ls -t /root/backups/dermosul-*.sql.gz "$APP_DIR"/db_backups/dermosul-*.sql.gz 2>/dev/null | head -n1)

if [[ -z "$LATEST_DUMP" ]]; then
  log "[ALERTA] Nenhum dump encontrado para restaurar."
  exit 1
fi

log "Restaurando de $LATEST_DUMP..."
if gunzip -c "$LATEST_DUMP" | $COMPOSE exec -T db psql -U postgres -d dermosul >/dev/null; then
  log "Restauração concluída com sucesso."
else
  log "[ERRO] Falha ao restaurar o dump $LATEST_DUMP."
  exit 1
fi
EOF

chmod +x /root/dermosul/scripts/auto-restore-if-missing.sh
( crontab -l; echo '*/15 * * * * /root/dermosul/scripts/auto-restore-if-missing.sh' ) | crontab -
```

> Sempre validar `auto-restore.log`, `verify.log` e os dumps antes de qualquer deploy. Em caso de queda de SSH, abrir chamado com o provedor citando o protocolo e anexando o output de `ssh -vvv`.
