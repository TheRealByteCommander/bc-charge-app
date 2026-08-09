# BC Charge Dynamic Load Management Service

This service implements Dynamic Load Management (DLM) for the BC Charge CitrineOS deployment. It monitors charging stations and dynamically adjusts charging profiles to prevent grid overload and optimize energy costs.

## Features

- Real-time monitoring of charging station power consumption
- Automatic adjustment of charging profiles via SetChargingProfile commands
- Configurable site power limits and adjustment thresholds
- WebSocket communication with CitrineOS
- Support for multiple charging stations
- PV Surplus Charging API for integration with Energy Management Systems (EMS)
- Dynamic Pricing Engine for flexible tariff management and idle fee calculation

## Architecture

The LoadManager service connects to CitrineOS via WebSocket and:

1. Receives MeterValues from charging stations
2. Aggregates power consumption across all active stations
3. When total consumption approaches the site limit, it calculates required adjustments
4. Sends SetChargingProfile commands to reduce charging power proportionally

The PvSurplusService provides an API endpoint for external EMS systems to report current solar surplus, enabling prioritization of renewable energy for charging.

The PricingService provides dynamic pricing capabilities including time-based tariffs, idle fees, and energy pass-through pricing.

## Configuration

The service can be configured with the following parameters:

- `maxSitePower`: Maximum power allowed for the site (kW)
- `adjustmentThreshold`: Threshold to trigger adjustment (kW)
- `adjustmentDelay`: Delay before adjustment (ms)
- `monitoringInterval`: How often to check loads (ms)
- `API_PORT`: Port for the PV Surplus API (default: 3002)
- `PRICING_DEFAULT_PRICE_PER_KWH`: Default energy price (EUR/kWh)
- `PRICING_DEFAULT_IDLE_FEE_PER_MIN`: Default idle fee (EUR/min)
- `PRICING_CURRENCY`: Currency code (default: EUR)
- `PRICING_TIMEZONE`: Timezone for tariff calculations (default: Europe/Berlin)

## Installation

1. Install dependencies:
   ```bash
   npm install
   ```

2. Build the service:
   ```bash
   npm run build
   ```

3. Start the service:
   ```bash
   npm start
   ```

## Docker Deployment

The service can be deployed using Docker Compose:

```bash
docker-compose up -d
```

## Testing

Run unit tests with:

```bash
npm test
```

## API Integration

The service integrates with CitrineOS through:

- WebSocket connection for real-time communication
- MeterValues messages for power consumption data
- SetChargingProfile commands for load adjustment

The PV Surplus API provides two endpoints:

- `POST /api/pv-surplus`: Update current solar surplus value
- `GET /api/pv-surplus`: Retrieve current solar surplus value

The Dynamic Pricing API provides endpoints for tariff management and session pricing:

- `POST /api/pricing/tariff`: Add a new tariff period
- `GET /api/pricing/tariff`: Get all tariff periods
- `POST /api/pricing/session/start`: Start a new charging session
- `POST /api/pricing/session/end`: End a charging session and calculate pricing
- `POST /api/pricing/session/idle/start`: Start idle fee tracking
- `POST /api/pricing/session/idle/end`: End idle fee tracking and calculate fee
- `GET /api/pricing/session/:sessionId`: Get session details
- `POST /api/pricing/energy-price`: Update energy price dynamically
- `GET /api/pricing/config`: Get current pricing configuration

## Monitoring

The service logs all activities including:

- Station registration/removal
- Power consumption updates
- Load adjustment decisions
- SetChargingProfile command responses
- PV surplus updates
- Pricing calculations and session management

## PV Surplus Charging

The PV Surplus Charging feature allows integration with external Energy Management Systems (EMS) to optimize charging based on locally generated solar power. See [PV Surplus Documentation](src/services/pv-surplus/README.md) for detailed information.

## Dynamic Pricing Engine

The Dynamic Pricing Engine provides flexible pricing logic for EV charging sessions, including time-based tariffs, idle fees, and energy pass-through calculations. See [Pricing Documentation](src/services/pricing/README.md) for detailed information.