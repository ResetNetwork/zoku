// MCP Server - Manual JSON-RPC implementation with SDK types
// Note: Attempted SDK integration but hit compatibility issues with Cloudflare Workers
// Using manual JSON-RPC handling with SDK types for now

import { z } from 'zod';
import type { Context } from 'hono';
import type { Bindings } from '../types';
import { DB } from '../db';
import { Logger, LogLevel } from '../lib/logger';

// Zod schemas for runtime validation (keeping from original)
const schemas = {
  list_entanglements: z.object({
    status: z.enum(['draft', 'active', 'paused', 'complete', 'archived']).optional(),
    function: z.enum(['tech_innovation', 'info_tech']).optional(),
    parent_id: z.string().optional(),
    root_only: z.boolean().optional(),
    limit: z.number().optional(),
    detailed: z.boolean().optional()
  }),
  get_volition: z.object({
    id: z.string(),
    include_children_qupts: z.boolean().optional(),
    detailed: z.boolean().optional()
  }),
  get_child_entanglements: z.object({
    parent_id: z.string(),
    recursive: z.boolean().optional()
  }),
  create_entanglement: z.object({
    name: z.string(),
    description: z.string().optional(),
    parent_id: z.string().optional(),
    initial_zoku: z.array(z.object({
      zoku_id: z.string(),
      role: z.enum(['perform', 'accountable', 'control', 'support', 'informed'])
    })).optional()
  }),
  update_entanglement: z.object({
    id: z.string(),
    name: z.string().optional(),
    description: z.string().optional(),
    parent_id: z.string().optional()
  }),
  move_entanglement: z.object({
    id: z.string(),
    new_parent_id: z.string().optional()
  }),
  delete_entanglement: z.object({
    id: z.string(),
    confirm: z.boolean()
  }),
  create_qupt: z.object({
    entanglement_id: z.string(),
    content: z.string(),
    zoku_id: z.string().optional(),
    metadata: z.record(z.any()).optional()
  }),
  list_qupts: z.object({
    entanglement_id: z.string(),
    recursive: z.boolean().optional(),
    source: z.string().optional(),
    limit: z.number().optional(),
    detailed: z.boolean().optional()
  }),
  list_zoku: z.object({
    type: z.enum(['human', 'agent']).optional(),
    limit: z.number().optional()
  }),
  create_zoku: z.object({
    name: z.string(),
    type: z.enum(['human', 'agent']),
    metadata: z.record(z.any()).optional()
  }),
  get_entangled: z.object({
    id: z.string()
  }),
  entangle: z.object({
    entanglement_id: z.string(),
    zoku_id: z.string(),
    role: z.enum(['perform', 'accountable', 'control', 'support', 'informed'])
  }),
  disentangle: z.object({
    entanglement_id: z.string(),
    zoku_id: z.string(),
    role: z.enum(['perform', 'accountable', 'control', 'support', 'informed'])
  }),
  get_matrix: z.object({
    entanglement_id: z.string()
  }),
  list_dimensions: z.object({}),
  set_attributes: z.object({
    entanglement_id: z.string(),
    attributes: z.array(z.object({
      dimension: z.string(),
      value: z.string()
    }))
  }),
  get_attributes: z.object({
    entanglement_id: z.string()
  }),
  list_sources: z.object({
    entanglement_id: z.string()
  }),
  add_source: z.object({
    entanglement_id: z.string(),
    type: z.enum(['github', 'gmail', 'zammad', 'gdrive', 'webhook']),
    config: z.record(z.any()),
    credentials: z.record(z.any()).optional(),
    jewel_id: z.string().optional()
  }),
  sync_source: z.object({
    source_id: z.string()
  }),
  remove_source: z.object({
    source_id: z.string()
  }),
  toggle_source: z.object({
    source_id: z.string(),
    enabled: z.boolean()
  }),
  add_jewel: z.object({
    name: z.string(),
    type: z.enum(['github', 'gmail', 'zammad', 'gdrive']),
    data: z.record(z.any())
  }),
  list_jewels: z.object({
    type: z.enum(['github', 'gmail', 'zammad', 'gdrive']).optional(),
    limit: z.number().optional()
  }),
  get_credential: z.object({
    id: z.string()
  }),
  update_jewel: z.object({
    id: z.string(),
    name: z.string().optional(),
    data: z.record(z.any()).optional()
  }),
  delete_jewel: z.object({
    id: z.string()
  }),
  get_jewel_usage: z.object({
    id: z.string()
  })
};

