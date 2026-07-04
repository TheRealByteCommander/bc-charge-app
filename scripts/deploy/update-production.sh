#!/bin/bash
set -euo pipefail

#===============================================================================
# BC Charge – Komplettes Produktions-Update
#
# Aktualisiert auf dem Server:
#   1. BC Charge App (Frontend dist/ + BFF-API via PM2)
#   2. CitrineOS Core / Hasura (Docker, optional)
#   3. Operator UI Nginx-Proxy (optional, falls installiert)
#
# Ausführung:
#   cd /opt/bc-charge && sudo ./scripts/deploy/update-production.sh
#===============================================================================

APP_DIR="${APP_DIR:-/opt/bc-charge}"
APP_USER="${APP_USER:-bccharge}"
CITRINE_DIR="${CITRINE_DIR:-/opt/citrineos}"
OPERATOR_DIR="${OPERATOR_DIR:-/opt/citrineos-operator-ui}"
GIT_BRANCH="${GIT_BRANCH:-master}"
RUN_OPERATOR_FIX="${RUN_OPERATOR_FIX:-auto}"

GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

log() { echo -e "${GREEN}[Deploy]${NC} $1"; }
warn() { echo -e "${YELLOW}[Hinweis]${NC} $1"; }
err() { echo -e "${RED}[Fehler]${NC} $1"; exit 1; }

if [[ $EUID -ne 0 ]]; then
  err "Bitte als root ausführen: sudo $0"
fi

[[ -d "$APP_DIR" ]] || err "App-Verzeichnis nicht gefunden: $APP_DIR"
id "$APP_USER" &>/dev/null || err "Benutzer $APP_USER fehlt."

fix_app_ownership() {
  chown -R "$APP_USER:$APP_USER" "$APP_DIR"
}

#-------------------------------------------------------------------------------
# 1. BC Charge – Code, Build, API (BFF)
#-------------------------------------------------------------------------------
log "1/4 – BC Charge App wird aktualisiert…"

cd "$APP_DIR"

# Git als root (sudo-Skript); danach Besitz für bccharge wiederherstellen.
# Vermeidet „Permission denied“ wenn zuvor „sudo git pull“ .git auf root gesetzt hat.
if [[ -d .git ]]; then
  git fetch origin "$GIT_BRANCH"
  git pull origin "$GIT_BRANCH"
  fix_app_ownership
else
  err "Kein Git-Repository in $APP_DIR"
fi

log "Abhängigkeiten installieren (inkl. Build-Tools)…"
sudo -u "$APP_USER" npm ci

log "Frontend & TypeScript bauen…"
sudo -u "$APP_USER" npm run build

log "Dev-Abhängigkeiten entfernen (nur Runtime für PM2 behalten)…"
sudo -u "$APP_USER" npm prune --omit=dev
fix_app_ownership

log "BFF-API (PM2) neu starten – legt DB-Tabellen an (z. B. reward_fulfillments)…"
mkdir -p /var/log/bc-charge
chown "$APP_USER:$APP_USER" /var/log/bc-charge 2>/dev/null || true

if sudo -u "$APP_USER" pm2 describe bc-charge-api &>/dev/null; then
  sudo -u "$APP_USER" pm2 restart bc-charge-api --update-env
else
  if [[ -f "$APP_DIR/ecosystem.config.cjs" ]]; then
    warn "PM2 bc-charge-api nicht gefunden – starte neu…"
    sudo -u "$APP_USER" pm2 start "$APP_DIR/ecosystem.config.cjs"
  else
    err "ecosystem.config.cjs fehlt in $APP_DIR – bitte setup-server.sh ausführen oder Datei anlegen."
  fi
fi
sudo -u "$APP_USER" pm2 save

#-------------------------------------------------------------------------------
# 2. CitrineOS (Docker)
#-------------------------------------------------------------------------------
log "2/4 – CitrineOS-Container…"

