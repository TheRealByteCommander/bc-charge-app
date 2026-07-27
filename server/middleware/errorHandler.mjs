import { Request, Response, NextFunction } from 'express';
import { logger } from './utils/logger.mjs';

export interface AppError extends Error {
  statusCode: number;
  isOperational: boolean;
}

export class ErrorHandler extends Error {
  constructor(public message: string, public statusCode: number = 500, public isOperational = true) {
    super(message);
    Object.setPrototypeOf(this, ErrorHandler.prototype);
  }
}

export const errorHandlerMiddleware = (err: any, req: Request, res: Response, next: NextFunction) => {
  const statusCode = err.statusCode || 500;
  const message = err.message || 'Internal Server Error';
  const isOperational = err.isOperational !== false;

  logger.error(`[Request Error] ${req.method} ${req.url} - ${message}`, err);

  res.status(statusCode).json({
    status: 'error',
    statusCode,
    message: isOperational ? message : 'Ein unerwarteter Fehler ist aufgetreten.',
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack }),
  });
};
