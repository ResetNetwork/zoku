// MCP Server implementation using official SDK - MIGRATED TO SERVICES
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StreamableHTTPTransport } from '@hono/mcp';
import { z } from 'zod';
import type { Context } from 'hono';
import type { HonoEnv } from '../types';
import { DB } from '../db';
import { Logger } from '../lib/logger';
import { createServices, mcpToolWrapper } from './mcp-helpers';

// Tool schemas using Zod (UNCHANGED)
const schemas = {
  list_entanglements: z.object({
    status: z.enum(['draft', 'active', 'paused', 'complete', 'archived']).optional().describe('Filter by status'),
    function: z.enum(['tech_innovation', 'info_tech']).optional().describe('Filter by function'),
    parent_id: z.string().optional().describe('Get children of a specific entanglement'),
    root_only: z.boolean().optional().default(false).describe('Only return top-level entanglements'),
    limit: z.number().optional().default(20).describe('Max results to return'),
    detailed: z.boolean().optional().default(false).describe('Include full details (default: counts only)')
  }),

  get_entanglement: z.object({
    id: z.string().describe('Entanglement ID'),
    include_children_qupts: z.boolean().optional().default(true).describe('Include qupts from child entanglements'),
    detailed: z.boolean().optional().default(false).describe('Return full nested data (children, matrix, attributes, qupts). Default: false (returns counts only)')
  }),

  get_child_entanglements: z.object({
    parent_id: z.string().describe('Parent entanglement ID'),
    recursive: z.boolean().optional().default(false).describe('Include all descendants, not just direct children')
  }),

  create_entanglement: z.object({
    name: z.string().describe('Name of the entanglement'),
    description: z.string().optional().describe('Description of the entanglement'),
    parent_id: z.string().optional().describe('Parent entanglement ID for nesting'),
    initial_zoku: z.array(z.object({
      zoku_id: z.string(),
      role: z.enum(['perform', 'accountable', 'control', 'support', 'informed'])
    })).optional().describe('Initial PASCI role assignments (e.g., [{ zoku_id: "ent-1", role: "accountable" }])')
  }),

  update_entanglement: z.object({
    id: z.string(),
    name: z.string().optional(),
    description: z.string().optional(),
    parent_id: z.string().optional().describe('Move to new parent (null to make root)')
  }),

  move_entanglement: z.object({
    id: z.string().describe('Entanglement ID to move'),
    new_parent_id: z.string().optional().describe('New parent entanglement ID, or null to make root-level')
  }),

  delete_entanglement: z.object({
    id: z.string().describe('Entanglement ID to delete'),
    confirm: z.boolean().default(false).describe('Must be true to confirm deletion')
  }),

  create_qupt: z.object({
    entanglement_id: z.string().describe('ID of the entanglement'),
    content: z.string().describe('Activity description'),
    zoku_id: z.string().optional().describe('ID of the zoku creating this qupt'),
    metadata: z.record(z.any()).optional().describe('Additional structured data')
  }),

  list_qupts: z.object({
    entanglement_id: z.string(),
    recursive: z.boolean().optional().default(true).describe('Include qupts from child entanglements'),
    source: z.string().optional().describe('Filter by source (github, gmail, zammad, etc.)'),
    since: z.number().optional().describe('Unix timestamp - only return qupts created after this time'),
    until: z.number().optional().describe('Unix timestamp - only return qupts created before this time'),
    limit: z.number().optional().default(20).describe('Maximum number of qupts to return (1-1000)'),
    offset: z.number().optional().default(0).describe('Number of qupts to skip (for pagination)'),
    detailed: z.boolean().optional().default(false).describe('Include full metadata. Default: false (omits metadata for brevity)')
  }),

  list_zoku: z.object({
    type: z.enum(['human', 'agent']).optional(),
    limit: z.number().optional().default(20)
  }),

  create_zoku: z.object({
    name: z.string().describe('Name of the entity'),
    type: z.enum(['human', 'agent']),
    metadata: z.record(z.any()).optional().describe('Additional metadata')
  }),

  get_entangled: z.object({
    id: z.string()
  }),

  entangle: z.object({
    entanglement_id: z.string(),
    zoku_id: z.string(),
    role: z.enum(['perform', 'accountable', 'control', 'support', 'informed']).describe('PASCI role: Perform (does work), Accountable (answerable), Control (veto power), Support (advisory), Informed (notified)')
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
      dimension: z.string().describe("Dimension name (e.g., 'function', 'pillar')"),
      value: z.string().describe('Value within that dimension')
    }))
  }),

  get_attributes: z.object({
    entanglement_id: z.string()
  }),

  list_sources: z.object({
    entanglement_id: z.string()
  }),

  add_source: z.discriminatedUnion('type', [
    z.object({
      entanglement_id: z.string(),
      type: z.literal('github'),
      config: z.object({
        owner: z.string(),
        repo: z.string(),
        events: z.array(z.string()).optional()
      }).describe('Source-specific configuration (e.g., owner, repo for GitHub)'),
      jewels: z.record(z.any()).optional().describe('Inline authentication jewels (will be validated and encrypted). Omit if using jewel_id.'),
      jewel_id: z.string().optional().describe('ID of stored jewel to use. Omit if providing inline jewels.')
    }),
    z.object({
      entanglement_id: z.string(),
      type: z.literal('zammad'),
      config: z.object({
        url: z.string().url(),
        tag: z.string(),
        include_articles: z.boolean().optional()
      }).describe('Source-specific configuration (e.g., owner, repo for GitHub)'),
      jewels: z.record(z.any()).optional().describe('Inline authentication jewels (will be validated and encrypted). Omit if using jewel_id.'),
      jewel_id: z.string().optional().describe('ID of stored jewel to use. Omit if providing inline jewels.')
    }),
    z.object({
      entanglement_id: z.string(),
      type: z.literal('gdocs'),
      config: z.object({
        document_id: z.string(),
        track_suggestions: z.boolean().optional()
      }).describe('Source-specific configuration (e.g., owner, repo for GitHub)'),
      jewels: z.record(z.any()).optional().describe('Inline authentication jewels (will be validated and encrypted). Omit if using jewel_id.'),
      jewel_id: z.string().optional().describe('ID of stored jewel to use. Omit if providing inline jewels.')
    }),
    z.object({
      entanglement_id: z.string(),
      type: z.literal('gdrive'),
      config: z.object({
        folder_id: z.string().optional(),
        file_types: z.array(z.string()).optional()
      }).describe('Source-specific configuration (e.g., owner, repo for GitHub)'),
      jewels: z.record(z.any()).optional().describe('Inline authentication jewels (will be validated and encrypted). Omit if using jewel_id.'),
      jewel_id: z.string().optional().describe('ID of stored jewel to use. Omit if providing inline jewels.')
    }),
    z.object({
      entanglement_id: z.string(),
      type: z.literal('gmail'),
      config: z.object({
        query: z.string().optional(),
        labels: z.array(z.string()).optional()
      }).describe('Source-specific configuration (e.g., owner, repo for GitHub)'),
      jewels: z.record(z.any()).optional().describe('Inline authentication jewels (will be validated and encrypted). Omit if using jewel_id.'),
      jewel_id: z.string().optional().describe('ID of stored jewel to use. Omit if providing inline jewels.')
    }),
    z.object({
      entanglement_id: z.string(),
      type: z.literal('webhook'),
      config: z.object({
        url: z.string().url().optional(),
        secret: z.string().optional()
      }).describe('Source-specific configuration (e.g., owner, repo for GitHub)'),
      jewels: z.record(z.any()).optional().describe('Inline authentication jewels (will be validated and encrypted). Omit if using jewel_id.'),
      jewel_id: z.string().optional().describe('ID of stored jewel to use. Omit if providing inline jewels.')
    })
  ]),

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
    name: z.string().describe('User-friendly name (e.g., "GitHub - Personal")'),
    type: z.enum(['github', 'gmail', 'zammad', 'gdrive', 'gdocs']),
    data: z.record(z.any()).describe('Authentication credentials (will be validated and encrypted)')
  }),

  list_jewels: z.object({
    type: z.enum(['github', 'gmail', 'zammad', 'gdrive', 'gdocs']).optional().describe('Filter by jewel type'),
    limit: z.number().optional().default(20)
  }),

  get_jewel: z.object({
    id: z.string()
  }),

  update_jewel: z.object({
    id: z.string(),
    name: z.string().optional().describe('New name for the jewel'),
    data: z.record(z.any()).optional().describe('New authentication credentials (will be validated)')
  }),

  delete_jewel: z.object({
    id: z.string()
  }),

  get_jewel_usage: z.object({
    id: z.string()
  })
};

