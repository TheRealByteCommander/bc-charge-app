import {
  extractConnectorId,
  extractEnergyKwhFromMeterValue,
  extractIdTag,
  extractMeterStartKwh,
  extractMeterStopKwh,
  extractMeterValueArray,
  extractOcppTransactionIds,
  extractPowerKwFromMeterValue,
  extractStationId,
  extractTransactionEventType,
  extractTransactionId,
} from './ocppMeterTransactionShape';

describe('ocppMeterTransactionShape', () => {
  test('extractStationId prefers top-level then payload aliases', () => {
    expect(extractStationId({ stationId: 'CS-A' }, { stationId: 'CS-B' })).toBe('CS-A');
    expect(extractStationId({}, { chargingStationId: 'CS-C' })).toBe('CS-C');
    expect(extractStationId({}, { station_id: 'CS-D' })).toBe('CS-D');
    expect(extractStationId({}, { charging_station_id: 'CS-E' })).toBe('CS-E');
    expect(extractStationId({}, {})).toBeNull();
    expect(extractStationId(null, null)).toBeNull();
    expect(extractStationId({}, { stationId: '  ' })).toBeNull();
  });

  test('extractConnectorId supports 1.6 flat and 2.x evse nest', () => {
    expect(extractConnectorId({ connectorId: 2 })).toBe(2);
    expect(extractConnectorId({ connector_id: 3 })).toBe(3);
    expect(extractConnectorId({ evse: { id: 1, connectorId: 4 } })).toBe(4);
    expect(extractConnectorId({ evse: { connector_id: 5 } })).toBe(5);
    expect(extractConnectorId({ evse: { id: 7 } })).toBe(7);
    expect(extractConnectorId({})).toBe(0);
    expect(extractConnectorId({ connectorId: 'nope' })).toBe(0);
    expect(extractConnectorId(null)).toBe(0);
  });

  test('extractTransactionId supports flat + transactionInfo + rejects objects', () => {
    expect(extractTransactionId({ transactionId: 'tx-1' })).toBe('tx-1');
    expect(extractTransactionId({ transaction_id: 42 })).toBe(42);
    expect(
      extractTransactionId({ transactionInfo: { transactionId: 'tx-nested' } })
    ).toBe('tx-nested');
    expect(
      extractTransactionId({ transaction_info: { transaction_id: 'tx-snake' } })
    ).toBe('tx-snake');
    expect(extractTransactionId({ transaction: { id: 'tx-obj' } })).toBe('tx-obj');
    expect(extractTransactionId({ transactionId: { bad: true } })).toBeUndefined();
    expect(extractTransactionId({})).toBeUndefined();
  });

  test('extractIdTag supports idTag and IdTokenType', () => {
    expect(extractIdTag({ idTag: 'RFID-1' })).toBe('RFID-1');
    expect(extractIdTag({ id_tag: 'RFID-2' })).toBe('RFID-2');
    expect(extractIdTag({ idToken: { idToken: 'RFID-3' } })).toBe('RFID-3');
    expect(extractIdTag({ id_token: { id_token: 'RFID-4' } })).toBe('RFID-4');
    expect(extractIdTag({ idToken: 'RFID-flat' })).toBe('RFID-flat');
    expect(extractIdTag({})).toBeUndefined();
    expect(extractIdTag({ idToken: { idToken: '  ' } })).toBeUndefined();
  });

  test('extractMeterValueArray finds camel/snake and transactionInfo nests', () => {
    const arr = [{ sampledValue: [] }];
    expect(extractMeterValueArray({ meterValue: arr })).toBe(arr);
    expect(extractMeterValueArray({ meter_values: arr })).toBe(arr);
    expect(
      extractMeterValueArray({ transactionInfo: { meterValue: arr } })
    ).toBe(arr);
    expect(
      extractMeterValueArray({ transaction_info: { meter_values: arr } })
    ).toBe(arr);
    expect(extractMeterValueArray({})).toBeUndefined();
    expect(extractMeterValueArray(null)).toBeUndefined();
  });

  test('extractEnergyKwhFromMeterValue Wh/kWh + snake sampled_value + drops corrupt', () => {
    expect(
      extractEnergyKwhFromMeterValue([
        {
          sampledValue: [
            { measurand: 'Power.Active.Import', value: '11000', unit: 'W' },
            {
              measurand: 'Energy.Active.Import.Register',
              value: '12000',
              unit: 'Wh',
            },
          ],
        },
      ])
    ).toBe(12);

    expect(
      extractEnergyKwhFromMeterValue([
        {
          sampled_value: [
            {
              Measurand: 'Energy.Active.Import.Register',
              value: '4.5',
              unit_of_measure: { unit: 'kWh' },
            },
          ],
        },
      ])
    ).toBe(4.5);

    expect(
      extractEnergyKwhFromMeterValue([
        {
          sampledValue: [
            { measurand: 'Energy.Active.Import.Register', value: 'nope' },
            'not-an-object',
          ],
        },
        null,
      ])
    ).toBeUndefined();

    expect(extractEnergyKwhFromMeterValue(null)).toBeUndefined();

    // #871 class: energy measurand + non-energy unit must not invent kWh (A/W)
    expect(
      extractEnergyKwhFromMeterValue([
        {
          sampledValue: [
            {
              measurand: 'Energy.Active.Import.Register',
              value: '16',
              unitOfMeasure: { unit: 'A' },
            },
            {
              measurand: 'Energy.Active.Import.Register',
              value: '9000',
              unit: 'Wh',
            },
          ],
        },
      ])
    ).toBe(9);

    expect(
      extractEnergyKwhFromMeterValue([
        {
          sampledValue: [
            {
              Measurand: 'Energy.Active.Import.Register',
              value: '4.5',
              unit: 'W',
            },
          ],
        },
      ])
    ).toBeUndefined();
  });

  test('extractPowerKwFromMeterValue normalizes W and heuristic', () => {
    expect(
      extractPowerKwFromMeterValue([
        {
          sampledValue: [
            { measurand: 'Power.Active.Import', value: '11000', unit: 'W' },
          ],
        },
      ])
    ).toBe(11);

    expect(
      extractPowerKwFromMeterValue([
        {
          sampled_value: [
            { measurand: 'Power.Active.Import.L1', value: '22000' },
          ],
        },
      ])
    ).toBe(22);

    expect(
      extractPowerKwFromMeterValue([
        {
          sampledValue: [{ measurand: 'Power.Active.Import', value: '7.5', unit: 'kW' }],
        },
      ])
    ).toBe(7.5);

    expect(extractPowerKwFromMeterValue([])).toBe(0);
    expect(
      extractPowerKwFromMeterValue([
        { sampledValue: [{ measurand: 'Power.Active.Import', value: 'bad' }] },
      ])
    ).toBe(0);
  });

  test('extractMeterStartKwh / extractMeterStopKwh flat + meterValue fallback', () => {
    expect(extractMeterStartKwh({ meterStart: 3.2 })).toBe(3.2);
    expect(extractMeterStartKwh({ meter_start: 1 })).toBe(1);
    expect(
      extractMeterStartKwh({
        meterValue: [
          {
            sampledValue: [
              {
                measurand: 'Energy.Active.Import.Register',
                value: '5000',
                unit: 'Wh',
              },
            ],
          },
        ],
      })
    ).toBe(5);
    expect(extractMeterStartKwh({})).toBe(0);

    expect(extractMeterStopKwh({ meterStop: 9.1 })).toBe(9.1);
    expect(extractMeterStopKwh({ meter_stop: 8 })).toBe(8);
    expect(
      extractMeterStopKwh({
        meterValue: [
          {
            sampledValue: [
              {
                measurand: 'Energy.Active.Import.Register',
                value: '15500',
                unitOfMeasure: { unit: 'Wh' },
              },
            ],
          },
        ],
      })
    ).toBe(15.5);
    expect(extractMeterStopKwh({})).toBeUndefined();
  });

  test('extractTransactionEventType normalizes case + snake alias', () => {
    expect(extractTransactionEventType({ eventType: 'Started' })).toBe('started');
    expect(extractTransactionEventType({ event_type: 'ENDED' })).toBe('ended');
    expect(extractTransactionEventType({ eventType: '  Updated ' })).toBe('updated');
    expect(extractTransactionEventType({})).toBe('');
    expect(extractTransactionEventType(null)).toBe('');
  });

  test('extractOcppTransactionIds bundles fields', () => {
    const ids = extractOcppTransactionIds(
      { stationId: 'CS-9' },
      {
        evse: { connectorId: 2 },
        transactionInfo: { transactionId: 'tx-9' },
        idToken: { idToken: 'TAG' },
      }
    );
    expect(ids).toEqual({
      stationId: 'CS-9',
      connectorId: 2,
      transactionId: 'tx-9',
      idTag: 'TAG',
    });
  });
});
