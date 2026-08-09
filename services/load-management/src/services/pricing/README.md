# Dynamic Pricing Engine

Flexible Preislogik für EV-Ladesessions: Zeit-Tarife, Idle-Fees, Energy Pass-Through und Session-Lifecycle.

## Komponenten

- `PricingService` — Business-Logik (in-memory Sessions)
- `PricingController` — REST-API
- Integration in `src/index.ts` — OCPP-Events vom `LoadManager` erzeugen/aktualisieren Sessions

## Session-Modell

| Status | Bedeutung |
|--------|-----------|
| `active` | Ladevorgang läuft |
| `completed` | Beendet, Energie/Preis berechnet |
| `idle` | Nachladen beendet, Idle-Fee läuft |
| `cancelled` | Abgebrochen (z. B. Remote-Start nicht zugestellt) — **nicht billable** |

Zusatzfelder u. a.: `customerId`, `locationId`, `source` (`api`|`deeplink`|`ocpp`|`unknown`), `deepLinkToken`, `transactionId`, `cancelReason`.

### Wichtige Service-Methoden

- `startSession(stationId, connectorId, startMeterValue, options?)`
- `endSession(sessionId, endMeterValue)` — idempotent für completed/idle
- `startIdleTracking` / `endIdleTracking`
- `findActiveSession` / `findOpenSession` / `getBillableSessions`
- `updateSessionMeterValue`
- `setSessionTransactionId` / `getSessionTransactionId`
- `cancelSession`

Regeln:

- Keine zweite active Session pro Station/Connector
- Energie `max(0, end - start)`
- Billable = `completed`|`idle` mit endlichem `totalPrice`

## API Endpoints

Base: API-Port (Default **3003**).

### Tarife

- `POST /api/pricing/tariff`
- `GET /api/pricing/tariff`

### Sessions

- `POST /api/pricing/session/start`
- `POST /api/pricing/session/end`
- `POST /api/pricing/session/idle/start`
- `POST /api/pricing/session/idle/end`
- `GET /api/pricing/session/:sessionId`

### Dynamic Pricing

- `POST /api/pricing/energy-price`
- `GET /api/pricing/config`

## Beispiele

### Tarife

```bash
curl -X POST http://localhost:3003/api/pricing/tariff \
  -H "Content-Type: application/json" \
  -d '{
    "startTime": "06:00",
    "endTime": "22:00",
    "pricePerKwh": 0.35,
    "idleFeePerMin": 0.10
  }'
```

### Session

```bash
curl -X POST http://localhost:3003/api/pricing/session/start \
  -H "Content-Type: application/json" \
  -d '{
    "stationId": "CS001",
    "connectorId": 1,
    "startMeterValue": 1234.5
  }'

curl -X POST http://localhost:3003/api/pricing/session/end \
  -H "Content-Type: application/json" \
  -d '{
    "sessionId": "session-uuid-here",
    "endMeterValue": 1250.0
  }'
```

### Idle

```bash
curl -X POST http://localhost:3003/api/pricing/session/idle/start \
  -H "Content-Type: application/json" \
  -d '{ "sessionId": "session-uuid-here" }'

curl -X POST http://localhost:3003/api/pricing/session/idle/end \
  -H "Content-Type: application/json" \
  -d '{ "sessionId": "session-uuid-here" }'
```

## ENV

| Variable | Default |
|----------|---------|
| `PRICING_DEFAULT_PRICE_PER_KWH` | `0.30` |
| `PRICING_DEFAULT_IDLE_FEE_PER_MIN` | `0.05` |
| `PRICING_CURRENCY` | `EUR` |
| `PRICING_TIMEZONE` | `Europe/Berlin` |
| `PRICING_API_PORT` | `3003` |

## OCPP-Integration

Über Events vom `LoadManager` (siehe `src/index.ts`):

| Event | Pricing |
|-------|---------|
| `transactionStarted` | Session anlegen/aktualisieren + `transactionId` |
| `meterEnergy` | Meterstand active Session |
| `transactionStopped` | Idle-Tracking (completed bei Bedarf zuerst) |

Deep-Link-Start/Stop nutzt denselben `PricingService`.

## Billing

Abgeschlossene/idle Sessions: `POST /api/billing/export` (siehe Service-README). Cancelled Sessions werden ausgeschlossen.

## Tests

```bash
npm test
# src/services/pricing/__tests__/pricingService.test.ts
```
