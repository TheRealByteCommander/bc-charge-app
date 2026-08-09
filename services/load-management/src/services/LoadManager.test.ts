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
});