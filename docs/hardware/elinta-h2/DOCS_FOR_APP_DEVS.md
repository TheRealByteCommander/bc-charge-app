# Technical Briefing for App Developers: Elinta H2 & CitrineOS Integration

This document outlines the necessary frontend adjustments to support the Elinta CityCharge H2 hardware via CitrineOS.

## 1. Protocol Discrepancy: OCPP 1.6 vs 2.0.1
The hardware (H2) communicates via **OCPP 1.6 JSON**, while the app is built for **OCPP 2.0.1**. CitrineOS handles the translation, but the app needs to be aware of the following:
- **IdToken:** The `idTokenType` in the app should be treated as "Central" for the translation layer, but it maps to the physical RFID/H2-ID.
- **Charging States:** Ensure that states from 1.6 (e.g., `Preparing`, `Charging`) are mapped correctly to the 2.0.1 enum expected by the `ChargingPage.tsx`.

## 2. H2 Specific Features for UI Implementation
The Elinta H2 has specific capabilities that should be reflected in the App UI:
- **Dual Connector Support:** The H2 has 2 connectors. The `StationDetailPage.tsx` and `ChargeStartConfirmSheet.tsx` must clearly allow the user to select which connector (EVSE 1 or 2) they are using.
- **Dynamic Load Management:** Since the H2 supports dynamic load balancing, the `ChargePriceEstimate.tsx` should inform the user that charging speeds might vary based on the current grid load.
- **MID Metering:** The `HistoryPage.tsx` should highlight that the billed kWh are based on a MID-certified meter (legal requirement for Eichrecht).

## 3. Required Data Field Mappings
Please check the following types in `src/api/citrineos/types.ts`:
- **`HasuraChargingStationRow`**: Ensure `chargePointModel` is correctly rendered as "CityCharge H2" to trigger specific UI layouts.
- **`CitrineosTransaction`**: Validate that `totalKwh` is retrieved from the `MeterValue` samples provided by the H2.

## 4. UX Recommendations
- **Connector Selection:** For H2 stations, the "Start Charging" flow should explicitly ask: "Connector 1 or Connector 2?".
- **Status Indicators:** Use the LED-strip status from the H2 to reflect the state in the app (e.g., Green pulse = Charging).
