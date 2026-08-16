# Technical Briefing for App Developers: Elinta H2 & CitrineOS Integration

This document outlines frontend adjustments to support the Elinta CityCharge H2 hardware via CitrineOS.

## Architecture: CitrineOS Server vs. BC Charge App

| Layer | Responsibility |
|-------|----------------|
| **CitrineOS Server** (`bc-citrineos`) | OCPP 1.6 ↔ 2.0.1 translation, MeterValues, charging states, `SetChargingProfile` |
| **BC Charge App Server** (`server/`) | Sessions, billing (`/api/pricing`), load/cost optimization (`/api/price-optimization`, `/api/pv-surplus`) |
| **Frontend** (`src/`) | UI, Hasura subscriptions, CitrineOS REST client |

## 1. Protocol: OCPP 1.6 vs 2.0.1

The H2 uses **OCPP 1.6 JSON**; the app targets **OCPP 2.0.1** enums. CitrineOS translates between them:

- **IdToken:** Treat `idTokenType` as `"Central"` for the translation layer; maps to physical RFID/H2-ID.
- **Charging states:** Map 1.6 states (`Preparing`, `Charging`, `SuspendedEV`, …) via `src/utils/ocppStateMapping.ts` for `ChargingPage.tsx` and billing idle detection.

### Idle / blocking fees (billing)

**Product policy:** BC Charge does **not** charge idle/blocking fees to end customers. Customer-facing copy must say so.

The pricing engine can still derive idle intervals from OCPP state transitions (`SuspendedEV`, `SuspendedEVSE`, `Idle` after `Charging`) — **not** from flat MeterValues — for future/roaming support. Live BC tariffs must not bill idle. See `docs/dynamic-pricing-engine.md`.

## 2. H2-specific UI

- **Connectors:** H2 has 2 connectors; `StationDetailPage` / `ChargeStartConfirmSheet` must allow EVSE selection. (go-e stations: single connector only — see `normalizeConnectorsForHardware` in `mappers.ts`.)
- **Dynamic load management:** Inform users in `ChargePriceEstimate.tsx` that speed may vary with grid load.
- **MID metering:** `HistoryPage` should note billed kWh come from MID-certified meters (Eichrecht).

## 3. Data mappings

Check `src/api/citrineos/types.ts`:

- **`HasuraChargingStationRow`:** `chargePointModel` → `"CityCharge H2"` for H2-specific layouts.
- **`CitrineosTransaction`:** `totalKwh` from H2 `MeterValue` samples (prefer signed/MID values for billing events).

## 4. Pricing integration

- Display prices from connector/CitrineOS tariff for estimates.
- Final invoice uses **TariffSnapshot** from `/api/pricing` when backend mode is active.
- `TariffsPage` shows versioned tariffs, preview, and audit — not the same as price-driven charging optimization.

## 5. UX recommendations

- H2: explicit “Connector 1 or 2?” in start flow.
- Use live connector status from Hasura subscriptions (`src/api/citrineos/subscription.ts`).
- Product policy: BC Charge does **not** charge idle/blocking fees. Do not show customer copy that implies idle fees may apply. Engine may still model `idle` components for future/roaming; live BC tariffs must not bill them.
