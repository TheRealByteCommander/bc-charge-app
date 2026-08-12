# BC Charge Load-Management Service

Dynamisches Lastmanagement (DLM) für das BC-Charge-CitrineOS-Deployment.

**Pfad im Monorepo:** `services/load-management/`  
**Branch:** `feat/load-management`  
**Repo:** [bc-charge-app](https://github.com/TheRealByteCommander/bc-charge-app)

Der Service überwacht Ladestationen, begrenzt die Site-Last proportional, steuert Remote-Start/Stop über Deep-Links, rechnet Sessions (Tarife + Idle-Fees) und exportiert DATEV-taugliche Billing-CSVs.

## Features

- Echtzeit-Monitoring der Stationsleistung über CitrineOS-WebSocket
- Proportionales Load-Shedding via OCPP `SetChargingProfile` (debounced)
- WebSocket-Reconnect bei Verbindungsabbruch
- PV-Surplus-API → Surplus wird auf aktive Stationen verteilt
- Dynamic Pricing (Zeit-Tarife, Idle-Fees, Energy Pass-Through)
- Deep-Link Tokens (durable JSON-Store, peek/consume/release)
- OCPP-Session-Bridge (`transactionStarted` / `meterEnergy` / `transactionStopped`)
- Health-Endpoints + HealthCheckBot (Timeout, Failure-Threshold, optional Reset)
- DATEV-Billing-Export (Semikolon-CSV, MwSt-Split)

## Architektur

```
CitrineOS (WS) ──► LoadManager ──► SetChargingProfile / RemoteStart / RemoteStop
                      │
                      ├─► PricingService (Sessions, Tarife, Idle)
                      ├─► DeepLinkController + DeepLinkTokenStore
                      ├─► PvSurplusService (Surplus → applySurplusBudget)
                      ├─► HealthCheckBot (GetStatus / TriggerMessage)
                      └─► BillingService (DATEV CSV)

HTTP API (:3003)     Health (:3001)
```

1. MeterValues / TransactionEvents kommen über den CitrineOS-WebSocket.
2. `LoadManager` aggregiert Leistung und drosselt bei Annäherung an `MAX_SITE_POWER`.
3. Pricing-Sessions werden aus OCPP-Events und/oder Deep-Link/API erzeugt.
4. PV-Surplus und manuelle Limits steuern Charging Profiles.
5. Abgeschlossene Sessions sind über Billing-Export abrechenbar.

## Voraussetzungen

- Node.js 18+
- Erreichbarer CitrineOS-WebSocket (Default `ws://localhost:8080`)

## Installation & Start

```bash
cd services/load-management
npm ci
npm run build
npm start
# Dev:
npm run dev
```

## Tests

```bash
npm test
# Typecheck
npx tsc --noEmit
# Billing-Selftest
npx ts-node src/test-billing.ts
```

## Ports

| Port | Zweck | ENV |
|------|--------|-----|
| `3001` | Health (`/health`, `/health/detailed`) | `HEALTH_PORT` |
| `3003` | REST-API (Pricing, Deep-Link, PV, Billing, Stations) | `PRICING_API_PORT` oder `API_PORT` |

> Hinweis: Früher war Port `3002` für PV dokumentiert. PV liegt jetzt auf dem gemeinsamen API-Port (`3003` Default).

## Environment Variables

### Load / CitrineOS

| Variable | Default | Beschreibung |
|----------|---------|--------------|
| `CITRINE_WS_URL` | `ws://localhost:8080` | CitrineOS WebSocket |
| `MAX_SITE_POWER` | `50` | Site-Limit (kW) |
| `ADJUSTMENT_THRESHOLD` | `5` | Trigger-Abstand zum Limit (kW) |
| `ADJUSTMENT_DELAY` | `1000` | Debounce vor Shedding (ms) |
| `MONITORING_INTERVAL` | `5000` | Monitoring-Tick (ms) |
| `DEFAULT_STATION_MAX_POWER_KW` | `22` | Default-Hardware-Ceiling |
| `KNOWN_STATIONS` | _(leer)_ | Kommagetrennte Bootstrap-IDs |

### API / Health

| Variable | Default | Beschreibung |
|----------|---------|--------------|
| `PRICING_API_PORT` / `API_PORT` | `3003` | REST-API-Port |
| `HEALTH_PORT` | `3001` | Health-Port |
| `LM_API_KEY` | _(leer)_ | Admin-API-Key (Bearer / `x-api-key` / `x-lm-api-key`). Alias: `LOAD_MANAGEMENT_API_KEY` |
| `LM_API_AUTH_REQUIRED` | `false` | `1`/`true` erzwingt Auth auch ohne Production; in `NODE_ENV=production` immer required |
| `HEALTH_CHECK_INTERVAL_MS` | `300000` | Bot-Intervall |
| `HEALTH_RESPONSE_TIMEOUT_MS` | `30000` | Antwort-Timeout |
| `HEALTH_FAILURE_THRESHOLD` | `3` | Failures vor Reset-Versuch |
| `HEALTH_RESET_COOLDOWN_MS` | `1800000` | Cooldown zwischen Resets |

### Pricing

| Variable | Default |
|----------|---------|
| `PRICING_DEFAULT_PRICE_PER_KWH` | `0.30` |
| `PRICING_DEFAULT_IDLE_FEE_PER_MIN` | `0.05` |
| `PRICING_CURRENCY` | `EUR` |
| `PRICING_TIMEZONE` | `Europe/Berlin` |

### Deep-Link / Billing / Runtime paths

| Variable | Default | Beschreibung |
|----------|---------|--------------|
| `DEEP_LINK_STORE_PATH` | `./data/deep-link-tokens.json` | Token-Persistenz |
| `BILLING_EXPORT_DIR` | `./exports` | CSV-Ziel |
| `BILLING_REVENUE_ACCOUNT` | `8400` | DATEV Erlöskonto |
| `BILLING_BANK_ACCOUNT` | `1200` | DATEV Gegenkonto |
| `BILLING_VAT_RATE` | `0.19` | MwSt |
| `BILLING_VAT_CODE` | `3` | DATEV BU-Schlüssel |
| `BILLING_CURRENCY` | `EUR` | |

Runtime-Ordner `data/`, `exports/`, `dist/`, `node_modules/` sind gitignored.

## HTTP API

### Auth-Modell

| Bereich | Auth |
|---------|------|
| Health (`:3001`) | öffentlich |
| `GET /api/deep-link/start/:token`, `GET /api/deep-link/stop/:token` | öffentlich — Deep-Link-Token ist das Capability-Secret |
| alle übrigen `/api/*` (Token mint/list/revoke, Pricing, PV, Billing, Stations) | **Admin-API-Key** wenn `LM_API_KEY` gesetzt oder Production/`LM_API_AUTH_REQUIRED` |

Header (eine Variante genügt):

```http
Authorization: Bearer <LM_API_KEY>
x-api-key: <LM_API_KEY>
x-lm-api-key: <LM_API_KEY>
```

Ohne Key in Production → geschützte Routen antworten `503 AUTH_NOT_CONFIGURED`.  
Falscher/fehlender Key → `401 UNAUTHORIZED`.

### Health

- `GET http://localhost:3001/health`
- `GET http://localhost:3001/health/detailed` — inkl. Station-Health + PV-Surplus

`status` ist `degraded` nur wenn Stationen bekannt sind **und** der CitrineOS-WS down ist.

### PV Surplus (admin)

- `POST /api/pv-surplus` — Body: `{ "surplus": 15.5 }` (kW)
- `GET /api/pv-surplus`

Surplus wird über `LoadManager.applySurplusBudget` auf aktive Stationen verteilt.

### Pricing (admin)

- `POST /api/pricing/tariff`
- `GET /api/pricing/tariff`
- `POST /api/pricing/session/start`
- `POST /api/pricing/session/end`
- `POST /api/pricing/session/idle/start`
- `POST /api/pricing/session/idle/end`
- `GET /api/pricing/session/:sessionId`
- `POST /api/pricing/energy-price`
- `GET /api/pricing/config`

Details: [src/services/pricing/README.md](src/services/pricing/README.md)

### Deep-Link

- `POST /api/deep-link/tokens` — Token erzeugen (**admin**)  
  Body u. a.: `stationId`, `connectorId`, optional `purpose` (`start`|`stop`|`both`), `ttlSeconds`, `maxUses`, `customerId`, `idTag`, …
- `GET /api/deep-link/tokens?includeRevoked=false` (**admin**)
- `DELETE /api/deep-link/tokens/:token` (**admin**)
- `GET /api/deep-link/start/:token` — public, optional `?meterValue=`
- `GET /api/deep-link/stop/:token` — public, optional `?meterValue=`

Verhalten (Stand Fix `64a095d`):

- `purpose: both` → default **2 Uses** (Start + Stop)
- Vor dem Consume: Peek + Preflight (aktive Session, WS-Status)
- Schlägt Remote-Befehl fehl → `releaseUse` (Token wird nicht verbrannt)
- Stop beendet die lokale Pricing-Session erst nach erfolgreichem Remote-Stop

### Stations / Station-Health

- `GET /api/stations`
- `GET /api/health/stations`

### Billing

- `POST /api/billing/export`  
  Body optional: `{ "sessionIds": ["…"], "filename": "export.csv", "paymentMethod": "stripe"|"rfid"|"guest"|"deeplink"|"unknown" }`  
  Exportiert completed/idle Sessions (cancelled ausgeschlossen) als DATEV-Semikolon-CSV.

## OCPP / CitrineOS Integration

Der Service verarbeitet u. a.:

| Action | Verhalten |
|--------|-----------|
| `MeterValues` | Leistung (kW) + optional Energy-Register → Pricing-Meter |
| `StartTransaction` / `TransactionEvent` (Started) | Pricing-Session + `transactionId` |
| `StopTransaction` / `TransactionEvent` (Ended) | Idle-Tracking starten |
| `BootNotification` / `StatusNotification` | Station registrieren |
| `SetChargingProfileResponse` | Log/Handling |

Ausgehend: `SetChargingProfile`, `RemoteStartTransaction`, `RemoteStopTransaction`.

## Docker

```bash
cd services/load-management
docker compose up -d --build
```

Siehe `docker-compose.yml` (CitrineOS + Postgres + load-manager + optional Directus).

## Weitere Doku

- [docs/LOAD_MANAGEMENT_DOCS.md](docs/LOAD_MANAGEMENT_DOCS.md) — Architektur & Flows
- [docs/IMPLEMENTATION_SUMMARY.md](docs/IMPLEMENTATION_SUMMARY.md) — Stand / Dateibaum
- [INSTALL.md](INSTALL.md) — kurze Installationsanleitung
- [src/services/pv-surplus/README.md](src/services/pv-surplus/README.md)
- [src/services/pricing/README.md](src/services/pricing/README.md)
