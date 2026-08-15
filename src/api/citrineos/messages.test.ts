import { describe, expect, it } from 'vitest';
import { normalizeStartConfirmations } from './messages';

describe('normalizeStartConfirmations', () => {
  it('maps success boolean rows', () => {
    expect(normalizeStartConfirmations({ success: true, payload: 'Accepted' })).toEqual([
      { success: true, payload: 'Accepted' },
    ]);
  });

  it('maps status Accepted/Rejected case-insensitively', () => {
    expect(normalizeStartConfirmations({ status: 'Accepted' })).toEqual([
      { success: true, payload: 'Accepted' },
    ]);
    expect(normalizeStartConfirmations({ Status: 'Rejected' })).toEqual([
      { success: false, payload: 'Rejected' },
    ]);
  });

  it('maps confirmation arrays without casting garbage items to success', () => {
    expect(
      normalizeStartConfirmations([{ success: true }, 'nope', { status: 'Accepted' }])
    ).toEqual([
      { success: true, payload: undefined },
      { success: false, payload: 'Unbekannte Antwort vom Ladesystem' },
      { success: true, payload: 'Accepted' },
    ]);
  });

  it('fails closed on unknown shapes', () => {
    expect(normalizeStartConfirmations(null)).toEqual([
      { success: false, payload: 'Unbekannte Antwort vom Ladesystem' },
    ]);
    expect(normalizeStartConfirmations('x')).toEqual([
      { success: false, payload: 'Unbekannte Antwort vom Ladesystem' },
    ]);
    expect(normalizeStartConfirmations([])).toEqual([
      { success: false, payload: 'Unbekannte Antwort vom Ladesystem' },
    ]);
  });
});
