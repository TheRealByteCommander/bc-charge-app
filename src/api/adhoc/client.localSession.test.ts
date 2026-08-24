import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  adhocLocalSessionEqual,
  clearAdhocSessionLocal,
  loadAdhocSessionLocal,
  parseAdhocSessionLocal,
  saveAdhocSessionLocal,
} from './client';

const STORAGE_KEY = 'bc_adhoc_session';

function mockSessionStorage(initial: Record<string, string> = {}) {
  const store = new Map<string, string>(Object.entries(initial));
  const api = {
    getItem: vi.fn((key: string) => (store.has(key) ? store.get(key)! : null)),
    setItem: vi.fn((key: string, value: string) => {
      store.set(key, String(value));
    }),
    removeItem: vi.fn((key: string) => {
      store.delete(key);
    }),
    clear: vi.fn(() => store.clear()),
    key: vi.fn(),
    get length() {
      return store.size;
    },
  };
  vi.stubGlobal('sessionStorage', api);
  return { store, api };
}

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('parseAdhocSessionLocal', () => {
  it('accepts valid id + token envelopes', () => {
    expect(
      parseAdhocSessionLocal(JSON.stringify({ sessionId: 'adh_1', accessToken: 'tok_abc' }))
    ).toEqual({ sessionId: 'adh_1', accessToken: 'tok_abc' });
  });

  it('rejects corrupt, empty, or extra-field payloads', () => {
    expect(parseAdhocSessionLocal(null)).toBeNull();
    expect(parseAdhocSessionLocal('')).toBeNull();
    expect(parseAdhocSessionLocal('{')).toBeNull();
    expect(parseAdhocSessionLocal(JSON.stringify({ sessionId: 'adh_1' }))).toBeNull();
    expect(parseAdhocSessionLocal(JSON.stringify({ sessionId: '', accessToken: 't' }))).toBeNull();
    expect(
      parseAdhocSessionLocal(
        JSON.stringify({ sessionId: 'adh_1', accessToken: 'tok', extra: true })
      )
    ).toBeNull();
  });
});

describe('adhocLocalSessionEqual', () => {
  it('compares sessionId + accessToken only', () => {
    const a = { sessionId: 'adh_1', accessToken: 'tok' };
    expect(adhocLocalSessionEqual(a, { ...a })).toBe(true);
    expect(adhocLocalSessionEqual(a, { sessionId: 'adh_2', accessToken: 'tok' })).toBe(false);
    expect(adhocLocalSessionEqual(a, { sessionId: 'adh_1', accessToken: 'other' })).toBe(false);
    expect(adhocLocalSessionEqual(null, null)).toBe(true);
    expect(adhocLocalSessionEqual(a, null)).toBe(false);
  });
});

describe('saveAdhocSessionLocal / loadAdhocSessionLocal', () => {
  it('persists valid envelopes and loads them back', () => {
    const { api } = mockSessionStorage();
    saveAdhocSessionLocal('adh_9', 'cap_token');
    expect(api.setItem).toHaveBeenCalledTimes(1);
    expect(loadAdhocSessionLocal()).toEqual({ sessionId: 'adh_9', accessToken: 'cap_token' });
  });

  it('skips sessionStorage rewrite when envelope is unchanged', () => {
    const { api } = mockSessionStorage({
      [STORAGE_KEY]: JSON.stringify({ sessionId: 'adh_1', accessToken: 'tok_1' }),
    });
    saveAdhocSessionLocal('adh_1', 'tok_1');
    expect(api.setItem).not.toHaveBeenCalled();
  });

  it('writes when sessionId or token changes', () => {
    const { api, store } = mockSessionStorage({
      [STORAGE_KEY]: JSON.stringify({ sessionId: 'adh_1', accessToken: 'tok_1' }),
    });
    saveAdhocSessionLocal('adh_1', 'tok_2');
    expect(api.setItem).toHaveBeenCalledTimes(1);
    expect(store.get(STORAGE_KEY)).toBe(
      JSON.stringify({ sessionId: 'adh_1', accessToken: 'tok_2' })
    );
  });

  it('ignores invalid save inputs and clears storage', () => {
    const { api, store } = mockSessionStorage({
      [STORAGE_KEY]: JSON.stringify({ sessionId: 'adh_1', accessToken: 'tok_1' }),
    });
    saveAdhocSessionLocal('', 'tok');
    expect(api.setItem).not.toHaveBeenCalled();
    clearAdhocSessionLocal();
    expect(api.removeItem).toHaveBeenCalledWith(STORAGE_KEY);
    expect(store.has(STORAGE_KEY)).toBe(false);
  });
});