// Create and configure MCP server using SERVICES
function createMcpServer(db: DB, env: any, logger: Logger, user: any): McpServer {
  const server = new McpServer(
    {
      name: 'zoku',
      version: '1.0.0'
    },
    {
      capabilities: {
        tools: {}
      }
    }
  );

  // Create services once for all tools
  const services = createServices(db, user, logger, env);

  // ENTANGLEMENT TOOLS (using EntanglementService)
  
  server.registerTool(
    'list_entanglements',
    { description: 'List entanglements in the Zoku system', inputSchema: schemas.list_entanglements },
    async (args, extra) => mcpToolWrapper('list_entanglements', logger, extra.sessionId, async () => {
      return await services.entanglements.list(args);
    })
  );

  server.registerTool(
    'get_entanglement',
    { description: 'Get entanglement details', inputSchema: schemas.get_entanglement },
    async (args, extra) => mcpToolWrapper('get_entanglement', logger, extra.sessionId, async () => {
      return await services.entanglements.get(
        args.id,
        args.include_children_qupts ?? true,
        args.detailed ? 50 : 20
      );
    })
  );

  server.registerTool(
    'get_child_entanglements',
    { description: 'Get child entanglements of a parent', inputSchema: schemas.get_child_entanglements },
    async (args, extra) => mcpToolWrapper('get_child_entanglements', logger, extra.sessionId, async () => {
      const children = await services.entanglements.getChildren(args.parent_id, args.recursive ?? false);
      return { children };
    })
  );

  server.registerTool(
    'create_entanglement',
    { description: 'Create a new entanglement', inputSchema: schemas.create_entanglement },
    async (args, extra) => mcpToolWrapper('create_entanglement', logger, extra.sessionId, async () => {
      return await services.entanglements.create(args);
    })
  );

  server.registerTool(
    'update_entanglement',
    { description: 'Update an entanglement', inputSchema: schemas.update_entanglement },
    async (args, extra) => mcpToolWrapper('update_entanglement', logger, extra.sessionId, async () => {
      return await services.entanglements.update(args.id, args);
    })
  );

  server.registerTool(
    'move_entanglement',
    { description: 'Move an entanglement to a new parent', inputSchema: schemas.move_entanglement },
    async (args, extra) => mcpToolWrapper('move_entanglement', logger, extra.sessionId, async () => {
      await services.entanglements.move(args.id, args.new_parent_id ?? null);
      return { success: true };
    })
  );

  server.registerTool(
    'delete_entanglement',
    { description: 'Delete an entanglement', inputSchema: schemas.delete_entanglement },
    async (args, extra) => mcpToolWrapper('delete_entanglement', logger, extra.sessionId, async () => {
      await services.entanglements.delete(args.id, args.confirm);
      return { success: true };
    })
  );

  server.registerTool(
    'get_matrix',
    { description: 'Get PASCI responsibility matrix', inputSchema: schemas.get_matrix },
    async (args, extra) => mcpToolWrapper('get_matrix', logger, extra.sessionId, async () => {
      const matrix = await services.entanglements.getMatrix(args.entanglement_id);
      return { entanglement_id: args.entanglement_id, matrix };
    })
  );

  server.registerTool(
    'entangle',
    { description: 'Assign a zoku to a PASCI role', inputSchema: schemas.entangle },
    async (args, extra) => mcpToolWrapper('entangle', logger, extra.sessionId, async () => {
      await services.entanglements.assignToMatrix(args.entanglement_id, args);
      return { success: true };
    })
  );

  server.registerTool(
    'disentangle',
    { description: 'Remove a zoku from a PASCI role', inputSchema: schemas.disentangle },
    async (args, extra) => mcpToolWrapper('disentangle', logger, extra.sessionId, async () => {
      await services.entanglements.removeFromMatrix(args.entanglement_id, args.zoku_id, args.role);
      return { success: true };
    })
  );

  server.registerTool(
    'get_attributes',
    { description: 'Get taxonomy attributes', inputSchema: schemas.get_attributes },
    async (args, extra) => mcpToolWrapper('get_attributes', logger, extra.sessionId, async () => {
      return await services.entanglements.getAttributes(args.entanglement_id);
    })
  );

  server.registerTool(
    'list_sources',
    { description: 'List sources for an entanglement', inputSchema: schemas.list_sources },
    async (args, extra) => mcpToolWrapper('list_sources', logger, extra.sessionId, async () => {
      const sources = await services.entanglements.listSources(args.entanglement_id);
      return { sources };
    })
  );

  // ZOKU TOOLS (using ZokuService)

  server.registerTool(
    'list_zoku',
    { description: 'List all zoku partners', inputSchema: schemas.list_zoku },
    async (args, extra) => mcpToolWrapper('list_zoku', logger, extra.sessionId, async () => {
      const zoku = await services.zoku.list(args);
      return { zoku };
    })
  );

  server.registerTool(
    'create_zoku',
    { description: 'Register a new zoku partner', inputSchema: schemas.create_zoku },
    async (args, extra) => mcpToolWrapper('create_zoku', logger, extra.sessionId, async () => {
      return await services.zoku.create(args);
    })
  );

  server.registerTool(
    'get_entangled',
    { description: 'Get details of a zoku partner', inputSchema: schemas.get_entangled },
    async (args, extra) => mcpToolWrapper('get_entangled', logger, extra.sessionId, async () => {
      return await services.zoku.get(args.id);
    })
  );

  // QUPT TOOLS (using QuptService)

  server.registerTool(
    'list_qupts',
    { description: 'List activity for an entanglement with filtering and pagination. Supports source filter, date range (since/until), limit, and offset for paging through results.', inputSchema: schemas.list_qupts },
    async (args, extra) => mcpToolWrapper('list_qupts', logger, extra.sessionId, async () => {
      const qupts = await services.qupts.list(args);
      
      // Format response based on detailed flag
      if (!args.detailed) {
        return {
          qupts: qupts.map((q: any) => ({
            id: q.id,
            entanglement_id: q.entanglement_id,
            content: q.content,
            source: q.source,
            external_id: q.external_id,
            created_at: q.created_at
          })),
          total: qupts.length,
          offset: args.offset || 0,
          limit: args.limit || 20
        };
      }
      return { 
        qupts,
        total: qupts.length,
        offset: args.offset || 0,
        limit: args.limit || 20
      };
    })
  );

  server.registerTool(
    'create_qupt',
    { description: 'Record activity or update on an entanglement', inputSchema: schemas.create_qupt },
    async (args, extra) => mcpToolWrapper('create_qupt', logger, extra.sessionId, async () => {
      return await services.qupts.create(args);
    })
  );

  // JEWEL TOOLS (using JewelService)

  server.registerTool(
    'add_jewel',
    { description: 'Store and validate jewels for reuse', inputSchema: schemas.add_jewel },
    async (args, extra) => mcpToolWrapper('add_jewel', logger, extra.sessionId, async () => {
      return await services.jewels.create(args);
    })
  );

  server.registerTool(
    'list_jewels',
    { description: 'List stored jewels (without exposing sensitive data)', inputSchema: schemas.list_jewels },
    async (args, extra) => mcpToolWrapper('list_jewels', logger, extra.sessionId, async () => {
      const jewels = await services.jewels.list(args);
      return { jewels };
    })
  );

  server.registerTool(
    'get_jewel',
    { description: 'Get jewel details', inputSchema: schemas.get_jewel },
    async (args, extra) => mcpToolWrapper('get_jewel', logger, extra.sessionId, async () => {
      return await services.jewels.get(args.id);
    })
  );

  server.registerTool(
    'update_jewel',
    { description: 'Update jewel name or data', inputSchema: schemas.update_jewel },
    async (args, extra) => mcpToolWrapper('update_jewel', logger, extra.sessionId, async () => {
      await services.jewels.update(args.id, args);
      return { success: true };
    })
  );

  server.registerTool(
    'delete_jewel',
    { description: 'Delete a stored jewel', inputSchema: schemas.delete_jewel },
    async (args, extra) => mcpToolWrapper('delete_jewel', logger, extra.sessionId, async () => {
      await services.jewels.delete(args.id);
      return { success: true };
    })
  );

  server.registerTool(
    'get_jewel_usage',
    { description: 'See which sources are using a jewel', inputSchema: schemas.get_jewel_usage },
    async (args, extra) => mcpToolWrapper('get_jewel_usage', logger, extra.sessionId, async () => {
      const sources = await services.jewels.getUsage(args.id);
      return { sources };
    })
  );

  // SOURCE TOOLS (using SourceService)

  server.registerTool(
    'add_source',
    { description: 'Add an activity source to an entanglement', inputSchema: schemas.add_source },
    async (args, extra) => mcpToolWrapper('add_source', logger, extra.sessionId, async () => {
      return await services.sources.create(args.entanglement_id, args);
    })
  );

  server.registerTool(
    'sync_source',
    { description: 'Manually trigger a sync for a source', inputSchema: schemas.sync_source },
    async (args, extra) => mcpToolWrapper('sync_source', logger, extra.sessionId, async () => {
      return await services.sources.sync(args.source_id);
    })
  );

  server.registerTool(
    'remove_source',
    { description: 'Remove an activity source from an entanglement', inputSchema: schemas.remove_source },
    async (args, extra) => mcpToolWrapper('remove_source', logger, extra.sessionId, async () => {
      await services.sources.delete(args.source_id);
      return { success: true };
    })
  );

  server.registerTool(
    'toggle_source',
    { description: 'Enable or disable a source', inputSchema: schemas.toggle_source },
    async (args, extra) => mcpToolWrapper('toggle_source', logger, extra.sessionId, async () => {
      await services.sources.update(args.source_id, { enabled: args.enabled });
      return { success: true };
    })
  );

  // SPECIAL CASE TOOLS (No service, direct DB access)

  server.registerTool(
    'list_dimensions',
    { description: 'List all taxonomy dimensions and their available values', inputSchema: schemas.list_dimensions },
    async (args, extra) => mcpToolWrapper('list_dimensions', logger, extra.sessionId, async () => {
      const dimensions = await db.listDimensions();
      const values = await db.getAllDimensionValues();
      
      const enriched = dimensions.map(dim => ({
        ...dim,
        values: values.filter(v => v.dimension_id === dim.id)
      }));
      
      return { dimensions: enriched };
    })
  );

  server.registerTool(
    'set_attributes',
    { description: 'Set taxonomy attributes on an entanglement', inputSchema: schemas.set_attributes },
    async (args, extra) => mcpToolWrapper('set_attributes', logger, extra.sessionId, async () => {
      // Convert dimension names to IDs
      const dimensions = await db.listDimensions();
      const dimensionValues = await db.getAllDimensionValues();
      
      const attributesToSet = [];
      for (const attr of args.attributes) {
        const dimension = dimensions.find((d: any) => d.name === attr.dimension);
        if (!dimension) {
          throw new Error(`Unknown dimension: ${attr.dimension}`);
        }
        
        const value = dimensionValues.find((v: any) =>
          v.dimension_id === dimension.id && v.value === attr.value
        );
        if (!value) {
          throw new Error(`Unknown value: ${attr.value} for dimension ${attr.dimension}`);
        }
        
        attributesToSet.push({ dimension_id: dimension.id, value_id: value.id });
      }
      
      await db.setEntanglementAttributes(args.entanglement_id, attributesToSet);
      return { success: true };
    })
  );

  return server;
}

