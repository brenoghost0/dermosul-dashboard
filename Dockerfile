# Usar uma imagem oficial do Node.js como base
FROM node:20-alpine

# Definir o diretório de trabalho no contêiner
WORKDIR /usr/src/app

# Copiar package.json e package-lock.json
COPY package*.json ./

# Instalar as dependências
RUN npm install

# Copiar o resto do código-fonte
COPY . .

# Gerar o cliente Prisma
RUN npx prisma generate

# Construir a aplicação para produção
RUN npm run build

# Expor a porta que a aplicação usa
EXPOSE 3003

# Definir o comando para iniciar a aplicação
CMD ["npm", "start"]
