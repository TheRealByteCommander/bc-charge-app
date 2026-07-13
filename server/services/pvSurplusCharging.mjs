/**
 * PV Surplus Charging service for CitrineOS
 * 
 * This service implements solar surplus-based charging optimization by:
 * 1. Receiving PV surplus reports from external energy management systems
 * 2. Distributing surplus power among active charging sessions
 * 3. Adjusting charging profiles to prioritize renewable energy
 * 4. Maintaining normal charging when no surplus is available
 */

// In-memory storage for PV surplus data
let currentPvSurplus = 0; // kW
let surplusUpdateTime = null;

/**
 * Send OCPP message to CitrineOS
 * @param {string} path - API path
 * @param {string} stationId - Station identifier
 * @param {Object} body - Request body
 * @param {number} timeoutMs - Timeout in milliseconds
 * @returns {Promise<any>} Response from CitrineOS
 */
async function citrineosMessage(path, stationId, body, timeoutMs = 12_000) {
  if (!process.env.CITRINEOS_API_URL) {
    throw Object.assign(new Error('CitrineOS API nicht konfiguriert'), { status: 503 });
  }
  
  const url = new URL(path, `${process.env.CITRINEOS_API_URL.replace(/\/$/, '')}/`);
  url.searchParams.set('identifier', stationId);
  url.searchParams.set('tenantId', String(process.env.CITRINEOS_TENANT_ID ?? '1'));

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  let res;
  try {
    res = await fetch(url.toString(), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify(body),
      signal: controller.signal,
    });
  } finally {
    clearTimeout(timeout);
  }

  const text = await res.text();
  let parsed;
  try {
    parsed = text ? JSON.parse(text) : null;
  } catch {
    parsed = text;
  }
  if (!res.ok) {
    const msg =
      typeof parsed === 'object' && parsed?.message
        ? String(parsed.message)
        : `CitrineOS ${res.status}`;
    throw Object.assign(new Error(msg), { status: 502 });
  }
  return parsed;
}

/**
 * Update the current PV surplus value
 * @param {number} surplus - PV surplus in kW
 * @returns {void}
 */
export function updatePvSurplus(surplus) {
  if (typeof surplus !== 'number' || surplus < 0) {
    throw new Error('Invalid surplus value. Must be a non-negative number.');
  }
  
  currentPvSurplus = surplus;
  surplusUpdateTime = new Date();
  
  console.log(`PV surplus updated to ${surplus} kW at ${surplusUpdateTime.toISOString()}`);
}

/**
 * Get the current PV surplus value
 * @returns {{surplus: number, updateTime: Date|null}} Current PV surplus and update time
 */
export function getCurrentPvSurplus() {
  return {
    surplus: currentPvSurplus,
    updateTime: surplusUpdateTime
  };
}

/**
 * Get active charging sessions from CitrineOS
 * @returns {Promise<Array>} Array of active charging sessions
 */
async function getActiveChargingSessions() {
  try {
    // In a real implementation, this would fetch active sessions from CitrineOS
    // For now, we'll return a mock implementation
    // TODO: Implement actual CitrineOS API call to fetch active sessions
    
    // Mock data for demonstration
    return [
      // Example active sessions
      // { stationId: 'CS-001', connectorId: 1, evseId: 1, currentPower: 11000 }, // 11kW
      // { stationId: 'CS-002', connectorId: 1, evseId: 1, currentPower: 50000 }  // 50kW
    ];
  } catch (error) {
    console.error('Failed to fetch active charging sessions:', error);
    return [];
  }
}

/**
 * Set charging profile for a specific connector
 * @param {string} stationId - OCPP station identifier
 * @param {number} evseId - EVSE identifier
 * @param {number} connectorId - Connector identifier
 * @param {number} targetPowerWatts - Target power in watts
 * @returns {Promise<boolean>} True if successful
 */
async function setChargingProfile(stationId, evseId, connectorId, targetPowerWatts) {
  try {
    // Build the charging profile based on target power
    const chargingProfile = {
      evseId: evseId,
      chargingProfile: {
        chargingProfileId: Math.floor(Date.now() / 1000), // Unique ID
        stackLevel: 1,
        chargingProfilePurpose: "TxProfile",
        chargingProfileKind: "Absolute",
        chargingSchedule: {
          startSchedule: new Date().toISOString(),
          chargingRateUnit: "W",
          chargingSchedulePeriod: [
            {
              startPeriod: 0,
              limit: targetPowerWatts / 1000, // Convert to kW
              numberPhases: 3
            }
          ]
        }
      }
    };
    
    // Send the SetChargingProfile command to the station
    const result = await citrineosMessage(
      '/ocpp/2.0.1/smartcharging/setChargingProfile',
      stationId,
      chargingProfile,
      10000 // 10 second timeout
    );
    
    const success = Array.isArray(result) 
      ? result.some(r => r.success === true)
      : result?.success === true;
      
    if (!success) {
      console.warn(`SetChargingProfile command failed for station ${stationId}`, result);
      return false;
    }
    
    return true;
  } catch (error) {
    console.error(`Failed to set charging profile for station ${stationId}:`, error);
    return false;
  }
}

/**
 * Optimize charging based on available PV surplus
 * @returns {Promise<{success: boolean, message: string, surplus: number, sessionsAffected: number}>} Optimization result
 */
export async function optimizeChargingWithPvSurplus() {
  try {
    // Get current PV surplus
    const { surplus: pvSurplus } = getCurrentPvSurplus();
    
    // Get active charging sessions
    const activeSessions = await getActiveChargingSessions();
    
    if (activeSessions.length === 0) {
      return {
        success: true,
        message: 'No active charging sessions found',
        surplus: pvSurplus,
        sessionsAffected: 0
      };
    }
    
    // Calculate power distribution
    let sessionsAffected = 0;
    
    if (pvSurplus > 0) {
      // Distribute surplus power among active sessions
      const powerPerSession = (pvSurplus * 1000) / activeSessions.length; // Convert to watts
      
      // Apply charging profiles to each session
      for (const session of activeSessions) {
        const success = await setChargingProfile(
          session.stationId,
          session.evseId,
          session.connectorId,
          powerPerSession
        );
        
        if (success) {
          sessionsAffected++;
        }
      }
      
      return {
        success: true,
        message: `Distributed ${pvSurplus} kW of PV surplus among ${activeSessions.length} active sessions`,
        surplus: pvSurplus,
        sessionsAffected
      };
    } else {
      // No surplus available, maintain normal charging profiles
      return {
        success: true,
        message: 'No PV surplus available, maintaining normal charging profiles',
        surplus: pvSurplus,
        sessionsAffected: 0
      };
    }
  } catch (error) {
    console.error('Failed to optimize charging with PV surplus:', error);
    return {
      success: false,
      message: `Failed to optimize charging with PV surplus: ${error.message}`,
      surplus: getCurrentPvSurplus().surplus,
      sessionsAffected: 0
    };
  }
}

export default {
  updatePvSurplus,
  getCurrentPvSurplus,
  optimizeChargingWithPvSurplus
};