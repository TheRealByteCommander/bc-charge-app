#!/bin/bash
set -euo pipefail

#===============================================================================
# CitrineOS Operator UI – Verbindung reparieren
#
# Behebt typischen Fehler: GraphQL 404 "Route POST:/v1/graphql not found"
# Ursache: Nach certbot fehlen oft die /v1/-Proxy-Regeln im HTTPS-Serverblock,
#          oder GraphQL zeigt fälschlich auf CitrineOS Core (8081) statt Hasura.
#===============================================================================

DOMAIN="${BC_DOMAIN:-main.bc-charge.com}"
OPERATOR_DOMAIN="${OPERATOR_DOMAIN:-operator.${DOMAIN}}"
CITRINE_DIR="${CITRINE_DIR:-/opt/citrineos}"
OPERATOR_DIR="${OPERATOR_DIR:-/opt/citrineos-operator-ui}"
OPERATOR_UI_PORT="${OPERATOR_UI_PORT:-3000}"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

log() { echo -e "${GREEN}[Fix]${NC} $1"; }
warn() { echo -e "${YELLOW}[Hinweis]${NC} $1"; }
err() { echo -e "${RED}[Fehler]${NC} $1"; }

if [[ $EUID -ne 0 ]]; then
  err "Bitte als root ausführen: sudo $0"
  exit 1
fi

detect_hasura_port() {
  local port
  port="$(docker port citrineos-hasura 8080 2>/dev/null | head -1 | awk -F: '{print $NF}')"
  if [[ -n "$port" ]]; then
    echo "$port"
    return
  fi
  for p in 8080 8090; do
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
  for p in 8081 8080; do
    if curl -sf "http://127.0.0.1:${p}/health" >/dev/null 2>&1; then
      echo "$p"
      return
    fi
  done
  echo "8081"
}

HASURA_PORT="$(detect_hasura_port)"
CORE_PORT="$(detect_core_port)"

log "Erkannte Ports: Hasura=${HASURA_PORT}, CitrineOS Core=${CORE_PORT}, Operator UI=${OPERATOR_UI_PORT}"

#-------------------------------------------------------------------------------
# 1. Nginx-Snippets & Site (HTTP + HTTPS mit allen location-Blöcken)
#-------------------------------------------------------------------------------
log "1/4 – Nginx-Konfiguration wird repariert…"

SNIPPET_DST="/etc/nginx/snippets/citrineos-operator-locations.conf"
mkdir -p /etc/nginx/snippets
sed \
  -e "s/__HASURA_PORT__/${HASURA_PORT}/g" \
  -e "s/__CORE_PORT__/${CORE_PORT}/g" \
  -e "s/__OPERATOR_PORT__/${OPERATOR_UI_PORT}/g" \
  "${SCRIPT_DIR}/snippets/citrineos-operator-nginx-locations.conf" > "$SNIPPET_DST"

NGINX_SITE="/etc/nginx/sites-available/citrineos-operator"
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
  log "TLS-Zertifikat gefunden – HTTPS-Serverblock wird mit Proxy-Regeln erstellt."
else
  warn "Kein Let's-Encrypt-Zertifikat für ${OPERATOR_DOMAIN} – nur Port 80."
fi

cat > "$NGINX_SITE" << EOF
# CitrineOS Operator UI – BC Charge (auto-repariert)
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
nginx -t
systemctl reload nginx
log "Nginx neu geladen."

#-------------------------------------------------------------------------------
# 2. .env.local prüfen / korrigieren
#-------------------------------------------------------------------------------
log "2/4 – Operator-UI-Umgebung wird geprüft…"

if [[ ! -d "$OPERATOR_DIR" ]]; then
  err "Operator UI nicht gefunden: $OPERATOR_DIR"
  exit 1
fi

CREDENTIALS_FILE="$OPERATOR_DIR/.bc-credentials.env"
HASURA_SECRET=""
if [[ -f "$CITRINE_DIR/.env" ]]; then
  # shellcheck disable=SC1090
  source "$CITRINE_DIR/.env" 2>/dev/null || true
  HASURA_SECRET="${HASURA_ADMIN_SECRET:-}"
fi

if [[ -f "$CREDENTIALS_FILE" ]]; then
  # shellcheck disable=SC1090
  source "$CREDENTIALS_FILE"
fi

OPERATOR_BASE_URL="https://${OPERATOR_DOMAIN}"
GRAPHQL_URL="${OPERATOR_BASE_URL}/v1/graphql"
CORE_URL="${OPERATOR_BASE_URL}/citrineos-api"

NEEDS_REBUILD=false
if [[ -f "$OPERATOR_DIR/.env.local" ]]; then
  if ! grep -q "NEXT_PUBLIC_API_URL=${GRAPHQL_URL}" "$OPERATOR_DIR/.env.local" 2>/dev/null; then
    warn "NEXT_PUBLIC_API_URL zeigt nicht auf ${GRAPHQL_URL} – wird korrigiert."
    NEEDS_REBUILD=true
  fi
else
  NEEDS_REBUILD=true
fi

if [[ "$NEEDS_REBUILD" == true ]]; then
  cat > "$OPERATOR_DIR/.env.local" << EOF
