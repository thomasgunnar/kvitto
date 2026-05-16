#!/bin/bash
# ============================================================
#  Kvitto — Auto-deploy script
#  Kaldes af API'et ved opdatering fra GitHub
#  Kør IKKE manuelt — brug admin-panelet i stedet
# ============================================================
set -e

APP_DIR="/opt/kvitto"
LOG_FILE="/var/log/kvitto/deploy.log"
TIMESTAMP=$(date '+%Y-%m-%d %H:%M:%S')

log() { echo "[$TIMESTAMP] $1" | tee -a "$LOG_FILE"; }

log "=== Deploy startet ==="

# Indlæs nvm
export NVM_DIR="/root/.nvm"
[ -s "$NVM_DIR/nvm.sh" ] && . "$NVM_DIR/nvm.sh"
export PATH="/usr/local/bin:$PATH"

cd "$APP_DIR"

# 1. Gem lokale ændringer (fx .env er i .gitignore, men sikkerhed)
log "Git: henter seneste kode..."
git fetch origin main
git reset --hard origin/main
log "Git: kode opdateret til $(git rev-parse --short HEAD)"

# 2. Kør eventuelle nye migrationer
MIGRATE_DIR="$APP_DIR/backend"
if [ -f "$APP_DIR/.last_migration" ]; then
  LAST=$(cat "$APP_DIR/.last_migration")
else
  LAST=""
fi

for f in $(ls "$MIGRATE_DIR"/migrate*.sql 2>/dev/null | sort); do
  FNAME=$(basename "$f")
  if [[ "$FNAME" > "$LAST" ]] || [ -z "$LAST" ]; then
    # Tjek om filen allerede er kørt
    if grep -q "$FNAME" "$APP_DIR/.ran_migrations" 2>/dev/null; then
      log "Migration allerede kørt: $FNAME"
      continue
    fi
    log "Kører migration: $FNAME"
    source "$APP_DIR/backend/.env"
    mysql -h "$DB_HOST" -P "$DB_PORT" -u "$DB_USER" -p"$DB_PASSWORD" "$DB_NAME" < "$f" 2>&1 | tee -a "$LOG_FILE"
    echo "$FNAME" >> "$APP_DIR/.ran_migrations"
    log "Migration OK: $FNAME"
  fi
done

# 3. Installer backend-pakker
log "NPM: installerer backend pakker..."
cd "$APP_DIR/backend"
npm install --omit=dev --quiet
log "NPM backend: OK"

# 4. Byg frontend
log "Vite: bygger frontend..."
cd "$APP_DIR/frontend"
npm install --quiet
npm run build
log "Frontend: OK"

# 5. Genstart API
log "PM2: genstarter kvitto-api..."
pm2 restart kvitto-api
log "PM2: OK"

log "=== Deploy færdig ==="
echo "SUCCESS"
