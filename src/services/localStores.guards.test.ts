import { describe, expect, it } from 'vitest';
import { isStationReport } from './community';
import { isSuccessEntry } from './stationTrust';

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
