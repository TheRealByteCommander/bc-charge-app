#!/bin/bash
set -euo pipefail

#===============================================================================
# BC Charge - Server Setup Script
# Für: Ubuntu 24.04/26.04 LTS + Cloudflare
# Domain: main.bc-charge.com
#===============================================================================

DOMAIN="main.bc-charge.com"
APP_USER="bccharge"
APP_DIR="/opt/bc-charge"
NODE_VERSION="20"
PG_VERSION="16"

# Farben für Output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

log() { echo -e "${GREEN}[BC Charge]${NC} $1"; }
warn() { echo -e "${YELLOW}[WARNUNG]${NC} $1"; }
error() { echo -e "${RED}[FEHLER]${NC} $1"; exit 1; }

#-------------------------------------------------------------------------------
# Root-Check
#-------------------------------------------------------------------------------
if [[ $EUID -ne 0 ]]; then
   error "Dieses Skript muss als root ausgeführt werden (sudo)"
fi

log "Starte BC Charge Server-Setup für $DOMAIN"

#-------------------------------------------------------------------------------
# 1. System-Update
#-------------------------------------------------------------------------------
log "1/8 - System wird aktualisiert..."
apt update && apt upgrade -y
apt install -y curl wget git build-essential software-properties-common \
    apt-transport-https ca-certificates gnupg lsb-release unzip

#-------------------------------------------------------------------------------
# 2. Node.js 20 LTS
#-------------------------------------------------------------------------------
log "2/8 - Node.js $NODE_VERSION wird installiert..."
if ! command -v node &> /dev/null; then
    curl -fsSL https://deb.nodesource.com/setup_${NODE_VERSION}.x | bash -
    apt install -y nodejs
fi
node --version
npm --version

#-------------------------------------------------------------------------------
# 3. PostgreSQL
#-------------------------------------------------------------------------------
log "3/8 - PostgreSQL $PG_VERSION wird installiert..."
if ! command -v psql &> /dev/null; then
    sh -c 'echo "deb http://apt.postgresql.org/pub/repos/apt $(lsb_release -cs)-pgdg main" > /etc/apt/sources.list.d/pgdg.list'
    curl -fsSL https://www.postgresql.org/media/keys/ACCC4CF8.asc | gpg --dearmor -o /etc/apt/trusted.gpg.d/postgresql.gpg
    apt update
    apt install -y postgresql-${PG_VERSION} postgresql-contrib-${PG_VERSION}
fi

# Datenbank und User erstellen
DB_PASSWORD=$(openssl rand -base64 32 | tr -dc 'a-zA-Z0-9' | head -c 24)
sudo -u postgres psql -c "CREATE USER bccharge WITH PASSWORD '$DB_PASSWORD';" 2>/dev/null || true
sudo -u postgres psql -c "CREATE DATABASE bccharge OWNER bccharge;" 2>/dev/null || true
sudo -u postgres psql -c "GRANT ALL PRIVILEGES ON DATABASE bccharge TO bccharge;"

log "PostgreSQL Passwort: $DB_PASSWORD (wird in .env gespeichert)"

#-------------------------------------------------------------------------------
# 4. App-User erstellen
#-------------------------------------------------------------------------------
log "4/8 - App-User wird erstellt..."
if ! id "$APP_USER" &>/dev/null; then
    useradd -m -s /bin/bash "$APP_USER"
fi

#-------------------------------------------------------------------------------
# 5. App klonen und installieren
#-------------------------------------------------------------------------------
log "5/8 - BC Charge App wird installiert..."
mkdir -p "$APP_DIR"
chown "$APP_USER:$APP_USER" "$APP_DIR"

if [[ -d "$APP_DIR/.git" ]]; then
    cd "$APP_DIR"
    sudo -u "$APP_USER" git pull origin master
else
    sudo -u "$APP_USER" git clone https://github.com/TheRealByteCommander/bc-charge-app.git "$APP_DIR"
fi

cd "$APP_DIR"
sudo -u "$APP_USER" npm ci
sudo -u "$APP_USER" npm run build
sudo -u "$APP_USER" npm prune --omit=dev

# .env Datei erstellen
cat > "$APP_DIR/.env" << EOF
# BC Charge - Produktions-Konfiguration
NODE_ENV=production
PORT=3000

# Datenbank
DATABASE_URL=postgresql://bccharge:${DB_PASSWORD}@localhost:5432/bccharge

# Domain
DOMAIN=${DOMAIN}
CORS_ORIGINS=https://${DOMAIN}

# Stripe (BITTE AUSFÜLLEN!)
STRIPE_SECRET_KEY=sk_live_XXXX
STRIPE_WEBHOOK_SECRET=whsec_XXXX
BC_STRIPE_API_KEY=$(openssl rand -hex 32)

# CitrineOS (BITTE AUSFÜLLEN!)
VITE_CITRINEOS_API_URL=https://your-citrineos-instance.com
VITE_CITRINEOS_HASURA_URL=https://your-hasura-instance.com/v1/graphql

# Session Secret
SESSION_SECRET=$(openssl rand -hex 32)
EOF

chown "$APP_USER:$APP_USER" "$APP_DIR/.env"
chmod 600 "$APP_DIR/.env"

#-------------------------------------------------------------------------------
# 6. PM2 Setup
#-------------------------------------------------------------------------------
log "6/8 - PM2 wird konfiguriert..."
npm install -g pm2

