# PV-Überschussladen (Ladeoptimierung)

## Übersicht

Integration externer Energiemanagementsysteme (EMS), um die Ladeleistung an lokal erzeugten Solarstrom anzupassen. **Keine Abrechnungslogik** – Endpreise über die [Dynamic Pricing Engine](dynamic-pricing-engine.md).

| | PV-Überschussladen | Dynamic Pricing Engine |
|--|-------------------|------------------------|
| Ziel | Erneuerbare Energie nutzen | Kosten berechnen |
| API | `/api/pv-surplus` | `/api/pricing` |
| Host | BC Charge App Server | BC Charge App Server |

## API-Endpunkte

### PV-Überschuss melden

```
POST /api/pv-surplus
```

```json
{ "surplus": 15.5 }
```

Antwort: `{ "success": true, "data": { "surplus": 15.5, "updateTime": "..." } }`

### Aktuellen Überschuss abfragen

```
GET /api/pv-surplus
```

### Ladeoptimierung auslösen (Admin)

```
POST /api/pv-surplus/optimize-charging
```

Verteilt den gemeldeten Überschuss auf aktive Sessions und setzt `SetChargingProfile` via CitrineOS.

## Implementierung

| Modul | Aufgabe |
|-------|---------|
| `server/services/pvSurplusCharging.mjs` | Überschuss speichern, auf Sessions verteilen |
| `server/routes/pvSurplusCharging.mjs` | REST-API, Validierung |

### CitrineOS Server

- Aktive Sessions über CitrineOS API
- Leistungsanpassung per `SetChargingProfile` (OCPP)

## Konfiguration

- `CITRINEOS_API_URL` – CitrineOS-API
- `CITRINEOS_TENANT_ID` – Mandant

## Tests

Manuell: `POST /api/pv-surplus` mit Überschusswert, danach `GET` und optional `optimize-charging`.

## Geplante Erweiterungen

1. Automatische Optimierung bei Überschuss-Update
2. Verteilungsalgorithmus nach Priorität (eigener PV &gt; Netz)
3. Historische Auswertung Überschuss vs. geladene kWh
