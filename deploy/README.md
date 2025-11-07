# Deploy rápido (PM2 + Nginx)

1. **Preparar VPS**
   ```bash
   sudo apt update && sudo apt install -y git curl nginx
   curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
   sudo apt install -y nodejs build-essential
   sudo npm install -g pm2
   ```
   Configure banco/Redis e copie o `.env`.

2. **Clonar e instalar**
   ```bash
   sudo mkdir -p /var/www/dermosul && sudo chown $USER:$USER /var/www/dermosul
   git clone <seu-repo> /var/www/dermosul
   cd /var/www/dermosul
   npm install
   npx prisma migrate deploy
   npm run build
   ```

3. **PM2**
   ```bash
   pm2 start dist-server/server.js --name dermosul --cwd /var/www/dermosul --env production
   pm2 save
   pm2 startup systemd
   ```

4. **systemd (opcional)**
   Copie `deploy/dermosul.service` para `/etc/systemd/system/dermosul.service`, ajuste `User`, `WorkingDirectory` e `PORT`, então:
   ```bash
   sudo systemctl daemon-reload
   sudo systemctl enable --now dermosul
   ```

5. **Nginx + HTTPS**
   - Copie `deploy/dermosul.nginx.conf` para `/etc/nginx/sites-available/dermosul`.
   - Ajuste `server_name` e `proxy_pass`.
   - Habilite: `sudo ln -s /etc/nginx/sites-available/dermosul /etc/nginx/sites-enabled/`
   - Teste/recarregue: `sudo nginx -t && sudo systemctl reload nginx`.
   - HTTPS: `sudo apt install -y certbot python3-certbot-nginx && sudo certbot --nginx -d dermosul.com.br -d www.dermosul.com.br`.

6. **Deploys futuros**
   ```bash
   chmod +x deploy/deploy.sh
   APP_DIR=/var/www/dermosul ./deploy/deploy.sh
   ```
   O script faz `git pull`, `npm install`, `prisma migrate deploy`, `npm run build` e reinicia o PM2 automaticamente.
