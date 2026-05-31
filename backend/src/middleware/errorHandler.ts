import type { Request, Response, NextFunction } from 'express';
import { ZodError } from 'zod';
import { config } from '../config.js';

// ---- Typed application errors ----------------------------------------

export class AppError extends Error {
  constructor(
    public readonly statusCode: number,
    message: string,
    public readonly code?: string,
  ) {
    super(message);
    this.name = 'AppError';
    Error.captureStackTrace(this, this.constructor);
  }
}

export class NotFoundError extends AppError {
  constructor(resource = 'Resource') {
    super(404, `${resource} not found`, 'NOT_FOUND');
  }
}

export class UnauthorizedError extends AppError {
  constructor(message = 'Authentication required') {
    super(401, message, 'UNAUTHORIZED');
  }
}

export class ForbiddenError extends AppError {
  constructor(message = 'Insufficient permissions') {
    super(403, message, 'FORBIDDEN');
  }
}

export class ConflictError extends AppError {
  constructor(message: string) {
    super(409, message, 'CONFLICT');
  }
}

export class BadRequestError extends AppError {
  constructor(message: string) {
    super(400, message, 'BAD_REQUEST');
  }
}

// ---- Centralised error handler middleware -----------------------------

interface ErrorResponseBody {
  error: {
    code: string;
    message: string;
    details?: unknown;
  };
}

// Express 5 error handlers accept 4 arguments; the types require all 4.
// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function errorHandler(
  err: unknown,
  req: Request,
  res: Response,
  _next: NextFunction,
): void {
  // ZodError — validation failure
  if (err instanceof ZodError) {
    const body: ErrorResponseBody = {
      error: {
        code: 'VALIDATION_ERROR',
        message: 'Request validation failed',
        details: err.flatten().fieldErrors,
      },
    };
    res.status(400).json(body);
    return;
  }

  // Application-layer errors
  if (err instanceof AppError) {
    const body: ErrorResponseBody = {
      error: {
        code: err.code ?? 'APP_ERROR',
        message: err.message,
      },
    };
    res.status(err.statusCode).json(body);
    return;
  }

  // PostgreSQL unique constraint violation
  if (
    err instanceof Error &&
    'code' in err &&
    (err as NodeJS.ErrnoException).code === '23505'
  ) {
    const body: ErrorResponseBody = {
      error: {
        code: 'CONFLICT',
        message: 'Resource already exists',
      },
    };
    res.status(409).json(body);
    return;
  }

  // Unexpected errors — never leak internals in production
  console.error('[errorHandler] Unhandled error:', err);

  const body: ErrorResponseBody = {
    error: {
      code: 'INTERNAL_SERVER_ERROR',
      message:
        config.NODE_ENV === 'production'
          ? 'An internal error occurred'
          : err instanceof Error
            ? err.message
            : String(err),
    },
  };
  res.status(500).json(body);
}
