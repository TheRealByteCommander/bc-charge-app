/** Integrationsvertrag CitrineOS ↔ bc-charge-app (v1.8.4)
 * Upstream watch (2026-08-20): citrineos-core latest pre-release tag still **v2.0.0-beta3**
 * (tag 2026-08-12; no newer tag on releases). Still NOT a prod pin — stay on 1.8.4 until staging
 * CANARY_FORCE=1 soak + pinBump.ready + hardware smoke (Elinta/go-e).
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
 * Open drift risks (still open 2026-08-20):
 *   - **#851 tenant path mapping** (open): config → tenant DB + cache + path sanitization.
 *   - **#852** unmapped measurands dropped (not relabeled as energy) — good for meter honesty.
 *   - **#867** OCPPMessages weekly partition (open): ops/migration risk; entrypoint must provision
 *     partitions or inserts fail (less fatal once #846 is deployed, still lossy/noisy).
 *   - **#881/#893** (open): OCPP2 handlers hard-code protocol OCPP2.1 on follow-up SetChargingProfile
 *     / related calls while registered for OCPP_2_VER_LIST (includes 2.0.1) — LM/PV profile sends can
 *     be metered/routed on the wrong action table for 2.0.1 stations.
 *   - **#869** (open): OCPP 2.x standalone MeterValues not attached to transaction / CostUpdated never
 *     fires from that handler — BC meter SoT remains TransactionEvent webhooks + strict energy extract.
 *   - **#859/#860** (open): multi-EVSE connector status + operator-ui start/stop; BC connector ids already
 *     `evse-{n}-conn-{m}` / sessionGuard is per-user not per-station.
 * Webhooks: TransactionEvent seqNo + triggerReason (ChargingRateChanged/ChargingStateChanged → LM
 * reopt) + chargingState persist + meterValue energy (citrineosWebhooks.mjs / loadManagementReopt.mjs).
 * Hasura: station-status live queries only via BFF WS proxy; meter/LM stays on webhooks (live-query
 * multiplex ~1s is wrong for high-freq telemetry).
 * Load-Management: /api/load-management proxy + composite/external limits (PR #46 merged).
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
];

/** Open upstream PRs/issues that can break BC routing, REST, or tenancy (informational). */
export const CITRINEOS_UPSTREAM_OPEN = [
  {
    id: 851,
    title: 'Feature/refactor tenant path mapping',
    url: 'https://github.com/citrineos/citrineos-core/pull/851',
    risk: 'Dynamic tenant pathing moves system-config → tenant DB/cache; base URL/scripts may break',
  },
  {
    id: 852,
    title: 'fix(core): drop unmapped OCPP measurands instead of relabeling them as the energy register',
    url: 'https://github.com/citrineos/citrineos-core/pull/852',
    risk: 'Positive for BC meter extract (Energy.Active.Import.Register only); watch if energy samples go missing on quirky hardware',
  },
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
      'OCPP2 handlers registered for 2.0.1+2.1 hard-code OCPP2_1 on follow-up SetChargingProfile/GetChargingProfiles/SendLocalList — wrong action table / audit for 2.0.1 stations (LM/PV profile path).',
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
    id: 859,
    title: 'fix(core): resolve OCPP 2.0.1 connector status through its EVSE',
    url: 'https://github.com/citrineos/citrineos-core/pull/859',
    risk:
      'OCPP 2.0.1 connectorId is per-EVSE (duplicate connectorId 1 across EVSEs). Status resolution without EVSE scope can flip wrong connector. BC ids already evse-{evseId}-conn-{connectorId}; re-verify Hasura/status mapping when #859 merges.',
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
