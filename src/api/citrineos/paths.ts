/**
 * CitrineOS REST-Pfade (OpenAPI v1.8.4 / Fastify).
 * Message-API: /ocpp/2.0.1/{module}/{callAction}
 * Data-API:    /data/{module}/{namespace}
 *
 * WARNING: Upstream PR #849 drops `/data/**` entirely. Do not bump the CitrineOS
 * pin toward v2 until server/contracts/citrineosDataApiMigration.mjs is clear.
 * Call sites: getTransaction, getTariffs, getBoot (see matrix).
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
  transactions: {
    getTransaction: '/data/transactions/transactionType',
    getTariffs: '/data/transactions/tariff',
    getTransactionStatus: '/ocpp/2.0.1/transactions/getTransactionStatus',
  },
  configuration: {
    getBoot: '/data/configuration/bootConfig',
  },
} as const;
