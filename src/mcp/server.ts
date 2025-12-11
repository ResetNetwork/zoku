// MCP Server implementation using official SDK

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  Tool
} from '@modelcontextprotocol/sdk/types.js';
import { z } from 'zod';
import type { Context } from 'hono';
import type { Bindings } from '../types';
import { DB } from '../db';

// Tool schemas using Zod
const schemas = {
  list_volitions: z.object({
    status: z.enum(['draft', 'active', 'paused', 'complete', 'archived']).optional(),
    function: z.enum(['tech_innovation', 'info_tech']).optional(),
    parent_id: z.string().optional(),
    root_only: z.boolean().optional(),
    limit: z.number().optional()
  }),

  get_volition: z.object({
    id: z.string(),
    include_children_qupts: z.boolean().optional()
  }),

  get_children: z.object({
    parent_id: z.string(),
    recursive: z.boolean().optional()
  }),

  create_volition: z.object({
    name: z.string(),
    description: z.string().optional(),
    parent_id: z.string().optional()
  }),

  update_volition: z.object({
    id: z.string(),
    name: z.string().optional(),
    description: z.string().optional(),
    parent_id: z.string().optional()
  }),

  move_volition: z.object({
    id: z.string(),
    new_parent_id: z.string().optional()
  }),

  delete_volition: z.object({
    id: z.string(),
    confirm: z.boolean()
  }),

  create_qupt: z.object({
    volition_id: z.string(),
    content: z.string(),
    entangled_id: z.string().optional(),
    metadata: z.record(z.any()).optional()
  }),

  list_qupts: z.object({
    volition_id: z.string(),
    recursive: z.boolean().optional(),
    source: z.string().optional(),
    limit: z.number().optional()
  }),

  list_entangled: z.object({
    type: z.enum(['human', 'agent']).optional(),
    limit: z.number().optional()
  }),

  create_entangled: z.object({
    name: z.string(),
    type: z.enum(['human', 'agent']),
    metadata: z.record(z.any()).optional()
  }),

  get_entangled: z.object({
    id: z.string()
  }),

  entangle: z.object({
    volition_id: z.string(),
    entangled_id: z.string(),
    role: z.enum(['perform', 'accountable', 'control', 'support', 'informed'])
  }),

  disentangle: z.object({
    volition_id: z.string(),
    entangled_id: z.string(),
    role: z.enum(['perform', 'accountable', 'control', 'support', 'informed'])
  }),

  get_matrix: z.object({
    volition_id: z.string()
  }),

  list_dimensions: z.object({}),

  set_attributes: z.object({
    volition_id: z.string(),
    attributes: z.array(z.object({
      dimension: z.string(),
      value: z.string()
    }))
  }),

  get_attributes: z.object({
    volition_id: z.string()
  }),

  list_sources: z.object({
    volition_id: z.string()
  }),

  add_source: z.object({
    volition_id: z.string(),
    type: z.enum(['github', 'gmail', 'zammad', 'gdrive', 'gdocs', 'webhook']),
    config: z.record(z.any())
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
  })
};

