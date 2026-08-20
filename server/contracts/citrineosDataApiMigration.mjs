/**
 * CitrineOS PR #849 — drop Data API (`/data/**`) migration matrix.
 *
 * Purpose: single source of truth for every BC call site that hit the legacy
 * Fastify Data-API prefix on pin 1.8.4. Upstream merge-spec maps survivors to
 * `/commands/*`. Runtime dual-fetch (legacy → commands) is wired so both
 * surfaces work; pin stays 1.8.4 until staging soak.
 *
 * Rules:
 * - Do NOT bump CITRINEOS_INTEGRATION_VERSION toward v2 until staging
 *   CANARY_FORCE soak + hardware smoke, even when matrix routes are dual-path.
 * - Prefer Hasura GraphQL for reads already covered; dual REST is the cutover bridge.
 * - Matrix feeds canary/contract pinBump structural gate.
 *
 * @see https://github.com/citrineos/citrineos-core/pull/849
 * @see ./citrineosContract.mjs CITRINEOS_UPSTREAM_MERGED_NEXT id 849
 * @see ../utils/citrineosDataApiPaths.mjs
 */

import { CITRINEOS_INTEGRATION_VERSION } from './citrineosContract.mjs';
import { CITRINEOS_DATA_API_PATHS } from '../utils/citrineosDataApiPaths.mjs';

export const CITRINEOS_DATA_API_LEGACY_PREFIX = '/data/';
export const CITRINEOS_COMMANDS_PREFIX = '/commands/';

/**
 * @typedef {'hard_break' | 'fallback_ready' | 'unused_or_low' | 'migrated' | 'dual_path'} DataApiRouteStatus
 *
 * @typedef {{
 *   kind: 'hasura' | 'webhook' | 'none' | 'backend_proxy' | 'mixed' | 'commands_dual';
 *   detail: string;
 *   coversLivePoll?: boolean;
 * }} DataApiFallback
 *
 * @typedef {{
 *   id: string;
 *   legacyPath: string;
 *   commandsPath: string;
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
    legacyPath: CITRINEOS_DATA_API_PATHS.getTransaction.legacy,
    commandsPath: CITRINEOS_DATA_API_PATHS.getTransaction.commands,
    method: 'GET',
    purpose: 'Live kWh/cost during session (REST poll by stationId + transactionId)',
    callSites: [
      'server/services/citrineosServer.mjs#fetchTransactionFromRestApi',
      'server/utils/citrineosDataApiPaths.mjs#getTransaction',
      'src/api/citrineos/paths.ts#getTransaction',
      'src/api/citrineos/data.ts#getTransaction',
      'server/contracts/citrineosContract.mjs#endpoints.getTransaction',
    ],
    fallback: {
      kind: 'commands_dual',
      detail:
        'Runtime dual-fetch: legacy /data/transactions/transactionType (+ alt /transaction) → /commands/transaction; Hasura + webhooks still cover most live session state',
      coversLivePoll: true,
    },
    targetHint: '/commands/transaction (PR #849 merge-spec)',
    status: 'dual_path',
    // Dual-path unblocks structural cutover of REST paths; pin bump still needs soak.
    blocksPinBump: false,
    notes:
      'CITRINEOS_REST_SURFACE=auto|legacy|commands. normalizeTransactionRow dual-accepts REST + Hasura shapes.',
  },
  {
    id: 'getTariffs',
    legacyPath: CITRINEOS_DATA_API_PATHS.getTariffs.legacy,
    commandsPath: CITRINEOS_DATA_API_PATHS.getTariffs.commands,
    method: 'GET',
    purpose: 'Tariff catalog for pricing UI / station sync',
    callSites: [
      'server/routes/citrineos.mjs#GET /api/citrineos/tariffs',
      'server/utils/citrineosDataApiPaths.mjs#getTariffs',
      'src/api/citrineos/paths.ts#getTariffs',
      'src/api/citrineos/data.ts#getTariffs',
      'src/services/citrineosSync.ts (getTariffs)',
      'server/contracts/citrineosContract.mjs#endpoints.getTariffs',
    ],
    fallback: {
      kind: 'commands_dual',
      detail:
        'Server proxy dual-fetches legacy /data/transactions/tariff → /commands/tariff; Hasura embedded Tariff remains secondary source',
      coversLivePoll: false,
    },
    targetHint: '/commands/tariff (PR #849 merge-spec)',
    status: 'dual_path',
    blocksPinBump: false,
    notes: 'Backend-mode client uses /api/citrineos/tariffs which already dual-fetches.',
  },
  {
    id: 'getBootConfig',
    legacyPath: CITRINEOS_DATA_API_PATHS.getBootConfig.legacy,
    commandsPath: CITRINEOS_DATA_API_PATHS.getBootConfig.commands,
    method: 'GET',
    purpose: 'Boot/configuration read (client path constant; low runtime use)',
    callSites: [
      'src/api/citrineos/paths.ts#configuration.getBoot',
      'server/utils/citrineosDataApiPaths.mjs#getBootConfig',
    ],
    fallback: {
      kind: 'commands_dual',
      detail: 'Path map includes /commands/bootConfig; no production hot path identified',
      coversLivePoll: false,
    },
    targetHint: '/commands/bootConfig (PR #849 merge-spec)',
    status: 'dual_path',
    blocksPinBump: false,
    notes: 'Still prefer resolveClientDataApiPaths for any new boot reads.',
  },
];

/**
 * Frozen migration document consumed by contract + canary stats.
 * @type {{
 *   upstreamPr: number;
 *   upstreamUrl: string;
 *   pin: string;
 *   legacyPrefix: string;
 *   commandsPrefix: string;
 *   title: string;
 *   risk: string;
 *   mergeSpecStatus: string;
 *   routes: DataApiMigrationRoute[];
 *   cutoverChecklist: string[];
 * }}
 */
