# PV Surplus Charging

Bindet ein externes Energy Management System (EMS) an das Load-Management an: gemeldeter PV-Überschuss wird auf aktive Ladestationen verteilt.

## Endpoints

Base-URL: API-Port des Services (Default **3003**, ENV `PRICING_API_PORT` / `API_PORT`).

### Surplus setzen

```
POST /api/pv-surplus
Content-Type: application/json

{ "surplus": 15.5 }
```

`surplus` = kW, muss endlich und ≥ 0 sein.

**Antwort (Beispiel):**

```json
{
  "success": true,
  "message": "PV surplus updated successfully",
  "data": { "surplus": 15.5 }
}
```

### Surplus lesen

```
GET /api/pv-surplus
```

```json
{
  "success": true,
  "data": { "surplus": 15.5 }
}
```

## Implementierung

| Datei | Rolle |
|-------|--------|
| `pvSurplusService.ts` | Hält `_currentSurplus`, wendet Budget auf `LoadManager` an |
| `pvSurplusController.ts` | Express-Handler, Validierung |

Ablauf bei `updateSurplus`:

1. Wert speichern
2. `allocatable = surplus * allocationFactor` (Default-Faktor `1`)
3. Wenn aktive Stationen existieren: `loadManager.applySurplusBudget(allocatable, minStationPowerKw)`
4. Ohne gebundenen LoadManager: nur speichern + Warning-Log

Constructor-Optionen:

- `loadManager` — wird in `index.ts` gesetzt (`new PvSurplusService(console, { loadManager })`)
- `allocationFactor` — Anteil des Surplus für EVs (0–1, Default 1)
- `minStationPowerKw` — Untergrenze je aktiver Station (Default 1.4 kW)

`setLoadManager()` erlaubt nachträgliches Binden.

## Integration CitrineOS

Die eigentliche Leistungsbegrenzung läuft über den `LoadManager` (OCPP `SetChargingProfile` an CitrineOS). Der PV-Service selbst spricht CitrineOS nicht direkt an.

## Konfiguration

Kein eigener Port mehr. PV teilt sich den REST-API-Port:

- `PRICING_API_PORT` oder `API_PORT` (Default `3003`)

## Tests

```bash
npm test
# u. a. src/services/pv-surplus/__tests__/
```
