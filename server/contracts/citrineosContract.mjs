/** Integrationsvertrag CitrineOS ↔ bc-charge-app (v1.8.4)
 * Upstream watch (2026-08-27): citrineos-core latest pre-release tag still **v2.0.0-beta3**
 * (tag 2026-08-12; no newer tag on releases; open #952 "beta4" still not tagged; 0 merges into
 * watch set since 2026-08-25). Still NOT a prod pin — stay on 1.8.4 until staging CANARY_FORCE=1
 * soak + pinBump.ready + hardware smoke (Elinta/go-e).
 * beta3 highlights for BC: OCPP message correlation (#832), tenant-scoped repo deletes (#842),
 * OCPI tenant decorator (#841), OCPP messages state/message columns (#855), null VariableAttribute
 * guard (#847). beta1 also: SalesTariffId on ChargingSchedules (#782), smart-charging Absolute
 * TxProfile startSchedule (#785), OTel WS metrics (#778).
 * Merged on upstream branch `next` (not in beta3 tag yet — deploy only when staging tracks next/post-beta3):
 *   - **#849 drop data API** (merged 2026-08-18 → next): removes `/data/**`; Commands API at
 *     `/commands/transaction|tariff|bootConfig`. BC dual-path remains SoT on pin 1.8.4; after Citrine
 *     staging carries #849 run `CITRINEOS_REST_SURFACE=commands` trial before any pin bump.
 *   - **#846** audit-insert crash fix (merged 2026-08-17 → next): OCPPMessages insert no longer kills
 *     process / drops all station WS — prefer this commit on any long webhook soak Citrine.
 *   - **#852** unmapped measurands dropped (merged 2026-08-20 → next): no longer relabel unknown
 *     samples as Energy.Active.Import.Register — aligns with BC webhook strict energy extract.
 *   - **#859** EVSE-scoped connector status (merged 2026-08-20 → next): OCPP 2.0.1 multi-EVSE
 *     connectorId collision fixed upstream; BC ids already `evse-{n}-conn-{m}`.
 *   - **#851 tenant path mapping** (merged 2026-08-25 → next): system-config → tenant DB/cache +
 *     path sanitization. Re-verify CITRINEOS_API_URL/tenant routing + deploy scripts when staging
 *     tracks next (pairs with #849 commands surface).
 * Open drift risks (still open 2026-08-27; no state change vs 2026-08-26):
 *   - **#867** OCPPMessages weekly partition (open): ops/migration risk; entrypoint must provision
 *     partitions or inserts fail (less fatal once #846 is deployed, still lossy/noisy).
 *   - **#881/#893** (open): OCPP2 handlers hard-code protocol OCPP2.1 on follow-up SetChargingProfile
 *     / related calls while registered for OCPP_2_VER_LIST (includes 2.0.1) — LM/PV profile sends can
 *     be audited/routed on the wrong action table for 2.0.1 stations (frame still reaches charger).
 *   - **#869** (open): OCPP 2.x standalone MeterValues not attached to transaction / CostUpdated never
 *     fires from that handler — BC meter SoT remains TransactionEvent webhooks + strict energy extract.
 *   - **#868** (open): MeterValueUtils.getTotalKwh returns 0 on non-energy batches and callers write it
 *     back → live Transaction.totalKwh wipe. BC webhook path already guards via pickMonotonicEnergyKwh.
 *   - **#879** (open): DC TxProfile from NotifyEVChargingNeeds mis-scales W/A (evMaxPower already W
 *     but ×1000; current×voltage returned as A). LM must not trust Citrine-derived DC ceilings blindly.
 *   - **#918** (open): smart-charging criteria treat 0 as absent (evseId=0 station-wide clear refused).
 *   - **#894** (open): TxProfile schedule duration unit wrong (not seconds) on Citrine-built profiles.
 *   - **#934** (open): charging-needs lookup mixes EvseTypes.databaseId vs Evses.id — EV-needs→TxProfile
 *     path can miss needs on multi-EVSE / non-empty device-model DBs.
 *   - **#871** (closed unmerged 2026-08-21): MeterValueUtils.normalizeToKwh throws on non-energy units
 *     (e.g. energy measurand default + unit A) → whole MeterValues/TransactionEvent CallError. BC
 *     energy extract allowlists Wh/kWh only (skip A/V/W) on webhook + LM paths.
 *   - **#950** (open, last push 2026-08-26): Boot PK leaves ocppConnectionName → auto-inc + stationId
 *     FK; Boot + VariableAttributes migration; PUT /bootConfig + boot.dto/VariableAttribute DTO;
 *     BootNotification 1.6/2 handlers. BC dual-path bootConfig is low-traffic — parse-do-not-cast any
 *     boot body; do not key identity solely on ocppConnectionName once staging carries #950 (pairs
 *     with #849 commands /bootConfig).
 *   - **#954** (open, 2026-08-25): allow null connectorId for OCPP 2.0.1 connectors — Hasura/status
 *     mapping and BC `evse-{n}-conn-{m}` builders must tolerate missing connectorId (EVSE-only).
 *     BC mapper + LM extractConnectorId already skip null/omit (no evse.id fallback).
 * Webhooks: TransactionEvent seqNo + triggerReason (ChargingRateChanged/ChargingStateChanged → LM
 * reopt) + chargingState persist + meterValue energy (citrineosWebhooks.mjs / loadManagementReopt.mjs).
 * Hasura: station-status live queries only via BFF WS proxy; meter/LM stays on webhooks (live-query
 * multiplex ~1s is wrong for high-freq telemetry). Event-trigger fan-out still wrong for OCPP meter
 * cadence (timeouts/duplicates) — keep BFF + webhooks SoT.
 * Load-Management: /api/load-management proxy + composite/external limits (PR #46 merged);
 * inbound Citrine WS frames parse-don't-cast via citrineWsEnvelope.ts.
 */

