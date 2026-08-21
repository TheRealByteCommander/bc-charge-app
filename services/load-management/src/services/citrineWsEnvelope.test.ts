import { parseCitrineWsEnvelope } from './citrineWsEnvelope';

describe('parseCitrineWsEnvelope', () => {
  test('parses valid MeterValues frame', () => {
    const msg = parseCitrineWsEnvelope(
      JSON.stringify({
        action: 'MeterValues',
        stationId: 'CS-1',
        uniqueId: 'u-1',
        payload: { meterValue: [] },
      })
    );
    expect(msg).not.toBeNull();
    expect(msg!.action).toBe('MeterValues');
    expect(msg!.stationId).toBe('CS-1');
    expect(msg!.uniqueId).toBe('u-1');
    expect(msg!.payload).toEqual({ meterValue: [] });
  });

  test('accepts Buffer input', () => {
    const msg = parseCitrineWsEnvelope(
      Buffer.from(JSON.stringify({ action: 'StatusNotification', stationId: 'S2' }), 'utf8')
    );
    expect(msg?.action).toBe('StatusNotification');
    expect(msg?.stationId).toBe('S2');
  });

  test('trims action whitespace', () => {
    const msg = parseCitrineWsEnvelope(JSON.stringify({ action: '  BootNotification  ' }));
    expect(msg?.action).toBe('BootNotification');
  });

  test('drops invalid JSON', () => {
    expect(parseCitrineWsEnvelope('{not-json')).toBeNull();
  });

  test('drops non-object JSON', () => {
    expect(parseCitrineWsEnvelope('"string"')).toBeNull();
    expect(parseCitrineWsEnvelope('42')).toBeNull();
    expect(parseCitrineWsEnvelope('[1,2]')).toBeNull();
  });

  test('drops missing or blank action', () => {
    expect(parseCitrineWsEnvelope(JSON.stringify({ stationId: 'x' }))).toBeNull();
    expect(parseCitrineWsEnvelope(JSON.stringify({ action: '' }))).toBeNull();
    expect(parseCitrineWsEnvelope(JSON.stringify({ action: '   ' }))).toBeNull();
    expect(parseCitrineWsEnvelope(JSON.stringify({ action: 12 }))).toBeNull();
  });

  test('drops non-object payload instead of casting', () => {
    const msg = parseCitrineWsEnvelope(
      JSON.stringify({ action: 'MeterValues', payload: 'oops' })
    );
    expect(msg).not.toBeNull();
    expect(msg!.payload).toBeUndefined();
  });
});
