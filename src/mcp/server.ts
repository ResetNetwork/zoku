// MCP Server implementation using official SDK
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StreamableHTTPTransport } from '@hono/mcp';
import { z } from 'zod';
import type { Context } from 'hono';
import type { Bindings } from '../types';
import { DB } from '../db';
import { Logger } from '../lib/logger';

// Tool schemas using Zod
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
    limit: z.number().optional().default(20),
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

  // Jewel/Credentials management
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

// Note: The MCP SDK expects Zod schemas directly (not JSON Schema).
// The SDK handles conversion to JSON Schema internally when responding to tools/list.
// We can pass our Zod schemas directly without any conversion.

// Helper to check user tier for MCP tools
function requireMcpTier(user: any, minTier: string): void {
  const tierLevels = {
    observed: 0,
    coherent: 1,
    entangled: 2,
    prime: 3,
  };

  const userLevel = tierLevels[user?.access_tier as keyof typeof tierLevels] || 0;
  const requiredLevel = tierLevels[minTier as keyof typeof tierLevels] || 0;

  if (userLevel < requiredLevel) {
    throw new Error(`Insufficient permissions: This tool requires ${minTier} tier or higher. You have ${user?.access_tier || 'no'} access.`);
  }
}

// Create and configure MCP server
function createMcpServer(db: DB, encryptionKey: string, logger: Logger, user: any): McpServer {
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

  // Tools are registered with inline implementations. Each tool receives validated args and returns CallToolResult format.

  server.registerTool(
    'list_entanglements',
    {
      description: 'List entanglements in the Zoku system',
      inputSchema: schemas.list_entanglements
    },
    async (args, extra) => {
      const toolLogger = logger.child({ tool: 'list_entanglements', session_id: extra.sessionId });
      const startTime = Date.now();

      try {
        const entanglementsWithCounts = await db.listEntanglementsWithCounts({
          parent_id: args.parent_id,
          root_only: args.root_only,
          status: args.status,
          function: args.function,
          limit: args.limit
        });

        // Return minimal or detailed view
        let result: any;
        if (!args.detailed) {
          result = {
            entanglements: entanglementsWithCounts.map(v => ({
              id: v.id,
              name: v.name,
              parent_id: v.parent_id,
              created_at: v.created_at,
              updated_at: v.updated_at,
              qupts_count: v.qupts_count,
              sources_count: v.sources_count
            }))
          };
        } else {
          result = { entanglements: entanglementsWithCounts };
        }

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
  );

  server.registerTool(
    'get_entanglement',
    {
      description: 'Get entanglement details. By default returns minimal info (counts only). Use detailed=true for full nested data.',
      inputSchema: schemas.get_entanglement
    },
    async (args, extra) => {
      const toolLogger = logger.child({ tool: 'get_entanglement', session_id: extra.sessionId });
      const startTime = Date.now();

      try {
        const entanglement = await db.getEntanglement(args.id);
        if (!entanglement) throw new Error('Entanglement not found');

        let result: any;
        // Default: return minimal info with proper counts
        if (!args.detailed) {
          const [childrenCount, quptsCount, sourcesCount] = await Promise.all([
            db.getEntanglementChildrenCount(args.id),
            db.getEntanglementQuptsCount(args.id, args.include_children_qupts ?? true),
            db.getEntanglementSourcesCount(args.id)
          ]);

          result = {
            ...entanglement,
            children_count: childrenCount,
            qupts_count: quptsCount,
            sources_count: sourcesCount
          };
        } else {
          // Detailed: return full nested data
          const children = await db.getEntanglementChildren(args.id);
          const matrix = await db.getMatrix(args.id);
          const attributes = await db.getEntanglementAttributes(args.id);
          const qupts = await db.listQupts({
            entanglement_id: args.id,
            recursive: args.include_children_qupts ?? true,
            limit: 20
          });

          result = { ...entanglement, children, matrix, attributes, qupts };
        }

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
  );

  server.registerTool(
    'get_child_entanglements',
    {
      description: 'Get child entanglements of a parent entanglement',
      inputSchema: schemas.get_child_entanglements
    },
    async (args, extra) => {
      const toolLogger = logger.child({ tool: 'get_child_entanglements', session_id: extra.sessionId });
      const startTime = Date.now();

      try {
        let result: any;
        if (args.recursive) {
          result = { children: await db.getEntanglementDescendants(args.parent_id) };
        } else {
          result = { children: await db.getEntanglementChildren(args.parent_id) };
        }

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
  );

  server.registerTool(
    'create_entanglement',
    {
      description: 'Create a new entanglement/initiative, optionally as a child of another entanglement with initial team assignments',
      inputSchema: schemas.create_entanglement
    },
    async (args, extra) => {
      requireMcpTier(user, 'entangled');
      const toolLogger = logger.child({ tool: 'create_entanglement', session_id: extra.sessionId });
      const startTime = Date.now();

      try {
        const entanglement = await db.createEntanglement({
          name: args.name,
          description: args.description,
          parent_id: args.parent_id
        });

        // Add initial zoku assignments if provided
        if (args.initial_zoku && Array.isArray(args.initial_zoku)) {
          for (const assignment of args.initial_zoku) {
            try {
              await db.assignToMatrix(entanglement.id, assignment.zoku_id, assignment.role);
            } catch (error) {
              toolLogger.warn(`Failed to assign ${assignment.zoku_id} to ${assignment.role}`, { error });
            }
          }
        }

        toolLogger.info('Tool completed', { duration_ms: Date.now() - startTime });

        return {
          content: [{
            type: 'text',
            text: JSON.stringify(entanglement, null, 2)
          }]
        };
      } catch (error) {
        toolLogger.error('Tool failed', error as Error, { duration_ms: Date.now() - startTime });
        throw error;
      }
    }
  );

  server.registerTool(
    'update_entanglement',
    {
      description: "Update an entanglement's name, description, or parent",
      inputSchema: schemas.update_entanglement
    },
    async (args, extra) => {
      requireMcpTier(user, 'entangled');
      const toolLogger = logger.child({ tool: 'update_entanglement', session_id: extra.sessionId });
      const startTime = Date.now();

      try {
        await db.updateEntanglement(args.id, {
          name: args.name,
          description: args.description,
          parent_id: args.parent_id
        });

        toolLogger.info('Tool completed', { duration_ms: Date.now() - startTime });

        return {
          content: [{
            type: 'text',
            text: JSON.stringify({ success: true }, null, 2)
          }]
        };
      } catch (error) {
        toolLogger.error('Tool failed', error as Error, { duration_ms: Date.now() - startTime });
        throw error;
      }
    }
  );

  server.registerTool(
    'move_entanglement',
    {
      description: 'Move an entanglement to become a child of another entanglement, or make it a root entanglement',
      inputSchema: schemas.move_entanglement
    },
    async (args, extra) => {
      requireMcpTier(user, 'entangled');
      const toolLogger = logger.child({ tool: 'move_entanglement', session_id: extra.sessionId });
      const startTime = Date.now();

      try {
        await db.updateEntanglement(args.id, { parent_id: args.new_parent_id || null });

        toolLogger.info('Tool completed', { duration_ms: Date.now() - startTime });

        return {
          content: [{
            type: 'text',
            text: JSON.stringify({ success: true }, null, 2)
          }]
        };
      } catch (error) {
        toolLogger.error('Tool failed', error as Error, { duration_ms: Date.now() - startTime });
        throw error;
      }
    }
  );

  server.registerTool(
    'delete_entanglement',
    {
      description: 'Delete an entanglement. WARNING: Also deletes all child entanglements, qupts, sources, and assignments.',
      inputSchema: schemas.delete_entanglement
    },
    async (args, extra) => {
      requireMcpTier(user, 'entangled');
      const toolLogger = logger.child({ tool: 'delete_entanglement', session_id: extra.sessionId });
      const startTime = Date.now();

      try {
        if (!args.confirm) {
          throw new Error('Must set confirm=true to delete entanglement');
        }
        await db.deleteEntanglement(args.id);

        toolLogger.info('Tool completed', { duration_ms: Date.now() - startTime });

        return {
          content: [{
            type: 'text',
            text: JSON.stringify({ success: true }, null, 2)
          }]
        };
      } catch (error) {
        toolLogger.error('Tool failed', error as Error, { duration_ms: Date.now() - startTime });
        throw error;
      }
    }
  );

  server.registerTool(
    'create_qupt',
    {
      description: 'Record activity or update on an entanglement',
      inputSchema: schemas.create_qupt
    },
    async (args, extra) => {
      requireMcpTier(user, 'entangled');
      const toolLogger = logger.child({ tool: 'create_qupt', session_id: extra.sessionId });
      const startTime = Date.now();

      try {
        const qupt = await db.createQupt({
          entanglement_id: args.entanglement_id,
          content: args.content,
          zoku_id: args.zoku_id,
          source: 'mcp',
          metadata: args.metadata
        });

        toolLogger.info('Tool completed', { duration_ms: Date.now() - startTime });

        return {
          content: [{
            type: 'text',
            text: JSON.stringify(qupt, null, 2)
          }]
        };
      } catch (error) {
        toolLogger.error('Tool failed', error as Error, { duration_ms: Date.now() - startTime });
        throw error;
      }
    }
  );

  server.registerTool(
    'list_qupts',
    {
      description: 'List activity for an entanglement. By default omits metadata for brevity. Use detailed=true for full metadata.',
      inputSchema: schemas.list_qupts
    },
    async (args, extra) => {
      const toolLogger = logger.child({ tool: 'list_qupts', session_id: extra.sessionId });
      const startTime = Date.now();

      try {
        const qupts = await db.listQupts({
          entanglement_id: args.entanglement_id,
          recursive: args.recursive ?? true,
          source: args.source,
          limit: args.limit
        });

        let result: any;
        // Default: return minimal qupts (no metadata)
        if (!args.detailed) {
          result = {
            qupts: qupts.map(q => ({
              id: q.id,
              entanglement_id: q.entanglement_id,
              content: q.content,
              source: q.source,
              external_id: q.external_id,
              created_at: q.created_at
            }))
          };
        } else {
          // Detailed: return full qupts with metadata
          result = { qupts };
        }

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
  );

  server.registerTool(
    'list_zoku',
    {
      description: 'List all zoku partners (humans and AI agents)',
      inputSchema: schemas.list_zoku
    },
    async (args, extra) => {
      const toolLogger = logger.child({ tool: 'list_zoku', session_id: extra.sessionId });
      const startTime = Date.now();

      try {
        const zoku = await db.listZoku({
          type: args.type,
          limit: args.limit
        });

        toolLogger.info('Tool completed', { duration_ms: Date.now() - startTime });

        return {
          content: [{
            type: 'text',
            text: JSON.stringify({ zoku }, null, 2)
          }]
        };
      } catch (error) {
        toolLogger.error('Tool failed', error as Error, { duration_ms: Date.now() - startTime });
        throw error;
      }
    }
  );

  server.registerTool(
    'create_zoku',
    {
      description: 'Register a new zoku partner (human or AI agent)',
      inputSchema: schemas.create_zoku
    },
    async (args, extra) => {
      requireMcpTier(user, 'entangled');
      const toolLogger = logger.child({ tool: 'create_zoku', session_id: extra.sessionId });
      const startTime = Date.now();

      try {
        const zoku = await db.createZoku(args);

        toolLogger.info('Tool completed', { duration_ms: Date.now() - startTime });

        return {
          content: [{
            type: 'text',
            text: JSON.stringify(zoku, null, 2)
          }]
        };
      } catch (error) {
        toolLogger.error('Tool failed', error as Error, { duration_ms: Date.now() - startTime });
        throw error;
      }
    }
  );

  server.registerTool(
    'get_entangled',
    {
      description: 'Get details of a zoku partner including their entanglements and roles',
      inputSchema: schemas.get_entangled
    },
    async (args, extra) => {
      const toolLogger = logger.child({ tool: 'get_entangled', session_id: extra.sessionId });
      const startTime = Date.now();

      try {
        const zoku = await db.getZoku(args.id);
        if (!zoku) throw new Error('Zoku not found');

        toolLogger.info('Tool completed', { duration_ms: Date.now() - startTime });

        return {
          content: [{
            type: 'text',
            text: JSON.stringify(zoku, null, 2)
          }]
        };
      } catch (error) {
        toolLogger.error('Tool failed', error as Error, { duration_ms: Date.now() - startTime });
        throw error;
      }
    }
  );

  server.registerTool(
    'entangle',
    {
      description: 'Assign a zoku partner to a PASCI role on an entanglement',
      inputSchema: schemas.entangle
    },
    async (args, extra) => {
      requireMcpTier(user, 'entangled');
      const toolLogger = logger.child({ tool: 'entangle', session_id: extra.sessionId });
      const startTime = Date.now();

      try {
        await db.assignToMatrix(args.entanglement_id, args.zoku_id, args.role);

        toolLogger.info('Tool completed', { duration_ms: Date.now() - startTime });

        return {
          content: [{
            type: 'text',
            text: JSON.stringify({ success: true }, null, 2)
          }]
        };
      } catch (error) {
        toolLogger.error('Tool failed', error as Error, { duration_ms: Date.now() - startTime });
        throw error;
      }
    }
  );

  server.registerTool(
    'disentangle',
    {
      description: 'Remove a zoku partner from a PASCI role on an entanglement',
      inputSchema: schemas.disentangle
    },
    async (args, extra) => {
      requireMcpTier(user, 'entangled');
      const toolLogger = logger.child({ tool: 'disentangle', session_id: extra.sessionId });
      const startTime = Date.now();

      try {
        await db.removeFromMatrix(args.entanglement_id, args.zoku_id, args.role);

        toolLogger.info('Tool completed', { duration_ms: Date.now() - startTime });

        return {
          content: [{
            type: 'text',
            text: JSON.stringify({ success: true }, null, 2)
          }]
        };
      } catch (error) {
        toolLogger.error('Tool failed', error as Error, { duration_ms: Date.now() - startTime });
        throw error;
      }
    }
  );

  server.registerTool(
    'get_matrix',
    {
      description: 'Get the PASCI responsibility matrix showing who is assigned to each role',
      inputSchema: schemas.get_matrix
    },
    async (args, extra) => {
      const toolLogger = logger.child({ tool: 'get_matrix', session_id: extra.sessionId });
      const startTime = Date.now();

      try {
        const matrix = await db.getMatrix(args.entanglement_id);

        toolLogger.info('Tool completed', { duration_ms: Date.now() - startTime });

        return {
          content: [{
            type: 'text',
            text: JSON.stringify({ matrix }, null, 2)
          }]
        };
      } catch (error) {
        toolLogger.error('Tool failed', error as Error, { duration_ms: Date.now() - startTime });
        throw error;
      }
    }
  );

  server.registerTool(
    'list_dimensions',
    {
      description: 'List all taxonomy dimensions and their available values',
      inputSchema: schemas.list_dimensions
    },
    async (args, extra) => {
      const toolLogger = logger.child({ tool: 'list_dimensions', session_id: extra.sessionId });
      const startTime = Date.now();

      try {
        const dimensions = await db.listDimensions();
        const values = await db.getAllDimensionValues();
        const dimensionsWithValues = dimensions.map(dim => ({
          ...dim,
          values: values.filter(v => v.dimension_id === dim.id)
        }));

        toolLogger.info('Tool completed', { duration_ms: Date.now() - startTime });

        return {
          content: [{
            type: 'text',
            text: JSON.stringify({ dimensions: dimensionsWithValues }, null, 2)
          }]
        };
      } catch (error) {
        toolLogger.error('Tool failed', error as Error, { duration_ms: Date.now() - startTime });
        throw error;
      }
    }
  );

  server.registerTool(
    'set_attributes',
    {
      description: 'Set taxonomy attributes on an entanglement (function, pillar, service area, etc.)',
      inputSchema: schemas.set_attributes
    },
    async (args, extra) => {
      requireMcpTier(user, 'entangled');
      const toolLogger = logger.child({ tool: 'set_attributes', session_id: extra.sessionId });
      const startTime = Date.now();

      try {
        const dimensions = await db.listDimensions();
        const values = await db.getAllDimensionValues();

        const attributesToSet = args.attributes.map(attr => {
          const dim = dimensions.find(d => d.name === attr.dimension);
          if (!dim) throw new Error(`Unknown dimension: ${attr.dimension}`);
          const val = values.find(v => v.dimension_id === dim.id && v.value === attr.value);
          if (!val) throw new Error(`Unknown value: ${attr.value} for dimension ${attr.dimension}`);
          return { dimension_id: dim.id, value_id: val.id };
        });

        await db.setEntanglementAttributes(args.entanglement_id, attributesToSet);

        toolLogger.info('Tool completed', { duration_ms: Date.now() - startTime });

        return {
          content: [{
            type: 'text',
            text: JSON.stringify({ success: true }, null, 2)
          }]
        };
      } catch (error) {
        toolLogger.error('Tool failed', error as Error, { duration_ms: Date.now() - startTime });
        throw error;
      }
    }
  );

  server.registerTool(
    'get_attributes',
    {
      description: 'Get taxonomy attributes assigned to an entanglement',
      inputSchema: schemas.get_attributes
    },
    async (args, extra) => {
      const toolLogger = logger.child({ tool: 'get_attributes', session_id: extra.sessionId });
      const startTime = Date.now();

      try {
        const attributes = await db.getEntanglementAttributes(args.entanglement_id);

        toolLogger.info('Tool completed', { duration_ms: Date.now() - startTime });

        return {
          content: [{
            type: 'text',
            text: JSON.stringify({ attributes }, null, 2)
          }]
        };
      } catch (error) {
        toolLogger.error('Tool failed', error as Error, { duration_ms: Date.now() - startTime });
        throw error;
      }
    }
  );

  server.registerTool(
    'list_sources',
    {
      description: 'List activity sources configured for an entanglement',
      inputSchema: schemas.list_sources
    },
    async (args, extra) => {
      const toolLogger = logger.child({ tool: 'list_sources', session_id: extra.sessionId });
      const startTime = Date.now();

      try {
        const sources = await db.listSources(args.entanglement_id);
        const result = {
          sources: sources.map(s => ({
            id: s.id,
            type: s.type,
            config: s.config,
            enabled: s.enabled,
            last_sync: s.last_sync
          }))
        };

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
  );

  server.registerTool(
    'add_source',
    {
      description: 'Add an activity source to an entanglement. Can use stored jewels (via jewel_id) or provide inline jewels.',
      inputSchema: schemas.add_source
    },
    async (args, extra) => {
      requireMcpTier(user, 'entangled');
      const toolLogger = logger.child({ tool: 'add_source', session_id: extra.sessionId });
      const startTime = Date.now();

      try {
        // Validate source configuration if jewels are provided
        const warnings: string[] = [];
        let validationMetadata: Record<string, any> = {};

        // If jewel_id is provided, verify it exists and matches type
        if (args.jewel_id) {
          const jewel = await db.getJewel(args.jewel_id);
          if (!jewel) {
            throw new Error('Jewel not found');
          }
          if (jewel.type !== args.type) {
            throw new Error(`Jewel type mismatch: jewel is ${jewel.type}, source is ${args.type}`);
          }
        } else if (args.jewels) {
          // Validate inline jewels
          const { validateGitHubSource, validateZammadSource, validateGoogleDocsSource } = await import('../handlers/validate');

          let validationResult;
          switch (args.type) {
            case 'github':
              validationResult = await validateGitHubSource(args.config, args.jewels);
              break;
            case 'zammad':
              validationResult = await validateZammadSource(args.config, args.jewels);
              break;
            case 'gdocs':
            case 'gdrive':
              validationResult = await validateGoogleDocsSource(args.config, args.jewels);
              break;
            default:
              // Other source types don't have validation yet
              break;
          }

          if (validationResult) {
            if (!validationResult.valid) {
              throw new Error(`Source validation failed: ${validationResult.errors.join(', ')}${validationResult.warnings.length > 0 ? '. Warnings: ' + validationResult.warnings.join(', ') : ''}`);
            }

            warnings.push(...validationResult.warnings);
            validationMetadata = validationResult.metadata || {};
          }
        }

        const source = await db.createSource({
          entanglement_id: args.entanglement_id,
          type: args.type,
          config: args.config,
          credentials: args.jewels,  // Store as credentials in DB for backward compat
          jewel_id: args.jewel_id
        });

        // Set initial sync window to last 30 days (mandatory)
        const thirtyDaysAgo = Math.floor(Date.now() / 1000) - (30 * 24 * 60 * 60);
        await db.updateSource(source.id, { last_sync: thirtyDaysAgo });
        toolLogger.info(`Set initial sync window to last 30 days for source ${source.id}`);

        const result: any = { source };
        if (warnings.length > 0) {
          result.warnings = warnings;
        }
        if (Object.keys(validationMetadata).length > 0) {
          result.validation = validationMetadata;
        }

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
  );

  server.registerTool(
    'sync_source',
    {
      description: 'Manually trigger a sync for a source',
      inputSchema: schemas.sync_source
    },
    async (args, extra) => {
      requireMcpTier(user, 'entangled');
      const toolLogger = logger.child({ tool: 'sync_source', session_id: extra.sessionId });
      const startTime = Date.now();

      try {
        const { decryptJewel } = await import('../lib/crypto');
        const { handlers } = await import('../handlers');

        // Get the source
        const source = await db.getSource(args.source_id);
        if (!source) {
          throw new Error('Source not found');
        }

        const handler = handlers[source.type];
        if (!handler) {
          throw new Error(`No handler for source type: ${source.type}`);
        }

        const config = JSON.parse(source.config);

        // Get credentials - either from jewel_id or inline
        let credentials = {};
        if (source.jewel_id) {
          const jewel = await db.getJewel(source.jewel_id);
          if (!jewel) {
            throw new Error('Jewel not found');
          }
          credentials = JSON.parse(await decryptCredentials(jewel.data, encryptionKey));
        } else if (source.credentials) {
          credentials = JSON.parse(await decryptCredentials(source.credentials, encryptionKey));
        }

        // Fetch new activity with error tracking and timeout
        try {
          // Timeout after 25 seconds (leave 5s buffer for Cloudflare Workers 30s limit)
          const SYNC_TIMEOUT = 25000;
          const collectPromise = handler.collect({
            source,
            config,
            credentials,
            since: source.last_sync,
            cursor: source.sync_cursor
          });

          const timeoutPromise = new Promise((_, reject) => {
            setTimeout(() => reject(new Error('Source sync timeout after 25 seconds')), SYNC_TIMEOUT);
          });

          const { qupts, cursor } = await Promise.race([collectPromise, timeoutPromise]) as any;

          // Insert qupts
          if (qupts.length > 0) {
            await db.batchCreateQupts(qupts);
          }

          // Update sync state and clear any previous errors
          await db.updateSource(source.id, {
            last_sync: Math.floor(Date.now() / 1000),
            sync_cursor: cursor,
            last_error: null,
            error_count: 0,
            last_error_at: null
          });

          const result = {
            success: true,
            qupts_collected: qupts.length,
            source_id: source.id,
            cursor: cursor
          };

          toolLogger.info('Tool completed', { duration_ms: Date.now() - startTime });

          return {
            content: [{
              type: 'text',
              text: JSON.stringify(result, null, 2)
            }]
          };
        } catch (syncError) {
          // Track sync failure
          const errorMessage = syncError instanceof Error ? syncError.message : String(syncError);
          await db.updateSource(source.id, {
            last_error: errorMessage,
            error_count: (source.error_count || 0) + 1,
            last_error_at: Math.floor(Date.now() / 1000)
          });

          toolLogger.error('Source sync failed', syncError as Error, { source_id: source.id });
          throw new Error(`Source sync failed: ${errorMessage}`);
        }
      } catch (error) {
        toolLogger.error('Tool failed', error as Error, { duration_ms: Date.now() - startTime });
        throw error;
      }
    }
  );

  server.registerTool(
    'remove_source',
    {
      description: 'Remove an activity source from an entanglement',
      inputSchema: schemas.remove_source
    },
    async (args, extra) => {
      requireMcpTier(user, 'entangled');
      const toolLogger = logger.child({ tool: 'remove_source', session_id: extra.sessionId });
      const startTime = Date.now();

      try {
        await db.deleteSource(args.source_id);

        toolLogger.info('Tool completed', { duration_ms: Date.now() - startTime });

        return {
          content: [{
            type: 'text',
            text: JSON.stringify({ success: true }, null, 2)
          }]
        };
      } catch (error) {
        toolLogger.error('Tool failed', error as Error, { duration_ms: Date.now() - startTime });
        throw error;
      }
    }
  );

  server.registerTool(
    'toggle_source',
    {
      description: 'Enable or disable a source',
      inputSchema: schemas.toggle_source
    },
    async (args, extra) => {
      requireMcpTier(user, 'entangled');
      const toolLogger = logger.child({ tool: 'toggle_source', session_id: extra.sessionId });
      const startTime = Date.now();

      try {
        await db.updateSource(args.source_id, { enabled: args.enabled });

        toolLogger.info('Tool completed', { duration_ms: Date.now() - startTime });

        return {
          content: [{
            type: 'text',
            text: JSON.stringify({ success: true }, null, 2)
          }]
        };
      } catch (error) {
        toolLogger.error('Tool failed', error as Error, { duration_ms: Date.now() - startTime });
        throw error;
      }
    }
  );

  server.registerTool(
    'add_jewel',
    {
      description: 'Store and validate jewels that can be reused across multiple sources',
      inputSchema: schemas.add_jewel
    },
    async (args, extra) => {
      requireMcpTier(user, 'coherent'); // Coherent can create jewels
      const toolLogger = logger.child({ tool: 'add_jewel', session_id: extra.sessionId });
      const startTime = Date.now();

      try {
        const { encryptJewel } = await import('../lib/crypto');
        const { validateGitHubCredential, validateZammadCredential, validateGoogleDocsSource } = await import('../handlers/validate');

        const warnings: string[] = [];
        let validationMetadata: Record<string, any> = {};

        // Validate credentials
        let validationResult;
        switch (args.type) {
          case 'github':
            validationResult = await validateGitHubCredential(args.data);
            break;
          case 'zammad':
            validationResult = await validateZammadCredential(args.data);
            break;
          case 'gdocs':
          case 'gdrive':
            // For Google, just validate OAuth credentials work (no document needed)
            validationResult = await validateGoogleDocsSource({}, args.data);
            break;
        }

        if (validationResult) {
          if (!validationResult.valid) {
            throw new Error(`Credential validation failed: ${validationResult.errors.join(', ')}`);
          }
          warnings.push(...validationResult.warnings);
          validationMetadata = validationResult.metadata || {};
        }

        // Encrypt and store
        const encrypted = await encryptCredentials(JSON.stringify(args.data), encryptionKey);
        const jewel = await db.createJewel({
          name: args.name,
          type: args.type,
          data: encrypted,
          last_validated: Math.floor(Date.now() / 1000),
          validation_metadata: validationMetadata
        });

        const result = {
          id: jewel.id,
          name: jewel.name,
          type: jewel.type,
          validation: validationMetadata,
          warnings: warnings.length > 0 ? warnings : undefined
        };

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
  );

  server.registerTool(
    'list_jewels',
    {
      description: 'List stored jewels (without exposing sensitive data)',
      inputSchema: schemas.list_jewels
    },
    async (args, extra) => {
      const toolLogger = logger.child({ tool: 'list_jewels', session_id: extra.sessionId });
      const startTime = Date.now();

      try {
        const jewels = await db.listJewels({
          type: args.type,
          limit: args.limit
        });

        // Remove encrypted data
        const result = {
          jewels: jewels.map(c => ({
            id: c.id,
            name: c.name,
            type: c.type,
            last_validated: c.last_validated,
            validation_metadata: c.validation_metadata ? JSON.parse(c.validation_metadata) : null,
            created_at: c.created_at,
            updated_at: c.updated_at
          }))
        };

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
  );

  server.registerTool(
    'get_jewel',
    {
      description: 'Get jewel details (without exposing sensitive data)',
      inputSchema: schemas.get_jewel
    },
    async (args, extra) => {
      const toolLogger = logger.child({ tool: 'get_jewel', session_id: extra.sessionId });
      const startTime = Date.now();

      try {
        const jewel = await db.getJewel(args.id);
        if (!jewel) throw new Error('Jewel not found');

        const result = {
          id: jewel.id,
          name: jewel.name,
          type: jewel.type,
          last_validated: jewel.last_validated,
          validation_metadata: jewel.validation_metadata ? JSON.parse(jewel.validation_metadata) : null,
          created_at: jewel.created_at,
          updated_at: jewel.updated_at
        };

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
  );

  server.registerTool(
    'update_jewel',
    {
      description: 'Update jewel name or data (will re-validate if data is updated)',
      inputSchema: schemas.update_jewel
    },
    async (args, extra) => {
      requireMcpTier(user, 'coherent'); // Coherent can update own jewels
      const toolLogger = logger.child({ tool: 'update_jewel', session_id: extra.sessionId });
      const startTime = Date.now();

      try {
        const updates: any = {};

        if (args.name) {
          updates.name = args.name;
        }

        if (args.data) {
          const { encryptCredentials } = await import('../lib/crypto');
          const { validateGitHubCredential, validateZammadCredential, validateGoogleDocsSource } = await import('../handlers/validate');

          const jewel = await db.getJewel(args.id);
          if (!jewel) throw new Error('Jewel not found');

          // Validate new credentials
          let validationResult;
          switch (jewel.type) {
            case 'github':
              validationResult = await validateGitHubCredential(args.data);
              break;
            case 'zammad':
              validationResult = await validateZammadCredential(args.data);
              break;
            case 'gdocs':
            case 'gdrive':
              validationResult = await validateGoogleDocsSource({}, args.data);
              break;
          }

          if (validationResult && !validationResult.valid) {
            throw new Error(`Credential validation failed: ${validationResult.errors.join(', ')}`);
          }

          const encrypted = await encryptCredentials(JSON.stringify(args.data), encryptionKey);
          updates.data = encrypted;
          updates.last_validated = Math.floor(Date.now() / 1000);
          updates.validation_metadata = validationResult?.metadata || {};
        }

        await db.updateJewel(args.id, updates);

        toolLogger.info('Tool completed', { duration_ms: Date.now() - startTime });

        return {
          content: [{
            type: 'text',
            text: JSON.stringify({ success: true }, null, 2)
          }]
        };
      } catch (error) {
        toolLogger.error('Tool failed', error as Error, { duration_ms: Date.now() - startTime });
        throw error;
      }
    }
  );

  server.registerTool(
    'delete_jewel',
    {
      description: 'Delete a stored jewel (fails if used by any sources)',
      inputSchema: schemas.delete_jewel
    },
    async (args, extra) => {
      requireMcpTier(user, 'coherent'); // Coherent can delete own jewels
      const toolLogger = logger.child({ tool: 'delete_jewel', session_id: extra.sessionId });
      const startTime = Date.now();

      try {
        // Check if in use
        const usage = await db.getJewelUsage(args.id);
        if (usage.length > 0) {
          throw new Error(`Cannot delete jewel: used by ${usage.length} source(s). Usage: ${usage.map(u => `${u.entanglement_name} (${u.source_type})`).join(', ')}`);
        }

        await db.deleteJewel(args.id);

        toolLogger.info('Tool completed', { duration_ms: Date.now() - startTime });

        return {
          content: [{
            type: 'text',
            text: JSON.stringify({ success: true }, null, 2)
          }]
        };
      } catch (error) {
        toolLogger.error('Tool failed', error as Error, { duration_ms: Date.now() - startTime });
        throw error;
      }
    }
  );

  server.registerTool(
    'get_jewel_usage',
    {
      description: 'See which sources are using a jewel',
      inputSchema: schemas.get_jewel_usage
    },
    async (args, extra) => {
      const toolLogger = logger.child({ tool: 'get_jewel_usage', session_id: extra.sessionId });
      const startTime = Date.now();

      try {
        const usage = await db.getJewelUsage(args.id);

        toolLogger.info('Tool completed', { duration_ms: Date.now() - startTime });

        return {
          content: [{
            type: 'text',
            text: JSON.stringify({ usage }, null, 2)
          }]
        };
      } catch (error) {
        toolLogger.error('Tool failed', error as Error, { duration_ms: Date.now() - startTime });
        throw error;
      }
    }
  );

  return server;
}

// HTTP handler for Hono (stateless per request)
export async function mcpHandler(c: Context<{ Bindings: Bindings }>) {
  const db = new DB(c.env.DB);
  const encryptionKey = c.env.ENCRYPTION_KEY;
  const minLogLevel = (c.env.LOG_LEVEL || 'info') as 'info' | 'warn' | 'error' | 'fatal';

  // Get request/session IDs from headers
  const requestId = c.req.header('X-Request-ID') || crypto.randomUUID().substring(0, 8);
  const sessionId = c.req.header('X-Zoku-Session-ID');

  // Create logger
  const logger = new Logger({
    request_id: requestId,
    session_id: sessionId,
    operation: 'mcp_request',
    path: c.req.path,
    method: c.req.method
  }, minLogLevel);

  logger.info('MCP request received');

  try {
    // Parse request body
    const body = await c.req.json().catch(() => undefined);

    // Authenticate MCP request (unless dev bypass)
    let user = null;
    if (c.env.DEV_AUTH_BYPASS === 'true' && c.env.DEV_USER_EMAIL) {
      // Dev bypass
      user = await db.getZokuByEmail(c.env.DEV_USER_EMAIL);
      if (!user) {
        user = await db.createZoku({
          name: 'Dev User',
          type: 'human',
          email: c.env.DEV_USER_EMAIL,
          access_tier: 'prime',
        });
      }
      logger.info('MCP dev auth bypass', { user_id: user.id });
    } else {
      // Validate Bearer token
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
    }

    c.set('user', user);

    // Create fresh transport and server for this request
    const transport = new StreamableHTTPTransport();
    const server = createMcpServer(db, encryptionKey, logger, user);

    // Connect server to transport
    await server.connect(transport);

    // Handle the request
    const response = await transport.handleRequest(c, body);

    logger.info('MCP request completed', logger.withDuration());

    return response;
  } catch (error) {
    logger.error('MCP request failed', error as Error, logger.withDuration());

    // Map error types to JSON-RPC error codes
    const errorMessage = error instanceof Error ? error.message : String(error);
    let code = -32603; // Default: Internal error
    let httpStatus = 500;

    // Map specific error patterns to appropriate codes
    if (errorMessage.includes('not found')) {
      code = -32001; // Resource not found (custom)
      httpStatus = 404;
    } else if (errorMessage.includes('validation failed') || errorMessage.includes('Invalid')) {
      code = -32602; // Invalid params
      httpStatus = 400;
    } else if (errorMessage.includes('timeout')) {
      code = -32002; // Timeout (custom)
      httpStatus = 504;
    } else if (errorMessage.includes('Access denied') || errorMessage.includes('permission')) {
      code = -32003; // Permission denied (custom)
      httpStatus = 403;
    } else if (error instanceof Error && error.name === 'ZodError') {
      code = -32602; // Invalid params
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
