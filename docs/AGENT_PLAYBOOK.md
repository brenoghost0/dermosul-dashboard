## Playbook de Agentes (Dermosul Dashboard)

Este arquivo resume o estado atual do projeto e os procedimentos críticos na VPS para que qualquer agente consiga continuar o trabalho sem precisar recriar contexto.

### Panorama rápido
- Repo: `/Users/brenoghost/dermosul-dashboard` (local) → `git remote origin https://github.com/brenoghost0/dermosul-dashboard.git`.
- Deploy: VPS `191.252.110.64`, diretório `/root/dermosul`, stack Docker Compose (Postgres + app + pgAdmin).
- `.env` **não** é versionado. Sempre que atualizar localmente, copie manualmente para a VPS via `scp .env root@191.252.110.64:/root/dermosul/.env`.

### Fluxo padrão de entrega
1. `git status -sb` e `npm run build` no Mac.
2. `git add ...`, `git commit -m "..."`, `git push origin main`.
3. VPS: `ssh root@191.252.110.64`.
4. `cd /root/dermosul && git pull`.
5. `docker-compose down` (sem `-v`!), depois `docker-compose up -d --build`.
6. Validar: `docker-compose logs --tail=50 app`.

### Banco de dados
- Container `dermosul_db_1`, volume `dermosul_pgdata`.
- **Nunca usar** `docker-compose down -v`, `docker volume rm dermosul_pgdata` ou `DROP DATABASE`.
- Para verificar contagem de produtos:
  ```bash
  docker-compose exec db psql -U postgres -d dermosul -c 'SELECT COUNT(*) FROM "products";'
  ```

### Backups e monitoração
Cron do root:
| Hora | Comando |
|------|---------|
| 01:00 | `/root/dermosul/scripts/verify-db-health.sh` |
| 02:00 | `/root/dermosul/scripts/backup-dermosul.sh` → dumps em `/root/dermosul/db_backups` |
| 03:00 | `docker-compose exec db pg_dump ...` → dumps em `/root/backups` |
| 04:00 | `find /root/dermosul/db_backups -mtime +7 -delete` |

Scripts principais:
- `/root/dermosul/scripts/backup-dermosul.sh`
- `/root/dermosul/scripts/verify-db-health.sh` (usa `docker-compose exec -T db ...` e escreve em `db_backups/verify.log`)

### Restaurar dados
1. Escolher dump válido (tamanho em MB, não bytes):
   ```bash
   LATEST=$(ls -t /root/backups/dermosul-*.sql.gz | head -n1)
   ```
2. Garantir que o banco existe:
   ```bash
   docker-compose exec db psql -U postgres -c "CREATE DATABASE dermosul;" 2>/dev/null || true
   ```
3. Importar:
   ```bash
   gunzip -c "$LATEST" | docker-compose exec -T db psql -U postgres -d dermosul
   ```
4. Validar: `SELECT COUNT(*) FROM "products";`.

### Logs úteis
- App: `docker-compose logs --tail=100 app`
- Backup verify: `tail -n 50 db_backups/verify.log`
- Cron output: cada job já redireciona para seus próprios logs (`db_backups/cron.log`, `verify.log`).

### Checklist rápido antes de sair
- `npm run build` local sem erros.
- `git status` limpo depois do commit.
- `.env` sincronizado com a VPS (caso tenha mudado).
- Deploy + restore validados (produtos > 500).
- Atualizar `docs/INFRA.md` / este playbook se algo mudar.
