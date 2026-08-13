import { describe, expect, it } from 'vitest';
import {
  asArrayOf,
  asNumberRecord,
  asRecordOfArrays,
  isPlainObject,
  safeParseJson,
} from './safeJson';

describe('safeParseJson', () => {
  it('returns fallback for null/empty/invalid', () => {
    expect(safeParseJson(null, { a: 1 })).toEqual({ a: 1 });
    expect(safeParseJson('', [])).toEqual([]);
    expect(safeParseJson('not-json', null)).toBeNull();
    expect(safeParseJson('{', 'x')).toBe('x');
  });

  it('parses valid JSON', () => {
    expect(safeParseJson('{"n":2}', {})).toEqual({ n: 2 });
    expect(safeParseJson('[1,2]', [])).toEqual([1, 2]);
  });
});

describe('isPlainObject', () => {
  it('accepts plain objects only', () => {
    expect(isPlainObject({})).toBe(true);
    expect(isPlainObject({ a: 1 })).toBe(true);
    expect(isPlainObject(null)).toBe(false);
    expect(isPlainObject([])).toBe(false);
    expect(isPlainObject('x')).toBe(false);
  });
});

describe('asRecordOfArrays', () => {
  it('keeps only array values', () => {
    expect(
      asRecordOfArrays({
        a: [1],
        b: 'no',
        c: null,
        d: [2, 3],
      })
    ).toEqual({ a: [1], d: [2, 3] });
    expect(asRecordOfArrays(null)).toEqual({});
    expect(asRecordOfArrays([1])).toEqual({});
  });
});

describe('asNumberRecord', () => {
  it('keeps finite numbers only', () => {
    expect(
      asNumberRecord({
        ok: 3,
        zero: 0,
        neg: -1,
        nan: Number.NaN,
        inf: Number.POSITIVE_INFINITY,
        str: '1',
        nested: { x: 1 },
        arr: [1],
      })
    ).toEqual({ ok: 3, zero: 0, neg: -1 });
    expect(asNumberRecord([])).toEqual({});
    expect(asNumberRecord(null)).toEqual({});
  });
});

describe('asArrayOf', () => {
  const isStr = (v: unknown): v is string => typeof v === 'string';

  it('filters with predicate and rejects non-arrays', () => {
    expect(asArrayOf(['a', 1, 'b', null], isStr)).toEqual(['a', 'b']);
    expect(asArrayOf({ 0: 'a' }, isStr)).toEqual([]);
    expect(asArrayOf(null, isStr)).toEqual([]);
  });
});
