import { PvSurplusService } from '../pvSurplusService';

// Mock console for testing
const mockConsole = {
  info: jest.fn(),
  error: jest.fn(),
};

describe('PvSurplusService', () => {
  let pvSurplusService: PvSurplusService;

  beforeEach(() => {
    pvSurplusService = new PvSurplusService(mockConsole as any);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('updateSurplus', () => {
    it('should update the current surplus value', async () => {
      const surplus = 15.5;
      
      await pvSurplusService.updateSurplus(surplus);
      
      expect(pvSurplusService.getCurrentSurplus()).toBe(surplus);
      expect(mockConsole.info).toHaveBeenCalledWith(`Updating PV surplus to ${surplus} kW`);
      expect(mockConsole.info).toHaveBeenCalledWith(`PV surplus updated to ${surplus} kW`);
    });
  });

  describe('getCurrentSurplus', () => {
    it('should return the current surplus value', () => {
      const surplus = 10.2;
      (pvSurplusService as any)._currentSurplus = surplus;
      
      expect(pvSurplusService.getCurrentSurplus()).toBe(surplus);
    });
  });
});