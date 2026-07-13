#!/bin/bash
set -euo pipefail

#===============================================================================
# CitrineOS Setup Script
# Installiert CitrineOS + Hasura auf dem BC Charge Server
#===============================================================================

CITRINE_DIR="/opt/citrineos"
DOMAIN="main.bc-charge.com"

GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

log() { echo -e "${GREEN}[CitrineOS]${NC} $1"; }
warn() { echo -e "${YELLOW}[INFO]${NC} $1"; }

if [[ $EUID -ne 0 ]]; then
   echo "Bitte als root ausführen (sudo)" && exit 1
fi

log "Starte CitrineOS Installation..."

#-------------------------------------------------------------------------------
# 1. Docker installieren
#-------------------------------------------------------------------------------
log "1/5 - Docker wird installiert..."
if ! command -v docker &> /dev/null; then
    curl -fsSL https://get.docker.com | bash
    systemctl enable docker
    systemctl start docker
fi
docker --version

if ! command -v docker-compose &> /dev/null && ! docker compose version &> /dev/null; then
    apt install -y docker-compose-plugin
fi

#-------------------------------------------------------------------------------
# 2. Verzeichnis erstellen
#-------------------------------------------------------------------------------
log "2/5 - Verzeichnisse werden erstellt..."
mkdir -p "$CITRINE_DIR"
cd "$CITRINE_DIR"

#-------------------------------------------------------------------------------
# 3. Docker Compose Datei erstellen
#-------------------------------------------------------------------------------
log "3/5 - Docker Compose wird konfiguriert..."

# Passwörter generieren
POSTGRES_PASSWORD=$(openssl rand -base64 24 | tr -dc 'a-zA-Z0-9' | head -c 20)
HASURA_ADMIN_SECRET=$(openssl rand -base64 32 | tr -dc 'a-zA-Z0-9' | head -c 32)
HASURA_JWT_SECRET=$(openssl rand -base64 64 | tr -dc 'a-zA-Z0-9' | head -c 64)

cat > "$CITRINE_DIR/docker-compose.yml" << EOF
version: '3.8'

services:
  citrine-db:
    image: postgres:16-alpine
    container_name: citrineos-db
    restart: unless-stopped
    environment:
      POSTGRES_USER: citrine
      POSTGRES_PASSWORD: ${POSTGRES_PASSWORD}
      POSTGRES_DB: citrineos
    volumes:
      - citrine_pgdata:/var/lib/postgresql/data
    ports:
      - "127.0.0.1:5433:5432"
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U citrine -d citrineos"]
      interval: 10s
      timeout: 5s
      retries: 5

  hasura:
    image: hasura/graphql-engine:v2.36.0
    container_name: citrineos-hasura
    restart: unless-stopped
    ports:
      - "127.0.0.1:8080:8080"
    depends_on:
      citrine-db:
        condition: service_healthy
    environment:
      HASURA_GRAPHQL_DATABASE_URL: postgres://citrine:${POSTGRES_PASSWORD}@citrine-db:5432/citrineos
      HASURA_GRAPHQL_ENABLE_CONSOLE: "true"
      HASURA_GRAPHQL_DEV_MODE: "false"
      HASURA_GRAPHQL_ADMIN_SECRET: ${HASURA_ADMIN_SECRET}
      HASURA_GRAPHQL_JWT_SECRET: '{"type":"HS256","key":"${HASURA_JWT_SECRET}"}'
      HASURA_GRAPHQL_UNAUTHORIZED_ROLE: anonymous
      HASURA_GRAPHQL_CORS_DOMAIN: "https://${DOMAIN},http://localhost:*"

  citrineos:
    image: citrineos/citrineos:latest
    container_name: citrineos-core
    restart: unless-stopped
    ports:
      - "127.0.0.1:8081:8080"
      - "0.0.0.0:9000:9000"
    depends_on:
      - hasura
      - citrine-db
    environment:
      DATABASE_URL: postgres://citrine:${POSTGRES_PASSWORD}@citrine-db:5432/citrineos
      HASURA_URL: http://hasura:8080/v1/graphql
      HASURA_ADMIN_SECRET: ${HASURA_ADMIN_SECRET}
      OCPP_PORT: 9000
      LOG_LEVEL: info

volumes:
  citrine_pgdata:
EOF

#-------------------------------------------------------------------------------
# 4. Secrets speichern
#-------------------------------------------------------------------------------
log "4/5 - Credentials werden gespeichert..."