// Tool definitions for tools/list response
const tools = [
  {
    name: 'list_entanglements',
    description: 'List entanglements in the Zoku system',
    inputSchema: {
      type: 'object',
      properties: {
        status: { type: 'string', enum: ['draft', 'active', 'paused', 'complete', 'archived'], description: 'Filter by status' },
        function: { type: 'string', enum: ['tech_innovation', 'info_tech'], description: 'Filter by function' },
        parent_id: { type: 'string', description: 'Get children of a specific entanglement' },
        root_only: { type: 'boolean', description: 'Only return top-level entanglements', default: false },
        limit: { type: 'number', description: 'Max results to return', default: 20 },
        detailed: { type: 'boolean', description: 'Return full nested data', default: false }
      }
    }
  },
  {
    name: 'get_volition',
    description: 'Get entanglement details. By default returns minimal info (counts only). Use detailed=true for full nested data.',
    inputSchema: {
      type: 'object',
      properties: {
        id: { type: 'string', description: 'Entanglement ID' },
        include_children_qupts: { type: 'boolean', description: 'Include qupts from child entanglements', default: true },
        detailed: { type: 'boolean', description: 'Return full nested data (children, matrix, attributes, qupts). Default: false (returns counts only)', default: false }
      },
      required: ['id']
    }
  },
  // Add remaining 27 tools...
  {
    name: 'create_zoku',
    description: 'Register a new zoku (human or AI agent)',
    inputSchema: {
      type: 'object',
      properties: {
        name: { type: 'string', description: 'Name of the entity' },
        type: { type: 'string', enum: ['human', 'agent'] },
        metadata: { type: 'object', description: 'Additional metadata' }
      },
      required: ['name', 'type']
    }
  }
];

// Tool execution handler
async function executeToolCall(name: string, args: any, db: DB, encryptionKey: string, logger: Logger): Promise<any> {
  const toolLogger = logger.child({ operation: 'mcp_tool', tool: name });
  toolLogger.info('Tool execution started');
  const startTime = Date.now();

  try {
    let result: any;

    switch (name) {
      case 'list_entanglements': {
        const input = schemas.list_entanglements.parse(args);
        const entanglements = await db.listEntanglements({
          parent_id: input.parent_id,
          root_only: input.root_only,
          limit: input.limit
        });

        const entanglementsWithCounts = await Promise.all(
          entanglements.map(async v => {
            const qupts_count = (await db.listQupts({ entanglement_id: v.id, recursive: true, limit: 1000 })).length;
            const sources_count = (await db.listSources(v.id)).length;

            if (!input.detailed) {
              return {
                id: v.id,
                name: v.name,
                parent_id: v.parent_id,
                created_at: v.created_at,
                updated_at: v.updated_at,
                qupts_count,
                sources_count
              };
            }

            return { ...v, qupts_count, sources_count };
          })
        );

        toolLogger.info('Listed entanglements', { count: entanglementsWithCounts.length });
        result = { entanglements: entanglementsWithCounts };
        break;
      }

      case 'create_zoku': {
        const input = schemas.create_zoku.parse(args);
        result = await db.createZoku(input);
        break;
      }

      // TODO: Implement remaining 27 tools
      default:
        throw new Error(`Tool not implemented: ${name}`);
    }

    const duration = Date.now() - startTime;
    toolLogger.info('Tool execution completed', {
      duration_ms: duration,
      result_size: JSON.stringify(result).length
    });

    return result;
  } catch (error) {
    const duration = Date.now() - startTime;
    toolLogger.error('Tool execution failed', error as Error, {
      duration_ms: duration
    });
    throw error;
  }
}

// HTTP handler for Hono
export async function mcpHandler(c: Context<{ Bindings: Bindings }>) {
  const db = new DB(c.env.DB);

  // Generate request ID (preserve existing pattern)
  const requestId = crypto.randomUUID().slice(0, 8);
  const logLevel = (c.env?.LOG_LEVEL as LogLevel) || 'info';
  const sessionId = c.req.header('X-Zoku-Session-ID') || undefined;

  const logger = new Logger({
    request_id: requestId,
    session_id: sessionId,
    operation: 'mcp_request',
  }, logLevel);

  logger.info('MCP request received');

  try {
    const request = await c.req.json();
    const { jsonrpc, id, method, params } = request;

    if (jsonrpc !== '2.0') {
      return c.json({
        jsonrpc: '2.0',
        id,
        error: { code: -32600, message: 'Invalid Request: jsonrpc must be 2.0' }
      }, 400);
    }

    // Handle initialize
    if (method === 'initialize') {
      logger.info('Initialize request received');
      return c.json({
        jsonrpc: '2.0',
        id,
        result: {
          protocolVersion: '2024-11-05',
          capabilities: {
            tools: {},
          },
          serverInfo: {
            name: 'zoku',
            version: '1.0.0'
          }
        }
      });
    }

    // Handle tools/list
    if (method === 'tools/list') {
      logger.info('Tools list requested');
      return c.json({
        jsonrpc: '2.0',
        id,
        result: { tools }
      });
    }

    // Handle tools/call
    if (method === 'tools/call') {
      const { name, arguments: args } = params;
      logger.info('Tool call requested', { tool: name });

      const startTime = Date.now();
      const result = await executeToolCall(name, args, db, c.env.ENCRYPTION_KEY, logger);
      const duration = Date.now() - startTime;

      logger.info('MCP request completed', { duration_ms: duration });

      return c.json({
        jsonrpc: '2.0',
        id,
        result: {
          content: [
            {
              type: 'text',
              text: JSON.stringify(result, null, 2)
            }
          ]
        }
      });
    }

    // Unknown method
    return c.json({
      jsonrpc: '2.0',
      id,
      error: { code: -32601, message: `Method not found: ${method}` }
    }, 404);

  } catch (error) {
    logger.error('MCP request failed', error as Error);
    return c.json({
      jsonrpc: '2.0',
      id: null,
      error: {
        code: -32700,
        message: error instanceof Error ? error.message : 'Parse error'
      }
    }, 500);
  }
}
