import { citrineosConfig } from '../../config/citrineos';
import { isBackendMode } from '../../services/backendMode';
import { apiConfig } from '../../config/api';
import type { HasuraChargingStationRow } from './types';

// Subscription query for real-time station updates
const STATION_SUBSCRIPTION = `
  subscription BcChargeStationUpdates($tenantId: Int!) {
    ChargingStations(where: { tenantId: { _eq: $tenantId } }) {
      id
      ocppConnectionName
      isOnline
      chargePointVendor
      chargePointModel
      coordinates
      Location {
        id
        name
        address
        city
        postalCode
        country
        coordinates
      }
      Evses {
        id
        evseId
        Connectors {
          id
          connectorId
          status
          type
          maximumPowerWatts
          tariffId
          Tariff {
            id
            pricePerKwh
            pricePerMin
            pricePerSession
            currency
          }
        }
      }
    }
  }
`;

// WebSocket connection for Hasura subscriptions
let hasuraWs: WebSocket | null = null;
let subscriptionActive = false;
let reconnectAttempts = 0;
const MAX_RECONNECT_ATTEMPTS = 5;

// Callback for station updates
let stationUpdateCallback: ((stations: HasuraChargingStationRow[]) => void) | null = null;

/**
 * Initialize WebSocket connection for Hasura subscriptions
 */
export function initHasuraSubscription(callback: (stations: HasuraChargingStationRow[]) => void): void {
  if (subscriptionActive) {
    console.warn('[BC Charge] Hasura subscription is already active');
    return;
  }

  stationUpdateCallback = callback;
  subscriptionActive = true;
  reconnectAttempts = 0;
  
  connectWebSocket();
}

/**
 * Establish WebSocket connection to Hasura
 */
function connectWebSocket(): void {
  if (!subscriptionActive) return;
  
  try {
    // Close existing connection if any
    if (hasuraWs) {
      hasuraWs.close();
      hasuraWs = null;
    }
    
    // Determine WebSocket URL
    let wsUrl: string;
    if (isBackendMode()) {
      // In backend mode, we need to proxy the WebSocket connection
      wsUrl = `${apiConfig.baseUrl.replace('http', 'ws')}/api/citrineos/hasura-ws`;
    } else {
      // Direct connection to Hasura
      const hasuraUrl = citrineosConfig.hasuraUrl.replace('http', 'ws').replace('/v1/graphql', '/v1/graphql');
      wsUrl = hasuraUrl;
    }
    
    console.log('[BC Charge] Connecting to Hasura WebSocket:', wsUrl);
    
    // Create WebSocket connection
    hasuraWs = new WebSocket(wsUrl, 'graphql-ws');
    
    // Set up event handlers
    hasuraWs.onopen = handleWsOpen;
    hasuraWs.onmessage = handleWsMessage;
    hasuraWs.onerror = handleWsError;
    hasuraWs.onclose = handleWsClose;
  } catch (error) {
    console.error('[BC Charge] Failed to create WebSocket connection:', error);
    scheduleReconnect();
  }
}

/**
 * Handle WebSocket open event
 */
function handleWsOpen(): void {
  console.log('[BC Charge] Hasura WebSocket connection established');
  reconnectAttempts = 0;
  
  // Send connection init message
  if (hasuraWs?.readyState === WebSocket.OPEN) {
    hasuraWs.send(JSON.stringify({
      type: 'connection_init',
      payload: isBackendMode() ? {} : {
        headers: {
          'x-hasura-admin-secret': citrineosConfig.hasuraAdminSecret
        }
      }
    }));
  }
}

/**
 * Handle WebSocket message event
 */
function handleWsMessage(event: MessageEvent): void {
  try {
    const message = JSON.parse(event.data);
    
    switch (message.type) {
      case 'connection_ack':
        // Connection acknowledged, now start subscription
        startSubscription();
        break;
        
      case 'data':
        // Subscription data received
        if (message.payload?.data?.ChargingStations && stationUpdateCallback) {
          console.log('[BC Charge] Received station updates via subscription');
          stationUpdateCallback(message.payload.data.ChargingStations);
        }
        break;
        
      case 'ka':
        // Keep alive message, ignore
        break;
        
      case 'error':
        console.error('[BC Charge] Hasura subscription error:', message.payload);
        break;
        
      default:
        console.log('[BC Charge] Unknown WebSocket message type:', message.type);
    }
  } catch (error) {
    console.error('[BC Charge] Error parsing WebSocket message:', error);
  }
}

/**
 * Handle WebSocket error event
 */
function handleWsError(event: Event): void {
  console.error('[BC Charge] Hasura WebSocket error:', event);
  scheduleReconnect();
}

/**
 * Handle WebSocket close event
 */
function handleWsClose(): void {
  console.log('[BC Charge] Hasura WebSocket connection closed');
  
  if (subscriptionActive) {
    scheduleReconnect();
  }
}

/**
 * Start the station subscription
 */
function startSubscription(): void {
  if (!hasuraWs || hasuraWs.readyState !== WebSocket.OPEN) {
    console.warn('[BC Charge] Cannot start subscription, WebSocket not open');
    return;
  }
  
  console.log('[BC Charge] Starting station subscription');
  
  hasuraWs.send(JSON.stringify({
    id: 'station-subscription',
    type: 'start',
    payload: {
      query: STATION_SUBSCRIPTION,
      variables: {
        tenantId: citrineosConfig.tenantId
      }
    }
  }));
}

/**
 * Schedule a reconnect attempt
 */
function scheduleReconnect(): void {
  if (!subscriptionActive) return;
  
  if (reconnectAttempts < MAX_RECONNECT_ATTEMPTS) {
    reconnectAttempts++;
    console.log(`[BC Charge] Scheduling reconnect attempt ${reconnectAttempts} in ${reconnectAttempts * 2} seconds`);
    
    setTimeout(() => {
      if (subscriptionActive) {
        connectWebSocket();
      }
    }, reconnectAttempts * 2000);
  } else {
    console.error('[BC Charge] Max reconnect attempts reached, giving up');
    subscriptionActive = false;
  }
}

/**
 * Stop the Hasura subscription
 */
export function stopHasuraSubscription(): void {
  console.log('[BC Charge] Stopping Hasura subscription');
  
  subscriptionActive = false;
  
  if (hasuraWs) {
    // Send stop message for subscription
    if (hasuraWs.readyState === WebSocket.OPEN) {
      hasuraWs.send(JSON.stringify({
        id: 'station-subscription',
        type: 'stop'
      }));
      
      // Close connection
      hasuraWs.close();
    }
    hasuraWs = null;
  }
  
  stationUpdateCallback = null;
}