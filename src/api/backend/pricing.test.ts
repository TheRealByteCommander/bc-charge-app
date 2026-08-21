import { describe, expect, it } from 'vitest';
import {
  PricingPreviewResultSchema,
  PricingTariffsEnvelopeSchema,
  TariffVersionSchema,
  TariffVersionsEnvelopeSchema,
} from './pricing';

describe('pricing client Zod envelopes', () => {
  it('parses tariffs list and coerces empty name', () => {
    const parsed = PricingTariffsEnvelopeSchema.parse({
      tariffs: [{ id: 't1', name: 'Hof AC' }, { id: 't2' }],
    });
    expect(parsed.tariffs).toHaveLength(2);
    expect(parsed.tariffs[0].name).toBe('Hof AC');
    expect(parsed.tariffs[1].name).toBe('');
  });

  it('parses tariff versions with numeric rate/version coercion', () => {
    const parsed = TariffVersionsEnvelopeSchema.parse({
      versions: [
        {
          id: 'v1',
          tariffId: 't1',
          version: '2',
          status: 'active',
          validFrom: '2026-01-01T00:00:00.000Z',
          timezone: 'Europe/Berlin',
          currency: 'EUR',
          taxRateBp: '1900',
          components: [{ kind: 'energy', rate: 0.39, priority: '10' }],
          hash: 'abc',
        },
      ],
    });
    const v = parsed.versions[0];
    expect(v.version).toBe(2);
    expect(v.taxRateBp).toBe(1900);
    expect(v.components[0].rate).toBe('0.39');
    expect(v.components[0].priority).toBe(10);
  });

  it('rejects tariff version without id', () => {
    const r = TariffVersionSchema.safeParse({
      tariffId: 't1',
      version: 1,
      validFrom: '2026-01-01T00:00:00.000Z',
      components: [],
    });
    expect(r.success).toBe(false);
  });

  it('parses preview cost envelope and coerces energyWh / money', () => {
    const parsed = PricingPreviewResultSchema.parse({
      snapshot: { hash: 'deadbeef', frozenAt: '2026-08-21T10:00:00.000Z' },
      cost: {
        netEur: 1.2,
        taxEur: '0.23',
        grossEur: '1.43',
        energyWh: '8500',
        lines: [{ code: 'energy', kind: 'energy', label: 'Energie', grossEur: 1.43 }],
      },
    });
    expect(parsed.snapshot.hash).toBe('deadbeef');
    expect(parsed.cost.energyWh).toBe(8500);
    expect(parsed.cost.grossEur).toBe('1.43');
    expect(parsed.cost.lines[0].grossEur).toBe('1.43');
  });

  it('rejects preview without snapshot hash', () => {
    const r = PricingPreviewResultSchema.safeParse({
      snapshot: { frozenAt: '2026-08-21T10:00:00.000Z' },
      cost: { netEur: '0', taxEur: '0', grossEur: '0', energyWh: 0, lines: [] },
    });
    expect(r.success).toBe(false);
  });
});
