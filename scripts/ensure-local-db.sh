#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
HOST_ALIAS="127.0.0.1 db"

log() {
  echo "[ensure-local-db] $*"
}

require_command() {
  if ! command -v "$1" >/dev/null 2>&1; then
    log "O comando '$1' não foi encontrado. Instale-o e tente novamente."
    exit 1
  fi
}

ensure_host_alias() {
  if grep -Eq '^[[:space:]]*127\.0\.0\.1[[:space:]]+db(\s|$)' /etc/hosts; then
    return
  fi

  log "Registrando alias 'db' para 127.0.0.1 em /etc/hosts (será solicitada senha sudo)."
  if [ "$EUID" -ne 0 ]; then
    sudo sh -c "echo '$HOST_ALIAS' >> /etc/hosts"
  else
    echo "$HOST_ALIAS" >> /etc/hosts
  fi
}

ensure_docker_up() {
  if ! docker info >/dev/null 2>&1; then
    log "Docker Desktop não está em execução. Abra o Docker e espere ficar 'Running'."
    exit 1
  fi
}

ensure_db_container() {
  cd "$ROOT_DIR"

  local container_id
  container_id="$(docker compose ps -q db 2>/dev/null || true)"

  if [ -z "$container_id" ]; then
    log "Container 'db' não encontrado. Subindo com 'docker compose up -d db'..."
    docker compose up -d db
    container_id="$(docker compose ps -q db)"
  fi

  local status
  status="$(docker inspect -f '{{.State.Status}}' "$container_id")"
  if [ "$status" != "running" ]; then
    log "Container 'db' está em estado '$status'. Iniciando..."
    docker start "$container_id" >/dev/null
  fi
}

wait_for_postgres() {
  log "Aguardando o PostgreSQL responder..."
  local attempt=0
  until docker compose exec -T db pg_isready -U postgres -d dermosul >/dev/null 2>&1; do
    attempt=$((attempt + 1))
    if [ "$attempt" -ge 10 ]; then
      log "Não foi possível confirmar o PostgreSQL após várias tentativas."
      exit 1
    fi
    sleep 1
  done
  log "PostgreSQL pronto em 127.0.0.1:5432 (alias 'db')."
}

main() {
  require_command docker
  require_command awk
  if ! docker compose version >/dev/null 2>&1; then
    log "Sua instalação do Docker não suporta 'docker compose'. Atualize o Docker Desktop."
    exit 1
  fi

  ensure_host_alias
  ensure_docker_up
  ensure_db_container
  wait_for_postgres
}

main "$@"
