# BC Charge - Server Deployment

## Voraussetzungen

- Hetzner Cloud Server (CX43 oder ähnlich)
- Ubuntu 24.04 / 26.04 LTS
- Domain bei Cloudflare: `main.bc-charge.com`
- SSH-Zugang zum Server

## Schnell-Installation

```bash
# Als root auf dem Server:
curl -fsSL https://raw.githubusercontent.com/TheRealByteCommander/bc-charge-app/master/scripts/deploy/setup-server.sh | bash
```

Oder manuell:

```bash
wget https://raw.githubusercontent.com/TheRealByteCommander/bc-charge-app/master/scripts/deploy/setup-server.sh
chmod +x setup-server.sh
sudo ./setup-server.sh
```

## Was das Skript installiert

| Komponente | Version | Beschreibung |
|------------|---------|--------------|
| Node.js | 20 LTS | JavaScript Runtime |
| PostgreSQL | 16 | Datenbank |
| Nginx | Latest | Reverse Proxy |
| PM2 | Latest | Process Manager |
| UFW | Latest | Firewall |

## Nach der Installation

### 1. Cloudflare DNS einrichten

```
Typ   Name   Inhalt           Proxy
A     main   <SERVER-IP>      ☁️ Proxied
```

SSL/TLS-Modus: **Full (strict)**

### 2. Environment-Variablen konfigurieren

```bash
sudo nano /opt/bc-charge/.env
```

Ausfüllen:
- `STRIPE_SECRET_KEY` - Stripe Live/Test Key
- `STRIPE_WEBHOOK_SECRET` - Stripe Webhook Secret
- `VITE_CITRINEOS_API_URL` - CitrineOS API URL
- `VITE_CITRINEOS_HASURA_URL` - Hasura GraphQL URL

### 3. App neu starten

```bash
sudo -u bccharge pm2 restart all
```

## Nützliche Befehle

```bash
# Status prüfen
sudo -u bccharge pm2 status

# Logs anzeigen
sudo -u bccharge pm2 logs

# App neu starten
sudo -u bccharge pm2 restart all

# Nginx Status
sudo systemctl status nginx

# PostgreSQL Status
sudo systemctl status postgresql
```

## Verzeichnisstruktur

```
/opt/bc-charge/
├── dist/              # Frontend Build
├── server/            # Backend
├── .env               # Konfiguration (GEHEIM!)
├── ecosystem.config.cjs  # PM2 Konfiguration
└── ...

/var/log/bc-charge/
├── out.log            # Stdout
└── error.log          # Stderr
```

## CitrineOS Operator UI (optional, Add-on)

Das offizielle Betreiber-UI von CitrineOS lässt sich **separat** installieren, ohne die
bestehende CitrineOS- oder BC-Charge-Installation zu verändern:

```bash
# Voraussetzung: setup-citrineos.sh wurde bereits ausgeführt
sudo ./scripts/deploy/setup-citrineos-operator-ui.sh
```

Oder per curl:

```bash
curl -fsSL https://raw.githubusercontent.com/TheRealByteCommander/bc-charge-app/master/scripts/deploy/setup-citrineos-operator-ui.sh | sudo bash
```

| Was | Pfad / Name |
|-----|-------------|
| Operator UI | `/opt/citrineos-operator-ui` |
| Container | `citrineos-operator-ui` (Port `127.0.0.1:3000`) |
| Nginx-Site | `operator.main.bc-charge.com` |
| Zugangsdaten | `/opt/citrineos-operator-ui/.bc-credentials.env` |

**Unberührt bleiben:** `/opt/citrineos`, `/opt/bc-charge`, PM2, bestehende Nginx-Sites.

GraphQL und Core-API werden über die Operator-Domain proxied (`/v1/graphql`, `/citrineos-api/`) –
dadurch ist **kein Eingriff in die Hasura-CORS-Konfiguration** nötig.

### Update nur Operator UI

```bash
sudo OPERATOR_REF=main /opt/bc-charge/scripts/deploy/setup-citrineos-operator-ui.sh
```

### Umgebungsvariablen (optional)

| Variable | Standard | Beschreibung |
|----------|----------|--------------|
| `OPERATOR_DOMAIN` | `operator.main.bc-charge.com` | Öffentliche Domain |
| `OPERATOR_UI_PORT` | `3000` | Lokaler Port (nur 127.0.0.1) |
| `CITRINE_DIR` | `/opt/citrineos` | Bestehende CitrineOS-Installation |
| `OPERATOR_REF` | `main` | Git-Branch des Operator-UI-Repos |

### Verbindung reparieren (GraphQL 404)

Wenn das Dashboard **„Error loading data“** oder **„Route POST:/v1/graphql not found“** zeigt,
landen GraphQL-Anfragen nicht bei Hasura (häufig nach `certbot`, weil HTTPS-Proxy-Regeln fehlen):

