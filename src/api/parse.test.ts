import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import {
  ApiParseError,
  errorMessageFromPayload,
  HasuraGraphqlEnvelopeSchema,
  OkEnvelopeSchema,
  parseApiData,
  parseJsonPayload,
  parseWithSchema,
  ProxyEnvelopeSchema,
  requirePlainObject,
} from './parse';

describe('errorMessageFromPayload', () => {
  it('reads error/message strings', () => {
    expect(errorMessageFromPayload({ error: 'nope' }, 'fb')).toBe('nope');
    expect(errorMessageFromPayload({ message: 'msg' }, 'fb')).toBe('msg');
    expect(errorMessageFromPayload({ error: { message: 'nested' } }, 'fb')).toBe('nested');
    expect(errorMessageFromPayload('raw', 'fb')).toBe('raw');
    expect(errorMessageFromPayload(null, 'fb')).toBe('fb');
    expect(errorMessageFromPayload({}, 'fb')).toBe('fb');
  });
});

describe('parseWithSchema', () => {
  const schema = z.object({ ok: z.boolean(), n: z.number() });

  it('returns parsed data', () => {
    expect(parseWithSchema({ ok: true, n: 1 }, schema)).toEqual({ ok: true, n: 1 });
  });

  it('throws ApiParseError on mismatch', () => {
    expect(() => parseWithSchema({ ok: 'yes' }, schema)).toThrow(ApiParseError);
    try {
      parseWithSchema({ ok: true }, schema, 'health');
    } catch (e) {
      expect(e).toBeInstanceOf(ApiParseError);
      expect((e as ApiParseError).message).toMatch(/Invalid health/);
      expect((e as ApiParseError).issues?.length).toBeGreaterThan(0);
    }
  });
});

describe('parseJsonPayload / requirePlainObject / parseApiData', () => {
  it('defaults empty body to {}', () => {
    expect(parseJsonPayload(undefined)).toEqual({});
    expect(parseJsonPayload({ a: 1 })).toEqual({ a: 1 });
  });

  it('requirePlainObject rejects arrays/primitives', () => {
    expect(requirePlainObject({ x: 1 })).toEqual({ x: 1 });
    expect(() => requirePlainObject([])).toThrow(ApiParseError);
    expect(() => requirePlainObject('x')).toThrow(ApiParseError);
  });

  it('parseApiData uses schema or object guard', () => {
    expect(parseApiData({ ok: true }, OkEnvelopeSchema, 'ok')).toEqual({ ok: true });
    expect(parseApiData({ a: 1 }, undefined, 'x')).toEqual({ a: 1 });
    expect(parseApiData(42, undefined, 'x', { allowNonObject: true })).toBe(42);
    expect(() => parseApiData(42, undefined, 'x')).toThrow(ApiParseError);
  });
});

describe('common envelopes', () => {
  it('parses proxy + hasura envelopes', () => {
    expect(parseWithSchema({ ok: true, data: { id: 1 } }, ProxyEnvelopeSchema)).toMatchObject({
      ok: true,
      data: { id: 1 },
    });
    expect(
      parseWithSchema({ data: { Transactions: [] }, errors: [] }, HasuraGraphqlEnvelopeSchema)
    ).toMatchObject({ data: { Transactions: [] } });
  });
});
