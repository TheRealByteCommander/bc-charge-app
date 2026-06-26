/** Integrationsvertrag CitrineOS ↔ bc-charge-app (v1.8.4) */

export const CITRINEOS_INTEGRATION_VERSION = '1.8.4';

export const citrineosIntegrationContract = {
  version: CITRINEOS_INTEGRATION_VERSION,
  operator: {
    brand: 'BC Charge',
    company: 'Byte Commander GmbH',
    website: 'https://bc-charge.com',
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
  ],
  bcApiProxyRoutes: [
    { method: 'GET', path: '/api/citrineos/health' },
    { method: 'GET', path: '/api/citrineos/status' },
    { method: 'GET', path: '/api/citrineos/contract' },
    { method: 'GET', path: '/api/citrineos/tariffs' },
    { method: 'POST', path: '/api/citrineos/hasura' },
    { method: 'POST', path: '/api/citrineos/proxy' },
  ],
  connectorIdFormat: 'evse-{evseId}-conn-{connectorId}',
  deploymentRepo: 'https://github.com/TheRealByteCommander/bc-citrineos',
};
