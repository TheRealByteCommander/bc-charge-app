# Price-Driven Charging Optimization

## Overview

This feature implements time-based charging optimization that pauses or throttles charging when electricity prices exceed a defined threshold. The system fetches day-ahead electricity prices and automatically adjusts charging behavior to minimize energy costs.

## Architecture

### Backend Components

1. **Price Optimizer Service** (`server/services/priceOptimization/priceOptimizer.mjs`)
   - Fetches day-ahead electricity prices from external APIs
   - Determines optimal charging windows based on price thresholds
   - Controls charging profiles via OCPP SetChargingProfile commands

2. **API Routes** (`server/routes/priceOptimization.mjs`)
   - `/api/price-optimization/price-data` - Fetch electricity prices
   - `/api/price-optimization/config` - Get/update configuration
   - `/api/price-optimization/charging-recommendation` - Get charging recommendations
   - `/api/price-optimization/optimize-charging` - Optimize charging for a connector

3. **Frontend Client** (`src/api/priceOptimization/client.ts`)
   - TypeScript client for interacting with the price optimization API

### Key Features

- **Dynamic Price Thresholds**: Configurable price thresholds for pausing charging
- **Hysteresis Control**: Prevents frequent switching when prices are near the threshold
- **Throttling Mode**: Reduces charging power to a minimum instead of completely pausing
- **OCPP Integration**: Uses standard OCPP SetChargingProfile commands for control
- **Fallback Behavior**: Continues normal charging if price data is unavailable

## Configuration

The price optimization service can be configured through environment variables:

| Variable | Description | Default |
|----------|-------------|---------|
| `PRICE_THRESHOLD_EUR_PER_KWH` | Price threshold above which charging is paused | 0.35 |
| `PRICE_HYSTERESIS_EUR` | Hysteresis to prevent frequent switching | 0.02 |
| `MIN_CHARGING_POWER_PERCENT` | Minimum power when throttling (%) | 20 |
| `ELECTRICITY_PRICE_API_URL` | API endpoint for electricity prices | https://api.energy-price-data.de/day-ahead |
| `PRICE_CHECK_INTERVAL_MINUTES` | How often to check prices | 15 |

## Implementation Details

### Price Data Integration

The system expects day-ahead electricity prices in the following format:

```json
[
  {
    "timestamp": "2026-07-14T00:00:00.000Z",
    "price": 0.32
  },
  {
    "timestamp": "2026-07-14T01:00:00.000Z",
    "price": 0.30
  }
]
```

### Charging Profile Control

When prices exceed the threshold, the system sends a `SetChargingProfile` command to the charging station:

```json
{
  "evseId": 1,
  "chargingProfile": {
    "chargingProfileId": 123456,
    "stackLevel": 1,
    "chargingProfilePurpose": "TxProfile",
    "chargingProfileKind": "Absolute",
    "chargingSchedule": {
      "startSchedule": "2026-07-14T10:00:00.000Z",
      "chargingRateUnit": "W",
      "chargingSchedulePeriod": [
        {
          "startPeriod": 0,
          "limit": 4.4,
          "numberPhases": 3
        }
      ]
    }
  }
}
```

### Hysteresis Logic

To prevent frequent switching when prices are near the threshold:

- When charging is active: Pause if price > (threshold + hysteresis)
- When charging is paused: Resume if price < (threshold - hysteresis)

## Testing

Run the test suite with:

```bash
node server/services/priceOptimization/priceOptimizer.test.mjs
```

## Monitoring

The system logs optimization decisions and OCPP command results for monitoring and debugging.

## Future Enhancements

1. Integration with real electricity price APIs (Entsoe-E, local providers)
2. Machine learning for price prediction
3. User preferences for charging urgency vs. cost savings
4. Multi-tier pricing with different charging levels
5. Integration with PV surplus data for hybrid optimization