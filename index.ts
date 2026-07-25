import logger from './logger';
import { setupGlobalErrorHandlers } from './error-handler';

// Initialize global error boundaries
setupGlobalErrorHandlers();

logger.info('Application started: Logging and Error Boundary initialized.');

// Simulate a handled error
try {
  throw new Error('Test handled error');
} catch (e: any) {
  logger.error('Handled error caught: ' + e.message);
}

// Simulate an operational error (via the handler)
const { handleError } = require('./error-handler'); 
// Note: using require for quick check in this demo if needed, but sticking to imports for production

// Simulate an unhandled rejection to test the boundary
Promise.reject(new Error('Unhandled Promise Rejection Test'));

console.log('Wait for async error to trigger...');