NEXT_PUBLIC_API_URL=${GRAPHQL_URL}
NEXT_PUBLIC_WS_URL=wss://${OPERATOR_DOMAIN}/v1/graphql
NEXT_PUBLIC_CITRINE_CORE_URL=${CORE_URL}
NEXT_PUBLIC_FILE_SERVER_URL=${CORE_URL}
NEXT_PUBLIC_LOGO_URL=/logo-collapsed.svg
NEXT_PUBLIC_ADMIN_EMAIL=${OPERATOR_ADMIN_EMAIL:-admin@${DOMAIN}}
NEXT_PUBLIC_BANNER_MESSAGE=BC Charge Operator
NEXT_PUBLIC_DEFAULT_MAP_CENTER_LATITUDE=51.3397
NEXT_PUBLIC_DEFAULT_MAP_CENTER_LONGITUDE=12.3731

HASURA_ADMIN_SECRET=${HASURA_SECRET}
ADMIN_PASSWORD=${OPERATOR_ADMIN_PASSWORD:-}

NEXTAUTH_URL=${OPERATOR_BASE_URL}
NEXTAUTH_SECRET=${NEXTAUTH_SECRET:-}

ALLOW_IMAGE_UPLOAD=false
EOF
  chmod 600 "$OPERATOR_DIR/.env.local"
  log ".env.local aktualisiert – Docker-Image wird neu gebaut…"
  cd "$OPERATOR_DIR"
  docker compose -f docker-compose.bc.yml up -d --build
else
  log ".env.local ist korrekt."
  cd "$OPERATOR_DIR"
  docker compose -f docker-compose.bc.yml up -d
fi

#-------------------------------------------------------------------------------
# 3. Verbindungstests
#-------------------------------------------------------------------------------
log "3/4 – Verbindungstests…"

echo ""
HASURA_OK=false
if curl -sf "http://127.0.0.1:${HASURA_PORT}/healthz" >/dev/null; then
  echo -e "  Hasura direkt (:${HASURA_PORT}):     ${GREEN}OK${NC}"
  HASURA_OK=true
else
  echo -e "  Hasura direkt (:${HASURA_PORT}):     ${RED}FEHLER${NC}"
fi

CORE_OK=false
if curl -sf "http://127.0.0.1:${CORE_PORT}/health" >/dev/null; then
  echo -e "  CitrineOS Core (:${CORE_PORT}):      ${GREEN}OK${NC}"
  CORE_OK=true
else
  echo -e "  CitrineOS Core (:${CORE_PORT}):      ${RED}FEHLER${NC}"
fi

UI_OK=false
if curl -sf "http://127.0.0.1:${OPERATOR_UI_PORT}" >/dev/null; then
  echo -e "  Operator UI (:${OPERATOR_UI_PORT}):    ${GREEN}OK${NC}"
  UI_OK=true
else
  echo -e "  Operator UI (:${OPERATOR_UI_PORT}):    ${RED}FEHLER${NC}"
fi

GQL_BODY='{"query":"query { __typename }"}'
GQL_VIA_NGINX=false
GQL_HTTP_CODE="$(curl -s -o /dev/null -w '%{http_code}' -X POST "http://127.0.0.1/v1/graphql" \
  -H "Host: ${OPERATOR_DOMAIN}" \
  -H "Content-Type: application/json" \
  -d "$GQL_BODY" 2>/dev/null || echo "000")"

if [[ "$GQL_HTTP_CODE" == "200" ]]; then
  echo -e "  GraphQL via Nginx (/v1/graphql):  ${GREEN}OK (HTTP 200)${NC}"
  GQL_VIA_NGINX=true
elif [[ "$GQL_HTTP_CODE" == "404" ]]; then
  echo -e "  GraphQL via Nginx (/v1/graphql):  ${RED}FEHLER (HTTP 404 – landet nicht bei Hasura)${NC}"
else
  echo -e "  GraphQL via Nginx (/v1/graphql):  ${YELLOW}HTTP ${GQL_HTTP_CODE}${NC}"
fi

echo ""

#-------------------------------------------------------------------------------
# 4. Ergebnis
#-------------------------------------------------------------------------------
log "4/4 – Zusammenfassung"
echo ""
echo "============================================================================"
if [[ "$GQL_VIA_NGINX" == true ]]; then
  echo -e "${GREEN}GraphQL-Verbindung repariert.${NC} Bitte Browser-Cache leeren und Seite neu laden:"
  echo "  https://${OPERATOR_DOMAIN}/overview"
else
  echo -e "${YELLOW}GraphQL antwortet noch nicht korrekt.${NC}"
  echo ""
  if [[ "$HASURA_OK" != true ]]; then
    echo "  → Hasura starten: docker compose -f ${CITRINE_DIR}/docker-compose.yml up -d hasura"
  fi
  if [[ "$GQL_HTTP_CODE" == "404" ]]; then
    echo "  → Prüfen: curl -v -X POST https://${OPERATOR_DOMAIN}/v1/graphql -H 'Content-Type: application/json' -d '{\"query\":\"{__typename}\"}'"
    echo "  → Darf NICHT api.${DOMAIN} als GraphQL-URL nutzen (das ist CitrineOS Core, nicht Hasura)."
  fi
fi
echo ""
echo -e "${YELLOW}Karten-Fehler (Google Maps):${NC} Optional GOOGLE_MAPS_API_KEY in"
echo "  ${OPERATOR_DIR}/.env.local setzen und neu bauen – Dashboard funktioniert auch ohne Karte."
echo ""
echo "Login:"
echo "  sudo grep -E 'EMAIL|PASSWORD' ${OPERATOR_DIR}/.bc-credentials.env"
echo "============================================================================"
