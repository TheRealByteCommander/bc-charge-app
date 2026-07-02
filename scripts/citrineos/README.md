# CitrineOS Tarif-Verwaltung

Scripts zum Erstellen und Verwalten von Tarifen in CitrineOS.

## Voraussetzungen

Die Scripts benötigen folgende Umgebungsvariablen (oder verwenden Standardwerte):

```bash
export CITRINEOS_HASURA_URL="http://127.0.0.1:8090/v1/graphql"
export CITRINEOS_HASURA_ADMIN_SECRET="your-secret"  # Falls aktiviert
export CITRINEOS_TENANT_ID="1"
```

## Schnellstart

### 1. Tarif erstellen (0,45€/kWh)

```bash
cd /opt/bc-charge/scripts/citrineos
chmod +x *.sh

# Tarif erstellen
./create-tariff.sh
```

**Ausgabe:**
```
✅ Tarif erfolgreich erstellt!
   Tarif-ID: 1
```

### 2. Vorhandene Connectors anzeigen

```bash
./list-connectors.sh
```

### 3. Tarif einem Connector zuweisen

```bash
# Syntax: ./assign-tariff-to-connector.sh <TARIFF_ID> <CONNECTOR_DATABASE_ID>
./assign-tariff-to-connector.sh 1 5
```

### 4. Alle Tarife anzeigen

```bash
./list-tariffs.sh
```

## Alternative: Hasura Console

Du kannst Tarife auch direkt über die Hasura Console verwalten:

1. Öffne: `https://hasura.main.bc-charge.com/console`
2. Gehe zu **Data** → **Tariff**
3. Klicke **Insert Row**
4. Fülle die Felder aus:

| Feld | Wert | Beschreibung |
|------|------|--------------|
| `tenantId` | `1` | Standard-Tenant |
| `currency` | `EUR` | Währung |
| `pricePerKwh` | `0.45` | 45 Cent pro kWh |
| `pricePerMin` | `0` | Keine Blockiergebühr |
| `pricePerSession` | `0` | Keine Startgebühr |
| `taxRate` | `0.19` | 19% MwSt (optional) |

5. Klicke **Save**

## Tarif mit Ladesäule verknüpfen

Nach dem Erstellen muss der Tarif einem **Connector** zugewiesen werden:

1. In Hasura Console: **Data** → **Connector**
2. Finde den gewünschten Connector (nach `chargingStationId` filtern)
3. Bearbeite den Eintrag und setze `tariffId` auf die ID deines Tarifs

## GraphQL Mutations (manuell)

### Tarif erstellen

```graphql
mutation CreateTariff {
  insert_Tariff_one(object: {
    tenantId: 1,
    currency: "EUR",
    pricePerKwh: 0.45,
    pricePerMin: 0,
    pricePerSession: 0,
    taxRate: 0.19
  }) {
    id
    pricePerKwh
  }
}
```

### Tarif zuweisen

```graphql
mutation AssignTariff {
  update_Connector_by_pk(
    pk_columns: { databaseId: 5 },
    _set: { tariffId: 1 }
  ) {
    databaseId
    tariffId
  }
}
```

### Alle Tarife abfragen

```graphql
query ListTariffs {
  Tariff(where: { tenantId: { _eq: 1 } }) {
    id
    currency
    pricePerKwh
    pricePerMin
    pricePerSession
    taxRate
  }
}
```

## Tarifstruktur

| Feld | Typ | Beschreibung |
|------|-----|--------------|
| `id` | Integer | Auto-generierte ID |
| `tenantId` | Integer | Mandanten-ID (Standard: 1) |
| `currency` | String | ISO 4217 Währungscode (z.B. "EUR") |
| `pricePerKwh` | Decimal | Preis pro Kilowattstunde |
| `pricePerMin` | Decimal | Blockiergebühr pro Minute |
| `pricePerSession` | Decimal | Einmalige Startgebühr |
| `taxRate` | Decimal | Steuersatz (0.19 = 19%) |

## Fehlerbehebung

### "relation does not exist"
Das Hasura-Schema wurde noch nicht migriert. Prüfe die CitrineOS-Installation.

### "permission denied"
`CITRINEOS_HASURA_ADMIN_SECRET` ist nicht korrekt gesetzt.

### Tarif wird nicht in der App angezeigt
1. Prüfe, ob der Tarif einem Connector zugewiesen ist
2. Synchronisiere die App: Ziehe die Stationsliste nach unten (Pull-to-Refresh)
