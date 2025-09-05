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

echo "[deploy] Healthcheck backend:"
curl -sS http://localhost/api/health || true

echo "[deploy] Pronto."
