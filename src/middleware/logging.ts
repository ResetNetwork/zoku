import { Context, Next } from 'hono';
import { Logger, LogLevel } from '../lib/logger';

export function loggingMiddleware() {
  return async (c: Context, next: Next) => {
    const requestId = crypto.randomUUID().slice(0, 8);
    const sessionId = c.req.header('X-Zoku-Session-ID');
    const startTime = Date.now();

    // Get log level from environment or default to 'info'
    const logLevel = (c.env?.LOG_LEVEL as LogLevel) || 'info';

    // Create logger and attach to context
    const logger = new Logger({
      request_id: requestId,
      session_id: sessionId,
      operation: 'api_request',
      path: c.req.path,
      method: c.req.method
    }, logLevel);

    c.set('logger', logger);
    c.set('requestId', requestId);
    c.set('startTime', startTime);

    // Log request start
    logger.info('Request started', {
      query: Object.fromEntries(new URL(c.req.url).searchParams),
      user_agent: c.req.header('user-agent')
    });

    try {
      await next();

      // Log request completion
      const duration = Date.now() - startTime;
      logger.info('Request completed', {
        status_code: c.res.status,
        duration_ms: duration
      });
    } catch (error) {
      // Log unhandled errors
      const duration = Date.now() - startTime;
      logger.error('Request failed', error as Error, {
        duration_ms: duration
      });
      throw error;
    }
  };
}
