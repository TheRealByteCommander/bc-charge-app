import { LoadManager } from './LoadManager';

// Mock WebSocket
jest.mock('ws', () => {
  return {
    WebSocket: jest.fn().mockImplementation(() => {
      return {
        on: jest.fn(),
        send: jest.fn(),
        readyState: 1 // OPEN
      };
    })
  };
});

describe('LoadManager', () => {
  let loadManager: LoadManager;
  const mockConfig = {
    maxSitePower: 50,
    adjustmentThreshold: 5,
    adjustmentDelay: 100,
    monitoringInterval: 1000
  };

  beforeEach(() => {
    loadManager = new LoadManager(mockConfig, 'ws://localhost:8080');
  });

  afterEach(() => {
    loadManager.shutdown();
    jest.clearAllMocks();
  });

  test('should register a charging station', () => {
    loadManager.registerStation('CS-001', 22);
    
    // Access private stations map through reflection
    const stations = (loadManager as any).stations;
    expect(stations.has('CS-001')).toBe(true);
    expect(stations.get('CS-001').maxPower).toBe(22);
  });

  test('should update station power', () => {
    loadManager.registerStation('CS-001', 22);
    loadManager.updateStationPower('CS-001', 15);
    
    const stations = (loadManager as any).stations;
    expect(stations.get('CS-001').currentPower).toBe(15);
    expect(stations.get('CS-001').isActive).toBe(true);
  });

  test('should calculate total power correctly', () => {
    loadManager.registerStation('CS-001', 22);
    loadManager.registerStation('CS-002', 50);
    
    loadManager.updateStationPower('CS-001', 10);
    loadManager.updateStationPower('CS-002', 20);
    
    const totalPower = (loadManager as any).calculateTotalPower();
    expect(totalPower).toBe(30);
  });

  test('should remove a station', () => {
    loadManager.registerStation('CS-001', 22);
    expect((loadManager as any).stations.has('CS-001')).toBe(true);
    
    loadManager.removeStation('CS-001');
    expect((loadManager as any).stations.has('CS-001')).toBe(false);
  });

  test('SetChargingProfile uses OCPP 2.0.1 ChargingStationMaxProfile + startSchedule', () => {
    const sendSpy = jest.spyOn(loadManager as any, 'sendWsMessage').mockReturnValue(true);
    (loadManager as any).sendSetChargingProfile('CS-001', 11);

    expect(sendSpy).toHaveBeenCalledTimes(1);
    const msg = sendSpy.mock.calls[0][0] as {
      action: string;
      payload: {
        evseId: number;
        chargingProfile: {
          chargingProfilePurpose: string;
          chargingProfileKind: string;
          chargingSchedule: {
            startSchedule: string;
            chargingSchedulePeriod: Array<{ limit: number }>;
          };
        };
        csChargingProfiles?: unknown;
      };
    };
    expect(msg.action).toBe('SetChargingProfile');
    expect(msg.payload.evseId).toBe(0);
    expect(msg.payload.chargingProfile.chargingProfilePurpose).toBe(
      'ChargingStationMaxProfile'
    );
    expect(msg.payload.chargingProfile.chargingProfileKind).toBe('Absolute');
    expect(typeof msg.payload.chargingProfile.chargingSchedule.startSchedule).toBe(
      'string'
    );
    expect(msg.payload.chargingProfile.chargingSchedule.chargingSchedulePeriod[0].limit).toBe(
      11000
    );
    // OCPP 2.0.1 ChargingProfileType.id is integer — UUID strings are schema-invalid.
    const profileId = (msg.payload.chargingProfile as { chargingProfileId?: unknown })
      .chargingProfileId;
    expect(typeof profileId).toBe('number');
    expect(Number.isInteger(profileId)).toBe(true);
    expect(profileId as number).toBeGreaterThan(0);
    expect(profileId as number).toBeLessThanOrEqual(2_147_483_647);
    // Must not use OCPP 1.6 field names / purpose
    expect(msg.payload.csChargingProfiles).toBeUndefined();
    expect(msg.payload.chargingProfile.chargingProfilePurpose).not.toBe(
      'ChargePointMaxProfile'
    );
  });

  test('SetChargingProfile chargingProfileId is unique integer across sends', () => {
    const sendSpy = jest.spyOn(loadManager as any, 'sendWsMessage').mockReturnValue(true);
    (loadManager as any).sendSetChargingProfile('CS-001', 7);
    (loadManager as any).sendSetChargingProfile('CS-001', 9);
    const id1 = (sendSpy.mock.calls[0][0] as any).payload.chargingProfile.chargingProfileId;
    const id2 = (sendSpy.mock.calls[1][0] as any).payload.chargingProfile.chargingProfileId;
    expect(typeof id1).toBe('number');
    expect(typeof id2).toBe('number');
    expect(id1).not.toBe(id2);
  });

  test('OCPP 2.x TransactionEvent Started extracts nested transactionInfo/evse/idToken', () => {
    const started: Array<Record<string, unknown>> = [];
    loadManager.on('transactionStarted', (evt) => started.push(evt));

    (loadManager as any).handleCitrineMessage({
      action: 'TransactionEvent',
      stationId: 'CS-201',
      payload: {
        eventType: 'Started',
        evse: { id: 1, connectorId: 2 },
        transactionInfo: { transactionId: 'tx-nested-1' },
        idToken: { idToken: 'RFID-42' },
        meterValue: [
          {
            sampledValue: [
              {
                measurand: 'Energy.Active.Import.Register',
                value: '12000',
                unit: 'Wh',
              },
            ],
          },
        ],
      },
    });

    expect(started).toHaveLength(1);
    expect(started[0]).toMatchObject({
      stationId: 'CS-201',
      connectorId: 2,
      transactionId: 'tx-nested-1',
      meterStart: 12,
      idTag: 'RFID-42',
    });
    expect((loadManager as any).stations.has('CS-201')).toBe(true);
  });

  test('OCPP 2.x TransactionEvent Ended uses meterValue energy as meterStop', () => {
    loadManager.registerStation('CS-201', 22);
    loadManager.updateStationPower('CS-201', 18);

    const stopped: Array<Record<string, unknown>> = [];
    loadManager.on('transactionStopped', (evt) => stopped.push(evt));

    (loadManager as any).handleCitrineMessage({
      action: 'TransactionEvent',
      stationId: 'CS-201',
      payload: {
        eventType: 'Ended',
        evse: { connectorId: 1 },
        transactionInfo: { transactionId: 'tx-end-9' },
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
      },
    });

    expect(stopped).toHaveLength(1);
    expect(stopped[0]).toMatchObject({
      stationId: 'CS-201',
      connectorId: 1,
      transactionId: 'tx-end-9',
      meterStop: 15.5,
    });
    expect((loadManager as any).stations.get('CS-201').isActive).toBe(false);
    expect((loadManager as any).stations.get('CS-201').currentPower).toBe(0);
  });

  test('TransactionEvent Updated emits meterEnergy with nested connector', () => {
    const energyEvents: Array<Record<string, unknown>> = [];
    loadManager.on('meterEnergy', (evt) => energyEvents.push(evt));

    (loadManager as any).handleCitrineMessage({
      action: 'TransactionEvent',
      stationId: 'CS-301',
      payload: {
        eventType: 'Updated',
        evse: { connectorId: 3 },
        meterValue: [
          {
            sampledValue: [
              {
                measurand: 'Power.Active.Import',
                value: '11000',
                unit: 'W',
              },
              {
                measurand: 'Energy.Active.Import.Register',
                value: '4.25',
                unit: 'kWh',
              },
            ],
          },
        ],
      },
    });

    expect((loadManager as any).stations.get('CS-301').currentPower).toBe(11);
    expect(energyEvents).toHaveLength(1);
    expect(energyEvents[0]).toMatchObject({
      stationId: 'CS-301',
      connectorId: 3,
      energyKwh: 4.25,
    });
  });

  test('TransactionEvent snake_case event_type + corrupt samples still routes Started', () => {
    const started: Array<Record<string, unknown>> = [];
    loadManager.on('transactionStarted', (evt) => started.push(evt));

    (loadManager as any).handleCitrineMessage({
      action: 'TransactionEvent',
      payload: {
        event_type: 'STARTED',
        station_id: 'CS-SNAKE',
        connector_id: 1,
        transaction_id: 'tx-snake-1',
        id_tag: 'TAG-S',
        meter_start: 2.5,
        meterValue: [
          null,
          {
            sampled_value: [
              { measurand: 'Energy.Active.Import.Register', value: 'bad' },
              'nope',
            ],
          },
        ],
      },
    });

    expect(started).toHaveLength(1);
    expect(started[0]).toMatchObject({
      stationId: 'CS-SNAKE',
      connectorId: 1,
      transactionId: 'tx-snake-1',
      meterStart: 2.5,
      idTag: 'TAG-S',
    });
  });

  test('NotifyChargingLimit stores external EMS limit and clamps SetChargingProfile', () => {
    const sendSpy = jest.spyOn(loadManager as any, 'sendWsMessage').mockReturnValue(true);
    loadManager.registerStation('CS-EMS', 22);

    const events: Array<Record<string, unknown>> = [];
    loadManager.on('externalLimit', (e) => events.push(e as any));

    (loadManager as any).handleCitrineMessage({
      action: 'NotifyChargingLimit',
      stationId: 'CS-EMS',
      payload: {
        evseId: 0,
        chargingLimit: {
          chargingLimitSource: 'EMS',
          isGridCritical: true,
        },
        chargingSchedule: {
          chargingRateUnit: 'W',
          chargingSchedulePeriod: [{ startPeriod: 0, limit: 8000, numberPhases: 3 }],
        },
      },
    });

    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({
      stationId: 'CS-EMS',
      source: 'EMS',
      isGridCritical: true,
      limitKw: 8,
    });
    expect(loadManager.getExternalLimit('CS-EMS')?.limitKw).toBe(8);
    expect(loadManager.getEffectiveMaxPowerKw('CS-EMS')).toBe(8);

    // Profile send should be clamped to external 8 kW even if 15 requested
    sendSpy.mockClear();
    loadManager.setStationChargingLimit('CS-EMS', 15);
    const msg = sendSpy.mock.calls[0][0] as any;
    expect(msg.payload.chargingProfile.chargingSchedule.chargingSchedulePeriod[0].limit).toBe(8000);
  });

  test('GetCompositeSchedule request/response round-trip', async () => {
    const sendSpy = jest.spyOn(loadManager as any, 'sendWsMessage').mockImplementation((message: any) => {
      // Simulate async response with same uniqueId
      setTimeout(() => {
        (loadManager as any).handleCitrineMessage({
          action: 'GetCompositeScheduleResponse',
          uniqueId: message.uniqueId,
          stationId: message.stationId,
          payload: {
            status: 'Accepted',
            evseId: 0,
            schedule: {
              duration: 3600,
              chargingRateUnit: 'W',
              startSchedule: new Date().toISOString(),
              chargingSchedulePeriod: [
                { startPeriod: 0, limit: 11000, numberPhases: 3 },
              ],
            },
          },
        });
      }, 5);
      return true;
    });

    const result = await loadManager.requestCompositeSchedule('CS-COMP', {
      durationSeconds: 3600,
      timeoutMs: 2000,
    });

    expect(sendSpy).toHaveBeenCalled();
    const req = sendSpy.mock.calls[0][0] as any;
    expect(req.action).toBe('GetCompositeSchedule');
    expect(req.payload).toMatchObject({
      duration: 3600,
      chargingRateUnit: 'W',
      evseId: 0,
    });
    expect(result).not.toBeNull();
    expect(result!.effectiveLimitKw).toBe(11);
    expect(loadManager.getCompositeSchedule('CS-COMP')?.status).toBe('Accepted');
  });

  test('ClearedChargingLimit removes external limit', () => {
    loadManager.registerStation('CS-CLR', 22);
    (loadManager as any).handleCitrineMessage({
      action: 'NotifyChargingLimit',
      stationId: 'CS-CLR',
      payload: {
        chargingLimit: { chargingLimitSource: 'SO' },
        chargingSchedule: {
          chargingRateUnit: 'W',
          chargingSchedulePeriod: [{ startPeriod: 0, limit: 5000 }],
        },
      },
    });
    expect(loadManager.getExternalLimit('CS-CLR')?.limitKw).toBe(5);

    (loadManager as any).handleCitrineMessage({
      action: 'ClearedChargingLimit',
      stationId: 'CS-CLR',
      payload: { chargingLimitSource: 'SO' },
    });
    expect(loadManager.getExternalLimit('CS-CLR')).toBeUndefined();
    expect(loadManager.getEffectiveMaxPowerKw('CS-CLR')).toBe(22);
  });

  test('NotifyChargingLimit + composite response accept snake_case schedule aliases', async () => {
    const sendSpy = jest.spyOn(loadManager as any, 'sendWsMessage').mockReturnValue(true);
    loadManager.registerStation('CS-SNAKE', 22);

    (loadManager as any).handleCitrineMessage({
      action: 'NotifyChargingLimit',
      stationId: 'CS-SNAKE',
      payload: {
        evse_id: 1,
        charging_limit: {
          charging_limit_source: 'EMS',
          is_grid_critical: false,
        },
        charging_schedule: {
          charging_rate_unit: 'W',
          charging_schedule_period: [{ start_period: 0, limit: 6000, number_phases: 3 }],
        },
      },
    });

    expect(loadManager.getExternalLimit('CS-SNAKE')).toMatchObject({
      source: 'EMS',
      limitKw: 6,
      evseId: 1,
    });
    expect(sendSpy).toHaveBeenCalled();

    sendSpy.mockImplementation((message: any) => {
      setTimeout(() => {
        (loadManager as any).handleCitrineMessage({
          action: 'GetCompositeScheduleResponse',
          uniqueId: message.uniqueId,
          stationId: 'CS-SNAKE',
          payload: {
            status: 'Accepted',
            evse_id: 0,
            composite_schedule: {
              duration: 1800,
              charging_rate_unit: 'W',
              start_schedule: '2026-08-21T06:00:00.000Z',
              charging_schedule_period: [
                { start_period: 0, limit: 7000, number_phases: 3 },
                { start_period: 900, limit: 'bad' },
              ],
            },
          },
        });
      }, 5);
      return true;
    });

    const composite = await loadManager.requestCompositeSchedule('CS-SNAKE', {
      durationSeconds: 1800,
      timeoutMs: 2000,
    });
    expect(composite).not.toBeNull();
    expect(composite!.effectiveLimitKw).toBe(7);
    expect(composite!.chargingRateUnit).toBe('W');
    expect(composite!.startSchedule).toBe('2026-08-21T06:00:00.000Z');
    expect(composite!.chargingSchedulePeriod).toEqual([
      { startPeriod: 0, limit: 7000, numberPhases: 3 },
    ]);
  });

});