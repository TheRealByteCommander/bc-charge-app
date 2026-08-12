# E2E Test Scenarios: BC Charge Charging Flow (Updated)

This document defines the critical user journeys that must be covered by automated E2E tests to ensure the stability of the charging core functions.

## 1. The Happy Path (Core Charging Flow)
**Goal:** A user can find a charger, start a session, and stop it successfully.
- **Step 1: Discovery**
  - Open App -> Map View.
  - Search for a charging station or select one from the map.
  - Verify station details (price, availability, connector type) are displayed.
- **Step 2: Authentication & Authorization**
  - Login with test credentials (`test_user1@example.com`).
  - Confirm payment method/credits.
- **Step 3: Session Start**
  - Trigger "Start Charging" command via API/UI.
  - Verify that the app shows "Charging" status and real-time energy delivery (kWh).
- **Step 4: Session Stop**
  - Trigger "Stop Charging" or wait for completion.
  - Verify the final summary (energy delivered, total cost, time).
  - Verify the session is moved to "History".

## 2. Payment & Billing Edge Cases
**Goal:** Ensure no charging happens without valid payment and billing is accurate.
- **Insufficient Funds:** Attempt to start charging with a user account having 0 balance -> Verify error message and that charging does not start.
- **Payment Method Update:** Attempt to start charging, receive payment failure, then update card and retry.
- **Invoice Generation:** Verify that a PDF invoice is generated correctly after session completion.

## 3. Connectivity & Hardware Failures
**Goal:** The app handles backend/charger timeouts gracefully.
- **Charger Offline:** Select a charger that is reported as 'Offline' -> Verify it cannot be started.
- **Connection Timeout:** Simulate a slow response from CitrineOS during "Start Charging" -> Verify a user-friendly timeout/retry message.
- **Unexpected Disconnect:** Simulate a session drop -> Verify the app notifies the user and shows the last known state.

## 4. User Account & Management
**Goal:** Account settings and history are reliable.
- **RFID Management:** Add/Remove an RFID chip and verify it's linked to the account.
- **Charging History:** Filter history by date/station and verify totals.

---

## Technical Strategy
- **Framework:** Playwright.
- **Environment:** Local Vite Dev Server + SQLite Test DB.
- **Seeding:** Use `scripts/create-test-users.mjs` and a new `scripts/seed-test-stations.mjs`.
- **Mocks:** For physical charger communication, we use a mock OCPP bridge in the test environment.

## Implementation Priority
1. **Scenario 1 (Happy Path)** - Absolute Priority.
2. **Scenario 2 (Payment Failures)** - High Priority.
3. **Scenario 3 (Offline States)** - Medium Priority.
4. **Scenario 4 (Account/RFID)** - Low Priority.
