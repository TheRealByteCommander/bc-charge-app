# Technical Task Breakdown: OCPI Integration

This document outlines the precise steps required to integrate the BC Charge backend with the Open Charge Point Interface (OCPI) protocol.

## 1. Core Objectives
- **Interoperability**: Enable roaming between BC Charge and other EMPs/CPOs.
- **Data Synchronization**: Synchronize locations, stations, and connector statuses.
- **Transaction Handling**: Manage charging sessions started via roaming partners.
- **Settlement**: Implement a basis for financial clearing between partners.

## 2. OCPI Version Selection
**Target Version**: OCPI 2.2.1 (Current industry standard).
**Role**: BC Charge acts as both **CPO** (Charge Point Operator) and **EMP** (E-Mobility Provider).

## 3. Technical Task Breakdown

### Phase 1: Foundation & Authentication
- [ ] **Task 1.1: OCPI Client/Server Infrastructure**
    - Implement REST API endpoints following the OCPI structure (`/ocpi/2.2.1/...`).
    - Implement Token-based authentication (JWT/OAuth2) as per OCPI spec.
    - Build a "Partner Management" module to store partner URLs and shared secrets.
- [ ] **Task 1.2: Version Negotiation**
    - Implement the `versions` endpoint to allow partners to negotiate the OCPI version.
    - Implement the `handshake` flow for initial connection establishment.

### Phase 2: CPO Module Implementation (Outgoing Data)
- [ ] **Task 2.1: Location Module**
    - Implement `Locations` endpoint: Export BC Charge locations to partners.
    - Map internal `locations` table to OCPI `Location` object.
- [ ] **Task 2.2: EVSE Module**
    - Implement `EVSEs` endpoint: Export specific chargers and their capabilities.
    - Sync `station_connectors` with OCPI `EVSE` definitions.
- [ ] **Task 2.3: Session Module**
    - Implement `Sessions` endpoint: Provide real-time and historical charging session data.
    - Map OCPP transaction events to OCPI Session objects.
- [ ] **Task 2.4: CDR (Charge Detail Record) Module**
    - Implement `CDRs` endpoint: Export finalized billing records for settlement.
    - Ensure precise energy (kWh) and time tracking.

### Phase 3: EMP Module Implementation (Incoming Data)
- [ ] **Task 3.1: Location Discovery**
    - Implement the "Pull" mechanism to import locations from roaming partners.
    - Store partner locations in a dedicated `roaming_locations` table (to avoid polluting internal data).
- [ ] **Task 3.2: Roaming Authorization**
    - Implement the logic to authorize an RFID/App-ID from a roaming partner.
    - Create a bridge between OCPI `Tokens` request and internal authorization logic.
- [ ] **Task 3.3: Roaming Session Tracking**
    - Track sessions started by roaming users on BC Charge hardware.
    - Handle `Session` updates from partners for users charging at partner stations.

### Phase 4: Operational & Business Logic
- [ ] **Task 4.1: Pricing & Tariff Mapping**
    - Translate internal pricing models to OCPI `Tariffs` object.
    - Handle currency conversions if applicable.
- [ ] **Task 4.2: Settlement Engine**
    - Build a report generator for monthly financial clearing (CPO $\leftrightarrow$ EMP).
    - Account for roaming fees and net revenue splits.
- [ ] **Task 4.3: Monitoring & Error Handling**
    - Implement logging for all OCPI requests/responses.
    - Build a dashboard to monitor partner connection health.

## 4. Implementation Timeline (Estimated)
| Phase | Focus | Effort (Dev Days) | Criticality |
| :--- | :--- | :--- | :--- |
| 1 | Auth & Handshake | 5-8 | High |
| 2 | CPO Outbound | 10-15 | High |
| 3 | EMP Inbound | 10-15 | Medium |
| 4 | Settlement & Ops | 7-10 | Medium |

## 5. Risks & Mitigations
- **Risk**: Data mismatch between OCPP and OCPI.
  - **Mitigation**: Strict mapping layer with validation checks.
- **Risk**: High latency in authorization requests.
  - **Mitigation**: Implement caching for frequently used roaming tokens.
- **Risk**: Breaking changes in partner implementations.
  - **Mitigation**: Comprehensive automated test suite using OCPI mock servers.
