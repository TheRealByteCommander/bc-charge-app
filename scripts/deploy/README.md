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

## Updates deployen

```bash
cd /opt/bc-charge
sudo -u bccharge git pull origin master
sudo -u bccharge npm ci --omit=dev
sudo -u bccharge npm run build
sudo -u bccharge pm2 restart all
```

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
