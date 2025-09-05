#!/bin/bash

# Para a execução se qualquer comando falhar
set -e

# Puxa as últimas alterações do repositório
echo "Buscando atualizações do repositório..."
git pull origin main # ou a branch que você usa para produção

# Navega para o diretório do backend e instala dependências
echo "Instalando dependências do backend..."
cd backend
npm install
cd ..

# Instala dependências do frontend/raiz
echo "Instalando dependências do frontend..."
npm install

# Faz o build da aplicação
echo "Construindo a aplicação..."
npm run build

# Reinicia os containers do Docker
echo "Reiniciando os serviços com Docker Compose..."
docker-compose down
docker-compose up -d --build

echo "Deploy concluído com sucesso!"