export const CITRINEOS_DATA_API_MIGRATION = Object.freeze({
  upstreamPr: 849,
  upstreamUrl: 'https://github.com/citrineos/citrineos-core/pull/849',
  pin: CITRINEOS_INTEGRATION_VERSION,
  legacyPrefix: CITRINEOS_DATA_API_LEGACY_PREFIX,
  commandsPrefix: CITRINEOS_COMMANDS_PREFIX,
  title: 'Drop CitrineOS Data API (/data/**) — dual-path to /commands/*',
  risk:
    'Removes /data/** prefix. BC dual-fetches legacy + /commands/transaction|/tariff|/bootConfig per #849 merge-spec. Pin stays 1.8.4 until staging soak; #849 merged→next 2026-08-18 (not in beta3 tag).',
  mergeSpecStatus:
    'Mapped 2026-08-15 from PR body: transaction→/commands/transaction, tariff→/commands/tariff, bootConfig→/commands/bootConfig; #849 merged to next 2026-08-18',
  routes: ROUTES,
  cutoverChecklist: Object.freeze([
    'DONE: dual-fetch getTransaction + getTariffs (legacy → /commands/*)',
    'DONE: path map + CITRINEOS_REST_SURFACE override',
    'DONE: update paths.ts / contract endpoints with commands targets',
    'DONE upstream: #849 merged → next 2026-08-18 (still no release tag after beta3)',
    'Wait for staging/prod Citrine build that actually carries #849 (tag or next pin)',
    'Staging CANARY_FORCE=1 soak against dual-path (expect commands 404 on pure 1.8.4 — legacy must win)',
    'When staging runs post-#849 Citrine: CITRINEOS_REST_SURFACE=commands soak + hardware smoke (Elinta + go-e)',
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
 * Structural readiness of the #849 path migration (not full pin-bump readiness).
 * Dual-path routes no longer block; soak/hardware remain separate canary gates.
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
    commandsPrefix: CITRINEOS_COMMANDS_PREFIX,
    pin: CITRINEOS_DATA_API_MIGRATION.pin,
    blockingRouteIds: blocking.map((r) => r.id),
    dualPathRouteIds: CITRINEOS_DATA_API_MIGRATION.routes
      .filter((r) => r.status === 'dual_path' || r.status === 'migrated')
      .map((r) => r.id),
    guidance:
      blockers.length === 0
        ? 'Data-API dual-path matrix clear — still require staging CANARY_FORCE soak + hardware smoke before pin bump; #849 merged to upstream next (2026-08-18) but not in beta3 tag — trial CITRINEOS_REST_SURFACE=commands only after staging Citrine carries #849.'
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
    commandsPrefix: CITRINEOS_COMMANDS_PREFIX,
  };
}

export default {
  CITRINEOS_DATA_API_MIGRATION,
  CITRINEOS_DATA_API_LEGACY_PREFIX,
  CITRINEOS_COMMANDS_PREFIX,
  getDataApiMigrationEntry,
  listDataApiCallSites,
  evaluateDataApiMigrationReadiness,
  summarizeDataApiMigration,
};
