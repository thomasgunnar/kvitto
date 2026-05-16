#!/bin/bash
set -e

APP_DIR="/opt/kvitto"
LOG_FILE="/var/log/kvitto/deploy.log"
TIMESTAMP=$(date '+%Y-%m-%d %H:%M:%S')
log() { echo "[$TIMESTAMP] $1" | tee -a "$LOG_FILE"; }

log "=== Deploy startet ==="

# Absolut sti til node/npm — nvm virker ikke i non-interactive shell
NODE_PATH=$(find /root/.nvm/versions/node -name "node" -type f 2>/dev/null | sort -V | tail -1)
NODE_DIR=$(dirname "$NODE_PATH")
export PATH="$NODE_DIR:$PATH"
hash -r
log "Node: $(node -v), npm: $(npm -v)"

cd "$APP_DIR"

# 1. Git pull
log "Git: henter seneste kode..."
git fetch origin main
git reset --hard origin/main
log "Git: opdateret til $(git rev-parse --short HEAD)"

# 2. Migrationer
for f in $(ls "$APP_DIR/backend"/migrate*.sql 2>/dev/null | sort); do
  FNAME=$(basename "$f")
  if grep -q "$FNAME" "$APP_DIR/.ran_migrations" 2>/dev/null; then
    log "Migration allerede kørt: $FNAME"
    continue
  fi
  log "Kører migration: $FNAME"
  source "$APP_DIR/backend/.env"
  mysql -h "$DB_HOST" -P "$DB_PORT" -u "$DB_USER" -p"$DB_PASSWORD" "$DB_NAME" < "$f" 2>&1 | tee -a "$LOG_FILE"
  echo "$FNAME" >> "$APP_DIR/.ran_migrations"
  log "Migration OK: $FNAME"
done

# 3. Backend pakker
log "NPM: backend..."
cd "$APP_DIR/backend"
npm install --omit=dev --quiet
log "Backend OK"

# 4. Frontend — brug absolut sti til npx
log "Vite: bygger frontend..."
cd "$APP_DIR/frontend"
npm install --quiet
/root/.nvm/versions/node/v20.20.2/bin/npx vite build

# 5. Genstart
log "PM2: genstarter..."
pm2 restart kvitto-api
log "PM2 OK"

log "=== Deploy færdig ==="
echo "SUCCESS"
