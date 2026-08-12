import { logger } from '../utils/logger.mjs';

/**
 * Operational app error with HTTP status.
 * Prefer throwing this (or plain Error with statusCode) from routes/services.
 */
export class AppError extends Error {
  /**
   * @param {string} message
   * @param {number} [statusCode=500]
   * @param {boolean} [isOperational=true]
   */
  constructor(message, statusCode = 500, isOperational = true) {
    super(message);
    this.name = 'AppError';
    this.statusCode = statusCode;
    this.isOperational = isOperational;
  }
}

/** @deprecated Use AppError — kept for existing imports */
export class ErrorHandler extends AppError {
  /**
   * @param {string} message
   * @param {number} [statusCode=500]
   * @param {boolean} [isOperational=true]
   */
  constructor(message, statusCode = 500, isOperational = true) {
    super(message, statusCode, isOperational);
    this.name = 'ErrorHandler';
  }
}

/**
 * Express error middleware (4-arg). Must stay plain ESM — app imports .mjs at runtime.
 * @param {unknown} err
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 * @param {import('express').NextFunction} _next
 */
export function errorHandlerMiddleware(err, req, res, _next) {
  const e = err && typeof err === 'object' ? err : {};
  const statusCode =
    typeof e.statusCode === 'number' && e.statusCode >= 400 && e.statusCode < 600
      ? e.statusCode
      : 500;
  const message =
    typeof e.message === 'string' && e.message.trim()
      ? e.message
      : 'Internal Server Error';
  const isOperational = e.isOperational !== false && statusCode < 500;

  logger.error(`[Request Error] ${req.method} ${req.originalUrl || req.url} - ${message}`, {
    statusCode,
    stack: e instanceof Error ? e.stack : undefined,
  });

  if (res.headersSent) {
    return;
  }

  res.status(statusCode).json({
    status: 'error',
    statusCode,
    message:
      isOperational || process.env.NODE_ENV === 'development'
        ? message
        : 'Ein unerwarteter Fehler ist aufgetreten.',
    ...(process.env.NODE_ENV === 'development' && e instanceof Error
      ? { stack: e.stack }
      : {}),
  });
}
