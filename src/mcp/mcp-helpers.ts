import { DB } from '../db';
import { Logger } from '../lib/logger';
import type { Zoku } from '../types';
import { EntanglementService, ZokuService, QuptService, JewelService, SourceService } from '../services';
import type { Env } from '../types';

/**
 * Create all services for MCP tool use
 */
export function createServices(db: DB, user: Zoku, logger: Logger, env: Env, requestId?: string) {
  return {
    entanglements: new EntanglementService(db, user, logger, requestId),
    zoku: new ZokuService(db, user, logger, requestId),
    qupts: new QuptService(db, user, logger, requestId),
    jewels: new JewelService(db, user, logger, requestId, env),
    sources: new SourceService(db, user, logger, requestId, env)
  };
}

/**
 * Wrapper to handle MCP tool execution with logging
 */
export async function mcpToolWrapper(
  toolName: string,
  logger: Logger,
  sessionId: string | undefined,
  fn: () => Promise<any>
) {
  const toolLogger = logger.child({ tool: toolName, session_id: sessionId });
  const startTime = Date.now();

  try {
    const result = await fn();
    toolLogger.info('Tool completed', { duration_ms: Date.now() - startTime });
    
    return {
      content: [{
        type: 'text',
        text: JSON.stringify(result, null, 2)
      }]
    };
  } catch (error) {
    toolLogger.error('Tool failed', error as Error, { duration_ms: Date.now() - startTime });
    throw error;
  }
}