```bash
cd /opt/bc-charge
sudo git pull origin master
sudo ./scripts/deploy/fix-operator-ui-connection.sh
```

Das Skript:
- setzt Nginx-Proxy für `/v1/` (Hasura) und `/citrineos-api/` (CitrineOS Core) in HTTP **und** HTTPS
- prüft/korrigiert `NEXT_PUBLIC_API_URL` in `/opt/citrineos-operator-ui/.env.local`
- baut den Operator-UI-Container bei Bedarf neu

**Karten-Fehler (Google Maps):** Optional `GOOGLE_MAPS_API_KEY` in `.env.local` setzen und neu bauen –
das Dashboard funktioniert auch ohne Karte.

## Updates deployen

### Komplettes Server-Update (empfohlen)

Ein Skript für alles: BC Charge (Frontend + BFF-API), CitrineOS-Docker, Operator-UI-Proxy:

```bash
cd /opt/bc-charge
sudo chmod +x scripts/deploy/update-production.sh
sudo ./scripts/deploy/update-production.sh
```

**Nicht** vorher separat `sudo git pull` ausführen – das Skript übernimmt `git pull` und setzt die Dateirechte für `bccharge` danach zurück.

Falls `.git` bereits root gehört (Permission denied):

```bash
sudo chown -R bccharge:bccharge /opt/bc-charge
sudo ./scripts/deploy/update-production.sh
```

Das Skript führt aus:

| Schritt | Was passiert |
|---------|----------------|
| 1 | `git pull`, `npm ci`, `npm run build` |
| 2 | **PM2 `bc-charge-api` neu starten** (BFF – legt DB-Tabellen an, z. B. `reward_fulfillments`) |
| 3 | CitrineOS Docker-Container (`docker compose up -d`) |
| 4 | Operator-UI Nginx-Fix (falls `/opt/citrineos-operator-ui` existiert) |
| 5 | `nginx -t && reload` + Healthchecks |

Ohne Operator-UI-Fix:

```bash
sudo RUN_OPERATOR_FIX=no ./scripts/deploy/update-production.sh
```

### Manuell (Schritt für Schritt)

```bash
# ── 1. BC Charge App + BFF-API ──────────────────────────────────────
cd /opt/bc-charge
sudo -u bccharge git pull origin master
sudo -u bccharge npm ci --omit=dev
sudo -u bccharge npm run build

# BFF neu starten (wichtig: DB-Migrationen, Fulfillment-API, Stripe-Routen)
sudo -u bccharge pm2 restart bc-charge-api
sudo -u bccharge pm2 save

# Status & API-Health
sudo -u bccharge pm2 status
curl -s http://127.0.0.1:3000/api/health   # Port ggf. aus .env: BC_SERVER_PORT

# ── 2. CitrineOS (Core, Hasura, DB) ─────────────────────────────────
docker compose -f /opt/citrineos/docker-compose.yml pull
docker compose -f /opt/citrineos/docker-compose.yml up -d
docker compose -f /opt/citrineos/docker-compose.yml ps

# ── 3. Operator UI (falls installiert) ──────────────────────────────
cd /opt/bc-charge
sudo ./scripts/deploy/fix-operator-ui-connection.sh

# ── 4. Nginx ────────────────────────────────────────────────────────
sudo nginx -t && sudo systemctl reload nginx
```

### Nur BC Charge (schnell)

```bash
cd /opt/bc-charge
sudo -u bccharge git pull origin master
sudo -u bccharge npm ci --omit=dev
sudo -u bccharge npm run build
sudo -u bccharge pm2 restart bc-charge-api
```

### Wichtige Ports (Standard-Setup)

| Dienst | Port | Erreichbarkeit |
|--------|------|----------------|
| BC Charge BFF-API | `3000` (`.env`: `BC_SERVER_PORT`) | Nginx `/api` → `127.0.0.1:3000` |
| Hasura | `8080` | nur localhost |
| CitrineOS Core | `8081` | nur localhost |
| Operator UI | `3000` | Nginx `operator.main.bc-charge.com` |
| OCPP | `9000` | öffentlich (Ladesäulen) |

**Hinweis:** `pm2 restart all` startet nur die BC-Charge-API neu. CitrineOS und Operator UI laufen in **Docker** bzw. eigenem Container – dafür die Schritte 2 und 3 oben.

## Troubleshooting

### App startet nicht
```bash
sudo -u bccharge pm2 logs --lines 50
```

### Nginx Fehler
```bash
sudo nginx -t
sudo tail -f /var/log/nginx/error.log
```

### Datenbank-Verbindung
```bash
sudo -u postgres psql -c "\l"
sudo -u postgres psql bccharge -c "\dt"
```
