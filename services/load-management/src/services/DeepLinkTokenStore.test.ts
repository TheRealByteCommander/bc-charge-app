import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import {
  DeepLinkTokenStore,
  normalizeDeepLinkMetadata,
} from './DeepLinkTokenStore';

describe('normalizeDeepLinkMetadata', () => {
  test('keeps plain string/number/boolean values and trims keys', () => {
    expect(
      normalizeDeepLinkMetadata({
        ' source ': 'qr',
        count: 2,
        active: true,
        '  ': 'drop-empty-key',
      })
    ).toEqual({ source: 'qr', count: 2, active: true });
  });

  test('drops nested objects, arrays, null, NaN/Infinity and empty bags', () => {
    expect(
      normalizeDeepLinkMetadata({
        ok: 'yes',
        nested: { a: 1 },
        list: [1, 2],
        nada: null,
        bad: Number.NaN,
        inf: Number.POSITIVE_INFINITY,
      })
    ).toEqual({ ok: 'yes' });
    expect(normalizeDeepLinkMetadata({})).toBeUndefined();
    expect(normalizeDeepLinkMetadata(null)).toBeUndefined();
    expect(normalizeDeepLinkMetadata(['x'])).toBeUndefined();
    expect(normalizeDeepLinkMetadata('nope')).toBeUndefined();
  });
});

describe('DeepLinkTokenStore metadata parse-don\'t-cast', () => {
  let dir: string;
  let filePath: string;

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), 'dl-store-'));
    filePath = join(dir, 'deep-link-tokens.json');
  });

  afterEach(() => {
    rmSync(dir, { recursive: true, force: true });
  });

  test('create normalizes metadata and persists only scalar bag', () => {
    const store = new DeepLinkTokenStore(filePath);
    const record = store.create({
      stationId: 'CS-1',
      connectorId: 1,
      purpose: 'start',
      metadata: {
        source: 'kiosk',
        attempt: 1,
        nested: { drop: true } as unknown as string,
        list: [1] as unknown as number,
      } as Record<string, string | number | boolean>,
    });

    expect(record.metadata).toEqual({ source: 'kiosk', attempt: 1 });
    const reloaded = new DeepLinkTokenStore(filePath);
    const again = reloaded.get(record.token);
    expect(again?.metadata).toEqual({ source: 'kiosk', attempt: 1 });
  });

  test('load drops corrupt nested metadata values and empty optional strings', () => {
    writeFileSync(
      filePath,
      JSON.stringify(
        {
          version: 1,
          tokens: [
            {
              token: 'dl_test_token_abc',
              stationId: '  CS-9  ',
              connectorId: 2,
              purpose: 'both',
              customerId: '  cust-1  ',
              locationId: '   ',
              idTag: 'TAG',
              maxUses: 2,
              useCount: 0,
              createdAt: '2026-08-24T08:00:00.000Z',
              expiresAt: '2026-08-25T08:00:00.000Z',
              metadata: {
                channel: 'sms',
                evil: { x: 1 },
                arr: [],
                flag: false,
              },
            },
            {
              // missing token → dropped
              stationId: 'bad',
              connectorId: 0,
              purpose: 'start',
              maxUses: 1,
              useCount: 0,
              createdAt: '2026-08-24T08:00:00.000Z',
              expiresAt: '2026-08-25T08:00:00.000Z',
            },
          ],
        },
        null,
        2
      ),
      'utf8'
    );

    const store = new DeepLinkTokenStore(filePath);
    const list = store.list(true);
    expect(list).toHaveLength(1);
    expect(list[0].stationId).toBe('CS-9');
    expect(list[0].customerId).toBe('cust-1');
    expect(list[0].locationId).toBeUndefined();
    expect(list[0].metadata).toEqual({ channel: 'sms', flag: false });
  });

  test('create without metadata leaves field undefined', () => {
    const store = new DeepLinkTokenStore(filePath);
    const record = store.create({ stationId: 'S', connectorId: 0 });
    expect(record.metadata).toBeUndefined();
    const raw = JSON.parse(readFileSync(filePath, 'utf8')) as {
      tokens: Array<{ metadata?: unknown }>;
    };
    expect(raw.tokens[0].metadata).toBeUndefined();
  });
});
