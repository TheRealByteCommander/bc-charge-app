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
    "surplus": 15.5,
    "updateTime": "2023-07-14T10:30:00.000Z"
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
    "surplus": 15.5,
    "updateTime": "2023-07-14T10:30:00.000Z"
  }
}
```

### Optimize Charging with PV Surplus

```
POST /api/pv-surplus/optimize-charging
```

Manually trigger optimization of charging based on current PV surplus (admin only).

**Response:**
```json
{
  "success": true,
  "message": "Distributed 15.5 kW of PV surplus among 2 active sessions",
  "surplus": 15.5,
  "sessionsAffected": 2
}
```

## Implementation Details

The PV Surplus Charging service (`pvSurplusCharging.mjs`) is responsible for:

1. Managing the current PV surplus value
2. Distributing surplus power among active charging sessions
3. Adjusting charging profiles to prioritize renewable energy
4. Maintaining normal charging when no surplus is available

The PV Surplus Charging routes (`pvSurplusCharging.mjs`) handle:

1. REST API endpoints for external systems
2. Input validation and error handling
3. Communication with the PV Surplus Charging service

## Integration with CitrineOS

The feature integrates with CitrineOS through:

1. Monitoring active charging sessions via CitrineOS API
2. Adjusting charging profiles using SetChargingProfile OCPP commands
3. Distributing surplus power among active charging sessions

## Configuration

The service uses environment variables from the main application:

- `CITRINEOS_API_URL`: CitrineOS API endpoint
- `CITRINEOS_TENANT_ID`: CitrineOS tenant identifier

## Testing

The service can be tested by:

1. Sending a POST request to `/api/pv-surplus` with a surplus value
2. Sending a GET request to `/api/pv-surplus` to retrieve the current surplus
3. Sending a POST request to `/api/pv-surplus/optimize-charging` as an admin user

## Future Enhancements

Planned improvements include:

1. Automatic optimization triggered by surplus updates
2. Integration with actual CitrineOS API for active session monitoring
3. More sophisticated power distribution algorithms
4. Historical data tracking and reporting