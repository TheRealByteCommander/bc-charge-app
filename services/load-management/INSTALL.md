# Installation — Load-Management Service

Service-Pfad im Monorepo: `services/load-management/`  
Canonical Repo: https://github.com/TheRealByteCommander/bc-charge-app

## Voraussetzungen

- Node.js **18+**
- npm
- Optional: Docker + Docker Compose
- Erreichbarer CitrineOS-WebSocket (OCPP), z. B. `ws://localhost:8080`

## Lokal (Entwicklung)

```bash
cd services/load-management
npm ci
npm run dev
```

Build + Production-Start:

```bash
npm run build
npm start
```

Tests:

```bash
npm test
npx tsc --noEmit
```

## Ports (Default)

| Service | URL |
|---------|-----|
| Health | http://localhost:3001/health |
| Health detailed | http://localhost:3001/health/detailed |
| REST API | http://localhost:3003 |

## Minimale Umgebung

```bash
export CITRINE_WS_URL=ws://localhost:8080
export MAX_SITE_POWER=50
export ADJUSTMENT_THRESHOLD=5
export PRICING_API_PORT=3003
export HEALTH_PORT=3001
# optional Bootstrap-Stationen:
# export KNOWN_STATIONS=CS001,CS002
```

Vollständige ENV-Liste: siehe [README.md](README.md).

## Docker Compose

```bash
cd services/load-management
docker compose up -d --build
```

Enthalten u. a.:

- Postgres
- CitrineOS (`3000` HTTP, `8080` OCPP/WS)
- load-manager (`3001` Health, `3003` API)
- Directus (`8055`) — optional Admin-UI

Health prüfen:

```bash
curl -s http://localhost:3001/health | jq .
curl -s http://localhost:3003/api/stations | jq .
```

## OCPP-Stationen

Ladestationen am CitrineOS-WebSocket (Port **8080**) anbinden.  
Der Load-Manager registriert Stationen über Boot/Status/MeterValues oder über `KNOWN_STATIONS`.

## Runtime-Daten

| Pfad | Inhalt |
|------|--------|
| `data/deep-link-tokens.json` | Deep-Link Token-Store (überschreibbar via `DEEP_LINK_STORE_PATH`) |
| `exports/` | DATEV-Billing-CSVs (`BILLING_EXPORT_DIR`) |

Beide Verzeichnisse sind gitignored.
