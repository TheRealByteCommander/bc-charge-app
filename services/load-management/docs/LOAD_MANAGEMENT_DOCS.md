# Dynamic Load Management — Architektur & Betrieb

Stand: Branch `feat/load-management` im Repo **bc-charge-app**  
Service-Root: `services/load-management/`

## Überblick

Der Load-Management-Service ist ein eigenständiger Node.js/TypeScript-Dienst. Er:

1. verbindet sich per WebSocket mit CitrineOS,
2. aggregiert die Wirkleistung aktiver Stationen,
3. drosselt proportional über OCPP `SetChargingProfile`, wenn das Site-Limit erreicht wird,
4. koppelt OCPP-Transaktionen an Pricing-Sessions,
5. stellt Deep-Link-Remote-Start/Stop, PV-Surplus, Health und DATEV-Billing bereit.

## Komponenten

| Modul | Datei | Rolle |
|-------|-------|--------|
| Entry | `src/index.ts` | Wiring, HTTP-Server, OCPP-Event-Bridge, Shutdown |
| LoadManager | `src/services/LoadManager.ts` | WS, Last, Profiles, Remote Start/Stop, Reconnect |
| PricingService | `src/services/pricing/pricingService.ts` | Tarife, Sessions, Idle-Fees |
| PricingController | `src/services/pricing/pricingController.ts` | Pricing-HTTP |
| PvSurplusService | `src/services/pv-surplus/pvSurplusService.ts` | Surplus speichern + auf Stationen anwenden |
| DeepLinkTokenStore | `src/services/DeepLinkTokenStore.ts` | Durable Token (JSON, atomar) |
| DeepLinkController | `src/services/DeepLinkController.ts` | Token-API + Start/Stop-Flow |
| HealthCheckBot | `src/services/HealthCheckBot.ts` | Periodische Station-Probes, optional Reset |
| health helpers | `src/health.ts` | Snapshot für `/health*` |
| BillingService | `src/services/BillingService.ts` | Session → DATEV-CSV |

## Lastmanagement-Flow

1. **Init** — WS zu `CITRINE_WS_URL`, optionale `KNOWN_STATIONS` registrieren.
2. **MeterValues** — `Power.Active.Import` → kW (W-Normalisierung), Station-Power updaten.
3. **Check** — wenn `totalPower > maxSitePower - adjustmentThreshold`:
   - Debounce über `adjustmentDelay`
   - Live-Total erneut lesen
   - Proportionaler Scale auf Ziel-Total; Floor ca. 1,4 kW wo möglich
4. **SetChargingProfile** an betroffene aktive Stationen.
5. Bei WS-Close (nicht intentional): Reconnect nach 5 s.

`setStationChargingLimit` clamped immer gegen die Hardware-/Config-Ceiling der Station und erhöht diese Ceiling **nicht** stillschweigend.

## PV-Surplus-Flow

1. EMS meldet Surplus: `POST /api/pv-surplus` `{ surplus: <kW> }`.
2. `PvSurplusService` speichert den Wert und ruft `LoadManager.applySurplusBudget` auf.
3. Budget wird über aktive Stationen verteilt (Allocation-Faktor / Min-Power konfigurierbar im Service).

## Pricing- & OCPP-Bridge

| LoadManager-Event | Pricing-Reaktion |
|-------------------|------------------|
| `transactionStarted` | aktive Session finden oder `startSession` (source `ocpp`), `transactionId` setzen |
| `meterEnergy` | `updateSessionMeterValue` auf aktiver Session |
| `transactionStopped` | `startIdleTracking` (endet active Session bei Bedarf zuerst) |

Session-Status: `active` → `completed` → optional `idle` → wieder `completed` (nach Idle-Ende) bzw. `cancelled`.

- `endSession` ist für completed/idle **idempotent**.
- Cancelled Sessions sind **nicht billable**.
- Energie wird auf ≥ 0 geclampt.

## Deep-Link-Flow

1. `POST /api/deep-link/tokens` erzeugt URL-sicheres Token (`dl_<checksum>_<secret>`).
2. Default-`maxUses`: **2** bei `purpose: both`, sonst **1**.
3. Start/Stop:
   - `peek` (validiert ohne Consume)
   - Preflight (aktive Session / WS open)
   - `resolveAndConsume`
   - Remote-Befehl; bei Fehlschlag `releaseUse` + Session-Cancel wo nötig
4. Stop endet die lokale Pricing-Session erst nach erfolgreichem Remote-Stop.
5. Store: JSON-Datei, atomic rewrite (`rename`), periodisches `prune`.

HTTP-Codes (Auszug): `404` NOT_FOUND, `410` REVOKED/EXPIRED/EXHAUSTED/PURPOSE_MISMATCH, `409` Session existiert, `503` WS down.

## Health

| Endpoint | Port | Inhalt |
|----------|------|--------|
| `GET /health` | `HEALTH_PORT` (3001) | status, wsOpen, timestamp |
| `GET /health/detailed` | 3001 | Snapshot + stationHealth + pvSurplusKw |
| `GET /api/health/stations` | API (3003) | HealthCheckBot-States |
| `GET /api/stations` | 3003 | LoadManager-Stationen + wsOpen |

Health-Status-Logik:

- `healthy` — WS open **oder** noch keine Stationen bekannt
- `degraded` — Stationen vorhanden **und** WS closed

HealthCheckBot: GetStatus-Probe + TriggerMessage, Timeout, Failure-Threshold, Reset-Cooldown, eigener WS mit Reconnect.

## Billing

`POST /api/billing/export` mappt billable Sessions auf DATEV-Zeilen:

- Semikolon-CSV
- Brutto → Netto/Steuer via `BILLING_VAT_RATE`
- Konten über ENV (`BILLING_REVENUE_ACCOUNT`, `BILLING_BANK_ACCOUNT`, …)
- Deep-Link-Sessions default PaymentMethod `deeplink`

## OCPP-Nachrichten (Inbound)

- `MeterValues` (Power + Energy.Active.Import.Register)
- `StartTransaction` / `StopTransaction`
- `TransactionEvent` (`started` / `updated` / `ended`)
- `BootNotification` / `StatusNotification`
- `SetChargingProfileResponse`
- Health: `GetStatusResponse` / `StatusNotification` / `ResetResponse`

## Konfiguration

Siehe [../README.md](../README.md) — vollständige ENV-Tabelle.

Wichtige Defaults:

```
MAX_SITE_POWER=50
ADJUSTMENT_THRESHOLD=5
ADJUSTMENT_DELAY=1000
MONITORING_INTERVAL=5000
CITRINE_WS_URL=ws://localhost:8080
PRICING_API_PORT=3003
HEALTH_PORT=3001
```

## Deployment

### Prozess

```bash
cd services/load-management
npm ci && npm run build && npm start
```

### Docker Compose

`docker-compose.yml` im Service-Root startet u. a. Postgres, CitrineOS, load-manager.

Ports load-manager:

- `3001` Health
- `3003` API

## Tests

```bash
npm test          # Jest (LoadManager, Pricing, PV)
npx tsc --noEmit
npx ts-node src/test-billing.ts
```

## Bekannte Betriebsgrenzen

- Pricing-Sessions sind **in-memory** (Neustart = Session-Verlust; Deep-Link-Tokens und Billing-CSVs sind dateibasiert).
- Deep-Link-HTTP-Routen sind aktuell unauthentifiziert — in Produktion hinter Gateway/Auth legen.
- Site-Limit und Surplus greifen über Charging Profiles; physische Enforcement hängt an Station/OCPP-Support.
