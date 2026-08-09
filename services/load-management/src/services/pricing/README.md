# Dynamic Pricing Engine

The Dynamic Pricing Engine is a service that provides flexible pricing logic for EV charging sessions, including time-based tariffs, idle fees, and energy pass-through calculations.

## Features

1. **Time-Based Tariffs**: Define different pricing periods throughout the day
2. **Idle Fees**: Charge fees for vehicles that remain plugged in after charging completes
3. **Energy Pass-Through Pricing**: Dynamically update energy prices based on current market rates
4. **Session Management**: Track charging sessions from start to completion
5. **Comprehensive API**: RESTful endpoints for all pricing operations

## Architecture

The service consists of two main components:

- `PricingService`: Core business logic for pricing calculations
- `PricingController`: HTTP API endpoints for external integration

## API Endpoints

### Tariff Management

- `POST /api/pricing/tariff` - Add a new tariff period
- `GET /api/pricing/tariff` - Get all tariff periods

### Session Management

- `POST /api/pricing/session/start` - Start a new charging session
- `POST /api/pricing/session/end` - End a charging session and calculate pricing
- `POST /api/pricing/session/idle/start` - Start idle fee tracking
- `POST /api/pricing/session/idle/end` - End idle fee tracking and calculate fee
- `GET /api/pricing/session/:sessionId` - Get session details

### Dynamic Pricing

- `POST /api/pricing/energy-price` - Update energy price dynamically
- `GET /api/pricing/config` - Get current pricing configuration

## Usage Examples

### 1. Adding Time-Based Tariffs

```bash
# Add peak hour tariff (more expensive)
curl -X POST http://localhost:3003/api/pricing/tariff \
  -H "Content-Type: application/json" \
  -d '{
    "startTime": "06:00",
    "endTime": "22:00",
    "pricePerKwh": 0.35,
    "idleFeePerMin": 0.10
  }'

# Add off-peak tariff (less expensive)
curl -X POST http://localhost:3003/api/pricing/tariff \
  -H "Content-Type: application/json" \
  -d '{
    "startTime": "22:00",
    "endTime": "06:00",
    "pricePerKwh": 0.25,
    "idleFeePerMin": 0.05
  }'
```

### 2. Managing Charging Sessions

```bash
# Start a charging session
curl -X POST http://localhost:3003/api/pricing/session/start \
  -H "Content-Type: application/json" \
  -d '{
    "stationId": "CS001",
    "connectorId": 1,
    "startMeterValue": 1234.5
  }'

# End a charging session
curl -X POST http://localhost:3003/api/pricing/session/end \
  -H "Content-Type: application/json" \
  -d '{
    "sessionId": "session-uuid-here",
    "endMeterValue": 1250.0
  }'
```

### 3. Idle Fee Tracking

```bash
# Start idle tracking after session completion
curl -X POST http://localhost:3003/api/pricing/session/idle/start \
  -H "Content-Type: application/json" \
  -d '{
    "sessionId": "session-uuid-here"
  }'

# End idle tracking and calculate fee
curl -X POST http://localhost:3003/api/pricing/session/idle/end \
  -H "Content-Type: application/json" \
  -d '{
    "sessionId": "session-uuid-here"
  }'
```

### 4. Dynamic Energy Pricing

```bash
# Update energy price based on current market rates
curl -X POST http://localhost:3003/api/pricing/energy-price \
  -H "Content-Type: application/json" \
  -d '{
    "pricePerKwh": 0.32
  }'
```

## Configuration

The service can be configured through environment variables:

- `PRICING_DEFAULT_PRICE_PER_KWH` - Default energy price (EUR/kWh)
- `PRICING_DEFAULT_IDLE_FEE_PER_MIN` - Default idle fee (EUR/min)
- `PRICING_CURRENCY` - Currency code (default: EUR)
- `PRICING_TIMEZONE` - Timezone for tariff calculations (default: Europe/Berlin)
- `PRICING_API_PORT` - API server port (default: 3003)

## Integration with CitrineOS

The Dynamic Pricing Engine integrates with CitrineOS through:

1. **Session Events**: Receives start/end events from CitrineOS
2. **Meter Values**: Processes meter values to calculate energy consumption
3. **OCPP Commands**: Can trigger OCPP commands based on pricing decisions

## Testing

Run the test suite with:

```bash
npm test
```

The tests cover:
- Tariff period management
- Session lifecycle management
- Idle fee calculations
- Dynamic pricing updates
- Edge cases and error conditions