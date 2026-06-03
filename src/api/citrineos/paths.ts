/**
 * CitrineOS REST-Pfade (OpenAPI v1.8.4 / Fastify).
 * Message-API: /ocpp/2.0.1/{module}/{callAction}
 * Data-API:    /data/{module}/{namespace}
 */
export const citrineosPaths = {
  health: '/health',
  evdriver: {
    requestStartTransaction: '/ocpp/2.0.1/evdriver/requestStartTransaction',
    requestStopTransaction: '/ocpp/2.0.1/evdriver/requestStopTransaction',
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
