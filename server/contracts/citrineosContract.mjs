/** Integrationsvertrag CitrineOS ↔ bc-charge-app (v1.8.4)
 * Upstream watch (2026-08-14): citrineos-core latest pre-release still **v2.0.0-beta3**
 * (tag 2026-08-12; no newer tag since). Still NOT a prod pin — stay on 1.8.4 until staging
 * CANARY_FORCE=1 soak + pinBump.ready.
 * beta3 highlights for BC: OCPP message correlation (#832), tenant-scoped repo deletes (#842),
 * OCPI tenant decorator (#841), OCPP messages state/message columns (#855), null VariableAttribute
 * guard (#847).
 * Open drift risks (not in beta3 tag):
 *   - **#849 drop data API** (base `next`): removes `/data/**` entirely → breaks BC REST
 *     `getTransaction`/`getTariffs` paths until migrated (Hasura or new Commands/Api surfaces).
 *     Matrix: `citrineosDataApiMigration.mjs` (CITRINEOS_DATA_API_MIGRATION) — structural pin gate.
 *   - **#851 tenant path mapping**: config → tenant DB + cache + path sanitization.
 *   - **#846** OCPPMessages audit insert can kill process (webhook dispatcher resilience).
 *   - **#852** unmapped measurands dropped (not relabeled as energy) — good for meter honesty.
 * Webhooks: TransactionEvent seqNo + triggerReason (ChargingRateChanged → LM reopt) +
 * meterValue energy (citrineosWebhooks.mjs / loadManagementReopt.mjs).
 * Load-Management: /api/load-management proxy + composite/external limits (PR #46 merged).
 */

export const CITRINEOS_INTEGRATION_VERSION = '1.8.4';

/** Latest upstream tag observed by intelligence cron (informational, not a hard pin). */
export const CITRINEOS_UPSTREAM_WATCH = 'v2.0.0-beta3';

/** Open upstream PRs/issues that can break BC routing, REST, or tenancy (informational). */
export const CITRINEOS_UPSTREAM_OPEN = [
  {
    id: 849,
    title: 'Feature/drop data api',
    url: 'https://github.com/citrineos/citrineos-core/pull/849',
    risk:
      'Removes /data/** prefix (decorator Data API → explicit Api module). BC uses /data/transactions/transactionType and /data/transactions/tariff — hard break on v2 cutover without path migration or Hasura-only reads. See CITRINEOS_DATA_API_MIGRATION in citrineosDataApiMigration.mjs',
    migrationMatrix: 'server/contracts/citrineosDataApiMigration.mjs',
  },
  {
    id: 851,
    title: 'Feature/refactor tenant path mapping',
    url: 'https://github.com/citrineos/citrineos-core/pull/851',
    risk: 'Dynamic tenant pathing moves system-config → tenant DB/cache; base URL/scripts may break',
  },
  {
    id: 846,
    title: "fix(core): don't let a failed message-audit insert kill the process",
    url: 'https://github.com/citrineos/citrineos-core/pull/846',
    risk: 'Unguarded OCPPMessages insert in WebhookDispatcher can crash CSMS on audit DB failure — ops resilience on staging/prod Citrine',
  },
  {
    id: 852,
    title: 'fix(core): drop unmapped OCPP measurands instead of relabeling them as the energy register',
    url: 'https://github.com/citrineos/citrineos-core/pull/852',
    risk: 'Positive for BC meter extract (Energy.Active.Import.Register only); watch if energy samples go missing on quirky hardware',
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
      query: ['tenantId', 'stationId', 'transactionId'],
      purpose: 'Live kWh/Kosten während Session',
      appUsage: 'pollCitrineosSession',
    },
    {
      id: 'getTariffs',
      method: 'GET',
      path: '/data/transactions/tariff',
      query: ['tenantId'],
      purpose: 'Tarifkatalog für Preisanzeige',
      appUsage: 'syncStationsFromCitrineos, tariffPricing',
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
