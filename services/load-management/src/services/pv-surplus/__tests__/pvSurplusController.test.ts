import { Request, Response } from 'express';
import { PvSurplusController } from '../pvSurplusController';
import { PvSurplusService } from '../pvSurplusService';

// Mock the PvSurplusService
const mockPvSurplusService = {
  updateSurplus: jest.fn(),
  getCurrentSurplus: jest.fn(),
};

const mockConsole = {
  error: jest.fn(),
};

describe('PvSurplusController', () => {
  let pvSurplusController: PvSurplusController;
  let mockRequest: Partial<Request>;
  let mockResponse: Partial<Response>;
  let mockNext: jest.Mock;

  beforeEach(() => {
    pvSurplusController = new PvSurplusController(
      mockPvSurplusService as unknown as PvSurplusService,
      mockConsole as any
    );
    
    mockRequest = {};
    mockResponse = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn(),
    };
    mockNext = jest.fn();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('updateSurplus', () => {
    it('should update surplus and return success response', async () => {
      mockRequest.body = { surplus: 15.5 };
      (mockPvSurplusService.updateSurplus as jest.Mock).mockResolvedValue(undefined);

      await pvSurplusController.updateSurplus(
        mockRequest as Request,
        mockResponse as Response,
        mockNext
      );

      expect(mockPvSurplusService.updateSurplus).toHaveBeenCalledWith(15.5);
      expect(mockResponse.status).toHaveBeenCalledWith(200);
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: true,
        message: 'PV surplus updated successfully',
        data: {
          surplus: 15.5,
        },
      });
    });

    it('should return error if surplus is missing', async () => {
      mockRequest.body = {};

      await pvSurplusController.updateSurplus(
        mockRequest as Request,
        mockResponse as Response,
        mockNext
      );

      expect(mockResponse.status).toHaveBeenCalledWith(400);
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: false,
        message: 'Missing required parameter: surplus',
      });
    });

    it('should return error if surplus is negative', async () => {
      mockRequest.body = { surplus: -5 };

      await pvSurplusController.updateSurplus(
        mockRequest as Request,
        mockResponse as Response,
        mockNext
      );

      expect(mockResponse.status).toHaveBeenCalledWith(400);
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: false,
        message: 'Invalid surplus value. Must be a non-negative number.',
      });
    });

    it('should call next with error if service throws', async () => {
      mockRequest.body = { surplus: 15.5 };
      const error = new Error('Service error');
      (mockPvSurplusService.updateSurplus as jest.Mock).mockRejectedValue(error);

      await pvSurplusController.updateSurplus(
        mockRequest as Request,
        mockResponse as Response,
        mockNext
      );

      expect(mockNext).toHaveBeenCalledWith(error);
    });
  });

  describe('getSurplus', () => {
    it('should return current surplus value', async () => {
      (mockPvSurplusService.getCurrentSurplus as jest.Mock).mockReturnValue(12.3);

      await pvSurplusController.getSurplus(
        mockRequest as Request,
        mockResponse as Response,
        mockNext
      );

      expect(mockResponse.status).toHaveBeenCalledWith(200);
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: true,
        data: {
          surplus: 12.3,
        },
      });
    });

    it('should call next with error if service throws', async () => {
      const error = new Error('Service error');
      (mockPvSurplusService.getCurrentSurplus as jest.Mock).mockImplementation(() => {
        throw error;
      });

      await pvSurplusController.getSurplus(
        mockRequest as Request,
        mockResponse as Response,
        mockNext
      );

      expect(mockNext).toHaveBeenCalledWith(error);
    });
  });
});