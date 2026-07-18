/**
 * Test file for price-based charging optimization
 */

import { optimizeChargingForConnector, getPriceOptimizationConfig, updatePriceOptimizationConfig } from './priceOptimizer.mjs';

// Test data
const TEST_STATION_ID = 'TEST-STATION-001';
const TEST_EVSE_ID = 1;
const TEST_CONNECTOR_ID = 1;
const TEST_MAX_POWER_WATTS = 22000;

console.log('Running price optimization tests...');

// Test 1: Get default configuration
console.log('\nTest 1: Get default configuration');
try {
  const config = getPriceOptimizationConfig();
  console.log('✓ Configuration retrieved successfully:', config);
} catch (error) {
  console.error('✗ Failed to get configuration:', error);
}

// Test 2: Update configuration
console.log('\nTest 2: Update configuration');
try {
  updatePriceOptimizationConfig({ priceThreshold: 0.40 });
  const config = getPriceOptimizationConfig();
  if (config.priceThreshold === 0.40) {
    console.log('✓ Configuration updated successfully');
  } else {
    console.error('✗ Configuration update failed');
  }
} catch (error) {
  console.error('✗ Failed to update configuration:', error);
}

// Note: Test 3 requires a running CitrineOS instance and is skipped in this test file
console.log('\nTest 3: Optimize charging (requires CitrineOS - skipped in unit test)');

console.log('\nUnit tests completed. To test full integration, run with a CitrineOS instance.');