export const CITRINEOS_INTEGRATION_VERSION = '1.8.4';

/** Latest upstream tag observed by intelligence cron (informational, not a hard pin). */
export const CITRINEOS_UPSTREAM_WATCH = 'v2.0.0-beta3';

/**
 * Upstream PRs merged to `next` but not yet in CITRINEOS_UPSTREAM_WATCH tag (informational).
 * Keep dual-path / soak gates until a tagged release that includes these lands on staging Citrine.
 */
export const CITRINEOS_UPSTREAM_MERGED_NEXT = [
  {
    id: 849,
    title: 'Feature/drop data api',
    url: 'https://github.com/citrineos/citrineos-core/pull/849',
    mergedAt: '2026-08-18T20:49:12Z',
    base: 'next',
    risk:
      'Removes /data/**. BC dual-fetches legacy + /commands/transaction|/tariff|/bootConfig. On pin 1.8.4 legacy still primary (auto); after staging Citrine includes #849, trial CITRINEOS_REST_SURFACE=commands then consider pin bump. See CITRINEOS_DATA_API_MIGRATION.',
    migrationMatrix: 'server/contracts/citrineosDataApiMigration.mjs',
  },
  {
    id: 846,
    title: "fix(core): don't let a failed message-audit insert kill the process",
    url: 'https://github.com/citrineos/citrineos-core/pull/846',
    mergedAt: '2026-08-17T18:11:59Z',
    base: 'next',
    risk:
      'Guards OCPPMessages audit insert in WebhookDispatcher so FK/DB failures no longer crash CSMS / drop all station websockets. Deploy on staging/prod Citrine before long webhook soaks when tracking next.',
  },
  {
    id: 852,
    title: 'fix(core): drop unmapped OCPP measurands instead of relabeling them as the energy register',
    url: 'https://github.com/citrineos/citrineos-core/pull/852',
    mergedAt: '2026-08-20T20:23:48Z',
    base: 'next',
    risk:
      'Upstream no longer relabels unknown measurands as Energy.Active.Import.Register. Positive for meter honesty; BC webhooks already strict-match that measurand — watch for missing energy samples on quirky hardware after staging tracks next.',
  },
  {
    id: 859,
    title: 'fix(core): resolve OCPP 2.0.1 connector status through its EVSE',
    url: 'https://github.com/citrineos/citrineos-core/pull/859',
    mergedAt: '2026-08-20T20:30:51Z',
    base: 'next',
    risk:
      'Fixes multi-EVSE connectorId collision in OCPP 2.0.1 status resolution. BC connector ids already evse-{evseId}-conn-{connectorId}; re-verify Hasura/status mapping when staging Citrine carries #859.',
  },
  {
    id: 851,
    title: 'Feature/refactor tenant path mapping',
    url: 'https://github.com/citrineos/citrineos-core/pull/851',
    mergedAt: '2026-08-25T17:01:34Z',
    base: 'next',
    risk:
      'Tenant pathing moves system-config → tenant DB/cache + path sanitization. BC uses env CITRINEOS_API_URL + tenantId query/Hasura vars (no URL-substring tenancy) — still re-verify REST base paths, deploy scripts, and multi-tenant routing when staging tracks next+#851 (with #849 commands).',
  },
];

