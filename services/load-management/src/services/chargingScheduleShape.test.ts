import {
  deriveLimitKwFromSchedule,
  extractChargingScheduleFromPayload,
  normalizeChargingSchedulePeriod,
  readChargingRateUnit,
  readChargingSchedulePeriods,
} from './chargingScheduleShape';

describe('chargingScheduleShape', () => {
  test('normalizeChargingSchedulePeriod accepts camel + snake and drops corrupt', () => {
    expect(
      normalizeChargingSchedulePeriod({
        startPeriod: 0,
        limit: 11000,
        numberPhases: 3,
      })
    ).toEqual({ startPeriod: 0, limit: 11000, numberPhases: 3 });

    expect(
      normalizeChargingSchedulePeriod({
        start_period: '60',
        limit: '5000',
        number_phases: 1,
      })
    ).toEqual({ startPeriod: 60, limit: 5000, numberPhases: 1 });

    expect(normalizeChargingSchedulePeriod(null)).toBeNull();
    expect(normalizeChargingSchedulePeriod({ startPeriod: 0 })).toBeNull();
    expect(normalizeChargingSchedulePeriod({ limit: 'nope' })).toBeNull();
  });

  test('readChargingRateUnit / periods tolerate aliases and non-objects', () => {
    expect(readChargingRateUnit({ chargingRateUnit: 'A' })).toBe('A');
    expect(readChargingRateUnit({ charging_rate_unit: 'w' })).toBe('W');
    expect(readChargingRateUnit(null, 'A')).toBe('A');
    expect(readChargingSchedulePeriods({ chargingSchedulePeriod: [{ limit: 1 }] })).toHaveLength(1);
    expect(
      readChargingSchedulePeriods({ charging_schedule_period: [{ limit: 2 }] })
    ).toHaveLength(1);
    expect(readChargingSchedulePeriods({ chargingSchedulePeriod: 'bad' })).toEqual([]);
    expect(readChargingSchedulePeriods(undefined)).toEqual([]);
  });

  test('deriveLimitKwFromSchedule converts W/A and picks lowest period', () => {
    expect(
      deriveLimitKwFromSchedule({
        chargingRateUnit: 'W',
        chargingSchedulePeriod: [
          { startPeriod: 0, limit: 11000 },
          { startPeriod: 300, limit: 8000 },
        ],
      })
    ).toBe(8);

    expect(
      deriveLimitKwFromSchedule({
        charging_rate_unit: 'A',
        charging_schedule_period: [{ start_period: 0, limit: 16, number_phases: 3 }],
      })
    ).toBeCloseTo((16 * 230 * 3) / 1000, 5);

    // Array of schedules — min across all
    expect(
      deriveLimitKwFromSchedule([
        {
          chargingRateUnit: 'W',
          chargingSchedulePeriod: [{ limit: 15000 }],
        },
        {
          chargingRateUnit: 'W',
          chargingSchedulePeriod: [{ limit: 9000 }],
        },
      ])
    ).toBe(9);

    expect(deriveLimitKwFromSchedule(null)).toBeNull();
    expect(deriveLimitKwFromSchedule({ chargingRateUnit: 'W' })).toBeNull();
    expect(deriveLimitKwFromSchedule('nope')).toBeNull();
  });

  test('extractChargingScheduleFromPayload reads nested aliases', () => {
    expect(
      extractChargingScheduleFromPayload({
        schedule: { chargingRateUnit: 'W' },
      })
    ).toEqual({ chargingRateUnit: 'W' });
    expect(
      extractChargingScheduleFromPayload({
        charging_schedule: { charging_rate_unit: 'A' },
      })
    ).toEqual({ charging_rate_unit: 'A' });
    expect(extractChargingScheduleFromPayload(null)).toBeNull();
    expect(extractChargingScheduleFromPayload({ status: 'Accepted' })).toBeNull();
  });
});
