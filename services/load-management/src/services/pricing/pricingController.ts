import { Request, Response, NextFunction } from 'express';
import { PricingService, TariffPeriod, ChargingSession } from './pricingService';

/**
 * Controller for Dynamic Pricing API endpoints
 */
export class PricingController {
  private readonly _pricingService: PricingService;
  private readonly _logService: any;

  constructor(pricingService: PricingService, logService: any) {
    this._pricingService = pricingService;
    this._logService = logService;
  }

  /**
   * POST /api/pricing/tariff
   * Add a new tariff period
   * 
   * Request body:
   * {
   *   "startTime": "06:00",
   *   "endTime": "22:00",
   *   "pricePerKwh": 0.35,
   *   "idleFeePerMin": 0.10
   * }
   * 
   * Response:
   * {
   *   "success": true,
   *   "message": "Tariff period added successfully"
   * }
   */
  public async addTariffPeriod(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { startTime, endTime, pricePerKwh, idleFeePerMin } = req.body;

      // Validate input
      if (!startTime || !endTime || pricePerKwh === undefined) {
        res.status(400).json({
          success: false,
          message: 'Missing required parameters: startTime, endTime, pricePerKwh',
        });
        return;
      }

      if (typeof startTime !== 'string' || typeof endTime !== 'string') {
        res.status(400).json({
          success: false,
          message: 'Invalid startTime or endTime. Must be strings in HH:MM format.',
        });
        return;
      }

      if (typeof pricePerKwh !== 'number' || pricePerKwh < 0) {
        res.status(400).json({
          success: false,
          message: 'Invalid pricePerKwh. Must be a non-negative number.',
        });
        return;
      }

      if (idleFeePerMin !== undefined && (typeof idleFeePerMin !== 'number' || idleFeePerMin < 0)) {
        res.status(400).json({
          success: false,
          message: 'Invalid idleFeePerMin. Must be a non-negative number if provided.',
        });
        return;
      }

      // Validate time format (HH:MM)
      const timeRegex = /^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/;
      if (!timeRegex.test(startTime) || !timeRegex.test(endTime)) {
        res.status(400).json({
          success: false,
          message: 'Invalid time format. Use HH:MM format (24-hour).',
        });
        return;
      }

      const tariffPeriod: TariffPeriod = {
        startTime,
        endTime,
        pricePerKwh,
        idleFeePerMin
      };

      this._pricingService.addTariffPeriod(tariffPeriod);

      res.status(200).json({
        success: true,
        message: 'Tariff period added successfully',
      });
    } catch (error) {
      this._logService.error('Error adding tariff period:', error);
      next(error);
    }
  }

  /**
   * GET /api/pricing/tariff
   * Get all tariff periods
   * 
   * Response:
   * {
   *   "success": true,
   *   "data": [
   *     {
   *       "startTime": "00:00",
   *       "endTime": "23:59",
   *       "pricePerKwh": 0.30,
   *       "idleFeePerMin": 0.05
   *     }
   *   ]
   * }
   */
  public async getTariffPeriods(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const tariffPeriods = this._pricingService.getTariffPeriods();

      res.status(200).json({
        success: true,
        data: tariffPeriods,
      });
    } catch (error) {
      this._logService.error('Error getting tariff periods:', error);
      next(error);
    }
  }

  /**
   * POST /api/pricing/session/start
   * Start a new charging session
   * 
   * Request body:
   * {
   *   "stationId": "CS001",
   *   "connectorId": 1,
   *   "startMeterValue": 1234.5
   * }
   * 
   * Response:
   * {
   *   "success": true,
   *   "data": {
   *     "sessionId": "uuid-string"
   *   }
   * }
   */
  public async startSession(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { stationId, connectorId, startMeterValue, customerId, locationId, source } = req.body;

      // Validate input
      if (!stationId || connectorId === undefined || startMeterValue === undefined) {
        res.status(400).json({
          success: false,
          message: 'Missing required parameters: stationId, connectorId, startMeterValue',
        });
        return;
      }

      if (typeof stationId !== 'string') {
        res.status(400).json({
          success: false,
          message: 'Invalid stationId. Must be a string.',
        });
        return;
      }

      if (typeof connectorId !== 'number' || connectorId < 0) {
        res.status(400).json({
          success: false,
          message: 'Invalid connectorId. Must be a non-negative number.',
        });
        return;
      }

      if (typeof startMeterValue !== 'number' || startMeterValue < 0) {
        res.status(400).json({
          success: false,
          message: 'Invalid startMeterValue. Must be a non-negative number.',
        });
        return;
      }

      const sessionId = this._pricingService.startSession(stationId, connectorId, startMeterValue, {
        customerId: typeof customerId === 'string' ? customerId : undefined,
        locationId: typeof locationId === 'string' ? locationId : undefined,
        source:
          source === 'api' || source === 'deeplink' || source === 'ocpp' || source === 'unknown'
            ? source
            : 'api',
      });

      res.status(200).json({
        success: true,
        data: {
          sessionId: sessionId
        },
      });
    } catch (error: any) {
      if (error instanceof Error && /already exists/i.test(error.message)) {
        res.status(409).json({ success: false, message: error.message });
        return;
      }
      this._logService.error('Error starting session:', error);
      next(error);
    }
  }

  /**
   * POST /api/pricing/session/end
   * End a charging session
   * 
   * Request body:
   * {
   *   "sessionId": "uuid-string",
   *   "endMeterValue": 1250.0
   * }
   * 
   * Response:
   * {
   *   "success": true,
   *   "data": {
   *     "session": {
   *       "id": "uuid-string",
   *       "stationId": "CS001",
   *       "connectorId": 1,
   *       "startTimestamp": "2023-01-01T10:00:00.000Z",
   *       "endTimestamp": "2023-01-01T11:00:00.000Z",
   *       "startMeterValue": 1234.5,
   *       "endMeterValue": 1250.0,
   *       "totalEnergy": 15.5,
   *       "totalPrice": 4.65,
   *       "status": "completed",
   *       "tariffApplied": {
   *         "startTime": "06:00",
   *         "endTime": "22:00",
   *         "pricePerKwh": 0.30
   *       }
   *     }
   *   }
   * }
   */
  public async endSession(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { sessionId, endMeterValue } = req.body;

      // Validate input
      if (!sessionId || endMeterValue === undefined) {
        res.status(400).json({
          success: false,
          message: 'Missing required parameters: sessionId, endMeterValue',
        });
        return;
      }

      if (typeof sessionId !== 'string') {
        res.status(400).json({
          success: false,
          message: 'Invalid sessionId. Must be a string.',
        });
        return;
      }

      if (typeof endMeterValue !== 'number' || endMeterValue < 0) {
        res.status(400).json({
          success: false,
          message: 'Invalid endMeterValue. Must be a non-negative number.',
        });
        return;
      }

      const session = this._pricingService.endSession(sessionId, endMeterValue);

      res.status(200).json({
        success: true,
        data: {
          session: session
        },
      });
    } catch (error) {
      this._logService.error('Error ending session:', error);
      next(error);
    }
  }

  /**
   * POST /api/pricing/session/idle/start
   * Start idle fee tracking for a completed session
   * 
   * Request body:
   * {
   *   "sessionId": "uuid-string"
   * }
   * 
   * Response:
   * {
   *   "success": true,
   *   "message": "Idle tracking started successfully"
   * }
   */
  public async startIdleTracking(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { sessionId } = req.body;

      // Validate input
      if (!sessionId) {
        res.status(400).json({
          success: false,
          message: 'Missing required parameter: sessionId',
        });
        return;
      }

      if (typeof sessionId !== 'string') {
        res.status(400).json({
          success: false,
          message: 'Invalid sessionId. Must be a string.',
        });
        return;
      }

      this._pricingService.startIdleTracking(sessionId);

      res.status(200).json({
        success: true,
        message: 'Idle tracking started successfully',
      });
    } catch (error) {
      this._logService.error('Error starting idle tracking:', error);
      next(error);
    }
  }

  /**
   * POST /api/pricing/session/idle/end
   * End idle fee tracking and calculate idle fee
   * 
   * Request body:
   * {
   *   "sessionId": "uuid-string"
   * }
   * 
   * Response:
   * {
   *   "success": true,
   *   "data": {
   *     "session": {
   *       "id": "uuid-string",
   *       "stationId": "CS001",
   *       "connectorId": 1,
   *       "startTimestamp": "2023-01-01T10:00:00.000Z",
   *       "endTimestamp": "2023-01-01T11:00:00.000Z",
   *       "startMeterValue": 1234.5,
   *       "endMeterValue": 1250.0,
   *       "totalEnergy": 15.5,
   *       "totalPrice": 5.15,
   *       "idleStartTime": "2023-01-01T11:00:00.000Z",
   *       "idleDuration": 15,
   *       "idleFee": 0.50,
   *       "status": "completed",
   *       "tariffApplied": {
   *         "startTime": "06:00",
   *         "endTime": "22:00",
   *         "pricePerKwh": 0.30,
   *         "idleFeePerMin": 0.10
   *       }
   *     }
   *   }
   * }
   */
  public async endIdleTracking(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { sessionId } = req.body;

      // Validate input
      if (!sessionId) {
        res.status(400).json({
          success: false,
          message: 'Missing required parameter: sessionId',
        });
        return;
      }

      if (typeof sessionId !== 'string') {
        res.status(400).json({
          success: false,
          message: 'Invalid sessionId. Must be a string.',
        });
        return;
      }

      const session = this._pricingService.endIdleTracking(sessionId);

      res.status(200).json({
        success: true,
        data: {
          session: session
        },
      });
    } catch (error) {
      this._logService.error('Error ending idle tracking:', error);
      next(error);
    }
  }

  /**
   * GET /api/pricing/session/:sessionId
   * Get a specific session by ID
   * 
   * Response:
   * {
   *   "success": true,
   *   "data": {
   *     "session": {
   *       // Session object
   *     }
   *   }
   * }
   */
  public async getSession(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { sessionId } = req.params;

      if (!sessionId) {
        res.status(400).json({
          success: false,
          message: 'Missing sessionId parameter',
        });
        return;
      }

      const session = this._pricingService.getSession(sessionId);

      if (!session) {
        res.status(404).json({
          success: false,
          message: 'Session not found',
        });
        return;
      }

      res.status(200).json({
        success: true,
        data: {
          session: session
        },
      });
    } catch (error) {
      this._logService.error('Error getting session:', error);
      next(error);
    }
  }

  /**
   * POST /api/pricing/energy-price
   * Update energy price dynamically (pass-through pricing)
   * 
   * Request body:
   * {
   *   "pricePerKwh": 0.32
   * }
   * 
   * Response:
   * {
   *   "success": true,
   *   "message": "Energy price updated successfully"
   * }
   */
  public async updateEnergyPrice(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { pricePerKwh } = req.body;

      // Validate input
      if (pricePerKwh === undefined) {
        res.status(400).json({
          success: false,
          message: 'Missing required parameter: pricePerKwh',
        });
        return;
      }

      if (typeof pricePerKwh !== 'number' || pricePerKwh < 0) {
        res.status(400).json({
          success: false,
          message: 'Invalid pricePerKwh. Must be a non-negative number.',
        });
        return;
      }

      this._pricingService.updateEnergyPrice(pricePerKwh);

      res.status(200).json({
        success: true,
        message: 'Energy price updated successfully',
      });
    } catch (error) {
      this._logService.error('Error updating energy price:', error);
      next(error);
    }
  }

  /**
   * GET /api/pricing/config
   * Get current pricing configuration
   * 
   * Response:
   * {
   *   "success": true,
   *   "data": {
   *     "config": {
   *       "defaultPricePerKwh": 0.30,
   *       "defaultIdleFeePerMin": 0.05,
   *       "currency": "EUR",
   *       "timezone": "Europe/Berlin"
   *     }
   *   }
   * }
   */
  public async getConfig(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const config = this._pricingService.getConfig();

      res.status(200).json({
        success: true,
        data: {
          config: config
        },
      });
    } catch (error) {
      this._logService.error('Error getting configuration:', error);
      next(error);
    }
  }
}