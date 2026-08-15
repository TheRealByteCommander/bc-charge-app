/**
 * CitrineOS REST paths.
 *
 * Pin 1.8.4 Message-API: /ocpp/{version}/{module}/{callAction}
 * Pin 1.8.4 Data-API:    /data/{module}/{namespace}
 *
 * Upstream PR #849 drops `/data/**` and maps surviving ops to `/commands/*`:
 *   transactionType|transaction → /commands/transaction
 *   tariff                      → /commands/tariff
 *   bootConfig                  → /commands/bootConfig
 *
 * Runtime dual-fetch prefers `legacy` first (safe on 1.8.4), then `commands`.
 * Override via env on the server (`CITRINEOS_REST_SURFACE`) or by importing
 * `resolveClientDataApiPath` with an explicit surface.
 *
 * @see server/utils/citrineosDataApiPaths.mjs
 * @see server/contracts/citrineosDataApiMigration.mjs
 * @see https://github.com/citrineos/citrineos-core/pull/849
 */

export type CitrineosRestSurface = 'legacy' | 'commands' | 'auto';

type DataApiPathPair = {
  legacy: string;
  legacyAlt?: string;
  commands: string;
};

export const citrineosDataApiPathMap: Record<string, DataApiPathPair> & {
  getTransaction: DataApiPathPair;
  getTariffs: DataApiPathPair;
  getBoot: DataApiPathPair;
} = {
  getTransaction: {
    legacy: '/data/transactions/transactionType',
    legacyAlt: '/data/transactions/transaction',
    commands: '/commands/transaction',
  },
  getTariffs: {
    legacy: '/data/transactions/tariff',
    commands: '/commands/tariff',
  },
  getBoot: {
    legacy: '/data/configuration/bootConfig',
    commands: '/commands/bootConfig',
  },
};

export type CitrineosDataApiPathId = 'getTransaction' | 'getTariffs' | 'getBoot';

/** Ordered candidates for dual-fetch (legacy → commands in auto mode). */
export function resolveClientDataApiPaths(
  id: CitrineosDataApiPathId,
  surface: CitrineosRestSurface = 'auto'
): string[] {
  const pair = citrineosDataApiPathMap[id];
  const legacy: string[] = [pair.legacy];
  if (pair.legacyAlt && pair.legacyAlt !== pair.legacy) {
    legacy.push(pair.legacyAlt);
  }
  if (surface === 'legacy') return legacy;
  if (surface === 'commands') return [pair.commands];
  return [...legacy, pair.commands];
}

export function resolveClientDataApiPath(
  id: CitrineosDataApiPathId,
  surface: CitrineosRestSurface = 'auto'
): string {
  return resolveClientDataApiPaths(id, surface)[0]!;
}

/**
 * Static path table for docs + default (legacy-first) call sites.
 * Prefer `resolveClientDataApiPaths` + dual-fetch for live reads that must
 * survive the #849 cutover without a pin bump.
 */
export const citrineosPaths = {
  health: '/health',
  evdriver: {
    requestStartTransaction: '/ocpp/2.0.1/evdriver/requestStartTransaction',
    requestStopTransaction: '/ocpp/2.0.1/evdriver/requestStopTransaction',
  },
  ocpp16: {
    remoteStartTransaction: '/ocpp/1.6/evdriver/remoteStartTransaction',
    remoteStopTransaction: '/ocpp/1.6/evdriver/remoteStopTransaction',
  },
  /** Commands surface after #849 (explicit; dual-fetch uses path map). */
  commands: {
    transaction: citrineosDataApiPathMap.getTransaction.commands,
    tariff: citrineosDataApiPathMap.getTariffs.commands,
    bootConfig: citrineosDataApiPathMap.getBoot.commands,
  },
  transactions: {
    getTransaction: citrineosDataApiPathMap.getTransaction.legacy,
    getTariffs: citrineosDataApiPathMap.getTariffs.legacy,
    getTransactionStatus: '/ocpp/2.0.1/transactions/getTransactionStatus',
  },
  configuration: {
    getBoot: citrineosDataApiPathMap.getBoot.legacy,
  },
} as const;