/** Open upstream PRs/issues that can break BC routing, REST, or tenancy (informational). */
export const CITRINEOS_UPSTREAM_OPEN = [
  {
    id: 867,
    title: 'Feature: OCPPMessages Partition',
    url: 'https://github.com/citrineos/citrineos-core/pull/867',
    risk:
      'Weekly partition + OCPPMessages_old on Citrine DB; deploy/entrypoint must run provision-partitions or inserts fail. With #846 on next, failure is lossy not process-fatal — still provision before enabling partitions.',
  },
  {
    id: 881,
    title: "fix(core): follow up on the station's own protocol, not a hard-coded OCPP 2.1",
    url: 'https://github.com/citrineos/citrineos-core/pull/881',
    risk:
      'OCPP2 handlers registered for 2.0.1+2.1 hard-code OCPP2_1 on follow-up SetChargingProfile/GetChargingProfiles/SendLocalList — wrong action table / audit for 2.0.1 stations (LM/PV profile path). Frame still reaches charger; audit/protocol metadata wrong.',
  },
  {
    id: 893,
    title: "fix(core): send the transaction's SetChargingProfile on the station's own protocol",
    url: 'https://github.com/citrineos/citrineos-core/pull/893',
    risk:
      'TransactionEvent OCPP2 handler hard-codes OCPP2_1 when pushing tx charging profiles — same class of bug as #881; prefer both on staging Citrine before Live-LM-PV soak on 2.0.1 hardware.',
  },
  {
    id: 869,
    title: 'fix(core): attach OCPP 2.x MeterValues to their transaction',
    url: 'https://github.com/citrineos/citrineos-core/pull/869',
    risk:
      'Standalone MeterValuesRequestOcpp2Handler never wires _sendCostUpdatedOnMeterValue; samples may not attach to tx. BC billing/UI meter SoT stays TransactionEvent webhooks + Energy.Active.Import.Register extract — do not depend on Citrine CostUpdated from MeterValues alone.',
  },
  {
    id: 868,
    title: "fix(base): don't reset a session's totalKwh when a meter batch has no energy reading",
    url: 'https://github.com/citrineos/citrineos-core/pull/868',
    risk:
      'Upstream MeterValueUtils.getTotalKwh returns 0 when batch has no usable energy (clock-only / SoC-only); callers write 0 onto Transaction.totalKwh and wipe live totals. BC apply path uses pickMonotonicEnergyKwh (rejects regression incl. 0 after real kWh). Still risky for any consumer reading Citrine REST/Hasura totalKwh directly during those ticks.',
  },
  {
    id: 879,
    title: 'fix(core): emit DC charging-profile limits in the unit they are labelled with',
    url: 'https://github.com/citrineos/citrineos-core/pull/879',
    risk:
      'NotifyEVChargingNeeds→TxProfile DC path mislabels limits (W×1000 or W-as-A). Station may reject or apply no real ceiling. BC LM chargingScheduleShape unit conversion is correct for honest frames — do not treat Citrine-built DC TxProfiles as ground truth until #879 lands; prefer BC/EMS SetChargingProfile limits.',
  },
  {
    id: 918,
    title: 'fix(core): treat 0 as a value in the smart charging criteria, not as absent',
    url: 'https://github.com/citrineos/citrineos-core/pull/918',
    risk:
      'ClearChargingProfile/GetChargingProfiles criteria use truthiness; evseId=0 (station-wide), stackLevel=0, chargingProfileId=0 look "missing". Station-wide clear/list can fail — LM clear/composite helpers must avoid assuming 0 works on unpatched Citrine.',
  },
  {
    id: 894,
    title: 'fix(smart-charging): convert TxProfile schedule duration to seconds',
    url: 'https://github.com/citrineos/citrineos-core/pull/894',
    risk:
      'Citrine-built TxProfile chargingSchedule.duration may not be in OCPP seconds. BC LM/PV outbound profiles omit duration (startSchedule + open-ended period) so send path is OK; inbound GetCompositeSchedule/Notify* duration fields must be treated as untrusted units until #894 lands — do not drive billing windows off Citrine duration alone.',
  },
  {
    id: 934,
    title: 'fix(core): find charging needs by the EVSE the transaction is on',
    url: 'https://github.com/citrineos/citrineos-core/pull/934',
    risk:
      'validateChargingProfileType looked up ChargingNeeds via EvseTypes.databaseId while needs are stored under Evses.id — multi-EVSE / non-toy DBs miss EV-reported needs and skip or mis-build TxProfiles. Compounds #879 on NotifyEVChargingNeeds→TxProfile; BC must keep EMS/LM SetChargingProfile as ceiling SoT.',
  },
  {
    id: 871,
    title: 'fix(base): ignore non-energy meter units instead of throwing',
    url: 'https://github.com/citrineos/citrineos-core/pull/871',
    risk:
      'Closed unmerged (2026-08-21): normalizeToKwh throws on unknown/non-energy units reached from getTotalKwh/getMeterStart → entire MeterValues/TransactionEvent aborts with CallError. Distinct from #852 (measurand map) and #868 (0 wipe). BC webhook+LM energy extract allowlist Wh/kWh only and skip A/V/W on energy measurand; still do not bill off Citrine REST totalKwh while this class is unpatched upstream.',
  },
  {
    id: 950,
    title: 'Feature: Update OCPP Boot PK',
    url: 'https://github.com/citrineos/citrineos-core/pull/950',
    risk:
      'Open (last activity 2026-08-26, 5 commits / 17 files): Boot PK → auto-inc + stationId FK (tenant-leak fix via ocppConnectionName PK); Boot + VariableAttributes migration; PUT /bootConfig; boot.dto + BootNotification 1.6/2 handlers. BC dual-path getBootConfig is low hot-path but identity/keys can drift after next-deploy — parse-do-not-cast any bootConfig body; never assume ocppConnectionName remains PK; re-canary when staging tracks next+#950 alongside #849 commands surface.',
  },
  {
    id: 954,
    title: 'fix(core): allow null connectorId for OCPP 2.0.1 connectors',
    url: 'https://github.com/citrineos/citrineos-core/pull/954',
    risk:
      'Open (2026-08-25): OCPP 2.0.1 connectors may omit connectorId (EVSE-level only). BC `evse-{evseId}-conn-{connectorId}` + Hasura station mappers must not stringify null into conn-null / crash — guard missing connectorId when staging carries #954 (pairs with #859 EVSE-scoped status).',
  },
];

