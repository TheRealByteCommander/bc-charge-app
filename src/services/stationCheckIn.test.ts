import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  addStationCheckIn,
  getCheckInsForStation,
  getStationReliabilitySummary,
  isStationCheckIn,
} from './stationCheckIn';

function installMemoryLocalStorage() {
  const store = new Map<string, string>();
  const ls = {
    getItem: (k: string) => (store.has(k) ? store.get(k)! : null),
    setItem: (k: string, v: string) => {
      store.set(k, String(v));
    },
    removeItem: (k: string) => {
      store.delete(k);
    },
    clear: () => {
      store.clear();
    },
    key: (i: number) => Array.from(store.keys())[i] ?? null,
    get length() {
      return store.size;
    },
  };
  vi.stubGlobal('localStorage', ls);
}

describe('stationCheckIn', () => {
  beforeEach(() => {
    installMemoryLocalStorage();
  });

  it('validates check-in shape', () => {
    expect(
      isStationCheckIn({
        id: 'x',
        stationId: 's1',
        status: 'available',
        createdAt: '2026-08-14T00:00:00.000Z',
      })
    ).toBe(true);
    expect(isStationCheckIn({ id: 'x', stationId: 's1', status: 'nope' })).toBe(false);
  });

  it('stores and lists check-ins newest first', () => {
    vi.spyOn(Date, 'now')
      .mockReturnValueOnce(1_700_000_000_000)
      .mockReturnValueOnce(1_700_000_000_100)
      .mockReturnValueOnce(1_700_000_000_200);
    addStationCheckIn({ stationId: 's1', status: 'busy' });
    addStationCheckIn({ stationId: 's1', status: 'available', note: 'ok' });
    addStationCheckIn({ stationId: 's2', status: 'broken' });
    const list = getCheckInsForStation('s1');
    expect(list).toHaveLength(2);
    expect(list[0].status).toBe('available');
    expect(list[0].note).toBe('ok');
    expect(list[1].status).toBe('busy');
    vi.restoreAllMocks();
  });

  it('computes reliability summary', () => {
    addStationCheckIn({ stationId: 's1', status: 'available' });
    addStationCheckIn({ stationId: 's1', status: 'charging_ok' });
    addStationCheckIn({ stationId: 's1', status: 'broken' });
    const s = getStationReliabilitySummary('s1');
    expect(s.total).toBe(3);
    expect(s.positiveRate).toBe(67);
    expect(s.labelDe).toMatch(/67%/);
  });

  it('rejects empty stationId / invalid status and clamps notes', () => {
    expect(() => addStationCheckIn({ stationId: '  ', status: 'available' })).toThrow(/stationId/);
    expect(() =>
      addStationCheckIn({ stationId: 's1', status: 'nope' as 'available' })
    ).toThrow(/status/);
    const long = 'x'.repeat(250);
    const row = addStationCheckIn({ stationId: ' s1 ', status: 'busy', note: `  ${long}  ` });
    expect(row.stationId).toBe('s1');
    expect(row.note).toHaveLength(200);
  });
});
