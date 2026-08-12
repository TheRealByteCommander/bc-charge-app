# Technical Specification: CitrineOS Integration Enhancements (bc-charge-app)

## Goal
Improve the stability, accuracy, and feature set of the CitrineOS integration, specifically focusing on transaction resolution, energy estimation, tariff management, and system stability.

---

## 1. Optimization: Transaction Resolution (Push vs Polling)
**Current State:** `startAdhocTransaction` uses a loop (20 iterations * 1.5s) to poll Hasura for the `transactionId` after a `remoteStartTransaction` command.
**Requirement:** Replace or augment polling with a push-based mechanism if CitrineOS supports it.
**Proposed Implementation:**
- **Verification:** Check if CitrineOS supports Webhooks or WebSockets for `TransactionStarted` events.
- **Proposed Change:** 
    - If Webhooks are available: Implement a webhook endpoint in `server/routes/webhooks.mjs` to receive transaction start events and update the session state in the database.
    - If no Push is available: Optimize the polling interval. Instead of a fixed 1.5s, implement an exponential backoff or a more aggressive initial burst followed by a slower poll.
- **Success Metric:** `transactionId` resolved in < 2s in 95% of cases without overloading the Hasura API.

## 2. Accuracy: Energy Estimation (`estimateEnergyKwh`)
**Current State:** `estimateEnergyKwh` uses a hardcoded `efficiency = 0.85` and `powerKw = 11` fallback.
**Requirement:** Validate and refine efficiency based on real-world telemetry.
**Proposed Implementation:**
- **Refinement:** Replace the constant `0.85` with a dynamic efficiency lookup table based on `powerKw`. (e.g., 22kW chargers often have different losses than 11kW or 3.7kW).
- **Telemetry Integration:** 
    - Modify `syncAccountSessionFromCitrineos` to log the difference between `estimatedEnergy` and `actualEnergy` once a transaction is closed.
    - Create a small telemetry table/log to track `estimated_vs_actual` per station model.
- **Proposed Formula:** `estimated = (powerKw * efficiency[model] * minutes) / 60`.
- **Success Metric:** Mean Absolute Percentage Error (MAPE) for energy estimation < 10%.

## 3. Feature: Native Tariff Management
**Current State:** Prices are fetched from `ChargingStations` $\rightarrow$ `Connectors` $\rightarrow$ `Tariff` via Hasura.
**Requirement:** Support complex pricing models (dynamic pricing, time-of-use).
**Proposed Implementation:**
- **Expansion:** Integrate with the CitrineOS Tariff API (if available) or the OCPI Tariff module.
- **Logic Update:** 
    - In `resolveAdhocConnector`, replace static `pricePerKwh` with a call to a `getEffectiveTariff(stationId, timestamp)` function.
    - Implement support for `pricePerMin` and `sessionFee` more robustly in the cost calculation.
- **Success Metric:** Correct price calculation for dynamic tariffs (e.g., night vs. day rates).

## 4. Stability: Polling Loop Load Monitoring
**Current State:** High-frequency polling (1.5s) for multiple concurrent sessions could stress the API/Database.
**Requirement:** Ensure stability under load.
**Proposed Implementation:**
- **Implementation:** 
    - Introduce a "Polling Manager" or a queue to stagger requests.
    - Add detailed logging to `citrineosServer.mjs` to track request latency and failure rates during the resolution phase.
    - Implement a circuit breaker for the Hasura/API calls to prevent cascading failures.
- **Test Case:** Simulate 50 concurrent `startAdhocTransaction` calls and monitor CPU/Memory and API response times.
- **Success Metric:** Zero timeouts or 502/503 errors during peak simulated load.

---

## Implementation Order
1. **Stability & Polling** $\rightarrow$ 2. **Push Integration** $\rightarrow$ 3. **Energy Accuracy** $\rightarrow$ 4. **Complex Tariffs**.