cat > "$APP_DIR/ecosystem.config.cjs" << 'EOF'
module.exports = {
  apps: [
    {
      name: 'bc-charge-api',
      script: 'server/start.mjs',
      cwd: '/opt/bc-charge',
      env: {
        NODE_ENV: 'production',
        PORT: 3000
      },
      instances: 'max',
      exec_mode: 'cluster',
      max_memory_restart: '500M',
      error_file: '/var/log/bc-charge/error.log',
      out_file: '/var/log/bc-charge/out.log',
      merge_logs: true,
      time: true
    }
  ]
};
EOF

mkdir -p /var/log/bc-charge
chown "$APP_USER:$APP_USER" /var/log/bc-charge

cd "$APP_DIR"
sudo -u "$APP_USER" pm2 start ecosystem.config.cjs
sudo -u "$APP_USER" pm2 save
env PATH=$PATH:/usr/bin pm2 startup systemd -u "$APP_USER" --hp /home/"$APP_USER"

#-------------------------------------------------------------------------------
# 7. Nginx (Cloudflare-ready)
#-------------------------------------------------------------------------------
log "7/8 - Nginx wird konfiguriert..."
apt install -y nginx

# Cloudflare IP-Ranges für Real-IP
cat > /etc/nginx/conf.d/cloudflare.conf << 'EOF'
# Cloudflare IP Ranges - Real IP wiederherstellen
set_real_ip_from 173.245.48.0/20;
set_real_ip_from 103.21.244.0/22;
set_real_ip_from 103.22.200.0/22;
set_real_ip_from 103.31.4.0/22;
set_real_ip_from 141.101.64.0/18;
set_real_ip_from 108.162.192.0/18;
set_real_ip_from 190.93.240.0/20;
set_real_ip_from 188.114.96.0/20;
set_real_ip_from 197.234.240.0/22;
set_real_ip_from 198.41.128.0/17;
set_real_ip_from 162.158.0.0/15;
set_real_ip_from 104.16.0.0/13;
set_real_ip_from 104.24.0.0/14;
set_real_ip_from 172.64.0.0/13;
set_real_ip_from 131.0.72.0/22;
# IPv6
set_real_ip_from 2400:cb00::/32;
set_real_ip_from 2606:4700::/32;
set_real_ip_from 2803:f800::/32;
set_real_ip_from 2405:b500::/32;
set_real_ip_from 2405:8100::/32;
set_real_ip_from 2a06:98c0::/29;
set_real_ip_from 2c0f:f248::/32;
real_ip_header CF-Connecting-IP;
EOF

# Site-Konfiguration
cat > /etc/nginx/sites-available/bc-charge << EOF
server {
    listen 80;
    listen [::]:80;
    server_name ${DOMAIN};

    # Statische Dateien (Frontend)
    root ${APP_DIR}/dist;
    index index.html;

    # Gzip
    gzip on;
    gzip_types text/plain text/css application/json application/javascript text/xml application/xml;
    gzip_min_length 1000;

    # API Proxy
    location /api {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_cache_bypass \$http_upgrade;
        proxy_read_timeout 90s;
    }

    # Stripe Webhooks
    location /api/stripe/webhook {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
    }

    # SPA Fallback
    location / {
        try_files \$uri \$uri/ /index.html;
    }

    # Cache für statische Assets
    location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg|woff|woff2)$ {
        expires 1y;
        add_header Cache-Control "public, immutable";
    }

    # Security Headers
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header Referrer-Policy "strict-origin-when-cross-origin" always;
}
EOF

ln -sf /etc/nginx/sites-available/bc-charge /etc/nginx/sites-enabled/
rm -f /etc/nginx/sites-enabled/default
nginx -t && systemctl reload nginx

#-------------------------------------------------------------------------------
# 8. Firewall (UFW)
#-------------------------------------------------------------------------------
log "8/8 - Firewall wird konfiguriert..."
apt install -y ufw

ufw default deny incoming
ufw default allow outgoing
ufw allow ssh
ufw allow 80/tcp
ufw allow 443/tcp

# Nur Cloudflare IPs erlauben (optional, für extra Sicherheit)
# ufw allow from 173.245.48.0/20 to any port 80,443 proto tcp
# ... weitere Cloudflare IPs

echo "y" | ufw enable

#-------------------------------------------------------------------------------
# Fertig!
#-------------------------------------------------------------------------------
echo ""
echo "==========================================================================="
echo -e "${GREEN}BC Charge Setup abgeschlossen!${NC}"
echo "==========================================================================="
echo ""
echo "Domain:     https://${DOMAIN}"
echo "App-Pfad:   ${APP_DIR}"
echo "Logs:       /var/log/bc-charge/"
echo ""
echo -e "${YELLOW}WICHTIG - Noch zu erledigen:${NC}"
echo ""
echo "1. Cloudflare DNS einrichten:"
echo "   A-Record: ${DOMAIN} → $(curl -s ifconfig.me)"
echo "   SSL-Modus: Full (strict)"
echo ""
echo "2. .env Datei anpassen:"
echo "   nano ${APP_DIR}/.env"
echo "   → STRIPE_SECRET_KEY eintragen"
echo "   → STRIPE_WEBHOOK_SECRET eintragen"
echo "   → CitrineOS URLs eintragen"
echo ""
echo "3. App neu starten nach .env Änderungen:"
echo "   sudo -u ${APP_USER} pm2 restart all"
echo ""
echo "4. Status prüfen:"
echo "   sudo -u ${APP_USER} pm2 status"
echo "   sudo -u ${APP_USER} pm2 logs"
echo ""
echo "==========================================================================="
echo "PostgreSQL Zugangsdaten (in .env gespeichert):"
echo "  User:     bccharge"
echo "  Passwort: ${DB_PASSWORD}"
echo "  Datenbank: bccharge"
echo "==========================================================================="