// Tool definitions
const tools: Tool[] = [
  {
    name: 'list_volitions',
    description: 'List volitions in the Zoku system',
    inputSchema: {
      type: 'object',
      properties: {
        status: {
          type: 'string',
          enum: ['draft', 'active', 'paused', 'complete', 'archived'],
          description: 'Filter by status'
        },
        function: {
          type: 'string',
          enum: ['tech_innovation', 'info_tech'],
          description: 'Filter by function'
        },
        parent_id: {
          type: 'string',
          description: 'Get children of a specific volition'
        },
        root_only: {
          type: 'boolean',
          description: 'Only return top-level volitions',
          default: false
        },
        limit: {
          type: 'number',
          description: 'Max results to return',
          default: 20
        }
      }
    }
  },
  {
    name: 'get_volition',
    description: 'Get full details of a volition including children, matrix, and aggregated activity from descendants',
    inputSchema: {
      type: 'object',
      properties: {
        id: { type: 'string', description: 'Volition ID' },
        include_children_qupts: {
          type: 'boolean',
          description: 'Include qupts from child volitions',
          default: true
        }
      },
      required: ['id']
    }
  },
  {
    name: 'get_children',
    description: 'Get child volitions of a parent volition',
    inputSchema: {
      type: 'object',
      properties: {
        parent_id: { type: 'string', description: 'Parent volition ID' },
        recursive: {
          type: 'boolean',
          description: 'Include all descendants, not just direct children',
          default: false
        }
      },
      required: ['parent_id']
    }
  },
  {
    name: 'create_volition',
    description: 'Create a new project/initiative, optionally as a child of another volition',
    inputSchema: {
      type: 'object',
      properties: {
        name: { type: 'string', description: 'Name of the volition' },
        description: { type: 'string', description: 'Description of the volition' },
        parent_id: { type: 'string', description: 'Parent volition ID for nesting' }
      },
      required: ['name']
    }
  },
  {
    name: 'update_volition',
    description: "Update a volition's name, description, or parent",
    inputSchema: {
      type: 'object',
      properties: {
        id: { type: 'string' },
        name: { type: 'string' },
        description: { type: 'string' },
        parent_id: { type: 'string', description: 'Move to new parent (null to make root)' }
      },
      required: ['id']
    }
  },
  {
    name: 'move_volition',
    description: 'Move a volition to become a child of another volition, or make it a root volition',
    inputSchema: {
      type: 'object',
      properties: {
        id: { type: 'string', description: 'Volition ID to move' },
        new_parent_id: {
          type: 'string',
          description: 'New parent volition ID, or null to make root-level'
        }
      },
      required: ['id']
    }
  },
  {
    name: 'delete_volition',
    description: 'Delete a volition. WARNING: Also deletes all child volitions, qupts, sources, and assignments.',
    inputSchema: {
      type: 'object',
      properties: {
        id: { type: 'string', description: 'Volition ID to delete' },
        confirm: {
          type: 'boolean',
          description: 'Must be true to confirm deletion',
          default: false
        }
      },
      required: ['id', 'confirm']
    }
  },
  {
    name: 'create_qupt',
    description: 'Record activity or update on a volition',
    inputSchema: {
      type: 'object',
      properties: {
        volition_id: { type: 'string', description: 'ID of the volition' },
        content: { type: 'string', description: 'Activity description' },
        entangled_id: { type: 'string', description: 'ID of the entangled entity creating this qupt' },
        metadata: { type: 'object', description: 'Additional structured data' }
      },
      required: ['volition_id', 'content']
    }
  },
  {
    name: 'list_qupts',
    description: 'List activity for a volition, optionally including child volitions',
    inputSchema: {
      type: 'object',
      properties: {
        volition_id: { type: 'string' },
        recursive: {
          type: 'boolean',
          description: 'Include qupts from child volitions',
          default: true
        },
        source: {
          type: 'string',
          description: 'Filter by source (github, gmail, zammad, etc.)'
        },
        limit: { type: 'number', default: 20 }
      },
      required: ['volition_id']
    }
  },
  {
    name: 'list_entangled',
    description: 'List all entangled partners (humans and AI agents)',
    inputSchema: {
      type: 'object',
      properties: {
        type: { type: 'string', enum: ['human', 'agent'] },
        limit: { type: 'number', default: 20 }
      }
    }
  },
  {
    name: 'create_entangled',
    description: 'Register a new entangled partner (human or AI agent)',
    inputSchema: {
      type: 'object',
      properties: {
        name: { type: 'string', description: 'Name of the entity' },
        type: { type: 'string', enum: ['human', 'agent'] },
        metadata: { type: 'object', description: 'Additional metadata' }
      },
      required: ['name', 'type']
    }
  },
  {
    name: 'get_entangled',
    description: 'Get details of an entangled partner including their volitions and roles',
    inputSchema: {
      type: 'object',
      properties: {
        id: { type: 'string' }
      },
      required: ['id']
    }
  },
  {
    name: 'entangle',
    description: 'Assign an entangled partner to a PASCI role on a volition',
    inputSchema: {
      type: 'object',
      properties: {
        volition_id: { type: 'string' },
        entangled_id: { type: 'string' },
        role: {
          type: 'string',
          enum: ['perform', 'accountable', 'control', 'support', 'informed'],
          description: 'PASCI role: Perform (does work), Accountable (answerable), Control (veto power), Support (advisory), Informed (notified)'
        }
      },
      required: ['volition_id', 'entangled_id', 'role']
    }
  },
  {
    name: 'disentangle',
    description: 'Remove an entangled partner from a PASCI role on a volition',
    inputSchema: {
      type: 'object',
      properties: {
        volition_id: { type: 'string' },
        entangled_id: { type: 'string' },
        role: {
          type: 'string',
          enum: ['perform', 'accountable', 'control', 'support', 'informed']
        }
      },
      required: ['volition_id', 'entangled_id', 'role']
    }
  },
  {
    name: 'get_matrix',
    description: 'Get the PASCI responsibility matrix showing who is assigned to each role',
    inputSchema: {
      type: 'object',
      properties: {
        volition_id: { type: 'string' }
      },
      required: ['volition_id']
    }
  },
  {
    name: 'list_dimensions',
    description: 'List all taxonomy dimensions and their available values',
    inputSchema: {
      type: 'object',
      properties: {}
    }
  },
  {
    name: 'set_attributes',
    description: 'Set taxonomy attributes on a volition (function, pillar, service area, etc.)',
    inputSchema: {
      type: 'object',
      properties: {
        volition_id: { type: 'string' },
        attributes: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              dimension: { type: 'string', description: "Dimension name (e.g., 'function', 'pillar')" },
              value: { type: 'string', description: 'Value within that dimension' }
            },
            required: ['dimension', 'value']
          }
        }
      },
      required: ['volition_id', 'attributes']
    }
  },
  {
    name: 'get_attributes',
    description: 'Get taxonomy attributes assigned to a volition',
    inputSchema: {
      type: 'object',
      properties: {
        volition_id: { type: 'string' }
      },
      required: ['volition_id']
    }
  },
  {
    name: 'list_sources',
    description: 'List activity sources configured for a volition',
    inputSchema: {
      type: 'object',
      properties: {
        volition_id: { type: 'string' }
      },
      required: ['volition_id']
    }
  },
  {
    name: 'add_source',
    description: 'Add an activity source to a volition (GitHub repo, Gmail label, Zammad tickets, Google Drive folder, Google Doc, etc.)',
    inputSchema: {
      type: 'object',
      properties: {
        volition_id: { type: 'string' },
        type: { type: 'string', enum: ['github', 'gmail', 'zammad', 'gdrive', 'gdocs', 'webhook'] },
        config: { type: 'object' }
      },
      required: ['volition_id', 'type', 'config']
    }
  },
  {
    name: 'sync_source',
    description: 'Manually trigger a sync for a source',
    inputSchema: {
      type: 'object',
      properties: {
        source_id: { type: 'string' }
      },
      required: ['source_id']
    }
  },
  {
    name: 'remove_source',
    description: 'Remove an activity source from a volition',
    inputSchema: {
      type: 'object',
      properties: {
        source_id: { type: 'string' }
      },
      required: ['source_id']
    }
  },
  {
    name: 'toggle_source',
    description: 'Enable or disable a source',
    inputSchema: {
      type: 'object',
      properties: {
        source_id: { type: 'string' },
        enabled: { type: 'boolean' }
      },
      required: ['source_id', 'enabled']
    }
  }
];

