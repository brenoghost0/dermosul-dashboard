## Infra (VPS) Cheatsheet

Anotações para operar a VPS `191.252.110.64` sem risco de apagar o banco.

### Deploy seguro
- Acesse: `ssh root@191.252.110.64` e `cd /root/dermosul`.
- Para atualizar código/imagens:  
  `git pull && docker-compose up -d --build && docker-compose logs --tail=50 app`
- **Nunca** use `docker-compose down -v` em produção (apaga o volume `dermosul_pgdata`).
- Se precisar parar serviços temporariamente, use `docker-compose stop` ou `docker-compose down` (sem `-v`).

### Banco de dados / backups
- Banco: Postgres em container `dermosul_db_1` com volume `dermosul_pgdata`.
- Backups manuais: `/root/dermosul/scripts/backup-dermosul.sh`
  ```bash
  /root/dermosul/scripts/backup-dermosul.sh
  ls -lh /root/dermosul/db_backups   # dumps gerados (.sql.gz)
  ```
- Cron jobs configurados (veja `crontab -l`):
  | Horário | Ação |
  |---------|------|
  | 02:00   | Executa `backup-dermosul.sh` e registra log em `db_backups/cron.log`. |
  | 03:00   | `docker-compose exec db pg_dump ...` gera um dump adicional em `/root/backups`. |
  | 04:00   | `find /root/dermosul/db_backups -mtime +7 -delete` remove dumps com +7 dias. |

### Restaurar dados sem destruir a base
1. Escolha o arquivo `.sql.gz` em `/root/dermosul/db_backups` ou `/root/backups`.
2. Copie/descompacte (se necessário): `gzip -d backup.sql.gz` (mantém uma cópia do `.gz`).
3. Importe direto no banco existente **sem** `DROP DATABASE`:
   ```bash
   docker-compose exec -T db psql -U postgres -d dermosul < backup.sql
   ```
   - Para testar antes, crie um banco provisório:  
     `docker-compose exec db psql -U postgres -c "CREATE DATABASE dermosul_restore;"`  
     `docker-compose exec -T db psql -U postgres -d dermosul_restore < backup.sql`
4. Após validar, opcionalmente renomeie bancos ou rode apenas os `INSERT/UPDATE` necessários.

### Diagnóstico rápido
- Verificar estado dos containers: `docker ps -a`.
- Verificar volume do Postgres: `docker volume ls | grep dermosul_pgdata`.
- Logs do app: `docker-compose logs --tail=100 app`.
- Histórico recente: `history | tail -n 100` (evite rodar comandos destrutivos listados aqui).

> Boas práticas: mantenha backups recentes, evite `DROP DATABASE`, documente qualquer intervenção na VPS e atualize este arquivo quando o processo mudar.
