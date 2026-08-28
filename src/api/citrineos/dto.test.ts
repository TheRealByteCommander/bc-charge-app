import { describe, expect, it } from 'vitest';
import {
  extractHasuraWsStationRows,
  normalizeCitrineosTariffs,
  normalizeCitrineosTransaction,
  normalizeHasuraChargingStationRow,
  normalizeHasuraChargingStationRows,
  normalizeHasuraTransactionRow,
  normalizeHasuraWsMessage,
} from './dto';

describe('normalizeCitrineosTransaction', () => {
  it('maps canonical REST shape', () => {
    expect(
      normalizeCitrineosTransaction({
        transactionId: 'tx-1',
        stationId: 'goe-1',
        isActive: true,
        totalKwh: 12.5,
        totalCost: 4.2,
        chargingState: 'Charging',
        evseId: 1,
      })
    ).toEqual({
      transactionId: 'tx-1',
      stationId: 'goe-1',
      evseId: 1,
      isActive: true,
      totalKwh: 12.5,
      totalCost: 4.2,
      chargingState: 'Charging',
    });
  });

  it('folds totalEnergyKwh / energyKwh / cost / state / active aliases', () => {
    expect(
      normalizeCitrineosTransaction({
        id: 99,
        stationId: 7,
        active: 'true',
        totalEnergyKwh: '3.25',
        cost: '1.5',
        state: 'SuspendedEV',
        evseId: '2',
      })
    ).toEqual({
      transactionId: '99',
      stationId: '7',
      evseId: 2,
      isActive: true,
      totalKwh: 3.25,
      totalCost: 1.5,
      chargingState: 'SuspendedEV',
    });
  });

  it('prefers totalKwh over totalEnergyKwh', () => {
    const tx = normalizeCitrineosTransaction({
      transactionId: 'a',
      stationId: 's',
      totalKwh: 1,
      totalEnergyKwh: 99,
      energyKwh: 50,
    });
    expect(tx?.totalKwh).toBe(1);
  });

  it('unwraps array and { data } / { transaction } envelopes', () => {
    expect(
      normalizeCitrineosTransaction([
        { transactionId: 'from-arr', stationId: 's', totalKwh: 1 },
      ])?.transactionId
    ).toBe('from-arr');

    expect(
      normalizeCitrineosTransaction({
        data: { transactionId: 'from-data', stationId: 's', totalKwh: 2 },
      })?.transactionId
    ).toBe('from-data');

    expect(
      normalizeCitrineosTransaction({
        transaction: { transactionId: 'from-tx', stationId: 's', totalKwh: 3 },
      })?.transactionId
    ).toBe('from-tx');
  });

  it('returns undefined for garbage / missing id', () => {
    expect(normalizeCitrineosTransaction(null)).toBeUndefined();
    expect(normalizeCitrineosTransaction('x')).toBeUndefined();
    expect(normalizeCitrineosTransaction({ stationId: 's', totalKwh: 1 })).toBeUndefined();
    expect(normalizeCitrineosTransaction([])).toBeUndefined();
  });

  it('normalizeHasuraTransactionRow matches', () => {
    expect(
      normalizeHasuraTransactionRow({
        transactionId: 'h1',
        stationId: 3,
        isActive: 1,
        totalKwh: 0.5,
      })
    ).toMatchObject({
      transactionId: 'h1',
      stationId: '3',
      isActive: true,
      totalKwh: 0.5,
    });
  });
});

describe('normalizeCitrineosTariffs', () => {
  it('maps array of tariffs with numeric coercion', () => {
    expect(
      normalizeCitrineosTariffs([
        { id: '1', pricePerKwh: '0.49', currency: 'EUR' },
        { id: 2, pricePerMin: 0.02, pricePerSession: '1' },
      ])
    ).toEqual([
      { id: 1, pricePerKwh: 0.49, currency: 'EUR' },
      { id: 2, pricePerMin: 0.02, pricePerSession: 1 },
    ]);
  });

  it('unwraps { data } / { tariffs } envelopes', () => {
    expect(
      normalizeCitrineosTariffs({
        data: [{ id: 5, pricePerKwh: 0.4 }],
      })
    ).toEqual([{ id: 5, pricePerKwh: 0.4 }]);

    expect(
      normalizeCitrineosTariffs({
        tariffs: [{ id: 6, pricePerKwh: 0.3 }],
      })
    ).toEqual([{ id: 6, pricePerKwh: 0.3 }]);
  });

  it('drops empty / invalid entries and garbage root', () => {
    expect(normalizeCitrineosTariffs(null)).toEqual([]);
    expect(normalizeCitrineosTariffs('nope')).toEqual([]);
    expect(normalizeCitrineosTariffs([{ currency: 'EUR' }])).toEqual([]);
    expect(normalizeCitrineosTariffs([{ id: 'x', currency: 'EUR' }])).toEqual([]);
  });
});