// Tool handler implementations
async function handleToolCall(name: string, args: any, db: DB): Promise<any> {
  switch (name) {
    case 'list_volitions': {
      const input = schemas.list_volitions.parse(args);
      const volitions = await db.listVolitions({
        parent_id: input.parent_id,
        root_only: input.root_only,
        limit: input.limit
      });
      return { volitions };
    }

    case 'get_volition': {
      const input = schemas.get_volition.parse(args);
      const volition = await db.getVolition(input.id);
      if (!volition) throw new Error('Volition not found');

      const children = await db.getVolitionChildren(input.id);
      const matrix = await db.getMatrix(input.id);
      const attributes = await db.getVolitionAttributes(input.id);
      const qupts = await db.listQupts({
        volition_id: input.id,
        recursive: input.include_children_qupts ?? true,
        limit: 20
      });

      return { ...volition, children, matrix, attributes, qupts };
    }

    case 'get_children': {
      const input = schemas.get_children.parse(args);
      if (input.recursive) {
        return { children: await db.getVolitionDescendants(input.parent_id) };
      }
      return { children: await db.getVolitionChildren(input.parent_id) };
    }

    case 'create_volition': {
      const input = schemas.create_volition.parse(args);
      const volition = await db.createVolition(input);
      return volition;
    }

    case 'update_volition': {
      const input = schemas.update_volition.parse(args);
      await db.updateVolition(input.id, {
        name: input.name,
        description: input.description,
        parent_id: input.parent_id
      });
      return { success: true };
    }

    case 'move_volition': {
      const input = schemas.move_volition.parse(args);
      await db.updateVolition(input.id, { parent_id: input.new_parent_id || null });
      return { success: true };
    }

    case 'delete_volition': {
      const input = schemas.delete_volition.parse(args);
      if (!input.confirm) {
        throw new Error('Must set confirm=true to delete volition');
      }
      await db.deleteVolition(input.id);
      return { success: true };
    }

    case 'create_qupt': {
      const input = schemas.create_qupt.parse(args);
      const qupt = await db.createQupt({
        volition_id: input.volition_id,
        content: input.content,
        entangled_id: input.entangled_id,
        source: 'mcp',
        metadata: input.metadata
      });
      return qupt;
    }

    case 'list_qupts': {
      const input = schemas.list_qupts.parse(args);
      const qupts = await db.listQupts({
        volition_id: input.volition_id,
        recursive: input.recursive ?? true,
        source: input.source,
        limit: input.limit
      });
      return { qupts };
    }

    case 'list_entangled': {
      const input = schemas.list_entangled.parse(args);
      const entangled = await db.listEntangled({
        type: input.type,
        limit: input.limit
      });
      return { entangled };
    }

    case 'create_entangled': {
      const input = schemas.create_entangled.parse(args);
      const entangled = await db.createEntangled(input);
      return entangled;
    }

    case 'get_entangled': {
      const input = schemas.get_entangled.parse(args);
      const entangled = await db.getEntangled(input.id);
      if (!entangled) throw new Error('Entangled entity not found');
      return entangled;
    }

    case 'entangle': {
      const input = schemas.entangle.parse(args);
      await db.assignToMatrix(input.volition_id, input.entangled_id, input.role);
      return { success: true };
    }

    case 'disentangle': {
      const input = schemas.disentangle.parse(args);
      await db.removeFromMatrix(input.volition_id, input.entangled_id, input.role);
      return { success: true };
    }

    case 'get_matrix': {
      const input = schemas.get_matrix.parse(args);
      const matrix = await db.getMatrix(input.volition_id);
      return { matrix };
    }

    case 'list_dimensions': {
      const dimensions = await db.listDimensions();
      const values = await db.getAllDimensionValues();
      const result = dimensions.map(dim => ({
        ...dim,
        values: values.filter(v => v.dimension_id === dim.id)
      }));
      return { dimensions: result };
    }

    case 'set_attributes': {
      const input = schemas.set_attributes.parse(args);
      const dimensions = await db.listDimensions();
      const values = await db.getAllDimensionValues();

      const attributesToSet = input.attributes.map(attr => {
        const dim = dimensions.find(d => d.name === attr.dimension);
        if (!dim) throw new Error(`Unknown dimension: ${attr.dimension}`);
        const val = values.find(v => v.dimension_id === dim.id && v.value === attr.value);
        if (!val) throw new Error(`Unknown value: ${attr.value} for dimension ${attr.dimension}`);
        return { dimension_id: dim.id, value_id: val.id };
      });

      await db.setVolitionAttributes(input.volition_id, attributesToSet);
      return { success: true };
    }

    case 'get_attributes': {
      const input = schemas.get_attributes.parse(args);
      const attributes = await db.getVolitionAttributes(input.volition_id);
      return { attributes };
    }

    case 'list_sources': {
      const input = schemas.list_sources.parse(args);
      const sources = await db.listSources(input.volition_id);
      return { sources: sources.map(s => ({
        id: s.id,
        type: s.type,
        config: s.config,
        enabled: s.enabled,
        last_sync: s.last_sync
      })) };
    }

    case 'add_source': {
      const input = schemas.add_source.parse(args);
      const source = await db.createSource({
        volition_id: input.volition_id,
        type: input.type,
        config: input.config
      });
      return { source };
    }

    case 'sync_source': {
      const input = schemas.sync_source.parse(args);
      // TODO: Trigger manual sync
      return { success: true, message: 'Manual sync not yet implemented' };
    }

    case 'remove_source': {
      const input = schemas.remove_source.parse(args);
      await db.deleteSource(input.source_id);
      return { success: true };
    }

    case 'toggle_source': {
      const input = schemas.toggle_source.parse(args);
      await db.updateSource(input.source_id, { enabled: input.enabled });
      return { success: true };
    }

    default:
      throw new Error(`Unknown tool: ${name}`);
  }
}

// HTTP handler for Hono
export async function mcpHandler(c: Context<{ Bindings: Bindings }>) {
  const db = new DB(c.env.DB);

  try {
    const request = await c.req.json();

    // Handle list tools
    if (request.method === 'tools/list') {
      return c.json({
        tools
      });
    }

    // Handle tool call
    if (request.method === 'tools/call') {
      const { name, arguments: args } = request.params;

      try {
        const result = await handleToolCall(name, args, db);
        return c.json({
          content: [
            {
              type: 'text',
              text: JSON.stringify(result, null, 2)
            }
          ]
        });
      } catch (error) {
        return c.json({
          error: {
            code: 'TOOL_EXECUTION_ERROR',
            message: error instanceof Error ? error.message : String(error)
          }
        }, 400);
      }
    }

    return c.json({ error: 'Unknown method' }, 400);
  } catch (error) {
    return c.json({
      error: {
        code: 'INVALID_REQUEST',
        message: error instanceof Error ? error.message : String(error)
      }
    }, 400);
  }
}
