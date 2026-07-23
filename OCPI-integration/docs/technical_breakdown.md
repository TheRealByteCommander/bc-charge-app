# OCPI (Open Charge Point Interface) Integration - Technical Task Breakdown

## 1. Introduction
Goal: Enable roaming and data exchange between BC Charge (CPO) and EMPs (E-Mobility Providers) using the OCPI standard (v2.2.1).

## 2. Architectural Scope
- **Role**: BC Charge acts as CPO (Charge Point Operator).
- **Integration Layer**: A dedicated OCPI Gateway/Service that translates CitrineOS internal state to OCPI modules.
- **Protocol**: REST API over HTTPS with Token-based authentication.

## 3. Module Breakdown (Priority Ordered)

### Phase 1: Foundational Setup & Auth
- [ ] **Task 1.1: OCPI Gateway Environment**
    - Setup dedicated API service for OCPI endpoints.
    - Implement HTTPS/TLS termination.
- [ ] **Task 1.2: Authentication & Token Management**
    - Implement the `Versions` module (handshake).
    - Implement Token exchange mechanism (CPO <-> EMP).
    - Setup token storage and rotation logic.

### Phase 2: Static Data (The "What" and "Where")
- [ ] **Task 2.1: Locations Module**
    - Map CitrineOS station data to OCPI `Location` objects.
    - Implement `GET /locations` (Push/Pull).
    - Handle location updates (Push triggers).
- [ ] **Task 2.2: EVSEs Module**
    - Map CitrineOS connector data to OCPI `EVSE` objects.
    - Implement `GET /evses` (Push/Pull).
    - Handle EVSE status updates.
- [ ] **Task 2.3: Tokens Module (Roaming)**
    - Implement verification logic for EMP-issued tokens (`GET /tokens/{token}`).
    - Handle whitelist/blacklist logic for roaming IDs.

### Phase 3: Dynamic Data & Transactions (The "Money")
- [ ] **Task 3.1: CDRs (Charge Detail Records)**
    - Implement mapping from CitrineOS transactions to OCPI `CDRs`.
    - Setup CDR push mechanism to EMPs upon session completion.
    - Handle CDR status (Pending, Approved, Rejected).
- [ ] **Task 3.2: Sessions Module**
    - Real-time session monitoring (`GET /sessions`).
    - Handle session start/stop events and notify EMPs.
- [ ] **Task 3.3: Pricing Module**
    - Define and expose tariffs for roaming users.
    - Implement `GET /pricing` for transparency.

### Phase 4: Settlement & Operations
- [ ] **Task 4.1: Settlement Logic**
    - Implement billing calculation based on CDRs.
    - Generate settlement reports for EMPs.
- [ ] **Task 4.2: Error Handling & Observability**
    - Setup detailed logging for OCPI requests/responses.
    - Implement alerting for failed push notifications.
    - Dashboard for OCPI partner health.

## 4. Key Technical Constraints
- **Idempotency**: Ensure all POST/PUT requests are idempotent.
- **Concurrency**: Handle high-frequency status updates without locking the main backend.
- **Security**: Strict validation of EMP tokens; no internal IDs leaked in OCPI payloads.
- **Versioning**: Support for OCPI 2.2.1 explicitly.

## 5. Success Criteria
- [ ] Successful handshake with at least one test EMP.
- [ ] Location and EVSE data correctly synchronized.
- [ ] Valid CDR pushed to EMP after a test charging session.
- [ ] Pricing data correctly retrieved by EMP.
