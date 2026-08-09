import type { LoadManager } from '../LoadManager';

/**
 * Service for managing PV surplus charging functionality.
 * When surplus changes, active stations are rebalanced so their charging
 * profiles can absorb available PV within site limits.
 */
export class PvSurplusService {
  private _currentSurplus = 0; // kW
  private _logService: {
    info: (...args: unknown[]) => void;
    warn?: (...args: unknown[]) => void;
    error?: (...args: unknown[]) => void;
  };
  private _loadManager: LoadManager | null = null;
  /** Fraction of surplus allocated to EV charging (0–1). */
  private readonly _allocationFactor: number;
  /** Floor power per active station when surplus is low (kW). */
  private readonly _minStationPowerKw: number;

  constructor(
    logService: PvSurplusService['_logService'],
    options: {
      loadManager?: LoadManager;
      allocationFactor?: number;
      minStationPowerKw?: number;
    } = {}
  ) {
    this._logService = logService;
    this._loadManager = options.loadManager ?? null;
    this._allocationFactor = options.allocationFactor ?? 1;
    this._minStationPowerKw = options.minStationPowerKw ?? 1.4;
  }

  public setLoadManager(loadManager: LoadManager): void {
    this._loadManager = loadManager;
  }

  /**
   * Update the current PV surplus value and apply load adjustments.
   * @param surplus Current PV surplus in kW
   */
  public async updateSurplus(surplus: number): Promise<void> {
    if (!Number.isFinite(surplus) || surplus < 0) {
      throw new Error('surplus must be a non-negative number');
    }

    this._logService.info(`Updating PV surplus to ${surplus} kW`);
    this._currentSurplus = surplus;
    this.applySurplusToLoadManager();
    this._logService.info(`PV surplus updated to ${surplus} kW`);
  }

  /**
   * Get the current PV surplus value
   */
  public getCurrentSurplus(): number {
    return this._currentSurplus;
  }

  /**
   * Distribute available surplus across active stations via LoadManager.
   */
  public applySurplusToLoadManager(): void {
    if (!this._loadManager) {
      this._logService.warn?.(
        'PvSurplusService: no LoadManager bound; surplus stored but not applied to stations'
      );
      return;
    }

    const allocatable = Math.max(0, this._currentSurplus * this._allocationFactor);
    const activeCount = this._loadManager.getStations().filter((s) => s.isActive).length;

    if (activeCount === 0) {
      this._logService.info('PvSurplusService: no active stations to adjust');
      return;
    }

    this._loadManager.applySurplusBudget(allocatable, this._minStationPowerKw);
    this._logService.info(
      `PvSurplusService: applied ${allocatable.toFixed(2)} kW surplus across ${activeCount} active station(s)`
    );
  }
}
