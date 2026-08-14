/**
 * CitrineOS PR #849 — drop Data API (`/data/**`) migration matrix.
 *
 * Purpose: single source of truth for every BC call site that still hits the
 * legacy Fastify Data-API prefix on pin 1.8.4. When upstream merges #849 onto
 * the line we cut over to, these paths hard-break unless migrated.
 *
 * Rules:
 * - Do NOT bump CITRINEOS_INTEGRATION_VERSION toward v2 while any route has
 *   blocksPinBump === true.
 * - Prefer Hasura GraphQL for reads already covered; only invent new REST
 *   targets after #849 merge-spec is known (targetHint stays TBD until then).
 * - Matrix is informational + gate input for canary/contract; it does not
 *   change runtime routing by itself.
 *
 * @see https://github.com/citrineos/citrineos-core/pull/849
 * @see ./citrineosContract.mjs CITRINEOS_UPSTREAM_OPEN id 849
 */

import { CITRINEOS_INTEGRATION_VERSION } from './citrineosContract.mjs';

export const CITRINEOS_DATA_API_LEGACY_PREFIX = '/data/';

/**
 * @typedef {'hard_break' | 'fallback_ready' | 'unused_or_low' | 'migrated'} DataApiRouteStatus
 *
 * @typedef {{
 *   kind: 'hasura' | 'webhook' | 'none' | 'backend_proxy' | 'mixed';
 *   detail: string;
 *   coversLivePoll?: boolean;
 * }} DataApiFallback
 *
 * @typedef {{
 *   id: string;
 *   legacyPath: string;
 *   method: 'GET' | 'POST' | 'PUT' | 'DELETE';
 *   purpose: string;
 *   callSites: string[];
 *   fallback: DataApiFallback;
 *   targetHint: string;
 *   status: DataApiRouteStatus;
 *   blocksPinBump: boolean;
 *   notes?: string;
 * }} DataApiMigrationRoute
 */

/** @type {DataApiMigrationRoute[]} */
const ROUTES = [
  {
    id: 'getTransaction',
    legacyPath: '/data/transactions/transactionType',
    method: 'GET',
    purpose: 'Live kWh/cost during session (REST poll by stationId + transactionId)',
    callSites: [
      'server/services/citrineosServer.mjs#fetchTransactionFromRestApi',
      'src/api/citrineos/paths.ts#transactions.getTransaction',
      'src/api/citrineos/data.ts#getTransaction',
      'server/contracts/citrineosContract.mjs#endpoints.getTransaction',
    ],
    fallback: {
      kind: 'mixed',
      detail:
        'Hasura Transactions by remoteStartId / isActive (server + client hasura.ts) + inbound webhooks cover most live session state; REST path still used when citrineosTransactionId is known and Hasura miss',
      coversLivePoll: false,
    },
    targetHint:
      'TBD after #849 merge-spec — likely Hasura-only reads and/or new Commands/Api transaction route (no /data prefix)',
    status: 'hard_break',
    blocksPinBump: true,
    notes:
      'normalizeTransactionRow already dual-accepts REST + Hasura shapes via canary; cutover must remove citrineosDataGet(/data/transactions/...)',
  },
  {
    id: 'getTariffs',
    legacyPath: '/data/transactions/tariff',
    method: 'GET',
    purpose: 'Tariff catalog for pricing UI / station sync',
    callSites: [
      'server/routes/citrineos.mjs#GET /api/citrineos/tariffs',
      'src/api/citrineos/paths.ts#transactions.getTariffs',
      'src/api/citrineos/data.ts#getTariffs',
      'src/services/citrineosSync.ts (getTariffs)',
      'server/contracts/citrineosContract.mjs#endpoints.getTariffs',
    ],
    fallback: {
      kind: 'hasura',
      detail:
        'Hasura ChargingStations → Evses → Connectors → Tariff embeds pricePerKwh/Min/Session; backend-mode client already uses /api/citrineos/tariffs proxy which still hits legacy REST',
      coversLivePoll: false,
    },
    targetHint:
      'Primary: Hasura embedded Tariff only; optional new REST tariff list once #849 Api module path is known. Drop direct /data/transactions/tariff',
    status: 'hard_break',
    blocksPinBump: true,
    notes:
      'Backend proxy is not a real fallback — it still forwards to /data/transactions/tariff on 1.8.4',
  },
  {
    id: 'getBootConfig',
    legacyPath: '/data/configuration/bootConfig',
    method: 'GET',
    purpose: 'Boot/configuration read (client path constant; low runtime use)',
    callSites: [
      'src/api/citrineos/paths.ts#configuration.getBoot',
    ],
    fallback: {
      kind: 'none',
      detail: 'No production hot path identified; path exported for completeness / future admin tools',
      coversLivePoll: false,
    },
    targetHint: 'Drop or replace with post-#849 configuration Api module path if still needed',
    status: 'unused_or_low',
    blocksPinBump: false,
    notes: 'Still remove from paths.ts on cutover so no accidental direct Data-API use remains',
  },
];