cat > "$CITRINE_DIR/.env" << EOF
# CitrineOS Credentials - GEHEIM HALTEN!
POSTGRES_PASSWORD=${POSTGRES_PASSWORD}
HASURA_ADMIN_SECRET=${HASURA_ADMIN_SECRET}
HASURA_JWT_SECRET=${HASURA_JWT_SECRET}
EOF
chmod 600 "$CITRINE_DIR/.env"

#-------------------------------------------------------------------------------
# 5. Container starten
#-------------------------------------------------------------------------------
log "5/5 - CitrineOS wird gestartet..."
cd "$CITRINE_DIR"
docker compose up -d

# Warten bis alles läuft
log "Warte auf Container-Start..."
sleep 15

docker compose ps

#-------------------------------------------------------------------------------
# 6. Nginx für CitrineOS APIs erweitern
#-------------------------------------------------------------------------------
log "Nginx wird für CitrineOS erweitert..."

cat > /etc/nginx/sites-available/citrineos << EOF
# CitrineOS Hasura GraphQL
server {
    listen 80;
    server_name hasura.${DOMAIN};

    location / {
        proxy_pass http://127.0.0.1:8080;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
    }
}

# CitrineOS API
server {
    listen 80;
    server_name api.${DOMAIN};

    location / {
        proxy_pass http://127.0.0.1:8081;
        proxy_http_version 1.1;
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
    }
}
EOF

ln -sf /etc/nginx/sites-available/citrineos /etc/nginx/sites-enabled/
nginx -t && systemctl reload nginx

#-------------------------------------------------------------------------------
# 7. BC Charge App mit CitrineOS verbinden
#-------------------------------------------------------------------------------
log "BC Charge App wird mit CitrineOS verbunden..."

# .env der BC Charge App aktualisieren
BC_ENV="/opt/bc-charge/.env"
if [[ -f "$BC_ENV" ]]; then
    # Bestehende CitrineOS-Einträge entfernen
    sed -i '/VITE_CITRINEOS/d' "$BC_ENV"
    sed -i '/CITRINEOS/d' "$BC_ENV"
    
    # Neue Einträge hinzufügen
    cat >> "$BC_ENV" << EOF

# CitrineOS Integration
VITE_CITRINEOS_API_URL=http://127.0.0.1:8081
VITE_CITRINEOS_HASURA_URL=http://127.0.0.1:8080/v1/graphql
VITE_CITRINEOS_HASURA_ADMIN_SECRET=${HASURA_ADMIN_SECRET}
EOF
fi

#-------------------------------------------------------------------------------
# 8. BC Charge App neu bauen
#-------------------------------------------------------------------------------
log "BC Charge App wird neu gebaut..."
cd /opt/bc-charge
npm run build
pm2 restart all

#-------------------------------------------------------------------------------
# Firewall für OCPP WebSocket
#-------------------------------------------------------------------------------
log "Firewall wird für OCPP geöffnet..."
ufw allow 9000/tcp comment 'OCPP WebSocket'

#-------------------------------------------------------------------------------
# Fertig!
#-------------------------------------------------------------------------------
echo ""
echo "==========================================================================="
echo -e "${GREEN}CitrineOS Installation abgeschlossen!${NC}"
echo "==========================================================================="
echo ""
echo "Services:"
echo "  - CitrineOS Core:  http://127.0.0.1:8081"
echo "  - Hasura Console:  http://127.0.0.1:8080"
echo "  - OCPP WebSocket:  ws://<SERVER-IP>:9000"
echo ""
echo "Credentials (gespeichert in $CITRINE_DIR/.env):"
echo "  - Hasura Admin Secret: ${HASURA_ADMIN_SECRET}"
echo ""
echo -e "${YELLOW}WICHTIG - Cloudflare DNS hinzufügen:${NC}"
echo "  A-Record: hasura.${DOMAIN} → $(curl -s ifconfig.me)"
echo "  A-Record: api.${DOMAIN} → $(curl -s ifconfig.me)"
echo ""
echo "Nützliche Befehle:"
echo "  docker compose -f $CITRINE_DIR/docker-compose.yml logs -f"
echo "  docker compose -f $CITRINE_DIR/docker-compose.yml ps"
echo "  docker compose -f $CITRINE_DIR/docker-compose.yml restart"
echo ""
echo "==========================================================================="
