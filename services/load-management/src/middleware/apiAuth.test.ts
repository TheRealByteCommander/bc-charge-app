import type { Request, Response } from 'express';
import {
  createApiAuthMiddleware,
  extractPresentedApiKey,
  isApiAuthRequiredFromEnv,
  resetApiAuthWarnStateForTests,
  resolveApiKeyFromEnv,
  safeEqualString,
} from './apiAuth';

function mockRes() {
  const res: Partial<Response> & {
    statusCode?: number;
    body?: unknown;
  } = {};
  res.status = jest.fn((code: number) => {
    res.statusCode = code;
    return res as Response;
  });
  res.json = jest.fn((body: unknown) => {
    res.body = body;
    return res as Response;
  });
  return res as Response & { statusCode?: number; body?: unknown };
}

function mockReq(headers: Record<string, string | undefined> = {}): Request {
  const normalized: Record<string, string> = {};
  for (const [k, v] of Object.entries(headers)) {
    if (v !== undefined) normalized[k.toLowerCase()] = v;
  }
  return {
    headers: normalized,
    get(name: string) {
      return normalized[name.toLowerCase()];
    },
  } as unknown as Request;
}

describe('apiAuth helpers', () => {
  beforeEach(() => {
    resetApiAuthWarnStateForTests();
  });

  test('safeEqualString accepts equal strings and rejects unequal', () => {
    expect(safeEqualString('abc', 'abc')).toBe(true);
    expect(safeEqualString('abc', 'abd')).toBe(false);
    expect(safeEqualString('abc', 'ab')).toBe(false);
    expect(safeEqualString('', '')).toBe(true);
  });

  test('extractPresentedApiKey reads Bearer and custom headers', () => {
    expect(
      extractPresentedApiKey(mockReq({ authorization: 'Bearer secret-key' }))
    ).toBe('secret-key');
    expect(extractPresentedApiKey(mockReq({ 'x-api-key': 'k1' }))).toBe('k1');
    expect(extractPresentedApiKey(mockReq({ 'x-lm-api-key': 'k2' }))).toBe('k2');
    expect(extractPresentedApiKey(mockReq({}))).toBeUndefined();
    expect(
      extractPresentedApiKey(mockReq({ authorization: 'Basic nope' }))
    ).toBeUndefined();
  });

  test('resolveApiKeyFromEnv prefers LM_API_KEY', () => {
    expect(
      resolveApiKeyFromEnv({
        LM_API_KEY: ' primary ',
        LOAD_MANAGEMENT_API_KEY: 'alias',
      } as NodeJS.ProcessEnv)
    ).toBe('primary');
    expect(
      resolveApiKeyFromEnv({
        LOAD_MANAGEMENT_API_KEY: 'alias',
      } as NodeJS.ProcessEnv)
    ).toBe('alias');
    expect(resolveApiKeyFromEnv({} as NodeJS.ProcessEnv)).toBeUndefined();
  });

  test('isApiAuthRequiredFromEnv respects production and flag', () => {
    expect(isApiAuthRequiredFromEnv({ NODE_ENV: 'production' } as NodeJS.ProcessEnv)).toBe(
      true
    );
    expect(
      isApiAuthRequiredFromEnv({ LM_API_AUTH_REQUIRED: 'true' } as NodeJS.ProcessEnv)
    ).toBe(true);
    expect(
      isApiAuthRequiredFromEnv({ NODE_ENV: 'development' } as NodeJS.ProcessEnv)
    ).toBe(false);
  });
});

describe('createApiAuthMiddleware', () => {
  beforeEach(() => {
    resetApiAuthWarnStateForTests();
  });

  test('allows request with valid Bearer key', () => {
    const mw = createApiAuthMiddleware({ apiKey: 'test-secret-key-32chars!!!!!!' });
    const req = mockReq({ authorization: 'Bearer test-secret-key-32chars!!!!!!' });
    const res = mockRes();
    const next = jest.fn();

    mw(req, res, next);

    expect(next).toHaveBeenCalledTimes(1);
    expect(res.status).not.toHaveBeenCalled();
  });

  test('allows request with valid x-api-key', () => {
    const mw = createApiAuthMiddleware({ apiKey: 'test-secret-key-32chars!!!!!!' });
    const req = mockReq({ 'x-api-key': 'test-secret-key-32chars!!!!!!' });
    const res = mockRes();
    const next = jest.fn();

    mw(req, res, next);

    expect(next).toHaveBeenCalledTimes(1);
  });

  test('rejects missing key with 401 when configured', () => {
    const mw = createApiAuthMiddleware({ apiKey: 'test-secret-key-32chars!!!!!!' });
    const req = mockReq({});
    const res = mockRes();
    const next = jest.fn();

    mw(req, res, next);

    expect(next).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.body).toMatchObject({ success: false, code: 'UNAUTHORIZED' });
  });

  test('rejects wrong key with 401', () => {
    const mw = createApiAuthMiddleware({ apiKey: 'test-secret-key-32chars!!!!!!' });
    const req = mockReq({ 'x-api-key': 'wrong-key-not-the-same-length!!' });
    const res = mockRes();
    const next = jest.fn();

    mw(req, res, next);

    expect(next).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(401);
  });

  test('when required and key missing → 503 AUTH_NOT_CONFIGURED', () => {
    const mw = createApiAuthMiddleware({
      apiKey: '',
      required: true,
      logger: { warn: jest.fn(), error: jest.fn() },
    });
    const req = mockReq({});
    const res = mockRes();
    const next = jest.fn();

    mw(req, res, next);

    expect(next).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(503);
    expect(res.body).toMatchObject({ success: false, code: 'AUTH_NOT_CONFIGURED' });
  });

  test('when not required and key missing → allow (dev)', () => {
    const warn = jest.fn();
    const mw = createApiAuthMiddleware({
      apiKey: '',
      required: false,
      logger: { warn, error: jest.fn() },
    });
    const req = mockReq({});
    const res = mockRes();
    const next = jest.fn();

    mw(req, res, next);

    expect(next).toHaveBeenCalledTimes(1);
    expect(warn).toHaveBeenCalled();
  });
});