// HTTP handler for MCP requests (UNCHANGED)
export async function handleMcpRequest(c: Context<HonoEnv>) {
  const db = new DB(c.env.DB);
  const encryptionKey = c.env.ENCRYPTION_KEY;
  const minLogLevel = (c.env.LOG_LEVEL || 'info') as 'info' | 'warn' | 'error' | 'fatal';

  const requestId = c.req.header('X-Request-ID') || crypto.randomUUID().substring(0, 8);
  const sessionId = c.req.header('X-Zoku-Session-ID');

  const logger = new Logger({
    request_id: requestId,
    session_id: sessionId,
    operation: 'mcp_request',
    path: c.req.path,
    method: c.req.method
  }, minLogLevel);

  logger.info('MCP request received');

  try {
    const body = await c.req.json().catch(() => undefined);

    const authHeader = c.req.header('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      logger.warn('Missing MCP Bearer token');
      return c.json({
        jsonrpc: '2.0',
        error: { code: -32001, message: 'Authentication required - provide Bearer token' },
        id: null
      }, 401);
    }

    const token = authHeader.substring(7);
    const { validateMcpToken } = await import('../lib/mcp-tokens');
    const isInitialize = body?.method === 'initialize';

    let user = null;
    try {
      user = await validateMcpToken(token, c.env, db, isInitialize);
      logger.info('MCP token validated', {
        user_id: user.id,
        tier: user.access_tier,
        method: body?.method,
        cached: !isInitialize
      });
    } catch (error) {
      logger.error('MCP token validation failed', error as Error);
      return c.json({
        jsonrpc: '2.0',
        error: { code: -32001, message: `Authentication failed: ${error instanceof Error ? error.message : 'Invalid token'}` },
        id: null
      }, 401);
    }

    c.set('user', user);

    const transport = new StreamableHTTPTransport();
    const server = createMcpServer(db, c.env, logger, user);

    await server.connect(transport);

    const response = await transport.handleRequest(c, body);

    logger.info('MCP request completed', logger.withDuration());

    return response;
  } catch (error) {
    logger.error('MCP request failed', error as Error, logger.withDuration());

    const errorMessage = error instanceof Error ? error.message : String(error);
    let code = -32603;
    let httpStatus = 500;

    if (errorMessage.includes('not found')) {
      code = -32001;
      httpStatus = 404;
    } else if (errorMessage.includes('validation failed') || errorMessage.includes('Invalid')) {
      code = -32602;
      httpStatus = 400;
    } else if (errorMessage.includes('timeout')) {
      code = -32002;
      httpStatus = 504;
    } else if (errorMessage.includes('Access denied') || errorMessage.includes('permission')) {
      code = -32003;
      httpStatus = 403;
    } else if (error instanceof Error && error.name === 'ZodError') {
      code = -32602;
      httpStatus = 400;
    }

    return c.json({
      jsonrpc: '2.0',
      id: null,
      error: {
        code,
        message: errorMessage
      }
    }, httpStatus);
  }
}
