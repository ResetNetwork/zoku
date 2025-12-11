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
    limit: z.number().optional(),
    detailed: z.boolean().optional()
  }),

  get_volition: z.object({
    id: z.string(),
    include_children_qupts: z.boolean().optional(),
    detailed: z.boolean().optional()
  }),

  get_children: z.object({
    parent_id: z.string(),
    recursive: z.boolean().optional()
  }),

  create_volition: z.object({
    name: z.string(),
    description: z.string().optional(),
    parent_id: z.string().optional(),
    initial_entangled: z.array(z.object({
      entangled_id: z.string(),
      role: z.enum(['perform', 'accountable', 'control', 'support', 'informed'])
    })).optional()
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
    limit: z.number().optional(),
    detailed: z.boolean().optional()
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
    config: z.record(z.any()),
    credentials: z.record(z.any()).optional(),
    credential_id: z.string().optional()
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

  // Credentials
  add_credential: z.object({
    name: z.string(),
    type: z.enum(['github', 'gmail', 'zammad', 'gdrive', 'gdocs']),
    data: z.record(z.any())
  }),

  list_credentials: z.object({
    type: z.enum(['github', 'gmail', 'zammad', 'gdrive', 'gdocs']).optional(),
    limit: z.number().optional()
  }),

  get_credential: z.object({
    id: z.string()
  }),

  update_credential: z.object({
    id: z.string(),
    name: z.string().optional(),
    data: z.record(z.any()).optional()
  }),

  delete_credential: z.object({
    id: z.string()
  }),

  get_credential_usage: z.object({
    id: z.string()
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
    description: 'Get volition details. By default returns minimal info (counts only). Use detailed=true for full nested data.',
    inputSchema: {
      type: 'object',
      properties: {
        id: { type: 'string', description: 'Volition ID' },
        include_children_qupts: {
          type: 'boolean',
          description: 'Include qupts from child volitions',
          default: true
        },
        detailed: {
          type: 'boolean',
          description: 'Return full nested data (children, matrix, attributes, qupts). Default: false (returns counts only)',
          default: false
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
    description: 'Create a new project/initiative, optionally as a child of another volition with initial team assignments',
    inputSchema: {
      type: 'object',
      properties: {
        name: { type: 'string', description: 'Name of the volition' },
        description: { type: 'string', description: 'Description of the volition' },
        parent_id: { type: 'string', description: 'Parent volition ID for nesting' },
        initial_entangled: {
          type: 'array',
          description: 'Initial PASCI role assignments (e.g., [{ entangled_id: "ent-1", role: "accountable" }])',
          items: {
            type: 'object',
            properties: {
              entangled_id: { type: 'string' },
              role: { type: 'string', enum: ['perform', 'accountable', 'control', 'support', 'informed'] }
            },
            required: ['entangled_id', 'role']
          }
        }
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
    description: 'List activity for a volition. By default omits metadata for brevity. Use detailed=true for full metadata.',
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
        limit: { type: 'number', default: 20 },
        detailed: {
          type: 'boolean',
          description: 'Include full metadata. Default: false (omits metadata for brevity)',
          default: false
        }
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
    description: 'Add an activity source to a volition. Can use stored credentials (via credential_id) or provide inline credentials.',
    inputSchema: {
      type: 'object',
      properties: {
        volition_id: { type: 'string' },
        type: { type: 'string', enum: ['github', 'gmail', 'zammad', 'gdrive', 'gdocs', 'webhook'] },
        config: { type: 'object', description: 'Source-specific configuration (e.g., owner, repo for GitHub)' },
        credentials: { type: 'object', description: 'Inline authentication credentials (will be validated and encrypted). Omit if using credential_id.' },
        credential_id: { type: 'string', description: 'ID of stored credential to use. Omit if providing inline credentials.' }
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
  },
  {
    name: 'add_credential',
    description: 'Store and validate credentials that can be reused across multiple sources',
    inputSchema: {
      type: 'object',
      properties: {
        name: { type: 'string', description: 'User-friendly name (e.g., "GitHub - Personal")' },
        type: { type: 'string', enum: ['github', 'gmail', 'zammad', 'gdrive', 'gdocs'] },
        data: { type: 'object', description: 'Authentication credentials (will be validated and encrypted)' }
      },
      required: ['name', 'type', 'data']
    }
  },
  {
    name: 'list_credentials',
    description: 'List stored credentials (without exposing sensitive data)',
    inputSchema: {
      type: 'object',
      properties: {
        type: { type: 'string', enum: ['github', 'gmail', 'zammad', 'gdrive', 'gdocs'], description: 'Filter by credential type' },
        limit: { type: 'number', default: 20 }
      }
    }
  },
  {
    name: 'get_credential',
    description: 'Get credential details (without exposing sensitive data)',
    inputSchema: {
      type: 'object',
      properties: {
        id: { type: 'string' }
      },
      required: ['id']
    }
  },
  {
    name: 'update_credential',
    description: 'Update credential name or data (will re-validate if data is updated)',
    inputSchema: {
      type: 'object',
      properties: {
        id: { type: 'string' },
        name: { type: 'string', description: 'New name for the credential' },
        data: { type: 'object', description: 'New authentication credentials (will be validated)' }
      },
      required: ['id']
    }
  },
  {
    name: 'delete_credential',
    description: 'Delete a stored credential (fails if used by any sources)',
    inputSchema: {
      type: 'object',
      properties: {
        id: { type: 'string' }
      },
      required: ['id']
    }
  },
  {
    name: 'get_credential_usage',
    description: 'See which sources are using a credential',
    inputSchema: {
      type: 'object',
      properties: {
        id: { type: 'string' }
      },
      required: ['id']
    }
  }
];

// Tool handler implementations
async function handleToolCall(name: string, args: any, db: DB, encryptionKey: string): Promise<any> {
  switch (name) {
    case 'list_volitions': {
      const input = schemas.list_volitions.parse(args);
      const volitions = await db.listVolitions({
        parent_id: input.parent_id,
        root_only: input.root_only,
        limit: input.limit
      });

      // Always include counts (lightweight and useful)
      const volitionsWithCounts = await Promise.all(
        volitions.map(async v => {
          const qupts_count = (await db.listQupts({ volition_id: v.id, recursive: true, limit: 1000 })).length;
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
              // Omit description by default
            };
          }

          return { ...v, qupts_count, sources_count };
        })
      );

      return { volitions: volitionsWithCounts };
    }

    case 'get_volition': {
      const input = schemas.get_volition.parse(args);
      const volition = await db.getVolition(input.id);
      if (!volition) throw new Error('Volition not found');

      // Default: return minimal info
      if (!input.detailed) {
        const childrenCount = (await db.getVolitionChildren(input.id)).length;
        const quptsCount = (await db.listQupts({
          volition_id: input.id,
          recursive: input.include_children_qupts ?? true,
          limit: 1000
        })).length;

        return {
          ...volition,
          children_count: childrenCount,
          qupts_count: quptsCount,
          sources_count: (await db.listSources(input.id)).length
        };
      }

      // Detailed: return full nested data
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
      const volition = await db.createVolition({
        name: input.name,
        description: input.description,
        parent_id: input.parent_id
      });

      // Add initial entangled assignments if provided
      if (input.initial_entangled && Array.isArray(input.initial_entangled)) {
        for (const assignment of input.initial_entangled) {
          try {
            await db.assignToMatrix(volition.id, assignment.entangled_id, assignment.role);
          } catch (error) {
            console.warn(`Failed to assign ${assignment.entangled_id} to ${assignment.role}:`, error);
          }
        }
      }

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

      // Default: return minimal qupts (no metadata)
      if (!input.detailed) {
        return {
          qupts: qupts.map(q => ({
            id: q.id,
            volition_id: q.volition_id,
            content: q.content,
            source: q.source,
            external_id: q.external_id,
            created_at: q.created_at
            // Omit metadata by default
          }))
        };
      }

      // Detailed: return full qupts with metadata
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

      // Validate source configuration if credentials are provided
      const warnings: string[] = [];
      let validationMetadata: Record<string, any> = {};

      // If credential_id is provided, verify it exists and matches type
      if (input.credential_id) {
        const credential = await db.getCredential(input.credential_id);
        if (!credential) {
          throw new Error('Credential not found');
        }
        if (credential.type !== input.type) {
          throw new Error(`Credential type mismatch: credential is ${credential.type}, source is ${input.type}`);
        }
      } else if (input.credentials) {
        // Validate inline credentials
        const { validateGitHubSource, validateZammadSource, validateGoogleDocsSource } = await import('../handlers/validate');

        let validationResult;
        switch (input.type) {
          case 'github':
            validationResult = await validateGitHubSource(input.config, input.credentials);
            break;
          case 'zammad':
            validationResult = await validateZammadSource(input.config, input.credentials);
            break;
          case 'gdocs':
            validationResult = await validateGoogleDocsSource(input.config, input.credentials);
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
        volition_id: input.volition_id,
        type: input.type,
        config: input.config,
        credentials: input.credentials,
        credential_id: input.credential_id
      });

      // Set initial sync window to last 30 days (ensures at least 20 items for active sources)
      const thirtyDaysAgo = Math.floor(Date.now() / 1000) - (30 * 24 * 60 * 60);
      try {
        await db.updateSource(source.id, { last_sync: thirtyDaysAgo });
        console.log(`Set initial sync window to last 30 days for source ${source.id}`);
      } catch (error) {
        console.warn(`Failed to set initial sync window for source ${source.id}:`, error);
      }

      const response: any = { source };
      if (warnings.length > 0) {
        response.warnings = warnings;
      }
      if (Object.keys(validationMetadata).length > 0) {
        response.validation = validationMetadata;
      }

      return response;
    }

    case 'sync_source': {
      const input = schemas.sync_source.parse(args);
      const { decryptCredentials } = await import('../lib/crypto');
      const { handlers } = await import('../handlers');

      // Get the source
      const source = await db.getSource(input.source_id);
      if (!source) {
        throw new Error('Source not found');
      }

      const handler = handlers[source.type];
      if (!handler) {
        throw new Error(`No handler for source type: ${source.type}`);
      }

      const config = JSON.parse(source.config);

      // Get credentials - either from credential_id or inline
      let credentials = {};
      if (source.credential_id) {
        const credential = await db.getCredential(source.credential_id);
        if (!credential) {
          throw new Error('Credential not found');
        }
        credentials = JSON.parse(await decryptCredentials(credential.data, encryptionKey));
      } else if (source.credentials) {
        credentials = JSON.parse(await decryptCredentials(source.credentials, encryptionKey));
      }

      // Fetch new activity
      const { qupts, cursor } = await handler.collect({
        source,
        config,
        credentials,
        since: source.last_sync,
        cursor: source.sync_cursor
      });

      // Insert qupts
      if (qupts.length > 0) {
        await db.batchCreateQupts(qupts);
      }

      // Update sync state
      await db.updateSource(source.id, {
        last_sync: Math.floor(Date.now() / 1000),
        sync_cursor: cursor
      });

      return {
        success: true,
        qupts_collected: qupts.length,
        source_id: source.id,
        cursor: cursor
      };
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

    // Credential management
    case 'add_credential': {
      const input = schemas.add_credential.parse(args);
      const { encryptCredentials } = await import('../lib/crypto');
      const { validateGitHubCredential, validateZammadCredential, validateGoogleDocsSource } = await import('../handlers/validate');

      const warnings: string[] = [];
      let validationMetadata: Record<string, any> = {};

      // Validate credentials (credential-only validation, no config needed)
      let validationResult;
      switch (input.type) {
        case 'github':
          validationResult = await validateGitHubCredential(input.data);
          break;
        case 'zammad':
          validationResult = await validateZammadCredential(input.data);
          break;
        case 'gdocs':
          // For Google, just validate OAuth credentials work
          validationResult = await validateGoogleDocsSource({ document_id: input.data.test_document_id || '' }, input.data);
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
      const encrypted = await encryptCredentials(JSON.stringify(input.data), encryptionKey);
      const credential = await db.createCredential({
        name: input.name,
        type: input.type,
        data: encrypted,
        last_validated: Math.floor(Date.now() / 1000),
        validation_metadata: validationMetadata
      });

      return {
        id: credential.id,
        name: credential.name,
        type: credential.type,
        validation: validationMetadata,
        warnings: warnings.length > 0 ? warnings : undefined
      };
    }

    case 'list_credentials': {
      const input = schemas.list_credentials.parse(args);
      const credentials = await db.listCredentials({
        type: input.type,
        limit: input.limit
      });

      // Remove encrypted data
      return {
        credentials: credentials.map(c => ({
          id: c.id,
          name: c.name,
          type: c.type,
          last_validated: c.last_validated,
          validation_metadata: c.validation_metadata ? JSON.parse(c.validation_metadata) : null,
          created_at: c.created_at,
          updated_at: c.updated_at
        }))
      };
    }

    case 'get_credential': {
      const input = schemas.get_credential.parse(args);
      const credential = await db.getCredential(input.id);
      if (!credential) throw new Error('Credential not found');

      return {
        id: credential.id,
        name: credential.name,
        type: credential.type,
        last_validated: credential.last_validated,
        validation_metadata: credential.validation_metadata ? JSON.parse(credential.validation_metadata) : null,
        created_at: credential.created_at,
        updated_at: credential.updated_at
      };
    }

    case 'update_credential': {
      const input = schemas.update_credential.parse(args);
      const updates: any = {};

      if (input.name) {
        updates.name = input.name;
      }

      if (input.data) {
        const { encryptCredentials } = await import('../lib/crypto');
        const { validateGitHubCredential, validateZammadCredential, validateGoogleDocsSource } = await import('../handlers/validate');

        const credential = await db.getCredential(input.id);
        if (!credential) throw new Error('Credential not found');

        // Validate new credentials
        let validationResult;
        switch (credential.type) {
          case 'github':
            validationResult = await validateGitHubCredential(input.data);
            break;
          case 'zammad':
            validationResult = await validateZammadCredential(input.data);
            break;
          case 'gdocs':
            validationResult = await validateGoogleDocsSource({ document_id: input.data.test_document_id || '' }, input.data);
            break;
        }

        if (validationResult && !validationResult.valid) {
          throw new Error(`Credential validation failed: ${validationResult.errors.join(', ')}`);
        }

        const encrypted = await encryptCredentials(JSON.stringify(input.data), encryptionKey);
        updates.data = encrypted;
        updates.last_validated = Math.floor(Date.now() / 1000);
        updates.validation_metadata = validationResult?.metadata || {};
      }

      await db.updateCredential(input.id, updates);
      return { success: true };
    }

    case 'delete_credential': {
      const input = schemas.delete_credential.parse(args);

      // Check if in use
      const usage = await db.getCredentialUsage(input.id);
      if (usage.length > 0) {
        throw new Error(`Cannot delete credential: used by ${usage.length} source(s). Usage: ${usage.map(u => `${u.volition_name} (${u.source_type})`).join(', ')}`);
      }

      await db.deleteCredential(input.id);
      return { success: true };
    }

    case 'get_credential_usage': {
      const input = schemas.get_credential_usage.parse(args);
      const usage = await db.getCredentialUsage(input.id);
      return { usage };
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

    // Handle initialize
    if (request.method === 'initialize') {
      return c.json({
        jsonrpc: '2.0',
        id: request.id,
        result: {
          protocolVersion: '2024-11-05',
          capabilities: {
            tools: {}
          },
          serverInfo: {
            name: 'zoku',
            version: '1.0.0'
          }
        }
      });
    }

    // Handle list tools
    if (request.method === 'tools/list') {
      return c.json({
        jsonrpc: '2.0',
        id: request.id,
        result: {
          tools
        }
      });
    }

    // Handle tool call
    if (request.method === 'tools/call') {
      const { name, arguments: args } = request.params;

      try {
        const result = await handleToolCall(name, args, db, c.env.ENCRYPTION_KEY);
        return c.json({
          jsonrpc: '2.0',
          id: request.id,
          result: {
            content: [
              {
                type: 'text',
                text: JSON.stringify(result, null, 2)
              }
            ]
          }
        });
      } catch (error) {
        return c.json({
          jsonrpc: '2.0',
          id: request.id,
          error: {
            code: -32603,
            message: error instanceof Error ? error.message : String(error)
          }
        });
      }
    }

    return c.json({
      jsonrpc: '2.0',
      id: request.id || null,
      error: {
        code: -32601,
        message: 'Method not found'
      }
    });
  } catch (error) {
    return c.json({
      jsonrpc: '2.0',
      id: null,
      error: {
        code: -32700,
        message: 'Parse error'
      }
    });
  }
}
