#!/bin/bash

# Parar e remover contêineres, redes e volumes antigos
echo "Parando e removendo contêineres antigos..."
docker-compose down --volumes

# Construir as imagens novamente
echo "Construindo as imagens Docker..."
docker-compose build

# Iniciar os serviços em modo detached
echo "Iniciando os serviços..."
docker-compose up -d

echo "Deploy concluído! A aplicação deve estar acessível em breve."
