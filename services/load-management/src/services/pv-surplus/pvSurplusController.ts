import { Request, Response, NextFunction } from 'express';
import { PvSurplusService } from './pvSurplusService';

/**
 * Controller for PV surplus charging API endpoints
 */
export class PvSurplusController {
  private readonly _pvSurplusService: PvSurplusService;
  private readonly _logService: any;

  constructor(pvSurplusService: PvSurplusService, logService: any) {
    this._pvSurplusService = pvSurplusService;
    this._logService = logService;
  }

  /**
   * POST /api/pv-surplus
   * Endpoint for external energy management systems to report current solar surplus
   * 
   * Request body:
   * {
   *   "surplus": 15.5  // Current PV surplus in kW
   * }
   * 
   * Response:
   * {
   *   "success": true,
   *   "message": "PV surplus updated successfully",
   *   "data": {
   *     "surplus": 15.5
   *   }
   * }
   */
  public async updateSurplus(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { surplus } = req.body;

      // Validate input
      if (surplus === undefined || surplus === null) {
        res.status(400).json({
          success: false,
          message: 'Missing required parameter: surplus',
        });
        return;
      }

      if (typeof surplus !== 'number' || surplus < 0) {
        res.status(400).json({
          success: false,
          message: 'Invalid surplus value. Must be a non-negative number.',
        });
        return;
      }

      // Update the surplus value
      await this._pvSurplusService.updateSurplus(surplus);

      // Return success response
      res.status(200).json({
        success: true,
        message: 'PV surplus updated successfully',
        data: {
          surplus: surplus,
        },
      });
    } catch (error) {
      this._logService.error('Error updating PV surplus:', error);
      next(error);
    }
  }

  /**
   * GET /api/pv-surplus
   * Endpoint to get current PV surplus value
   * 
   * Response:
   * {
   *   "success": true,
   *   "data": {
   *     "surplus": 15.5
   *   }
   * }
   */
  public async getSurplus(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const surplus = this._pvSurplusService.getCurrentSurplus();

      res.status(200).json({
        success: true,
        data: {
          surplus: surplus,
        },
      });
    } catch (error) {
      this._logService.error('Error getting PV surplus:', error);
      next(error);
    }
  }
}