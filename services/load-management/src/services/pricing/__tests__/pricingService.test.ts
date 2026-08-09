import { PricingService, TariffPeriod } from '../pricingService';

// Mock logger
const mockLogger = {
  info: jest.fn(),
  error: jest.fn(),
  debug: jest.fn(),
  warn: jest.fn()
};

describe('PricingService', () => {
  let pricingService: PricingService;
  const defaultConfig = {
    defaultPricePerKwh: 0.30,
    defaultIdleFeePerMin: 0.05,
    currency: 'EUR',
    timezone: 'Europe/Berlin'
  };

  beforeEach(() => {
    pricingService = new PricingService(defaultConfig, mockLogger);
    jest.clearAllMocks();
  });

  describe('Tariff Management', () => {
    it('should add a tariff period', () => {
      const tariff: TariffPeriod = {
        startTime: '06:00',
        endTime: '22:00',
        pricePerKwh: 0.35
      };

      pricingService.addTariffPeriod(tariff);
      const tariffs = pricingService.getTariffPeriods();
      
      expect(tariffs).toHaveLength(2); // Default + added
      expect(tariffs[1]).toEqual(tariff);
    });

    it('should sort tariff periods by start time', () => {
      const tariff1: TariffPeriod = {
        startTime: '22:00',
        endTime: '06:00',
        pricePerKwh: 0.25
      };
      
      const tariff2: TariffPeriod = {
        startTime: '06:00',
        endTime: '22:00',
        pricePerKwh: 0.35
      };

      pricingService.addTariffPeriod(tariff1);
      pricingService.addTariffPeriod(tariff2);
      const tariffs = pricingService.getTariffPeriods();
      
      // Should be sorted: 00:00-23:59, 06:00-22:00, 22:00-06:00
      expect(tariffs[1].startTime).toBe('06:00');
      expect(tariffs[2].startTime).toBe('22:00');
    });

    it('should get applicable tariff for a specific time', () => {
      const tariff: TariffPeriod = {
        startTime: '06:00',
        endTime: '22:00',
        pricePerKwh: 0.35
      };

      pricingService.addTariffPeriod(tariff);
      
      // Test time within the special tariff period
      const dateInPeriod = new Date();
      dateInPeriod.setHours(12, 0, 0, 0); // 12:00 PM
      
      const applicableTariff = pricingService.getApplicableTariff(dateInPeriod);
      expect(applicableTariff.pricePerKwh).toBe(0.35);
    });

    it('should handle overnight tariff periods', () => {
      const tariff: TariffPeriod = {
        startTime: '22:00',
        endTime: '06:00',
        pricePerKwh: 0.25
      };

      pricingService.addTariffPeriod(tariff);
      
      // Test time within the overnight period
      const dateInOvernight = new Date();
      dateInOvernight.setHours(23, 0, 0, 0); // 11:00 PM
      
      const applicableTariff = pricingService.getApplicableTariff(dateInOvernight);
      expect(applicableTariff.pricePerKwh).toBe(0.25);
    });
  });

  describe('Session Management', () => {
    it('should start a new session', () => {
      const sessionId = pricingService.startSession('CS001', 1, 100.5);
      
      expect(sessionId).toBeDefined();
      expect(typeof sessionId).toBe('string');
      
      const session = pricingService.getSession(sessionId);
      expect(session).toBeDefined();
      expect(session?.stationId).toBe('CS001');
      expect(session?.connectorId).toBe(1);
      expect(session?.startMeterValue).toBe(100.5);
      expect(session?.status).toBe('active');
    });

    it('should update session meter value', () => {
      const sessionId = pricingService.startSession('CS001', 1, 100.5);
      pricingService.updateSessionMeterValue(sessionId, 105.0);
      
      const session = pricingService.getSession(sessionId);
      expect(session?.endMeterValue).toBe(105.0);
      expect(session?.totalEnergy).toBe(4.5); // 105.0 - 100.5
    });

    it('should end a session and calculate pricing', () => {
      // Add a special tariff period
      const tariff: TariffPeriod = {
        startTime: '06:00',
        endTime: '22:00',
        pricePerKwh: 0.35
      };
      pricingService.addTariffPeriod(tariff);
      
      // Set a fixed time during the tariff period
      const sessionTime = new Date('2023-01-01T12:00:00.000Z');
      jest.useFakeTimers();
      jest.setSystemTime(sessionTime);
      
      const sessionId = pricingService.startSession('CS001', 1, 100.5);
      const session = pricingService.endSession(sessionId, 105.0);
      
      // Restore real timers
      jest.useRealTimers();
      
      expect(session.status).toBe('completed');
      expect(session.totalEnergy).toBe(4.5);
      expect(session.totalPrice).toBeCloseTo(1.575, 3); // 4.5 * 0.35 with 3 decimal precision
      expect(session.tariffApplied?.pricePerKwh).toBe(0.35);
    });

    it('should throw error when ending non-existent session', () => {
      expect(() => {
        pricingService.endSession('non-existent-id', 105.0);
      }).toThrow('Session non-existent-id not found');
    });
  });

  describe('Idle Fee Tracking', () => {
    let sessionId: string;
    
    beforeEach(() => {
      sessionId = pricingService.startSession('CS001', 1, 100.5);
      pricingService.endSession(sessionId, 105.0);
    });

    it('should start idle tracking for completed session', () => {
      expect(() => {
        pricingService.startIdleTracking(sessionId);
      }).not.toThrow();
      
      const session = pricingService.getSession(sessionId);
      expect(session?.status).toBe('idle');
      expect(session?.idleStartTime).toBeDefined();
    });

    it('should throw error when starting idle tracking for non-existent session', () => {
      expect(() => {
        pricingService.startIdleTracking('non-existent-id');
      }).toThrow('Session non-existent-id not found');
    });

    it('should auto-complete active session when starting idle tracking', () => {
      const activeSessionId = pricingService.startSession('CS002', 1, 200.0);
      pricingService.updateSessionMeterValue(activeSessionId, 205.0);

      expect(() => {
        pricingService.startIdleTracking(activeSessionId);
      }).not.toThrow();

      const session = pricingService.getSession(activeSessionId);
      expect(session?.status).toBe('idle');
      expect(session?.totalEnergy).toBe(5.0);
      expect(session?.idleStartTime).toBeDefined();
    });

    it('should end idle tracking and calculate fee', () => {
      // Set a fixed time for the start of idle tracking
      const startTime = new Date('2023-01-01T11:00:00.000Z');
      jest.useFakeTimers();
      jest.setSystemTime(startTime);
      
      pricingService.startIdleTracking(sessionId);
      
      // Advance time by 15 minutes
      const endTime = new Date(startTime.getTime() + 15 * 60 * 1000);
      jest.setSystemTime(endTime);
      
      const updatedSession = pricingService.endIdleTracking(sessionId);
      
      // Restore real timers
      jest.useRealTimers();
      
      expect(updatedSession.status).toBe('completed');
      expect(updatedSession.idleDuration).toBeGreaterThanOrEqual(15);
      expect(updatedSession.idleFee).toBeGreaterThanOrEqual(0.75); // 15 * 0.05 (default idle fee)
      expect(updatedSession.totalPrice).toBeGreaterThan(1.35); // Base price + idle fee
    });

    it('should use tariff-specific idle fee when available', () => {
      // Add a tariff with specific idle fee
      const tariff: TariffPeriod = {
        startTime: '06:00',
        endTime: '22:00',
        pricePerKwh: 0.35,
        idleFeePerMin: 0.10
      };
      pricingService.addTariffPeriod(tariff);
      
      // Start and end session during tariff period
      const sessionTime = new Date('2023-01-01T12:00:00.000Z');
      jest.useFakeTimers();
      jest.setSystemTime(sessionTime);
      
      const testSessionId = pricingService.startSession('CS001', 1, 100.5);
      const session = pricingService.endSession(testSessionId, 105.0);
      
      // Set a fixed time for the start of idle tracking (still within the tariff period)
      const startTime = new Date('2023-01-01T12:00:00.000Z');
      jest.setSystemTime(startTime);
      
      // Start idle tracking
      pricingService.startIdleTracking(testSessionId);
      
      // Advance time by 10 minutes
      const endTime = new Date(startTime.getTime() + 10 * 60 * 1000);
      jest.setSystemTime(endTime);
      
      const updatedSession = pricingService.endIdleTracking(testSessionId);
      
      // Restore real timers
      jest.useRealTimers();
      
      // The session ended during the special tariff period, so that tariff should be used
      // 10 minutes * 0.10 EUR/min = 1.00 EUR
      expect(updatedSession.idleFee).toBeCloseTo(1.0, 2); // 10 * 0.10 (tariff idle fee)
    });
  });

  describe('Dynamic Pricing', () => {
    it('should update energy price dynamically', () => {
      pricingService.updateEnergyPrice(0.32);
      
      const config = pricingService.getConfig();
      expect(config.defaultPricePerKwh).toBe(0.32);
      
      // Check that default tariff was updated
      const tariffs = pricingService.getTariffPeriods();
      const defaultTariff = tariffs.find(t => t.startTime === '00:00' && t.endTime === '23:59');
      expect(defaultTariff?.pricePerKwh).toBe(0.32);
    });
  });

  describe('Edge Cases', () => {
    it('should handle sessions with zero energy consumption', () => {
      const sessionId = pricingService.startSession('CS001', 1, 100.0);
      const session = pricingService.endSession(sessionId, 100.0);
      
      expect(session.totalEnergy).toBe(0);
      expect(session.totalPrice).toBe(0);
    });

    it('should handle multiple active sessions', () => {
      const sessionId1 = pricingService.startSession('CS001', 1, 100.0);
      const sessionId2 = pricingService.startSession('CS002', 1, 200.0);
      const sessionId3 = pricingService.startSession('CS003', 2, 300.0);
      
      const activeSessions = pricingService.getActiveSessions();
      expect(activeSessions).toHaveLength(3);
      
      // End one session
      pricingService.endSession(sessionId2, 210.0);
      
      const activeSessionsAfterEnd = pricingService.getActiveSessions();
      expect(activeSessionsAfterEnd).toHaveLength(2);
    });
  });
});