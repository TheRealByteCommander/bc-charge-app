import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  isStationReport,
  saveStationReports,
  stationReportsDomainEqual,
  type StationReport,
} from './community';
import {
  isStationCheckIn,
  saveStationCheckIns,
  stationCheckInsDomainEqual,
  type StationCheckIn,
} from './stationCheckIn';
import {
  isSuccessEntry,
  saveStationSuccessLog,
  stationSuccessLogDomainEqual,
} from './stationTrust';

function installMemoryLocalStorage() {
  const store = new Map<string, string>();
  const setItem = vi.fn((k: string, v: string) => {
    store.set(k, String(v));
  });
  const ls = {
    getItem: (k: string) => (store.has(k) ? store.get(k)! : null),
    setItem,
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
  return { store, setItem };
}

describe('isStationReport', () => {
  const valid = {
    id: 'rep_1',
    stationId: 'st_1',
    category: 'defect' as const,
    message: 'broken',
    createdAt: '2026-08-13T08:00:00.000Z',
    helpfulVotes: 0,
  };

  it('accepts well-formed reports', () => {
    expect(isStationReport(valid)).toBe(true);
    expect(isStationReport({ ...valid, photoBase64: 'data:…' })).toBe(true);
  });

  it('rejects corrupt / partial rows', () => {
    expect(isStationReport(null)).toBe(false);
    expect(isStationReport([])).toBe(false);
    expect(isStationReport({ ...valid, category: 'nope' })).toBe(false);
    expect(isStationReport({ ...valid, id: '' })).toBe(false);
    expect(isStationReport({ ...valid, helpfulVotes: Number.NaN })).toBe(false);
    expect(isStationReport({ ...valid, photoBase64: 12 })).toBe(false);
    expect(isStationReport({ ...valid, message: undefined })).toBe(false);
  });
});

describe('isSuccessEntry', () => {
  it('accepts stationId+at strings', () => {
    expect(isSuccessEntry({ stationId: 's1', at: '2026-08-13T00:00:00.000Z' })).toBe(true);
  });

  it('rejects incomplete entries', () => {
    expect(isSuccessEntry(null)).toBe(false);
    expect(isSuccessEntry({ stationId: 's1' })).toBe(false);
    expect(isSuccessEntry({ stationId: '', at: 'x' })).toBe(false);
    expect(isSuccessEntry({ stationId: 's1', at: 1 })).toBe(false);
  });
});

describe('community local-store domain equal-skip', () => {
  const report: StationReport = {
    id: 'rep_1',
    stationId: 'st_1',
    category: 'defect',
    message: 'broken',
    createdAt: '2026-08-13T08:00:00.000Z',
    helpfulVotes: 0,
  };
  const checkIn: StationCheckIn = {
    id: 'ci_1',
    stationId: 'st_1',
    status: 'available',
    createdAt: '2026-08-13T08:00:00.000Z',
    note: 'ok',
  };
  const success = { stationId: 'st_1', at: '2026-08-13T08:00:00.000Z' };

  let setItem: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    ({ setItem } = installMemoryLocalStorage());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('compares report/check-in/success domain fields order-sensitively', () => {
    expect(stationReportsDomainEqual([report], [{ ...report }])).toBe(true);
    expect(stationReportsDomainEqual([report], [{ ...report, helpfulVotes: 1 }])).toBe(false);
    expect(stationReportsDomainEqual([report], [])).toBe(false);

    expect(stationCheckInsDomainEqual([checkIn], [{ ...checkIn }])).toBe(true);
    expect(stationCheckInsDomainEqual([checkIn], [{ ...checkIn, status: 'busy' }])).toBe(false);
    expect(isStationCheckIn(checkIn)).toBe(true);

    expect(stationSuccessLogDomainEqual([success], [{ ...success }])).toBe(true);
    expect(stationSuccessLogDomainEqual([success], [{ ...success, at: 'later' }])).toBe(false);
  });

  it('saveStationReports skips identical rewrite and writes on change', () => {
    saveStationReports([report]);
    expect(setItem).toHaveBeenCalledTimes(1);
    saveStationReports([{ ...report }]);
    expect(setItem).toHaveBeenCalledTimes(1);

    saveStationReports([{ ...report, helpfulVotes: 2 }]);
    expect(setItem).toHaveBeenCalledTimes(2);
  });

  it('saveStationCheckIns skips identical rewrite and writes on change', () => {
    saveStationCheckIns([checkIn]);
    expect(setItem).toHaveBeenCalledTimes(1);
    saveStationCheckIns([{ ...checkIn }]);
    expect(setItem).toHaveBeenCalledTimes(1);

    saveStationCheckIns([{ ...checkIn, note: 'updated' }]);
    expect(setItem).toHaveBeenCalledTimes(2);
  });

  it('saveStationSuccessLog skips identical rewrite and writes on change', () => {
    saveStationSuccessLog([success]);
    expect(setItem).toHaveBeenCalledTimes(1);
    saveStationSuccessLog([{ ...success }]);
    expect(setItem).toHaveBeenCalledTimes(1);

    saveStationSuccessLog([success, { stationId: 'st_2', at: '2026-08-14T00:00:00.000Z' }]);
    expect(setItem).toHaveBeenCalledTimes(2);
  });
});
