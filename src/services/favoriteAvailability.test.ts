import { describe, expect, it } from 'vitest';
import { favoriteAvailabilityStateEqual } from './favoriteAvailability';

describe('favoriteAvailabilityStateEqual', () => {
  it('treats identical key/value maps as equal regardless of insert order', () => {
    expect(favoriteAvailabilityStateEqual({ a: 0, b: 2 }, { b: 2, a: 0 })).toBe(true);
  });

  it('detects value changes and missing keys', () => {
    expect(favoriteAvailabilityStateEqual({ a: 0 }, { a: 1 })).toBe(false);
    expect(favoriteAvailabilityStateEqual({ a: 0 }, { a: 0, b: 1 })).toBe(false);
    expect(favoriteAvailabilityStateEqual({ a: 0, b: 1 }, { a: 0 })).toBe(false);
  });

  it('treats empty maps as equal', () => {
    expect(favoriteAvailabilityStateEqual({}, {})).toBe(true);
  });
});
