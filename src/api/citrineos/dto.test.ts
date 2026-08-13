import { describe, expect, it } from 'vitest';
import {
  normalizeCitrineosTariffs,
  normalizeCitrineosTransaction,
  normalizeHasuraTransactionRow,
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
