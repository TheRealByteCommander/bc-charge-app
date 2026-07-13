#!/bin/bash
# ============================================================================
# BC Charge – Elinta H2: EVSEs + Connectors per Hasura anlegen
#
# Legt zwei Type-2-AC-Anschlüsse (IEC62196T2) für eine H2-Ladesäule an.
# OCPP kennt keinen Wert „Type2“ – der korrekte Enum ist IEC62196T2.
#
# Nutzung:
#   ./seed-h2-connectors.sh <STATION_DATABASE_ID> [TARIFF_ID]
#
# Beispiel:
#   ./seed-h2-connectors.sh 3 1
# ============================================================================

set -euo pipefail

STATION_ID="${1:-}"
TARIFF_ID="${2:-}"

HASURA_URL="${CITRINEOS_HASURA_URL:-http://127.0.0.1:8090/v1/graphql}"
HASURA_ADMIN_SECRET="${CITRINEOS_HASURA_ADMIN_SECRET:-}"
TENANT_ID="${CITRINEOS_TENANT_ID:-1}"

if [[ -z "$STATION_ID" ]]; then
  echo "Usage: $0 <STATION_DATABASE_ID> [TARIFF_ID]" >&2
  exit 1
fi

graphql_post() {
  local payload="$1"
  curl -s -X POST "$HASURA_URL" \
    -H "Content-Type: application/json" \
    ${HASURA_ADMIN_SECRET:+-H "x-hasura-admin-secret: $HASURA_ADMIN_SECRET"} \
    -d "$payload"
}

echo "============================================"
echo "H2 Connectors für Station $STATION_ID (Tenant $TENANT_ID)"
echo "============================================"

STATION_JSON=$(graphql_post "{\"query\":\"query { ChargingStations_by_pk(id: $STATION_ID) { id ocppConnectionName chargePointModel chargePointVendor tenantId } }\"}")

OCPP_NAME=$(echo "$STATION_JSON" | python3 -c "
import json, sys
d = json.load(sys.stdin)
if d.get('errors'):
    print('Fehler:', d['errors'], file=sys.stderr)
    sys.exit(1)
row = d.get('data', {}).get('ChargingStations_by_pk')
if not row:
    print('Station nicht gefunden (id=$STATION_ID)', file=sys.stderr)
    sys.exit(1)
print(row['ocppConnectionName'])
")

VENDOR_MODEL=$(echo "$STATION_JSON" | python3 -c "
import json, sys
d = json.load(sys.stdin)
row = d.get('data', {}).get('ChargingStations_by_pk') or {}
vendor = (row.get('chargePointVendor') or '').lower()
model = (row.get('chargePointModel') or '').lower()
print(vendor, model)
")

VENDOR_LOWER=$(echo "$VENDOR_MODEL" | awk '{print $1}')
MODEL_LOWER=$(echo "$VENDOR_MODEL" | awk '{print $2}')

if echo "$VENDOR_LOWER $MODEL_LOWER" | grep -qiE 'go-e|goe|go_e|homeplus'; then
  echo "FEHLER: Station $STATION_ID ($OCPP_NAME) ist go-e – kein H2-Doppelanschluss." >&2
  echo "  seed-h2-connectors.sh nur für Elinta CityCharge H2 verwenden." >&2
  exit 1
fi

if ! echo "$MODEL_LOWER" | grep -qiE 'h2|citycharge'; then
  echo "WARNUNG: chargePointModel enthält weder H2 noch CityCharge ($MODEL_LOWER)." >&2
  read -r -p "Trotzdem fortfahren? [y/N] " CONFIRM
  [[ "${CONFIRM,,}" == "y" ]] || exit 1
fi

echo "Ladesäule: $OCPP_NAME"

for EVSE_NUM in 1 2; do
  echo ""
  echo "→ EVSE $EVSE_NUM …"

  EXISTING_EVSE=$(graphql_post "{\"query\":\"query { Evses(where: { stationId: { _eq: $STATION_ID }, evseId: { _eq: $EVSE_NUM } }, limit: 1) { id evseId } }\"}")
  EVSE_DB_ID=$(echo "$EXISTING_EVSE" | python3 -c "
import json, sys
rows = json.load(sys.stdin).get('data', {}).get('Evses', [])
print(rows[0]['id'] if rows else '')
")

  if [[ -z "$EVSE_DB_ID" ]]; then
    EVSE_JSON=$(graphql_post "{\"query\":\"mutation { insert_Evses_one(object: { stationId: $STATION_ID, evseId: $EVSE_NUM, evseTypeId: $EVSE_NUM, tenantId: $TENANT_ID, ocppConnectionName: \\\"$OCPP_NAME\\\", physicalReference: \\\"H2-$EVSE_NUM\\\" }) { id evseId } }\"}")
    EVSE_DB_ID=$(echo "$EVSE_JSON" | python3 -c "
import json, sys
d = json.load(sys.stdin)
if d.get('errors'):
    print('EVSE-Fehler:', json.dumps(d['errors']), file=sys.stderr)
    sys.exit(1)
print(d['data']['insert_Evses_one']['id'])
")
    echo "  EVSE angelegt (id=$EVSE_DB_ID)"
  else
    echo "  EVSE existiert bereits (id=$EVSE_DB_ID)"
  fi

  EXISTING_CONN=$(graphql_post "{\"query\":\"query { Connectors(where: { evseId: { _eq: $EVSE_DB_ID }, connectorId: { _eq: $EVSE_NUM } }, limit: 1) { id type } }\"}")
  EXISTING_CONN_ID=$(echo "$EXISTING_CONN" | python3 -c "
import json, sys
rows = json.load(sys.stdin).get('data', {}).get('Connectors', [])
print(rows[0]['id'] if rows else '')
")

  if [[ -n "$EXISTING_CONN_ID" ]]; then
    echo "  Connector $EVSE_NUM existiert bereits (id=$EXISTING_CONN_ID) – übersprungen"
    continue
  fi

  TARIFF_JSON=""
  if [[ -n "$TARIFF_ID" ]]; then
    TARIFF_JSON=", tariffId: $TARIFF_ID"
  fi

  CONN_JSON=$(graphql_post "{\"query\":\"mutation { insert_Connectors_one(object: { stationId: $STATION_ID, evseId: $EVSE_DB_ID, connectorId: $EVSE_NUM, evseTypeConnectorId: 1, tenantId: $TENANT_ID, ocppConnectionName: \\\"$OCPP_NAME\\\", type: IEC62196T2, format: SOCKET, powerType: AC_3_PHASE, maximumAmperage: 32, maximumVoltage: 400, maximumPowerWatts: 22000, status: Available$TARIFF_JSON }) { id connectorId type powerType maximumPowerWatts tariffId } }\"}")

  echo "$CONN_JSON" | python3 -m json.tool
done

echo ""
echo "✅ Fertig."
echo "   OCPP/CitrineOS-Typ: IEC62196T2 (= Type 2 AC, 22 kW)"
echo "   In der BC-Charge-App erscheint das als „Type2“."