if [[ -f "$CITRINE_DIR/docker-compose.yml" ]]; then
  if command -v docker &>/dev/null; then
    docker compose -f "$CITRINE_DIR/docker-compose.yml" pull 2>/dev/null || warn "docker compose pull übersprungen."
    docker compose -f "$CITRINE_DIR/docker-compose.yml" up -d
    log "CitrineOS-Container laufen."
  else
    warn "Docker nicht gefunden – CitrineOS-Schritt übersprungen."
  fi
else
  warn "Kein CitrineOS unter $CITRINE_DIR – übersprungen."
fi

#-------------------------------------------------------------------------------
# 3. Operator UI (optional)
#-------------------------------------------------------------------------------
log "3/4 – Operator UI…"

should_fix_operator=false
if [[ "$RUN_OPERATOR_FIX" == "yes" ]]; then
  should_fix_operator=true
elif [[ "$RUN_OPERATOR_FIX" == "auto" && -d "$OPERATOR_DIR" ]]; then
  should_fix_operator=true
fi

if [[ "$should_fix_operator" == true && -x "$APP_DIR/scripts/deploy/fix-operator-ui-connection.sh" ]]; then
  "$APP_DIR/scripts/deploy/fix-operator-ui-connection.sh"
else
  warn "Operator-UI-Fix übersprungen (nicht installiert oder RUN_OPERATOR_FIX=no)."
fi

#-------------------------------------------------------------------------------
# 4. Nginx & Healthchecks
#-------------------------------------------------------------------------------
log "4/4 – Nginx & Verbindungstests…"

if command -v nginx &>/dev/null; then
  nginx -t
  systemctl reload nginx
fi

echo ""
echo "============================================================================"
echo -e "${GREEN}Update abgeschlossen${NC}"
echo "============================================================================"
echo ""

# PM2
echo "── PM2 (BFF-API) ──"
sudo -u "$APP_USER" pm2 status || true
API_PORT="$(grep -E '^BC_SERVER_PORT=' "$APP_DIR/.env" 2>/dev/null | cut -d= -f2 || echo "3000")"
if curl -sf "http://127.0.0.1:${API_PORT}/api/health" >/dev/null 2>&1; then
  echo -e "  API /api/health (:${API_PORT}):  ${GREEN}OK${NC}"
else
  echo -e "  API /api/health (:${API_PORT}):  ${YELLOW}nicht erreichbar – pm2 logs prüfen${NC}"
fi

# Frontend
if [[ -f "$APP_DIR/dist/index.html" ]]; then
  echo -e "  Frontend dist/:                    ${GREEN}OK${NC}"
else
  echo -e "  Frontend dist/:                    ${RED}FEHLER – Build fehlgeschlagen?${NC}"
fi

# CitrineOS
if curl -sf "http://127.0.0.1:8080/healthz" >/dev/null 2>&1; then
  echo -e "  Hasura (:8080):                    ${GREEN}OK${NC}"
elif curl -sf "http://127.0.0.1:8090/healthz" >/dev/null 2>&1; then
  echo -e "  Hasura (:8090):                    ${GREEN}OK${NC}"
fi

if curl -sf "http://127.0.0.1:8081/health" >/dev/null 2>&1; then
  echo -e "  CitrineOS Core (:8081):            ${GREEN}OK${NC}"
fi

# Operator UI
if curl -sf "http://127.0.0.1:3000" >/dev/null 2>&1; then
  echo -e "  Operator UI (:3000):               ${GREEN}OK${NC}"
fi

echo ""
echo "Logs bei Problemen:"
echo "  sudo -u $APP_USER pm2 logs bc-charge-api --lines 50"
echo "  sudo tail -f /var/log/nginx/error.log"
echo "  docker compose -f $CITRINE_DIR/docker-compose.yml logs -f --tail 30"
echo ""
echo "Öffentliche URLs:"
echo "  https://main.bc-charge.com"
echo "  https://operator.main.bc-charge.com  (falls Operator UI installiert)"
echo "============================================================================"
