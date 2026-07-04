#!/bin/bash
set -euo pipefail

#===============================================================================
# BC Charge API-Port reparieren (Konflikt mit Operator UI auf :3000)
#
# Operator UI:  127.0.0.1:3000
# BC Charge API: 127.0.0.1:3001 (BC_SERVER_PORT)
#
#   sudo ./scripts/deploy/fix-api-port.sh
#===============================================================================

APP_DIR="${APP_DIR:-/opt/bc-charge}"
APP_USER="${APP_USER:-bccharge}"
API_PORT="${BC_SERVER_PORT:-3001}"
NGINX_SITE="${NGINX_SITE:-/etc/nginx/sites-available/bc-charge}"

GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

log() { echo -e "${GREEN}[API-Port]${NC} $1"; }
warn() { echo -e "${YELLOW}[Hinweis]${NC} $1"; }
err() { echo -e "${RED}[Fehler]${NC} $1"; exit 1; }

[[ $EUID -ne 0 ]] && err "Bitte als root: sudo $0"
[[ -d "$APP_DIR" ]] || err "App nicht gefunden: $APP_DIR"
[[ -f "$APP_DIR/.env" ]] || err ".env fehlt in $APP_DIR"

if ss -tln 2>/dev/null | grep -q ':3000 '; then
  if docker ps --format '{{.Names}}' 2>/dev/null | grep -qx 'citrineos-operator-ui'; then
    warn "Port 3000 wird vom Operator-UI-Container genutzt – API wird auf :${API_PORT} gesetzt."
  fi
fi

log "Setze BC_SERVER_PORT=${API_PORT} in .env…"
if grep -q '^BC_SERVER_PORT=' "$APP_DIR/.env"; then
  sed -i "s/^BC_SERVER_PORT=.*/BC_SERVER_PORT=${API_PORT}/" "$APP_DIR/.env"
elif grep -q '^PORT=' "$APP_DIR/.env"; then
  sed -i "s/^PORT=.*/BC_SERVER_PORT=${API_PORT}/" "$APP_DIR/.env"
else
  echo "BC_SERVER_PORT=${API_PORT}" >> "$APP_DIR/.env"
fi

if [[ -f "$NGINX_SITE" ]]; then
  log "Nginx API-Proxy → 127.0.0.1:${API_PORT}…"
  sed -i "s|proxy_pass http://127.0.0.1:3000|proxy_pass http://127.0.0.1:${API_PORT}|g" "$NGINX_SITE"
  nginx -t
  systemctl reload nginx
else
  warn "Nginx-Site nicht gefunden: $NGINX_SITE – bitte proxy_pass manuell auf :${API_PORT} setzen."
fi

log "PM2 bc-charge-api neu starten…"
mkdir -p /var/log/bc-charge
chown "$APP_USER:$APP_USER" /var/log/bc-charge 2>/dev/null || true

sudo -u "$APP_USER" pm2 delete bc-charge-api 2>/dev/null || true
sudo -u "$APP_USER" pm2 start "$APP_DIR/ecosystem.config.cjs"
sudo -u "$APP_USER" pm2 save

sleep 2
if curl -sf "http://127.0.0.1:${API_PORT}/api/health" | grep -q 'bc-charge-api'; then
  log "API OK: http://127.0.0.1:${API_PORT}/api/health"
else
  warn "Healthcheck fehlgeschlagen – Logs: sudo -u $APP_USER pm2 logs bc-charge-api --lines 40"
fi

echo ""
echo "Ports:"
echo "  Operator UI:     127.0.0.1:3000"
echo "  BC Charge API:   127.0.0.1:${API_PORT}"
echo "  Test: curl -s http://127.0.0.1:${API_PORT}/api/health"