/** Lazy import helper so consumers can load the #849 matrix without circular deps at module top. */
export async function loadDataApiMigrationMatrix() {
  const mod = await import('./citrineosDataApiMigration.mjs');
  return {
    matrix: mod.CITRINEOS_DATA_API_MIGRATION,
    readiness: mod.evaluateDataApiMigrationReadiness(),
    summary: mod.summarizeDataApiMigration(),
  };
}

export const citrineosIntegrationContract = {
  version: CITRINEOS_INTEGRATION_VERSION,
  upstreamWatch: CITRINEOS_UPSTREAM_WATCH,
  upstreamOpen: CITRINEOS_UPSTREAM_OPEN,
  upstreamMergedNext: CITRINEOS_UPSTREAM_MERGED_NEXT,
  /** Structural #849 gate — live object attached by canary stats / routes that import the matrix. */
  dataApiMigrationRef: 'server/contracts/citrineosDataApiMigration.mjs',
  operator: {
    brand: 'BC Charge',
    company: 'Byte Commander GmbH',
    website: 'https://main.bc-charge.com',
    email: 'hello@bc-charge.com',
    phone: '+49 (0) 34292 43340',
    address: 'Grüner Weg 3, 04827 Machern, Deutschland',
    vatId: 'DE343089057',
  },
  tenantId: 1,
  idTokenType: 'Central',
  defaultPorts: {
    restApi: 8080,
    hasura: 8090,
    ocppWs: 8081,
    ocppWss: 8082,
  },
  endpoints: [
    {
      id: 'health',
      method: 'GET',
      path: '/health',
      purpose: 'Erreichbarkeit CitrineOS REST',
      appUsage: 'citrineosHealth, syncStationsFromCitrineos',
    },
    {
      id: 'requestStartTransaction',
      method: 'POST',
      path: '/ocpp/2.0.1/evdriver/requestStartTransaction',
      query: ['identifier', 'tenantId'],
      purpose: 'Fernstart Ladevorgang OCPP 2.0.1',
      appUsage: 'startCitrineosCharge',
    },
    {
      id: 'requestStopTransaction',
      method: 'POST',
      path: '/ocpp/2.0.1/evdriver/requestStopTransaction',
      query: ['identifier', 'tenantId'],
      purpose: 'Fernstopp Ladevorgang',
      appUsage: 'stopCitrineosCharge',
    },
    {
      id: 'getTransaction',
      method: 'GET',
      path: '/data/transactions/transactionType',
      pathCommands: '/commands/transaction',
      pathStrategy: 'dual_legacy_then_commands',
      query: ['tenantId', 'stationId', 'transactionId'],
      purpose: 'Live kWh/Kosten während Session (dual-path #849)',
      appUsage: 'pollCitrineosSession / fetchTransactionFromRestApi',
    },
    {
      id: 'getTariffs',
      method: 'GET',
      path: '/data/transactions/tariff',
      pathCommands: '/commands/tariff',
      pathStrategy: 'dual_legacy_then_commands',
      query: ['tenantId'],
      purpose: 'Tarifkatalog für Preisanzeige (dual-path #849)',
      appUsage: 'syncStationsFromCitrineos, tariffPricing, GET /api/citrineos/tariffs',
    },
    {
      id: 'hasuraChargingStation',
      method: 'POST',
      graphql: 'ChargingStation',
      purpose: 'Stationen, EVSEs, Connector-Status, eingebettete Tarife',
      appUsage: 'fetchChargingStationsFromHasura, mapHasuraStations',
    },
    {
      id: 'hasuraTransaction',
      method: 'POST',
      graphql: 'Transaction',
      purpose: 'Transaktion nach remoteStartId / aktiv',
      appUsage: 'fetchTransactionByRemoteStartId, fetchActiveTransaction',
    },
    {
      id: 'transactionWebhook',
      method: 'POST',
      path: '/api/webhooks/citrineos',
      purpose:
        'Push TransactionEvent / session updates (aliases + meterValue energy + seqNo ordering); auth via CITRINEOS_WEBHOOK_SECRET (Bearer / x-citrineos-webhook-secret)',
      appUsage: 'citrineosWebhooks.assertCitrineosWebhookAuthorized → normalize → db.applyCitrineosWebhookToSessions',
    },
  ],
  canary: {
    description:
      'Sampled Zod validation of live CitrineOS/Hasura responses (graceful; logs drift, does not block). Pin-bump gate via evaluatePinBumpReadiness (staging CANARY_FORCE=1 soak).',
    sampleRateEnv: 'CANARY_SAMPLE_RATE',
    forceEnv: 'CANARY_FORCE',
    pinMinSamplesEnv: 'CANARY_PIN_MIN_SAMPLES',
    pinMaxFailRateEnv: 'CANARY_PIN_MAX_FAIL_RATE',
    statsPath: '/api/citrineos/canary',
    pinBumpField: 'canary.pinBump',
    schemas: [
      'hasura.transaction',
      'hasura.transactionsData',
      'hasura.chargingStation',
      'hasura.chargingStationsData',
      'rest.transaction',
      'rest.tariffList',
      'webhook.citrineos.raw',
    ],
  },
  loadManagement: {
    servicePath: 'services/load-management',
    apiProxyMount: '/api/load-management',
    healthPorts: { health: 3001, api: 3003 },
    env: [
      'LOAD_MANAGEMENT_ENABLED',
      'LOAD_MANAGEMENT_API_URL',
      'LOAD_MANAGEMENT_HEALTH_URL',
      'LM_API_KEY',
    ],
    features: [
      'SetChargingProfile (OCPP 2.0.1 ChargingStationMaxProfile)',
      'GetCompositeSchedule request/response',
      'NotifyChargingLimit / ClearedChargingLimit external limits',
    ],
  },
  bcApiProxyRoutes: [
    { method: 'GET', path: '/api/citrineos/health' },
    { method: 'GET', path: '/api/citrineos/status' },
    { method: 'GET', path: '/api/citrineos/canary' },
    { method: 'GET', path: '/api/citrineos/contract' },
    { method: 'GET', path: '/api/citrineos/tariffs' },
    { method: 'POST', path: '/api/citrineos/hasura' },
    { method: 'POST', path: '/api/citrineos/proxy' },
    { method: 'POST', path: '/api/citrineos/ensure-authorization' },
    { method: 'POST', path: '/api/webhooks/citrineos' },
    { method: 'GET', path: '/api/load-management/status' },
    { method: 'GET', path: '/api/load-management/health' },
    { method: 'GET', path: '/api/load-management/stations' },
    { method: 'GET', path: '/api/load-management/external-limits' },
    { method: 'POST', path: '/api/load-management/composite-schedules' },
    { method: 'POST', path: '/api/load-management/proxy' },
  ],
  connectorIdFormat: 'evse-{evseId}-conn-{connectorId}',
  deploymentRepo: 'https://github.com/TheRealByteCommander/bc-citrineos',
};
