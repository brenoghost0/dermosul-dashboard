#!/bin/bash

# Uso:
#   ./deploy/deploy.sh
# Assumindo que o código já está em /var/www/dermosul (ou ajuste APP_DIR).

set -euo pipefail

APP_DIR=${APP_DIR:-/var/www/dermosul}
NODE_ENV=${NODE_ENV:-production}

echo ">>> Entrando em ${APP_DIR}"
cd "${APP_DIR}"

echo ">>> Atualizando repositório"
git pull --ff-only

echo ">>> Instalando dependências"
npm install --production

echo ">>> Rodando migrations (se houver)"
npx prisma migrate deploy

echo ">>> Gerando build"
npm run build

echo ">>> Reiniciando processo PM2"
pm2 restart dermosul || pm2 start dist-server/server.js --name dermosul --cwd "${APP_DIR}" --update-env

echo ">>> Estado do PM2 salvo"
pm2 save

echo ">>> Deploy concluído"
