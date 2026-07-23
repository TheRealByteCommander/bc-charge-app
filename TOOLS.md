# Pairing Codes
- Telegram: WBSQ6PZD (2026-04-05)
# TOOLS.md — Local Notes and Tool Conventions

Skills define what tools can do. This file defines ARIA's local conventions, project assumptions, and safe operating habits.

## Workspace Conventions

- Keep all BC Charge work inside clearly named project folders.
- Use stable filenames; avoid “final_final_v3”.
- Prefer Markdown for strategy, JSON/YAML for configuration, SQL for schemas, TypeScript/Python for automation, and Mermaid for lightweight diagrams.
- Treat this workspace as confidential company memory.
- Use a private git repository for versioning the workspace and project artifacts.

## Research Conventions

Use current, high-quality sources for:

- Ladepreise, roaming fees, tariffs, grid costs, funding programs, legal/regulatory requirements
- charger specs, payment requirements, Eichrecht/MessEV/MessEG topics, AFIR-related obligations
- CitrineOS, OCPP, OCPI, Plug & Charge, payment, app store, and cloud dependencies
- market data, competitor pricing, utilization assumptions, and bank-facing financial claims

Source priority:

1. official vendor documentation and specifications
2. regulators, laws, public funding bodies, grid operators, municipalities
3. charger/backend/payment provider documentation
4. audited or reputable market reports
5. reputable trade press only when primary sources are unavailable

Do not use stale pricing or regulatory assumptions without saying so.

## Development Stack Preferences

Default preferences unless the existing project dictates otherwise:

- Backend/API: TypeScript + Node.js or Python where data/automation-heavy
- Database: PostgreSQL
- Queue/jobs: Redis/BullMQ or platform-native equivalent
- Frontend/admin: React/Next.js
- Mobile: Flutter or React Native, chosen by project constraints
- Infrastructure: Docker Compose for small deployments; Kubernetes only when operationally justified
- Observability: structured logs, health checks, uptime checks, alerting
- CI/CD: lint, test, build, deploy steps with rollback notes

## CitrineOS / Charging Platform Notes

When working on CitrineOS or a CPO backend, always separate:

- charger/OCPP communication
- authorization and identity
- charging profiles and smart charging
- transaction/event ingestion
- pricing and billing calculation
- roaming/OCPI communication
- payment flows
- monitoring and support workflows
- data exports for accounting and management

Keep protocol terminology exact. Do not blur CPO, EMP, MSP, OCPI, OCPP, roaming, and payment provider roles.

## Mobile App Notes

For BC Charge mobile app tasks, consider:

- station discovery and availability
- connector types and charging speed display
- transparent pricing before charging
- session start/stop
- payment/RFID/account support
- receipts/invoices
- push notifications
- support flow and incident reporting
- GDPR/privacy-by-design
- app store release requirements

Build app flows around trust: drivers must know price, availability, status, and support path.

## Business and Finance Notes

For bank/investor documents:

- separate capex, opex, revenue, margin, cash flow, debt service, and sensitivity cases;
- show conservative, base, and growth scenarios;
- define utilization assumptions clearly;
- include downside risks and mitigations;
- avoid vanity projections without operating logic.

For CPO pricing and roaming:

- separate ad-hoc direct charging, app customers, RFID/accounts, and roaming customers;
- show payment, platform, EMP, and settlement cost assumptions independently;
- do not collapse all sessions into one blended revenue number unless a separate detail table exists.

## Marketing Tool Notes

Marketing outputs should include at least one of:

- a strong hook
- local relevance
- proof or mechanism
- direct call to action
- channel-specific format
- testable variant

Avoid slogans that any competitor could use unchanged.

## Safety and Permissions

Before using any tool that changes the world:

- identify the target system/account/file/channel;
- inspect current state first;
- preserve existing data where possible;
- ask for approval if the action sends, publishes, deletes, spends, migrates, or affects production.

Never expose or store credentials. Use secret references, environment variables, or the configured credential mechanism.

## Useful Workspace Files

- `AGENTS.md`: operating rules and workflows
- `SOUL.md`: personality, tone, boundaries
- `IDENTITY.md`: short identity card
- `USER.md`: information about the human and organization
- `MEMORY.md`: durable facts and decisions
- `memory/YYYY-MM-DD.md`: daily working notes
- `TOOLS.md`: this file; local conventions and environment notes

## Improvement Checks

When reviewing a project, actively look for:

- manual work that should become automation
- missing monitoring or logs
- unclear ownership
- weak pricing assumptions
- untested deployment steps
- documents that are visually polished but commercially thin
- marketing messages with no reason to believe or act