# Dynamic Load Management Implementation for BC Charge

## Overview

This document describes the implementation of Dynamic Load Management (DLM) for the BC Charge CitrineOS deployment. The implementation follows the requirements specified in section 1.1 of the CitrineOS Extensions Roadmap.

## Implementation Details

### Architecture

The LoadManager service is implemented as a separate Node.js service that communicates with CitrineOS via WebSocket. It:

1. Connects to CitrineOS via WebSocket to receive real-time MeterValues
2. Aggregates power consumption across all connected charging stations
3. Dynamically adjusts charging profiles using SetChargingProfile commands when total consumption approaches site limits
4. Provides health monitoring and configuration via environment variables

### Key Components

#### LoadManager Service (`backend/src/services/LoadManager.ts`)

The core service that implements the load management logic:

- **Station Registration**: Registers charging stations with their maximum power capabilities
- **Power Monitoring**: Tracks real-time power consumption from MeterValues
- **Load Adjustment**: Calculates and applies charging profile adjustments when needed
- **WebSocket Communication**: Handles communication with CitrineOS

#### Configuration (`backend/src/index.ts`)

The service can be configured via environment variables:

- `MAX_SITE_POWER`: Maximum power allowed for the site (kW)
- `ADJUSTMENT_THRESHOLD`: Threshold to trigger adjustment (kW)
- `ADJUSTMENT_DELAY`: Delay before adjustment (ms)
- `MONITORING_INTERVAL`: How often to check loads (ms)
- `CITRINE_WS_URL`: CitrineOS WebSocket URL

#### Docker Integration (`backend/Dockerfile` and `backend/docker-compose.yml`)

The service is containerized and integrated into the existing CitrineOS docker-compose setup:

- Built as a separate service in the docker-compose file
- Shares network with CitrineOS for direct communication
- Configurable via environment variables

### Implementation Flow

1. **Initialization**: Service starts and connects to CitrineOS WebSocket
2. **Station Registration**: Charging stations are registered with their maximum power
3. **Monitoring**: MeterValues are received and processed to update current power consumption
4. **Load Checking**: Periodically checks if total consumption is approaching site limits
5. **Adjustment**: When needed, calculates proportional power reductions and sends SetChargingProfile commands
6. **Monitoring**: Continues monitoring and adjusting as needed

### OCPP Compliance

The implementation follows OCPP 1.6 standards:

- Uses `MeterValues` for power consumption data
- Uses `SetChargingProfile` for load adjustment
- Implements proper WebSocket communication patterns

### Performance Requirements

The implementation meets the requirements specified in the roadmap:

- **Response Time**: Adjustments happen within 5 seconds of detecting overload
- **Grid Protection**: Prevents circuit breaker tripping by staying within site limits
- **Proportional Adjustment**: Distributes load reduction fairly across active stations

## Deployment

### Prerequisites

- Docker and Docker Compose
- Node.js 18+ (for development)

### Installation

1. Clone the repository
2. Navigate to the backend directory
3. Run `npm install` to install dependencies
4. Run `docker-compose up -d` to start all services

### Configuration

The service can be configured via environment variables in the docker-compose.yml file:

```yaml
load-manager:
  build: 
    context: .
    dockerfile: Dockerfile
  restart: always
  environment:
    - CITRINE_WS_URL=ws://citrineos:8080
    - MAX_SITE_POWER=50
    - ADJUSTMENT_THRESHOLD=5
  depends_on:
    - citrineos
```

## Testing

Unit tests are implemented using Jest:

- Test station registration and removal
- Test power consumption tracking
- Test load adjustment calculations
- Test WebSocket communication handling

Run tests with `npm test`

## Monitoring

The service provides health check endpoints:

- `/health`: Basic health status
- `/health/detailed`: Detailed status including station count

## Future Enhancements

Potential enhancements that could be added:

1. Integration with external energy price APIs for cost optimization
2. Advanced load forecasting based on historical usage patterns
3. Integration with smart grid signals for grid services
4. Multi-site load management coordination