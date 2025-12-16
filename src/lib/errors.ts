import type { Context } from 'hono';
import { ZodError } from 'zod';
import { Logger } from './logger';

/**
 * Centralized error handling with sanitized error messages
 * Prevents information leakage (stack traces, DB errors) to clients
 */

export interface ApiError {
  code: string;
  message: string;
  details?: any;
}

export class AppError extends Error {
  constructor(
    public code: string,
    message: string,
    public statusCode: number = 500,
    public details?: any
  ) {
    super(message);
    this.name = 'AppError';
  }
}

/**
 * Predefined error types for common scenarios
 */
export class NotFoundError extends AppError {
  constructor(resource: string, id?: string) {
    super(
      'NOT_FOUND',
      id ? `${resource} with id '${id}' not found` : `${resource} not found`,
      404
    );
  }
}

export class ValidationError extends AppError {
  constructor(message: string, details?: any) {
    super('VALIDATION_ERROR', message, 400, details);
  }
}

export class UnauthorizedError extends AppError {
  constructor(message: string = 'Authentication required') {
    super('UNAUTHORIZED', message, 401);
  }
}

export class ForbiddenError extends AppError {
  constructor(message: string = 'Insufficient permissions') {
    super('FORBIDDEN', message, 403);
  }
}

export class ConflictError extends AppError {
  constructor(message: string) {
    super('CONFLICT', message, 409);
  }
}

export class InternalError extends AppError {
  constructor(message: string = 'Internal server error') {
    super('INTERNAL_ERROR', message, 500);
  }
}

/**
 * Sanitize error for client response
 * Removes sensitive information (stack traces, DB errors)
 */
function sanitizeError(error: unknown, logger: Logger): ApiError {
  // Known AppError - already sanitized
  if (error instanceof AppError) {
    return {
      code: error.code,
      message: error.message,
      details: error.details
    };
  }

  // Zod validation error - format nicely
  if (error instanceof ZodError) {
    const issues = error.issues.map(issue => ({
      path: issue.path.join('.'),
      message: issue.message
    }));
    
    return {
      code: 'VALIDATION_ERROR',
      message: 'Request validation failed',
      details: { issues }
    };
  }

  // Database errors - sanitize completely
  if (error instanceof Error) {
    const message = error.message.toLowerCase();
    
    // UNIQUE constraint violations
    if (message.includes('unique constraint')) {
      if (message.includes('email')) {
        return {
          code: 'CONFLICT',
          message: 'Email address already in use'
        };
      }
      if (message.includes('external_id')) {
        return {
          code: 'CONFLICT',
          message: 'This activity already exists (duplicate external ID)'
        };
      }
      return {
        code: 'CONFLICT',
        message: 'A record with these values already exists'
      };
    }
    
    // FOREIGN KEY constraint violations
    if (message.includes('foreign key constraint')) {
      return {
        code: 'VALIDATION_ERROR',
        message: 'Referenced resource does not exist'
      };
    }
    
    // CHECK constraint violations
    if (message.includes('check constraint')) {
      if (message.includes('access_tier')) {
        return {
          code: 'VALIDATION_ERROR',
          message: 'Invalid access tier. Must be: observed, coherent, entangled, or prime'
        };
      }
      return {
        code: 'VALIDATION_ERROR',
        message: 'Invalid value for field constraint'
      };
    }
    
    // NOT NULL constraint violations
    if (message.includes('not null constraint')) {
      return {
        code: 'VALIDATION_ERROR',
        message: 'Required field is missing'
      };
    }

    // Log full error for debugging (server-side only)
    logger.error('Unexpected error', error, {
      type: error.constructor.name
    });
  }

  // Unknown error - completely generic response
  logger.error('Unknown error type', undefined, { error: String(error) });
  
  return {
    code: 'INTERNAL_ERROR',
    message: 'An unexpected error occurred. Please try again later.'
  };
}

/**
 * Global error handler middleware for Hono
 * Catches all errors and returns sanitized responses
 */
export function errorHandler() {
  return async (c: Context, next: () => Promise<void>) => {
    try {
      await next();
    } catch (error) {
      const logger = c.get('logger') as Logger || new Logger(c.get('request_id'));
      
      // Sanitize error
      const apiError = sanitizeError(error, logger);
      
      // Determine status code
      let statusCode = 500;
      if (error instanceof AppError) {
        statusCode = error.statusCode;
      } else if (error instanceof ZodError) {
        statusCode = 400;
      }
      
      // Log error with context
      logger.error('Request failed', error instanceof Error ? error : undefined, {
        api_error: apiError,
        path: c.req.path,
        method: c.req.method,
        status: statusCode
      });
      
      // Return sanitized error
      return c.json({ error: apiError }, statusCode);
    }
  };
}

/**
 * Validate request body with Zod schema
 * Throws ValidationError on failure
 */
export async function validateBody<T>(
  c: Context,
  schema: { parse: (data: any) => T }
): Promise<T> {
  try {
    const body = await c.req.json();
    return schema.parse(body) as T;
  } catch (error) {
    if (error instanceof ZodError) {
      throw error; // Will be caught by errorHandler
    }
    throw new ValidationError('Invalid JSON in request body');
  }
}

/**
 * Validate query parameters with Zod schema
 * Throws ValidationError on failure
 */
export function validateQuery<T>(
  c: Context,
  schema: { parse: (data: any) => T }
): T {
  try {
    const query = Object.fromEntries(
      Object.entries(c.req.query()).map(([key, value]) => {
        // Convert numeric strings to numbers
        if (/^\d+$/.test(value)) {
          return [key, parseInt(value, 10)];
        }
        // Convert boolean strings
        if (value === 'true') return [key, true];
        if (value === 'false') return [key, false];
        return [key, value];
      })
    );
    return schema.parse(query) as T;
  } catch (error) {
    if (error instanceof ZodError) {
      throw error;
    }
    throw new ValidationError('Invalid query parameters');
  }
}
