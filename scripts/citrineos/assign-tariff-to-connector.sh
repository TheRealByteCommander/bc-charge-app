#!/bin/bash
# ============================================================================
# BC Charge - Tarif einem Connector zuweisen
# ============================================================================
# Verwendung: ./assign-tariff-to-connector.sh <TARIFF_ID> <CONNECTOR_DATABASE_ID>
# ============================================================================

set -e

TARIFF_ID="${1:-}"
CONNECTOR_DB_ID="${2:-}"

if [ -z "$TARIFF_ID" ] || [ -z "$CONNECTOR_DB_ID" ]; then
  echo "Verwendung: $0 <TARIFF_ID> <CONNECTOR_DATABASE_ID>"
  echo ""
  echo "Beispiel: $0 1 5"
  echo ""
  echo "Connector-IDs findest du mit: ./list-connectors.sh"
  exit 1
fi

# Konfiguration
HASURA_URL="${CITRINEOS_HASURA_URL:-http://127.0.0.1:8090/v1/graphql}"
HASURA_ADMIN_SECRET="${CITRINEOS_HASURA_ADMIN_SECRET:-}"

echo "============================================"
echo "Tarif $TARIFF_ID → Connector $CONNECTOR_DB_ID zuweisen"
echo "============================================"

# GraphQL Mutation
MUTATION=$(cat <<EOF
mutation AssignTariff {
  update_Connector_by_pk(
    pk_columns: { databaseId: $CONNECTOR_DB_ID },
    _set: { tariffId: $TARIFF_ID }
  ) {
    databaseId
    connectorId
    tariffId
    evse {
      evseId
      chargingStation {
        id
      }
    }
  }
}
EOF
)

RESPONSE=$(curl -s -X POST "$HASURA_URL" \
  -H "Content-Type: application/json" \
  ${HASURA_ADMIN_SECRET:+-H "x-hasura-admin-secret: $HASURA_ADMIN_SECRET"} \
  -d "{\"query\": \"$(echo "$MUTATION" | tr '\n' ' ' | sed 's/"/\\"/g')\"}")

echo "Antwort:"
echo "$RESPONSE" | python3 -m json.tool 2>/dev/null || echo "$RESPONSE"

if echo "$RESPONSE" | grep -q '"tariffId"'; then
  echo ""
  echo "✅ Tarif erfolgreich zugewiesen!"
else
  echo ""
  echo "❌ Fehler bei der Zuweisung"
  exit 1
fi
