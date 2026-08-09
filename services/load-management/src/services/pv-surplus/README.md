# PV Surplus Charging Feature

## Overview

The PV Surplus Charging feature enables integration with external Energy Management Systems (EMS) to optimize charging based on locally generated solar power. This feature allows the charging infrastructure to prioritize renewable energy by adjusting charging power in real-time based on reported solar surplus.

## API Endpoints

### Update PV Surplus

```
POST /api/pv-surplus
```

Updates the current PV surplus value reported by an external energy management system.

**Request Body:**
```json
{
  "surplus": 15.5  // Current PV surplus in kW
}
```

**Response:**
```json
{
  "success": true,
  "message": "PV surplus updated successfully",
  "data": {
    "surplus": 15.5
  }
}
```

### Get Current PV Surplus

```
GET /api/pv-surplus
```

Retrieves the current PV surplus value.

**Response:**
```json
{
  "success": true,
  "data": {
    "surplus": 15.5
  }
}
```

## Implementation Details

The PV Surplus Service (`pvSurplusService.ts`) is responsible for:
1. Managing the current PV surplus value
2. Logging updates to the surplus value

The PV Surplus Controller (`pvSurplusController.ts`) handles:
1. REST API endpoints for external systems
2. Input validation and error handling
3. Communication with the PV Surplus Service

## Integration with CitrineOS

In a full implementation, this feature would integrate with CitrineOS through:
1. Monitoring active charging sessions via TransactionEvent repository
2. Adjusting charging profiles using SetChargingProfile OCPP commands
3. Distributing surplus power among active charging sessions

## Configuration

The service can be configured through environment variables:
- `API_PORT`: API server port (default: 3002)

## Testing

Unit tests are available in the `__tests__` directory:
- `pvSurplusService.test.ts`: Tests for the core service logic
- `pvSurplusController.test.ts`: Tests for the API endpoints

Run tests with:
```bash
npm test
```