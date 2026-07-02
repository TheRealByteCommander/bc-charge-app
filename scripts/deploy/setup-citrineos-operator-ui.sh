#!/bin/bash
set -euo pipefail

#===============================================================================
# CitrineOS Operator UI – Installation (add-on)
#
# Installiert das offizielle Operator UI auf dem gleichen Server wie CitrineOS
# und BC Charge, ohne bestehende Dienste zu verändern:
#   - /opt/citrineos          (Core, Hasura, DB) bleibt unberührt
#   - /opt/bc-charge          (App, PM2) bleibt unberührt
#   - eigener Ordner:         /opt/citrineos-operator-ui
#   - eigener Container:      citrineos-operator-ui
#   - eigene Nginx-Site:      operator.main.bc-charge.com
#
# Voraussetzung: setup-citrineos.sh wurde bereits ausgeführt.
#===============================================================================

DOMAIN="${BC_DOMAIN:-main.bc-charge.com}"
OPERATOR_DOMAIN="${OPERATOR_DOMAIN:-operator.${DOMAIN}}"
CITRINE_DIR="${CITRINE_DIR:-/opt/citrineos}"
OPERATOR_DIR="${OPERATOR_DIR:-/opt/citrineos-operator-ui}"
OPERATOR_UI_PORT="${OPERATOR_UI_PORT:-3000}"
OPERATOR_REPO="${OPERATOR_REPO:-https://github.com/citrineos/citrineos-operator-ui.git}"
OPERATOR_REF="${OPERATOR_REF:-main}"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

HASURA_HOST_PORT="${HASURA_HOST_PORT:-8080}"
CORE_HOST_PORT="${CORE_HOST_PORT:-8081}"

detect_hasura_port() {
  local port
  port="$(docker port citrineos-hasura 8080 2>/dev/null | head -1 | awk -F: '{print $NF}')"
  if [[ -n "$port" ]]; then
    echo "$port"
    return
  fi
  for p in "${HASURA_HOST_PORT}" 8080 8090; do
    if curl -sf "http://127.0.0.1:${p}/healthz" >/dev/null 2>&1; then
      echo "$p"
      return
    fi
  done
  echo "8080"
}

detect_core_port() {
  local port
  port="$(docker port citrineos-core 8080 2>/dev/null | head -1 | awk -F: '{print $NF}')"
  if [[ -n "$port" ]]; then
    echo "$port"
    return
  fi
  for p in "${CORE_HOST_PORT}" 8081 8080; do
    if curl -sf "http://127.0.0.1:${p}/health" >/dev/null 2>&1; then
      echo "$p"
      return
    fi
  done
  echo "8081"
}

GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

log() { echo -e "${GREEN}[Operator UI]${NC} $1"; }
warn() { echo -e "${YELLOW}[Hinweis]${NC} $1"; }
error() { echo -e "${RED}[Fehler]${NC} $1"; exit 1; }

if [[ $EUID -ne 0 ]]; then
  error "Bitte als root ausführen: sudo $0"
fi

#-------------------------------------------------------------------------------
# Voraussetzungen prüfen (nur lesend)
#-------------------------------------------------------------------------------
log "Prüfe bestehende CitrineOS-Installation…"

command -v docker >/dev/null 2>&1 || error "Docker fehlt. Bitte zuerst setup-citrineos.sh ausführen."
docker compose version >/dev/null 2>&1 || error "Docker Compose fehlt."

[[ -d "$CITRINE_DIR" ]] || error "CitrineOS-Verzeichnis nicht gefunden: $CITRINE_DIR"
[[ -f "$CITRINE_DIR/docker-compose.yml" ]] || error "CitrineOS docker-compose.yml fehlt in $CITRINE_DIR"

if ! docker compose -f "$CITRINE_DIR/docker-compose.yml" ps --status running 2>/dev/null | grep -qE 'hasura|citrineos'; then
  warn "CitrineOS-Container scheinen nicht zu laufen. Start mit:"
  warn "  docker compose -f $CITRINE_DIR/docker-compose.yml up -d"
fi

