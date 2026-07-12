#!/usr/bin/env node
/**
 * Listet EVSEs/Connectors pro CitrineOS-Station (Hasura).
 * cd /opt/bc-charge && node scripts/admin/list-hasura-connectors.mjs [ocppConnectionName]
 */
const HASURA_URL = (process.env.CITRINEOS_HASURA_URL ?? 'http://127.0.0.1:8090/v1/graphql').replace(
  /\/$/,
  ''
);
const TENANT_ID = Number(process.env.CITRINEOS_TENANT_ID ?? 1);
const filterName = process.argv[2]?.trim();

const QUERY = `
  query BcListStationConnectors($tenantId: Int!) {
    ChargingStations(where: { tenantId: { _eq: $tenantId } }, order_by: { id: asc }) {
      id
      ocppConnectionName
      chargePointVendor
      chargePointModel
      isOnline
      Location { name city }
      Evses(order_by: { evseId: asc }) {
        evseId
        Connectors(order_by: { connectorId: asc }) {
          connectorId
          type
          status
          maximumPowerWatts
        }
      }
    }
  }
`;

const headers = { 'Content-Type': 'application/json' };
if (process.env.CITRINEOS_HASURA_ADMIN_SECRET) {
  headers['x-hasura-admin-secret'] = process.env.CITRINEOS_HASURA_ADMIN_SECRET;
}

const res = await fetch(HASURA_URL, {
  method: 'POST',
  headers,
  body: JSON.stringify({ query: QUERY, variables: { tenantId: TENANT_ID } }),
});
const json = await res.json();
if (!res.ok || json.errors?.length) {
  console.error('Hasura-Fehler:', json.errors ?? res.status);
  process.exit(1);
}

let stations = json.data?.ChargingStations ?? [];
if (filterName) {
  stations = stations.filter(
    (s) =>
      s.ocppConnectionName === filterName ||
      String(s.id) === filterName ||
      s.Location?.name?.toLowerCase().includes(filterName.toLowerCase())
  );
}

if (stations.length === 0) {
  console.log(filterName ? `Keine Station für „${filterName}“` : 'Keine Stationen');
  process.exit(0);
}

for (const s of stations) {
  const loc = s.Location;
  const label = loc?.name ? `${loc.name}${loc.city ? `, ${loc.city}` : ''}` : s.ocppConnectionName;
  const vendor = [s.chargePointVendor, s.chargePointModel].filter(Boolean).join(' / ') || '—';
  let connCount = 0;
  for (const evse of s.Evses ?? []) {
    connCount += evse.Connectors?.length ?? 0;
  }
  console.log(`\n── ${label} ──`);
  console.log(`  DB-ID: ${s.id} · OCPP: ${s.ocppConnectionName} · ${vendor} · online=${s.isOnline}`);
  console.log(`  Connectors in Hasura: ${connCount}`);
  for (const evse of s.Evses ?? []) {
    for (const c of evse.Connectors ?? []) {
      const kw = c.maximumPowerWatts ? Math.round(c.maximumPowerWatts / 1000) : '?';
      console.log(
        `    EVSE ${evse.evseId} / Connector ${c.connectorId}: ${c.type ?? '?'} · ${kw} kW · ${c.status ?? '?'}`
      );
    }
  }
  const isGoe = /go-?e|homeplus/i.test(vendor);
  if (isGoe && connCount > 1) {
    console.log('  ⚠ go-e mit >1 Connector – EVSE 2 in Hasura/Operator UI löschen oder seed-h2 nicht verwendet');
  }
}
