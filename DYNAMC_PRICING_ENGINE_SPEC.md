# Dynamic Pricing Engine - Technical Implementation

## 1. Time-Based Tariff Matrix
The system shall support multiple price zones per day.
- **Structure:** `Map<ZoneID, {startTime, endTime, pricePerKWh, currency}>`
- **Logic:** At `StartTransaction`, the current time is mapped to the active zone. If a session crosses zone boundaries, the energy is split and billed proportionally to the duration spent in each zone.

## 2. Idle Fee Logic (Blockiergebühr)
To prevent "camping" at charging points:
- **Trigger:** When `ChargingSession` ends OR `MeterValue` (Power) drops below 0.1kW for > 5 minutes.
- **Grace Period:** 15 minutes after charging ends (configurable).
- **Calculation:** `IdleDuration (min) * FeePerMinute`.
- **OCPP Interaction:** If the vehicle is not removed within X minutes of the idle fee starting, the system may trigger a `RemoteStopTransaction` or send a push notification to the user.

## 3. Energy Pass-Through Model
Dynamic cost calculation based on real-time energy prices:
- **Formula:** `FinalPrice = (RealTimeEnergyCost + OpEx_Surcharge) * (1 + MarginPercentage)`
- **Data Source:** Integration with Entsoe-E API for Day-Ahead prices.
- **Update Frequency:** Daily update of the base cost per kWh.

## 4. Implementation Steps in CitrineOS
1. **Database Schema Update:** Add `TariffZones` and `IdleFeeConfig` tables.
2. **Transaction Processor Extension:** Modify the billing module to check for active time-zones and track session end times for idle fees.
3. **API Endpoints:** Create admin endpoints to manage the tariff matrix.
4. **Integration Test:** Simulate a session crossing from "Day" to "Night" tariff and a session with a 30-minute idle period.
