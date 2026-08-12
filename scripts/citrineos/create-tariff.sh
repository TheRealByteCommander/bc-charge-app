#!/bin/bash
# ============================================================================
# BC Charge - CitrineOS Tarif erstellen
# ============================================================================
# Tarif: 0,45€/kWh, keine Startgebühr, pricePerMin=0 (Legacy-Anzeige; Abrechnung → /api/pricing)
# ============================================================================

set -e

# Konfiguration
HASURA_URL="${CITRINEOS_HASURA_URL:-http://127.0.0.1:8090/v1/graphql}"
HASURA_ADMIN_SECRET="${CITRINEOS_HASURA_ADMIN_SECRET:-}"
TENANT_ID="${CITRINEOS_TENANT_ID:-1}"

# Tarif-Daten
PRICE_PER_KWH="0.45"
PRICE_PER_MIN="0"          # Legacy CitrineOS-Anzeige; Idle-Abrechnung auf App Server
PRICE_PER_SESSION="0"      # Keine Startgebühr
CURRENCY="EUR"
TAX_RATE="0.19"            # 19% MwSt (optional anpassen)

echo "============================================"
echo "CitrineOS Tarif erstellen"
echo "============================================"
echo "Hasura URL: $HASURA_URL"
echo "Tenant ID:  $TENANT_ID"
echo ""
echo "Tarif-Details:"
echo "  - Preis/kWh:     ${PRICE_PER_KWH} ${CURRENCY}"
echo "  - Startgebühr:   ${PRICE_PER_SESSION} ${CURRENCY}"
echo "  - pricePerMin (Legacy): ${PRICE_PER_MIN} ${CURRENCY}"
echo "  - MwSt:          $(echo "$TAX_RATE * 100" | bc)%"
echo "============================================"
echo ""

# GraphQL Mutation
MUTATION=$(cat <<EOF
mutation CreateTariff {
  insert_Tariff_one(object: {
    tenantId: $TENANT_ID,
    currency: "$CURRENCY",
    pricePerKwh: $PRICE_PER_KWH,
    pricePerMin: $PRICE_PER_MIN,
    pricePerSession: $PRICE_PER_SESSION,
    taxRate: $TAX_RATE
  }) {
    id
    currency
    pricePerKwh
    pricePerMin
    pricePerSession
    taxRate
    createdAt
  }
}
EOF
)

# Headers zusammenstellen
HEADERS="-H 'Content-Type: application/json'"
if [ -n "$HASURA_ADMIN_SECRET" ]; then
  HEADERS="$HEADERS -H 'x-hasura-admin-secret: $HASURA_ADMIN_SECRET'"
fi

echo "Sende Mutation an Hasura..."
echo ""

# Request ausführen
RESPONSE=$(curl -s -X POST "$HASURA_URL" \
  -H "Content-Type: application/json" \
  ${HASURA_ADMIN_SECRET:+-H "x-hasura-admin-secret: $HASURA_ADMIN_SECRET"} \
  -d "{\"query\": \"$(echo "$MUTATION" | tr '\n' ' ' | sed 's/"/\\"/g')\"}")

echo "Antwort:"
echo "$RESPONSE" | python3 -m json.tool 2>/dev/null || echo "$RESPONSE"
echo ""

# Prüfen ob erfolgreich
if echo "$RESPONSE" | grep -q '"id"'; then
  TARIFF_ID=$(echo "$RESPONSE" | python3 -c "import sys, json; print(json.load(sys.stdin)['data']['insert_Tariff_one']['id'])" 2>/dev/null || echo "?")
  echo "============================================"
  echo "✅ Tarif erfolgreich erstellt!"
  echo "   Tarif-ID: $TARIFF_ID"
  echo "============================================"
  echo ""
  echo "Nächster Schritt: Tarif mit Connector verknüpfen"
  echo "Führe aus: ./assign-tariff-to-connector.sh $TARIFF_ID <CONNECTOR_ID>"
else
  echo "============================================"
  echo "❌ Fehler beim Erstellen des Tarifs"
  echo "============================================"
  exit 1
fi