describe('normalizeHasuraChargingStationRow', () => {
  it('maps a canonical Hasura station row with nested EVSE/connector/tariff', () => {
    const row = normalizeHasuraChargingStationRow({
      id: '42',
      ocppConnectionName: 'goe-main',
      isOnline: 'true',
      chargePointVendor: 'go-e',
      chargePointModel: 'Gemini',
      coordinates: { type: 'Point', coordinates: ['13.4', '52.5'] },
      Location: {
        id: 7,
        name: 'Hof',
        address: 'Weg 1',
        city: 'Berlin',
        postalCode: '10115',
        country: 'DE',
        coordinates: null,
      },
      Evses: [
        {
          id: 1,
          evseId: '1',
          Connectors: [
            {
              id: '10',
              connectorId: 1,
              status: 'Available',
              type: 'cType2',
              maximumPowerWatts: '22000',
              tariffId: 3,
              Tariff: { id: '3', pricePerKwh: '0.49', currency: 'EUR' },
            },
            // corrupt connector (missing ids) — dropped
            { status: 'Faulted' },
          ],
        },
        // corrupt EVSE — dropped
        { id: 'x', evseId: 'y' },
      ],
    });

    expect(row).toMatchObject({
      id: 42,
      ocppConnectionName: 'goe-main',
      isOnline: true,
      chargePointVendor: 'go-e',
      chargePointModel: 'Gemini',
      coordinates: { type: 'Point', coordinates: [13.4, 52.5] },
      Location: {
        id: 7,
        name: 'Hof',
        address: 'Weg 1',
        city: 'Berlin',
        postalCode: '10115',
        country: 'DE',
        coordinates: null,
      },
    });
    expect(row?.Evses).toHaveLength(1);
    expect(row?.Evses?.[0].Connectors).toHaveLength(1);
    expect(row?.Evses?.[0].Connectors?.[0]).toMatchObject({
      id: 10,
      connectorId: 1,
      status: 'Available',
      maximumPowerWatts: 22000,
      tariffId: 3,
      Tariff: { id: 3, pricePerKwh: 0.49, currency: 'EUR' },
    });
  });

  it('defaults missing isOnline to false and ocppConnectionName to id', () => {
    const row = normalizeHasuraChargingStationRow({
      id: 9,
      Evses: [{ id: 1, evseId: 1, Connectors: [{ id: 1, connectorId: 1, status: 'Available' }] }],
    });
    expect(row?.isOnline).toBe(false);
    expect(row?.ocppConnectionName).toBe('9');
  });

  it('drops OCPP 2.0.1 connectors with null/missing connectorId (#954)', () => {
    const row = normalizeHasuraChargingStationRow({
      id: 12,
      isOnline: true,
      ocppConnectionName: 'cp-null-conn',
      Evses: [
        {
          id: 1,
          evseId: 1,
          Connectors: [
            { id: 10, connectorId: null, status: 'Available' },
            { id: 11, connectorId: 2, status: 'Charging' },
            { id: 12, status: 'Unavailable' },
          ],
        },
      ],
    });
    expect(row?.Evses?.[0]?.Connectors?.map((c) => c.connectorId)).toEqual([2]);
  });

  it('drops rows without usable id and garbage roots', () => {
    expect(normalizeHasuraChargingStationRow(null)).toBeUndefined();
    expect(normalizeHasuraChargingStationRow('x')).toBeUndefined();
    expect(normalizeHasuraChargingStationRow({ ocppConnectionName: 'a' })).toBeUndefined();
    expect(normalizeHasuraChargingStationRow({ id: 'nope' })).toBeUndefined();
  });

  it('normalizeHasuraChargingStationRows drops corrupt entries', () => {
    const rows = normalizeHasuraChargingStationRows([
      { id: 1, isOnline: true, Evses: [] },
      null,
      { id: 'bad' },
      { id: 2, isOnline: 0, Evses: [{ id: 1, evseId: 1, Connectors: [] }] },
    ]);
    expect(rows.map((r) => r.id)).toEqual([1, 2]);
    expect(rows[1].isOnline).toBe(false);
  });
});

describe('normalizeHasuraWsMessage / extractHasuraWsStationRows', () => {
  it('parses graphql-ws frames from string or object', () => {
    expect(normalizeHasuraWsMessage('{"type":"ka"}')).toEqual({ type: 'ka' });
    expect(normalizeHasuraWsMessage({ type: 'connection_ack' })?.type).toBe('connection_ack');
    expect(normalizeHasuraWsMessage('not-json')).toBeUndefined();
    expect(normalizeHasuraWsMessage([])).toBeUndefined();
    expect(normalizeHasuraWsMessage(null)).toBeUndefined();
  });

  it('extracts and normalizes ChargingStations from data payload', () => {
    const stations = extractHasuraWsStationRows({
      data: {
        ChargingStations: [
          {
            id: 5,
            isOnline: true,
            Evses: [
              {
                id: 1,
                evseId: 1,
                Connectors: [{ id: 1, connectorId: 1, status: 'Charging' }],
              },
            ],
          },
          { id: 'drop-me' },
        ],
      },
    });
    expect(stations).toHaveLength(1);
    expect(stations[0].id).toBe(5);
    expect(stations[0].Evses?.[0].Connectors?.[0].status).toBe('Charging');
  });

  it('returns [] for missing nesting', () => {
    expect(extractHasuraWsStationRows(undefined)).toEqual([]);
    expect(extractHasuraWsStationRows({ data: {} })).toEqual([]);
    expect(extractHasuraWsStationRows({ data: { ChargingStations: null } })).toEqual([]);
  });
});