/**
 * Frozen migration document consumed by contract + canary stats.
 * @type {{
 *   upstreamPr: number;
 *   upstreamUrl: string;
 *   pin: string;
 *   legacyPrefix: string;
 *   title: string;
 *   risk: string;
 *   routes: DataApiMigrationRoute[];
 *   cutoverChecklist: string[];
 * }}
 */
export const CITRINEOS_DATA_API_MIGRATION = Object.freeze({
  upstreamPr: 849,
  upstreamUrl: 'https://github.com/citrineos/citrineos-core/pull/849',
  pin: CITRINEOS_INTEGRATION_VERSION,
  legacyPrefix: CITRINEOS_DATA_API_LEGACY_PREFIX,
  title: 'Drop CitrineOS Data API (/data/**)',
  risk:
    'Removes /data/** prefix (decorator Data API → explicit Api module). BC REST getTransaction + getTariffs hard-break on v2 cutover without path migration or Hasura-only reads.',
  routes: ROUTES,
  cutoverChecklist: Object.freeze([
    'Wait for #849 merge-spec (replacement Api module paths) OR commit to Hasura-only reads',
    'Replace fetchTransactionFromRestApi + GET /api/citrineos/tariffs legacy URLs',
    'Update src/api/citrineos/paths.ts transactions/configuration entries',
    'Update citrineosContract.mjs endpoints getTransaction/getTariffs paths',
    'Extend canary schemas if response envelopes change',
    'Staging CANARY_FORCE=1 soak + hardware smoke (Elinta + go-e)',
    'Only then allow evaluatePinBumpReadiness / version pin bump off 1.8.4',
  ]),
});

/**
 * @param {string} id
 * @returns {DataApiMigrationRoute | undefined}
 */
export function getDataApiMigrationEntry(id) {
  return CITRINEOS_DATA_API_MIGRATION.routes.find((r) => r.id === id);
}

/** @returns {string[]} */
export function listDataApiCallSites() {
  return CITRINEOS_DATA_API_MIGRATION.routes.flatMap((r) => r.callSites);
}

/**
 * Gate input: ready only when no route blocks pin bump (all migrated or non-blocking).
 * Independent of live canary samples — structural readiness only.
 */
export function evaluateDataApiMigrationReadiness() {
  const blocking = CITRINEOS_DATA_API_MIGRATION.routes.filter((r) => r.blocksPinBump);
  /** @type {string[]} */
  const blockers = [];
  if (blocking.length > 0) {
    blockers.push(`DATA_API_#849_OPEN(${blocking.map((r) => r.id).join(',')})`);
  }
  for (const r of blocking) {
    blockers.push(`ROUTE_BLOCKS:${r.id}`);
  }

  return {
    ready: blockers.length === 0,
    blockers,
    upstreamPr: CITRINEOS_DATA_API_MIGRATION.upstreamPr,
    upstreamUrl: CITRINEOS_DATA_API_MIGRATION.upstreamUrl,
    legacyPrefix: CITRINEOS_DATA_API_LEGACY_PREFIX,
    pin: CITRINEOS_DATA_API_MIGRATION.pin,
    blockingRouteIds: blocking.map((r) => r.id),
    guidance:
      blockers.length === 0
        ? 'Data-API migration matrix clear — still require staging CANARY_FORCE soak before pin bump.'
        : 'Do not bump CITRINEOS_INTEGRATION_VERSION off 1.8.4 while #849 /data/** routes still block (see CITRINEOS_DATA_API_MIGRATION).',
  };
}

export function summarizeDataApiMigration() {
  /** @type {Record<string, number>} */
  const byStatus = {};
  for (const r of CITRINEOS_DATA_API_MIGRATION.routes) {
    byStatus[r.status] = (byStatus[r.status] ?? 0) + 1;
  }
  const blockingIds = CITRINEOS_DATA_API_MIGRATION.routes
    .filter((r) => r.blocksPinBump)
    .map((r) => r.id);
  return {
    total: CITRINEOS_DATA_API_MIGRATION.routes.length,
    blocking: blockingIds.length,
    blockingIds,
    byStatus,
    upstreamPr: CITRINEOS_DATA_API_MIGRATION.upstreamPr,
    pin: CITRINEOS_DATA_API_MIGRATION.pin,
  };
}

export default {
  CITRINEOS_DATA_API_MIGRATION,
  CITRINEOS_DATA_API_LEGACY_PREFIX,
  getDataApiMigrationEntry,
  listDataApiCallSites,
  evaluateDataApiMigrationReadiness,
  summarizeDataApiMigration,
};