HASURA_HOST_PORT="$(detect_hasura_port)"
CORE_HOST_PORT="$(detect_core_port)"
log "Erkannte Ports: Hasura=${HASURA_HOST_PORT}, CitrineOS Core=${CORE_HOST_PORT}"

# Hasura erreichbar?
if ! curl -sf "http://127.0.0.1:${HASURA_HOST_PORT}/healthz" >/dev/null 2>&1; then
  warn "Hasura antwortet nicht auf 127.0.0.1:${HASURA_HOST_PORT} – Installation wird fortgesetzt."
fi

# Port-Konflikt vermeiden (nur localhost)
if ss -tln 2>/dev/null | grep -q ":${OPERATOR_UI_PORT} " ; then
  if ! docker ps --format '{{.Names}}' 2>/dev/null | grep -qx 'citrineos-operator-ui'; then
    error "Port ${OPERATOR_UI_PORT} ist bereits belegt. Setzen Sie OPERATOR_UI_PORT=3001 $0"
  fi
  warn "Port ${OPERATOR_UI_PORT} wird bereits vom Operator-UI-Container genutzt – Update-Modus."
fi

# Hasura-Admin-Secret aus bestehender Installation lesen (optional)
HASURA_ADMIN_SECRET=""
if [[ -f "$CITRINE_DIR/.env" ]]; then
  # shellcheck disable=SC1090
  set +u
  source "$CITRINE_DIR/.env" 2>/dev/null || true
  set -u
  HASURA_ADMIN_SECRET="${HASURA_ADMIN_SECRET:-}"
fi

#-------------------------------------------------------------------------------
# 1. Verzeichnis & Quellcode
#-------------------------------------------------------------------------------
log "1/5 – Operator UI Repository…"
mkdir -p "$OPERATOR_DIR"

if [[ -d "$OPERATOR_DIR/.git" ]]; then
  log "Bestehendes Repo wird aktualisiert (kein Reset auf Remote-Compose)…"
  git -C "$OPERATOR_DIR" fetch origin "$OPERATOR_REF"
  git -C "$OPERATOR_DIR" checkout "$OPERATOR_REF"
  git -C "$OPERATOR_DIR" pull --ff-only origin "$OPERATOR_REF" || warn "git pull fehlgeschlagen – nutze lokalen Stand."
else
  git clone --depth 1 --branch "$OPERATOR_REF" "$OPERATOR_REPO" "$OPERATOR_DIR"
fi

#-------------------------------------------------------------------------------
# 2. Zugangsdaten & Umgebung
#-------------------------------------------------------------------------------
log "2/5 – Konfiguration wird erstellt…"

CREDENTIALS_FILE="$OPERATOR_DIR/.bc-credentials.env"
if [[ -f "$CREDENTIALS_FILE" ]]; then
  # shellcheck disable=SC1090
  source "$CREDENTIALS_FILE"
  log "Bestehende Zugangsdaten aus $CREDENTIALS_FILE werden wiederverwendet."
else
  NEXTAUTH_SECRET=$(openssl rand -base64 48 | tr -dc 'a-zA-Z0-9' | head -c 48)
  OPERATOR_ADMIN_EMAIL="${OPERATOR_ADMIN_EMAIL:-admin@${DOMAIN}}"
  OPERATOR_ADMIN_PASSWORD=$(openssl rand -base64 24 | tr -dc 'a-zA-Z0-9' | head -c 20)

  cat > "$CREDENTIALS_FILE" << EOF
# BC Charge – Operator UI Zugangsdaten (GEHEIM)
OPERATOR_ADMIN_EMAIL=${OPERATOR_ADMIN_EMAIL}
OPERATOR_ADMIN_PASSWORD=${OPERATOR_ADMIN_PASSWORD}
NEXTAUTH_SECRET=${NEXTAUTH_SECRET}
EOF
  chmod 600 "$CREDENTIALS_FILE"
fi

# shellcheck disable=SC1090
source "$CREDENTIALS_FILE"

OPERATOR_BASE_URL="https://${OPERATOR_DOMAIN}"
# GraphQL & Core API über dieselbe Subdomain (Nginx-Proxy) → kein Hasura-CORS-Eingriff nötig
GRAPHQL_PUBLIC_URL="${OPERATOR_BASE_URL}/v1/graphql"
CORE_PUBLIC_URL="${OPERATOR_BASE_URL}/citrineos-api"

