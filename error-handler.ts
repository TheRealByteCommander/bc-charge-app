import logger from './logger';

export interface AppError extends Error {
  statusCode?: number;
  isOperational?: boolean;
}

export const handleError = (error: AppError): void => {
  const statusCode = error.statusCode || 500;
  const message = error.message || 'Internal Server Error';

  logger.error({
    message,
    stack: error.stack,
    statusCode,
    isOperational: error.isOperational,
  });

  if (!error.isOperational) {
    logger.warn('Non-operational error detected. Consider restarting the process.');
    // In a real production environment, you might trigger a graceful shutdown here
  }
};

export const setupGlobalErrorHandlers = (): void => {
  process.on('uncaughtException', (error: Error) => {
    handleError(error as AppError);
    process.exit(1);
  });

  process.on('unhandledRejection', (reason: any) => {
    const error = reason instanceof Error ? reason : new Error(String(reason));
    handleError(error as AppError);
  });
};
