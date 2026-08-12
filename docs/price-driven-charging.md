# Price-Driven Charging (Ladeoptimierung)

## Übersicht

Dieses Feature **steuert die Ladeleistung** anhand von Day-Ahead-Strompreisen – es berechnet **keine** Endabrechnung. Für Tarife, Idle-Fees und Rechnungen siehe [`dynamic-pricing-engine.md`](dynamic-pricing-engine.md).

| | Price-Driven Charging | Dynamic Pricing Engine |
|--|----------------------|------------------------|
| Ziel | Wann/wie stark laden | Was der Kunde zahlt |
| API | `/api/price-optimization` | `/api/pricing` |
| OCPP-Ausgang | `SetChargingProfile` | Liest States & MeterValues |
| Host | BC Charge App Server | BC Charge App Server |

## Architektur

### Backend (App Server)

1. **Price Optimizer** (`server/services/priceOptimization/priceOptimizer.mjs`)
   - Day-Ahead-Strompreise von externer API
   - Schwellenwert-Logik mit Hysterese
   - `SetChargingProfile` über CitrineOS API

2. **API-Routen** (`server/routes/priceOptimization.mjs`)
   - `GET /api/price-optimization/price-data` – Strompreise
   - `GET/PUT /api/price-optimization/config` – Konfiguration
   - `GET /api/price-optimization/charging-recommendation` – Empfehlung
   - `POST /api/price-optimization/optimize-charging` – Optimierung für Connector

3. **Frontend-Client** (`src/api/priceOptimization/client.ts`)

### CitrineOS Server

- Empfängt `SetChargingProfile` und setzt Ladeleistung an der Hardware um.
- Liefert `MeterValues` und Ladezustände zurück an die App (für Abrechnung, nicht für diese Optimierung).

## Konfiguration

| Variable | Beschreibung | Standard |
|----------|--------------|----------|
| `PRICE_THRESHOLD_EUR_PER_KWH` | Preis-Schwelle (Pause/Drossel) | `0.35` |
| `PRICE_HYSTERESIS_EUR` | Hysterese gegen Flattern | `0.02` |
| `MIN_CHARGING_POWER_PERCENT` | Mindestleistung beim Drosseln (%) | `20` |
| `ELECTRICITY_PRICE_API_URL` | Day-Ahead-API | `https://api.energy-price-data.de/day-ahead` |
| `PRICE_CHECK_INTERVAL_MINUTES` | Preis-Check-Intervall | `15` |

## Preisdaten-Format

```json
[
  { "timestamp": "2026-07-14T00:00:00.000Z", "price": 0.32 },
  { "timestamp": "2026-07-14T01:00:00.000Z", "price": 0.30 }
]
```

## Hysterese

- Laden aktiv → pausieren wenn `Preis > Schwelle + Hysterese`
- Laden pausiert → fortsetzen wenn `Preis < Schwelle − Hysterese`

## Tests

```bash
npm test
```

Unit-Tests: `server/services/priceOptimization/priceOptimizer.test.mjs`

## Geplante Erweiterungen

1. Entsoe-E und weitere Preis-APIs
2. Nutzerpräferenz „Eil-Ladung“ vs. Kostenersparnis
3. Kombination mit PV-Überschuss (`/api/pv-surplus`)
