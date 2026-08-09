# Load-Management — Implementation Summary

**Repo:** https://github.com/TheRealByteCommander/bc-charge-app  
**Pfad:** `services/load-management/`  
**Branch:** `feat/load-management`  
**Relevante Commits:**
- `c0afb04` — initial complete service under monorepo path
- `64a095d` — harden deep-link, load manager, billing/health flows

## Scope (erfüllt)

- Dynamic Load Management gegen CitrineOS WebSocket
- Proportionales, debounced Load-Shedding
- WS-Reconnect + sauberes Shutdown
- PV-Surplus → echte Profile-Anpassung (kein Log-only-Placeholder)
- Dynamic Pricing + OCPP-Session-Bridge inkl. `transactionId` / Meter-Energy
- Deep-Link Token-Store (durable) mit peek/consume/release
- Health endpoints + HealthCheckBot
- DATEV-Billing-Export
- Jest-Tests grün, `tsc --noEmit` grün

## Dateibaum (Service)

```
services/load-management/
├── Dockerfile
├── docker-compose.yml
├── INSTALL.md
├── README.md
├── jest.config.js
├── package.json
├── package-lock.json
├── tsconfig.json
├── docs/
│   ├── IMPLEMENTATION_SUMMARY.md   # diese Datei
│   └── LOAD_MANAGEMENT_DOCS.md
└── src/
    ├── index.ts
    ├── health.ts
    ├── test-billing.ts
    └── services/
        ├── BillingService.ts
        ├── DeepLinkController.ts
        ├── DeepLinkTokenStore.ts
        ├── HealthCheckBot.ts
        ├── LoadManager.ts
        ├── LoadManager.test.ts
        ├── pricing/
        │   ├── README.md
        │   ├── index.ts
        │   ├── pricingController.ts
        │   ├── pricingService.ts
        │   └── __tests__/
        └── pv-surplus/
            ├── README.md
            ├── index.ts
            ├── pvSurplusController.ts
            ├── pvSurplusService.ts
            └── __tests__/
```

Runtime (gitignored): `node_modules/`, `dist/`, `data/`, `exports/`.

## Kernverhalten nach Hardening (`64a095d`)

| Bereich | Verhalten |
|---------|-----------|
| Deep-Link | `both` → 2 Uses; Peek vor Consume; Release bei 503; Stop erst nach Remote-OK |
| LoadManager | Reconnect, proportional scale, debounced adjust, robuste MeterValues, `meterEnergy` |
| Pricing | `transactionId`, idempotentes `endSession`, keine negativen kWh, cancelled nicht billable |
| Health | `degraded` nur bei bekannten Stationen + WS down |
| Billing | cancelled gefiltert; MwSt-Split DATEV-CSV |

## API-Oberfläche (Kurz)

| Methode | Pfad | Port |
|---------|------|------|
| GET | `/health`, `/health/detailed` | 3001 |
| GET/POST | `/api/pv-surplus` | 3003 |
| * | `/api/pricing/*` | 3003 |
| * | `/api/deep-link/*` | 3003 |
| GET | `/api/stations`, `/api/health/stations` | 3003 |
| POST | `/api/billing/export` | 3003 |

## Verifikation

```bash
cd services/load-management
npm ci
npx tsc --noEmit
npm test
npx ts-node src/test-billing.ts
```

Erwartet: Typecheck OK, 28 Jest-Tests OK, Billing-Selftest OK.

## Nicht in diesem Service

- Frontend/PWA (`bc-charge-app` App-Root)
- Stripe-BFF / Hasura GraphQL der App
- CitrineOS-Core selbst (externes Image / bc-citrineos Deployment)

## Offene Betriebs-Themen (kein Code-Placeholder)

- Deep-Link-Routen in Produktion authentifizieren
- Pricing-Session-Persistenz (aktuell in-memory)
- Fälschlich angelegtes Repo `TheRealByteCommander/bc-charge` manuell löschen (PAT ohne `delete_repo`)