cat > "$OPERATOR_DIR/.env.local" << EOF
# Generiert von setup-citrineos-operator-ui.sh – nicht manuell in Git committen
NEXT_PUBLIC_API_URL=${GRAPHQL_PUBLIC_URL}
NEXT_PUBLIC_WS_URL=wss://${OPERATOR_DOMAIN}/v1/graphql
NEXT_PUBLIC_CITRINE_CORE_URL=${CORE_PUBLIC_URL}
NEXT_PUBLIC_FILE_SERVER_URL=${CORE_PUBLIC_URL}
NEXT_PUBLIC_LOGO_URL=/logo-collapsed.svg
NEXT_PUBLIC_ADMIN_EMAIL=${OPERATOR_ADMIN_EMAIL}
NEXT_PUBLIC_BANNER_MESSAGE=BC Charge Operator
NEXT_PUBLIC_DEFAULT_MAP_CENTER_LATITUDE=51.3397
NEXT_PUBLIC_DEFAULT_MAP_CENTER_LONGITUDE=12.3731

HASURA_ADMIN_SECRET=${HASURA_ADMIN_SECRET}
ADMIN_PASSWORD=${OPERATOR_ADMIN_PASSWORD}

NEXTAUTH_URL=${OPERATOR_BASE_URL}
NEXTAUTH_SECRET=${NEXTAUTH_SECRET}

ALLOW_IMAGE_UPLOAD=false
EOF
chmod 600 "$OPERATOR_DIR/.env.local"

# Eigene Compose-Datei (wird bei git pull nicht überschrieben)
cat > "$OPERATOR_DIR/docker-compose.bc.yml" << EOF
# BC Charge – Operator UI (add-on, unabhängig von citrineos-core)
services:
  citrine-ui:
    container_name: citrineos-operator-ui
    restart: unless-stopped
    build:
      context: .
      dockerfile: ./Dockerfile
    ports:
      - "127.0.0.1:${OPERATOR_UI_PORT}:3000"
    env_file:
      - .env.local
    healthcheck:
      test: ["CMD", "wget", "-qO-", "http://127.0.0.1:3000"]
      interval: 30s
      timeout: 10s
      retries: 3
      start_period: 60s
EOF

#-------------------------------------------------------------------------------
# 3. Container bauen & starten
#-------------------------------------------------------------------------------
log "3/5 – Docker-Image wird gebaut (dauert beim ersten Mal einige Minuten)…"
cd "$OPERATOR_DIR"
docker compose -f docker-compose.bc.yml build

log "4/5 – Container wird gestartet…"
docker compose -f docker-compose.bc.yml up -d

log "Warte auf Operator UI…"
for i in $(seq 1 30); do
  if curl -sf "http://127.0.0.1:${OPERATOR_UI_PORT}" >/dev/null 2>&1; then
    break
  fi
  sleep 2
done

docker compose -f docker-compose.bc.yml ps

#-------------------------------------------------------------------------------
# 4. Nginx (eigene Site, bestehende Sites unverändert)
#-------------------------------------------------------------------------------
log "5/5 – Nginx Reverse Proxy (nur neue Site)…"

if command -v nginx >/dev/null 2>&1; then
  NGINX_SITE="/etc/nginx/sites-available/citrineos-operator"
  SNIPPET_DST="/etc/nginx/snippets/citrineos-operator-locations.conf"
  mkdir -p /etc/nginx/snippets
  sed \
    -e "s/__HASURA_PORT__/${HASURA_HOST_PORT}/g" \
    -e "s/__CORE_PORT__/${CORE_HOST_PORT}/g" \
    -e "s/__OPERATOR_PORT__/${OPERATOR_UI_PORT}/g" \
    "${SCRIPT_DIR}/snippets/citrineos-operator-nginx-locations.conf" > "$SNIPPET_DST"

  SSL_CERT="/etc/letsencrypt/live/${OPERATOR_DOMAIN}/fullchain.pem"
  SSL_KEY="/etc/letsencrypt/live/${OPERATOR_DOMAIN}/privkey.pem"
  SSL_BLOCK=""
  if [[ -f "$SSL_CERT" && -f "$SSL_KEY" ]]; then
    SSL_BLOCK="
    listen 443 ssl http2;
    ssl_certificate ${SSL_CERT};
    ssl_certificate_key ${SSL_KEY};
    include /etc/letsencrypt/options-ssl-nginx.conf;
    ssl_dhparam /etc/letsencrypt/ssl-dhparams.pem;"
    log "TLS-Zertifikat gefunden – HTTPS-Serverblock mit Proxy-Regeln wird erstellt."
  fi

  cat > "$NGINX_SITE" << EOF
