#!/bin/bash
# ============================================================
#  Kvitto – Installations-script til Debian/Ubuntu LXC
#  Til brug bag eksisterende reverse proxy (fx Nginx Proxy Manager)
#  Bruger ekstern MariaDB — installerer IKKE lokal database
#
#  Kør som root: bash install.sh
# ============================================================
set -e

APP_DIR="/opt/kvitto"
LOG_DIR="/var/log/kvitto"
NVM_DIR="/root/.nvm"

echo ""
echo "============================================================"
echo " Kvitto – Konfiguration"
echo "============================================================"
echo ""

read -rp "  Subdomæne (fx kvitto.mitdomaene.dk): " DOMAIN
DOMAIN=${DOMAIN:-localhost}

echo ""
echo "  -- Database (ekstern MariaDB) --"
read -rp "  DB host/IP (fx 192.168.1.50):        " DB_HOST
read -rp "  DB port [3306]:                       " DB_PORT
DB_PORT=${DB_PORT:-3306}
read -rp "  DB navn [kvitto]:                     " DB_NAME
DB_NAME=${DB_NAME:-kvitto}
read -rp "  DB bruger [kvitto]:                   " DB_USER
DB_USER=${DB_USER:-kvitto}
read -rsp "  DB adgangskode:                       " DB_PASS
echo ""

JWT_SECRET=$(openssl rand -base64 32 | tr -dc 'a-zA-Z0-9' | head -c 48)

echo ""
echo "============================================================"
echo " Kvitto – Installation starter"
echo "============================================================"

# ── 1. System ────────────────────────────────────────────────
echo "[1/6] Opdaterer system..."
apt-get update -y -qq
apt-get install -y curl ca-certificates gnupg unzip default-mysql-client -qq

# ── 2. Test database-forbindelse ─────────────────────────────
echo "[2/6] Tester database-forbindelse..."
if ! mysql -h "$DB_HOST" -P "$DB_PORT" -u "$DB_USER" -p"$DB_PASS" "$DB_NAME" -e "SELECT 1;" > /dev/null 2>&1; then
  echo ""
  echo "FEJL: Kan ikke forbinde til MariaDB på ${DB_HOST}:${DB_PORT}"
  echo ""
  echo "  Tjek:"
  echo "  1. At MariaDB kører og lytter på ${DB_HOST}"
  echo "  2. At brugeren '${DB_USER}' har adgang fra denne IP"
  echo "  3. At adgangskoden er korrekt"
  echo "  4. At bind-address i MariaDB ikke er sat til 127.0.0.1"
  exit 1
fi
echo "  Database OK — forbundet til ${DB_HOST}:${DB_PORT}/${DB_NAME}"

# ── 3. Node.js 20 via nvm ────────────────────────────────────
echo "[3/6] Installerer Node.js 20 via nvm..."
curl -fsSL https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.7/install.sh -o /tmp/nvm_install.sh
bash /tmp/nvm_install.sh

export NVM_DIR="$NVM_DIR"
[ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh"

nvm install 20
nvm use 20
nvm alias default 20

NODE_BIN=$(nvm which current)
NODE_DIR=$(dirname "$NODE_BIN")
ln -sf "$NODE_DIR/node" /usr/local/bin/node
ln -sf "$NODE_DIR/npm"  /usr/local/bin/npm
ln -sf "$NODE_DIR/npx"  /usr/local/bin/npx

export PATH="/usr/local/bin:$PATH"
hash -r
echo "  Node $(node -v) / npm $(npm -v)"

if ! grep -q 'NVM_DIR' /root/.bashrc 2>/dev/null; then
  cat >> /root/.bashrc << 'BASHRC'

export NVM_DIR="/root/.nvm"
[ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh"
BASHRC
fi

# ── 4. PM2 ───────────────────────────────────────────────────
echo "[4/6] Installerer PM2..."
npm install -g pm2 --quiet

if systemctl --version &>/dev/null 2>&1; then
  env PATH="/usr/local/bin:$PATH" pm2 startup systemd -u root --hp /root 2>/dev/null \
    | grep -E '^sudo|^env' | bash || true
else
  cat > /etc/rc.local << 'RCLOCAL'
#!/bin/bash
export PATH="/usr/local/bin:/usr/bin:/bin"
/usr/local/bin/pm2 resurrect
exit 0
RCLOCAL
  chmod +x /etc/rc.local
fi

# ── 5. Kopiér og konfigurér app ──────────────────────────────
echo "[5/6] Konfigurerer applikation..."
mkdir -p "$APP_DIR" "$LOG_DIR"

if command -v rsync &>/dev/null; then
  rsync -a --exclude='node_modules' --exclude='dist' --exclude='.git' . "$APP_DIR/"
else
  cp -r . "$APP_DIR/"
fi
mkdir -p "$APP_DIR/backend/uploads"

# Skriv .env
cat > "$APP_DIR/backend/.env" << ENV
DB_HOST=${DB_HOST}
DB_PORT=${DB_PORT}
DB_USER=${DB_USER}
DB_PASSWORD=${DB_PASS}
DB_NAME=${DB_NAME}
JWT_SECRET=${JWT_SECRET}
JWT_EXPIRES_IN=7d
PORT=3001
NODE_ENV=production
UPLOAD_DIR=${APP_DIR}/backend/uploads
MAX_FILE_SIZE_MB=10
FRONTEND_URL=https://${DOMAIN}
ENV

# Importer skema via ekstern DB
echo "  Importerer database-skema..."
mysql -h "$DB_HOST" -P "$DB_PORT" -u "$DB_USER" -p"$DB_PASS" "$DB_NAME" \
  < "$APP_DIR/backend/schema.sql"
echo "  Skema importeret"

# Backend dependencies
echo "  Installerer backend pakker..."
cd "$APP_DIR/backend"
npm install --omit=dev --quiet

# Byg frontend
echo "  Bygger frontend..."
cd "$APP_DIR/frontend"
npm install --quiet
npm run build

# ── 6. Start med PM2 ─────────────────────────────────────────
echo "[6/6] Starter Kvitto API..."
cd "$APP_DIR"
export PATH="/usr/local/bin:$PATH"
pm2 delete kvitto-api 2>/dev/null || true
pm2 start ecosystem.config.js
pm2 save --quiet

IP=$(hostname -I | awk '{print $1}')

echo ""
echo "============================================================"
echo " Kvitto er installeret og koerer!"
echo "============================================================"
echo ""
echo "  LXC IP:      ${IP}"
echo "  API port:    3001"
echo "  Health:      http://${IP}:3001/api/health"
echo "  Database:    ${DB_HOST}:${DB_PORT}/${DB_NAME}"
echo ""
echo "  ── Nginx Proxy Manager ─────────────────────────────────"
echo "  Scheme:      http"
echo "  Forward til: ${IP}:3001"
echo "  Domaene:     ${DOMAIN}"
echo "  SSL:         Let's Encrypt i NPM"
echo ""
echo "  Advanced -> Custom Nginx Config:"
echo "    client_max_body_size 15M;"
echo "    proxy_read_timeout 60s;"
echo ""
echo "  Gemt i: ${APP_DIR}/backend/.env"
echo "  Logs:   pm2 logs kvitto-api"
echo "============================================================"
