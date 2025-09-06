#!/bin/bash
set -euo pipefail

echo "[deploy] Atualizando imagens (pull opcional)..."
docker-compose pull || true

echo "[deploy] Buildando imagem do app..."
docker-compose build app

echo "[deploy] Subindo serviços..."
docker-compose up -d

echo "[deploy] Aplicando schema Prisma (db push)..."
docker-compose exec -T app npx prisma db push

echo "[deploy] Healthcheck (HTTPS via Nginx + Host; fallback :3003):"
if curl -fsSLk -H "Host: dermosul.com.br" https://127.0.0.1/api/health; then
  echo "\n[deploy] OK via Nginx (HTTPS)"
elif curl -fsSL http://127.0.0.1:3003/api/health; then
  echo "\n[deploy] OK direto no app :3003"
else
  echo "\n[deploy] Healthcheck falhou" >&2
  docker-compose ps || true
fi

echo "[deploy] Pronto."