# CitrineOS Operator UI – BC Charge add-on
# GraphQL/Core werden unter derselben Domain proxied (kein CORS-Update an Hasura nötig)
# WICHTIG: /v1/ und /citrineos-api/ MÜSSEN vor location / stehen (via Snippet)

server {
    listen 80;
    server_name ${OPERATOR_DOMAIN};
${SSL_BLOCK}

    client_max_body_size 20m;

    include ${SNIPPET_DST};
}
EOF

  ln -sf "$NGINX_SITE" /etc/nginx/sites-enabled/citrineos-operator
  if nginx -t 2>/dev/null; then
    systemctl reload nginx
    log "Nginx-Site aktiviert: ${OPERATOR_DOMAIN}"
  else
    warn "Nginx-Konfiguration fehlerhaft – bitte manuell prüfen: nginx -t"
  fi
else
  warn "Nginx nicht installiert – UI nur lokal: http://127.0.0.1:${OPERATOR_UI_PORT}"
fi

#-------------------------------------------------------------------------------
# Fertig
#-------------------------------------------------------------------------------
SERVER_IP="$(curl -sf --max-time 3 ifconfig.me 2>/dev/null || hostname -I 2>/dev/null | awk '{print $1}' || echo '<SERVER-IP>')"

echo ""
echo "============================================================================"
echo -e "${GREEN}CitrineOS Operator UI Installation abgeschlossen${NC}"
echo "============================================================================"
echo ""
echo "Unverändert gelassen:"
echo "  - $CITRINE_DIR          (CitrineOS Core / Hasura / DB)"
echo "  - /opt/bc-charge        (BC Charge App / PM2)"
echo ""
echo "Neu installiert:"
echo "  - Verzeichnis:    $OPERATOR_DIR"
echo "  - Container:      citrineos-operator-ui"
echo "  - Lokal:          http://127.0.0.1:${OPERATOR_UI_PORT}"
echo "  - Öffentlich:     http://${OPERATOR_DOMAIN}  (nach DNS + TLS)"
echo ""
echo "Zugangsdaten (gespeichert in $CREDENTIALS_FILE):"
echo "  - E-Mail:   ${OPERATOR_ADMIN_EMAIL}"
echo "  - Passwort: ${OPERATOR_ADMIN_PASSWORD}"
if [[ -n "$HASURA_ADMIN_SECRET" ]]; then
  echo "  - Hasura Admin Secret: aus $CITRINE_DIR/.env übernommen"
else
  echo "  - Hasura Admin Secret: nicht gefunden – ggf. in .env.local nachtragen"
fi
echo ""
echo -e "${YELLOW}DNS (Cloudflare):${NC}"
echo "  A-Record: ${OPERATOR_DOMAIN} → ${SERVER_IP}"
echo ""
echo -e "${YELLOW}TLS (optional):${NC}"
echo "  certbot --nginx -d ${OPERATOR_DOMAIN}"
echo "  # Nach certbot ggf. Proxy-Regeln reparieren:"
echo "  sudo ${SCRIPT_DIR}/fix-operator-ui-connection.sh"
echo ""
echo "Nützliche Befehle:"
echo "  cd $OPERATOR_DIR"
echo "  docker compose -f docker-compose.bc.yml logs -f"
echo "  docker compose -f docker-compose.bc.yml ps"
echo "  docker compose -f docker-compose.bc.yml up -d --build   # nach .env.local-Änderung"
echo ""
echo "Update (nur Operator UI, ohne CitrineOS anzufassen):"
echo "  sudo OPERATOR_REF=main $0"
echo ""
echo "============================================================================"
