#!/bin/bash
# ============================================================================
# BC Charge - Alle Connectors auflisten
# ============================================================================

set -e

HASURA_URL="${CITRINEOS_HASURA_URL:-http://127.0.0.1:8090/v1/graphql}"
HASURA_ADMIN_SECRET="${CITRINEOS_HASURA_ADMIN_SECRET:-}"
TENANT_ID="${CITRINEOS_TENANT_ID:-1}"

echo "============================================"
echo "CitrineOS Connectors (Tenant $TENANT_ID)"
echo "============================================"

QUERY=$(cat <<EOF
query ListConnectors {
  Connector(where: { evse: { chargingStation: { tenantId: { _eq: $TENANT_ID } } } }) {
    databaseId
    connectorId
    status
    type
    maximumPowerWatts
    tariffId
    tariff {
      id
      pricePerKwh
      currency
    }
    evse {
      evseId
      chargingStation {
        id
        isOnline
        location {
          name
          address
        }
      }
    }
  }
}
EOF
)

RESPONSE=$(curl -s -X POST "$HASURA_URL" \
  -H "Content-Type: application/json" \
  ${HASURA_ADMIN_SECRET:+-H "x-hasura-admin-secret: $HASURA_ADMIN_SECRET"} \
  -d "{\"query\": \"$(echo "$QUERY" | tr '\n' ' ' | sed 's/"/\\"/g')\"}")

echo "$RESPONSE" | python3 -m json.tool 2>/dev/null || echo "$RESPONSE"
