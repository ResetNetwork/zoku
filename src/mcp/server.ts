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
    type: z.enum(['github', 'gmail', 'zammad', 'gdrive', 'gdocs', 'webhook']),
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

  // Jewel/Credentials management
  add_jewel: z.object({
    name: z.string(),
    type: z.enum(['github', 'gmail', 'zammad', 'gdrive', 'gdocs']),
    data: z.record(z.any())
  }),

  list_jewels: z.object({
    type: z.enum(['github', 'gmail', 'zammad', 'gdrive', 'gdocs']).optional(),
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

// Create and configure MCP server
function createMcpServer(db: DB, encryptionKey: string, logger: Logger): McpServer {
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

  // Tool handlers
  const handleToolCall = async (name: string, args: any): Promise<any> => {
    const toolLogger = logger.child({ tool: name });
    const startTime = Date.now();

    try {
      toolLogger.info(`Tool called`, { args });

      let result: any;

      switch (name) {
        case 'list_entanglements': {
          const input = schemas.list_entanglements.parse(args);
          const entanglementsWithCounts = await db.listEntanglementsWithCounts({
            parent_id: input.parent_id,
            root_only: input.root_only,
            limit: input.limit
          });

          // Return minimal or detailed view
          if (!input.detailed) {
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
          break;
        }

        case 'get_volition': {
          const input = schemas.get_volition.parse(args);
          const entanglement = await db.getEntanglement(input.id);
          if (!entanglement) throw new Error('Entanglement not found');

          // Default: return minimal info with proper counts
          if (!input.detailed) {
            const [childrenCount, quptsCount, sourcesCount] = await Promise.all([
              db.getEntanglementChildrenCount(input.id),
              db.getEntanglementQuptsCount(input.id, input.include_children_qupts ?? true),
              db.getEntanglementSourcesCount(input.id)
            ]);

            result = {
              ...entanglement,
              children_count: childrenCount,
              qupts_count: quptsCount,
              sources_count: sourcesCount
            };
          } else {
            // Detailed: return full nested data
            const children = await db.getEntanglementChildren(input.id);
            const matrix = await db.getMatrix(input.id);
            const attributes = await db.getEntanglementAttributes(input.id);
            const qupts = await db.listQupts({
              entanglement_id: input.id,
              recursive: input.include_children_qupts ?? true,
              limit: 20
            });

            result = { ...entanglement, children, matrix, attributes, qupts };
          }
          break;
        }

        case 'get_child_entanglements': {
          const input = schemas.get_child_entanglements.parse(args);
          if (input.recursive) {
            result = { children: await db.getEntanglementDescendants(input.parent_id) };
          } else {
            result = { children: await db.getEntanglementChildren(input.parent_id) };
          }
          break;
        }

        case 'create_entanglement': {
          const input = schemas.create_entanglement.parse(args);
          const entanglement = await db.createEntanglement({
            name: input.name,
            description: input.description,
            parent_id: input.parent_id
          });

          // Add initial zoku assignments if provided
          if (input.initial_zoku && Array.isArray(input.initial_zoku)) {
            for (const assignment of input.initial_zoku) {
              try {
                await db.assignToMatrix(entanglement.id, assignment.zoku_id, assignment.role);
              } catch (error) {
                toolLogger.warn(`Failed to assign ${assignment.zoku_id} to ${assignment.role}`, { error });
              }
            }
          }

          result = entanglement;
          break;
        }

        case 'update_entanglement': {
          const input = schemas.update_entanglement.parse(args);
          await db.updateEntanglement(input.id, {
            name: input.name,
            description: input.description,
            parent_id: input.parent_id
          });
          result = { success: true };
          break;
        }

        case 'move_entanglement': {
          const input = schemas.move_entanglement.parse(args);
          await db.updateEntanglement(input.id, { parent_id: input.new_parent_id || null });
          result = { success: true };
          break;
        }

        case 'delete_entanglement': {
          const input = schemas.delete_entanglement.parse(args);
          if (!input.confirm) {
            throw new Error('Must set confirm=true to delete entanglement');
          }
          await db.deleteEntanglement(input.id);
          result = { success: true };
          break;
        }

        case 'create_qupt': {
          const input = schemas.create_qupt.parse(args);
          const qupt = await db.createQupt({
            entanglement_id: input.entanglement_id,
            content: input.content,
            zoku_id: input.zoku_id,
            source: 'mcp',
            metadata: input.metadata
          });
          result = qupt;
          break;
        }

        case 'list_qupts': {
          const input = schemas.list_qupts.parse(args);
          const qupts = await db.listQupts({
            entanglement_id: input.entanglement_id,
            recursive: input.recursive ?? true,
            source: input.source,
            limit: input.limit
          });

          // Default: return minimal qupts (no metadata)
          if (!input.detailed) {
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
          break;
        }

        case 'list_zoku': {
          const input = schemas.list_zoku.parse(args);
          const zoku = await db.listZoku({
            type: input.type,
            limit: input.limit
          });
          result = { zoku };
          break;
        }

        case 'create_zoku': {
          const input = schemas.create_zoku.parse(args);
          const zoku = await db.createZoku(input);
          result = zoku;
          break;
        }

        case 'get_entangled': {
          const input = schemas.get_entangled.parse(args);
          const zoku = await db.getZoku(input.id);
          if (!zoku) throw new Error('Zoku not found');
          result = zoku;
          break;
        }

        case 'entangle': {
          const input = schemas.entangle.parse(args);
          await db.assignToMatrix(input.entanglement_id, input.zoku_id, input.role);
          result = { success: true };
          break;
        }

        case 'disentangle': {
          const input = schemas.disentangle.parse(args);
          await db.removeFromMatrix(input.entanglement_id, input.zoku_id, input.role);
          result = { success: true };
          break;
        }

        case 'get_matrix': {
          const input = schemas.get_matrix.parse(args);
          const matrix = await db.getMatrix(input.entanglement_id);
          result = { matrix };
          break;
        }

        case 'list_dimensions': {
          const dimensions = await db.listDimensions();
          const values = await db.getAllDimensionValues();
          const dimensionsWithValues = dimensions.map(dim => ({
            ...dim,
            values: values.filter(v => v.dimension_id === dim.id)
          }));
          result = { dimensions: dimensionsWithValues };
          break;
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

          await db.setEntanglementAttributes(input.entanglement_id, attributesToSet);
          result = { success: true };
          break;
        }

        case 'get_attributes': {
          const input = schemas.get_attributes.parse(args);
          const attributes = await db.getEntanglementAttributes(input.entanglement_id);
          result = { attributes };
          break;
        }

        case 'list_sources': {
          const input = schemas.list_sources.parse(args);
          const sources = await db.listSources(input.entanglement_id);
          result = {
            sources: sources.map(s => ({
              id: s.id,
              type: s.type,
              config: s.config,
              enabled: s.enabled,
              last_sync: s.last_sync
            }))
          };
          break;
        }

        case 'add_source': {
          const input = schemas.add_source.parse(args);

          // Validate source configuration if credentials are provided
          const warnings: string[] = [];
          let validationMetadata: Record<string, any> = {};

          // If jewel_id is provided, verify it exists and matches type
          if (input.jewel_id) {
            const jewel = await db.getJewel(input.jewel_id);
            if (!jewel) {
              throw new Error('Jewel not found');
            }
            if (jewel.type !== input.type) {
              throw new Error(`Jewel type mismatch: jewel is ${jewel.type}, source is ${input.type}`);
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
              case 'gdrive':
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
            entanglement_id: input.entanglement_id,
            type: input.type,
            config: input.config,
            credentials: input.credentials,
            jewel_id: input.jewel_id
          });

          // Set initial sync window to last 30 days
          const thirtyDaysAgo = Math.floor(Date.now() / 1000) - (30 * 24 * 60 * 60);
          try {
            await db.updateSource(source.id, { last_sync: thirtyDaysAgo });
            toolLogger.info(`Set initial sync window to last 30 days for source ${source.id}`);
          } catch (error) {
            toolLogger.warn(`Failed to set initial sync window for source ${source.id}`, { error });
          }

          result = { source };
          if (warnings.length > 0) {
            result.warnings = warnings;
          }
          if (Object.keys(validationMetadata).length > 0) {
            result.validation = validationMetadata;
          }
          break;
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

          // Fetch new activity with error tracking
          try {
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

            // Update sync state and clear any previous errors
            await db.updateSource(source.id, {
              last_sync: Math.floor(Date.now() / 1000),
              sync_cursor: cursor,
              last_error: null,
              error_count: 0,
              last_error_at: null
            });

            result = {
              success: true,
              qupts_collected: qupts.length,
              source_id: source.id,
              cursor: cursor
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
          break;
        }

        case 'remove_source': {
          const input = schemas.remove_source.parse(args);
          await db.deleteSource(input.source_id);
          result = { success: true };
          break;
        }

        case 'toggle_source': {
          const input = schemas.toggle_source.parse(args);
          await db.updateSource(input.source_id, { enabled: input.enabled });
          result = { success: true };
          break;
        }

        // Jewel/Credential management
        case 'add_jewel': {
          const input = schemas.add_jewel.parse(args);
          const { encryptCredentials } = await import('../lib/crypto');
          const { validateGitHubCredential, validateZammadCredential, validateGoogleDocsSource } = await import('../handlers/validate');

          const warnings: string[] = [];
          let validationMetadata: Record<string, any> = {};

          // Validate credentials
          let validationResult;
          switch (input.type) {
            case 'github':
              validationResult = await validateGitHubCredential(input.data);
              break;
            case 'zammad':
              validationResult = await validateZammadCredential(input.data);
              break;
            case 'gdocs':
            case 'gdrive':
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
          const jewel = await db.createJewel({
            name: input.name,
            type: input.type,
            data: encrypted,
            last_validated: Math.floor(Date.now() / 1000),
            validation_metadata: validationMetadata
          });

          result = {
            id: jewel.id,
            name: jewel.name,
            type: jewel.type,
            validation: validationMetadata,
            warnings: warnings.length > 0 ? warnings : undefined
          };
          break;
        }

        case 'list_jewels': {
          const input = schemas.list_jewels.parse(args);
          const jewels = await db.listJewels({
            type: input.type,
            limit: input.limit
          });

          // Remove encrypted data
          result = {
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
          break;
        }

        case 'get_credential': {
          const input = schemas.get_credential.parse(args);
          const jewel = await db.getJewel(input.id);
          if (!jewel) throw new Error('Jewel not found');

          result = {
            id: jewel.id,
            name: jewel.name,
            type: jewel.type,
            last_validated: jewel.last_validated,
            validation_metadata: jewel.validation_metadata ? JSON.parse(jewel.validation_metadata) : null,
            created_at: jewel.created_at,
            updated_at: jewel.updated_at
          };
          break;
        }

        case 'update_jewel': {
          const input = schemas.update_jewel.parse(args);
          const updates: any = {};

          if (input.name) {
            updates.name = input.name;
          }

          if (input.data) {
            const { encryptCredentials } = await import('../lib/crypto');
            const { validateGitHubCredential, validateZammadCredential, validateGoogleDocsSource } = await import('../handlers/validate');

            const jewel = await db.getJewel(input.id);
            if (!jewel) throw new Error('Jewel not found');

            // Validate new credentials
            let validationResult;
            switch (jewel.type) {
              case 'github':
                validationResult = await validateGitHubCredential(input.data);
                break;
              case 'zammad':
                validationResult = await validateZammadCredential(input.data);
                break;
              case 'gdocs':
              case 'gdrive':
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

          await db.updateJewel(input.id, updates);
          result = { success: true };
          break;
        }

        case 'delete_jewel': {
          const input = schemas.delete_jewel.parse(args);

          // Check if in use
          const usage = await db.getJewelUsage(input.id);
          if (usage.length > 0) {
            throw new Error(`Cannot delete jewel: used by ${usage.length} source(s). Usage: ${usage.map(u => `${u.entanglement_name} (${u.source_type})`).join(', ')}`);
          }

          await db.deleteJewel(input.id);
          result = { success: true };
          break;
        }

        case 'get_jewel_usage': {
          const input = schemas.get_jewel_usage.parse(args);
          const usage = await db.getJewelUsage(input.id);
          result = { usage };
          break;
        }

        default:
          throw new Error(`Unknown tool: ${name}`);
      }

      const duration = Date.now() - startTime;
      toolLogger.info('Tool completed', { duration_ms: duration });

      return result;
    } catch (error) {
      const duration = Date.now() - startTime;
      toolLogger.error('Tool failed', error as Error, { duration_ms: duration });
      throw error;
    }
  };

  // Register all 29 tools
  server.tool(
    'list_entanglements',
    'List entanglements in the Zoku system',
    {
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
        description: 'Get children of a specific entanglement'
      },
      root_only: {
        type: 'boolean',
        description: 'Only return top-level entanglements',
        default: false
      },
      limit: {
        type: 'number',
        description: 'Max results to return',
        default: 20
      },
      detailed: {
        type: 'boolean',
        description: 'Include full details (default: counts only)',
        default: false
      }
    },
    (args) => handleToolCall('list_entanglements', args)
  );

  server.tool(
    'get_volition',
    'Get entanglement details. By default returns minimal info (counts only). Use detailed=true for full nested data.',
    {
      id: { type: 'string', description: 'Entanglement ID' },
      include_children_qupts: {
        type: 'boolean',
        description: 'Include qupts from child entanglements',
        default: true
      },
      detailed: {
        type: 'boolean',
        description: 'Return full nested data (children, matrix, attributes, qupts). Default: false (returns counts only)',
        default: false
      }
    },
    (args) => handleToolCall('get_volition', args)
  );

  server.tool(
    'get_child_entanglements',
    'Get child entanglements of a parent entanglement',
    {
      parent_id: { type: 'string', description: 'Parent entanglement ID' },
      recursive: {
        type: 'boolean',
        description: 'Include all descendants, not just direct children',
        default: false
      }
    },
    (args) => handleToolCall('get_child_entanglements', args)
  );

  server.tool(
    'create_entanglement',
    'Create a new entanglement/initiative, optionally as a child of another entanglement with initial team assignments',
    {
      name: { type: 'string', description: 'Name of the entanglement' },
      description: { type: 'string', description: 'Description of the entanglement' },
      parent_id: { type: 'string', description: 'Parent entanglement ID for nesting' },
      initial_zoku: {
        type: 'array',
        description: 'Initial PASCI role assignments (e.g., [{ zoku_id: "ent-1", role: "accountable" }])',
        items: {
          type: 'object',
          properties: {
            zoku_id: { type: 'string' },
            role: { type: 'string', enum: ['perform', 'accountable', 'control', 'support', 'informed'] }
          },
          required: ['zoku_id', 'role']
        }
      }
    },
    (args) => handleToolCall('create_entanglement', args)
  );

  server.tool(
    'update_entanglement',
    "Update an entanglement's name, description, or parent",
    {
      id: { type: 'string' },
      name: { type: 'string' },
      description: { type: 'string' },
      parent_id: { type: 'string', description: 'Move to new parent (null to make root)' }
    },
    (args) => handleToolCall('update_entanglement', args)
  );

  server.tool(
    'move_entanglement',
    'Move an entanglement to become a child of another entanglement, or make it a root entanglement',
    {
      id: { type: 'string', description: 'Entanglement ID to move' },
      new_parent_id: {
        type: 'string',
        description: 'New parent entanglement ID, or null to make root-level'
      }
    },
    (args) => handleToolCall('move_entanglement', args)
  );

  server.tool(
    'delete_entanglement',
    'Delete an entanglement. WARNING: Also deletes all child entanglements, qupts, sources, and assignments.',
    {
      id: { type: 'string', description: 'Entanglement ID to delete' },
      confirm: {
        type: 'boolean',
        description: 'Must be true to confirm deletion',
        default: false
      }
    },
    (args) => handleToolCall('delete_entanglement', args)
  );

  server.tool(
    'create_qupt',
    'Record activity or update on an entanglement',
    {
      entanglement_id: { type: 'string', description: 'ID of the entanglement' },
      content: { type: 'string', description: 'Activity description' },
      zoku_id: { type: 'string', description: 'ID of the zoku creating this qupt' },
      metadata: { type: 'object', description: 'Additional structured data' }
    },
    (args) => handleToolCall('create_qupt', args)
  );

  server.tool(
    'list_qupts',
    'List activity for an entanglement. By default omits metadata for brevity. Use detailed=true for full metadata.',
    {
      entanglement_id: { type: 'string' },
      recursive: {
        type: 'boolean',
        description: 'Include qupts from child entanglements',
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
    (args) => handleToolCall('list_qupts', args)
  );

  server.tool(
    'list_zoku',
    'List all zoku partners (humans and AI agents)',
    {
      type: { type: 'string', enum: ['human', 'agent'] },
      limit: { type: 'number', default: 20 }
    },
    (args) => handleToolCall('list_zoku', args)
  );

  server.tool(
    'create_zoku',
    'Register a new zoku partner (human or AI agent)',
    {
      name: { type: 'string', description: 'Name of the entity' },
      type: { type: 'string', enum: ['human', 'agent'] },
      metadata: { type: 'object', description: 'Additional metadata' }
    },
    (args) => handleToolCall('create_zoku', args)
  );

  server.tool(
    'get_entangled',
    'Get details of a zoku partner including their entanglements and roles',
    {
      id: { type: 'string' }
    },
    (args) => handleToolCall('get_entangled', args)
  );

  server.tool(
    'entangle',
    'Assign a zoku partner to a PASCI role on an entanglement',
    {
      entanglement_id: { type: 'string' },
      zoku_id: { type: 'string' },
      role: {
        type: 'string',
        enum: ['perform', 'accountable', 'control', 'support', 'informed'],
        description: 'PASCI role: Perform (does work), Accountable (answerable), Control (veto power), Support (advisory), Informed (notified)'
      }
    },
    (args) => handleToolCall('entangle', args)
  );

  server.tool(
    'disentangle',
    'Remove a zoku partner from a PASCI role on an entanglement',
    {
      entanglement_id: { type: 'string' },
      zoku_id: { type: 'string' },
      role: {
        type: 'string',
        enum: ['perform', 'accountable', 'control', 'support', 'informed']
      }
    },
    (args) => handleToolCall('disentangle', args)
  );

  server.tool(
    'get_matrix',
    'Get the PASCI responsibility matrix showing who is assigned to each role',
    {
      entanglement_id: { type: 'string' }
    },
    (args) => handleToolCall('get_matrix', args)
  );

  server.tool(
    'list_dimensions',
    'List all taxonomy dimensions and their available values',
    {},
    (args) => handleToolCall('list_dimensions', args)
  );

  server.tool(
    'set_attributes',
    'Set taxonomy attributes on an entanglement (function, pillar, service area, etc.)',
    {
      entanglement_id: { type: 'string' },
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
    (args) => handleToolCall('set_attributes', args)
  );

  server.tool(
    'get_attributes',
    'Get taxonomy attributes assigned to an entanglement',
    {
      entanglement_id: { type: 'string' }
    },
    (args) => handleToolCall('get_attributes', args)
  );

  server.tool(
    'list_sources',
    'List activity sources configured for an entanglement',
    {
      entanglement_id: { type: 'string' }
    },
    (args) => handleToolCall('list_sources', args)
  );

  server.tool(
    'add_source',
    'Add an activity source to an entanglement. Can use stored jewels (via jewel_id) or provide inline credentials.',
    {
      entanglement_id: { type: 'string' },
      type: { type: 'string', enum: ['github', 'gmail', 'zammad', 'gdrive', 'gdocs', 'webhook'] },
      config: { type: 'object', description: 'Source-specific configuration (e.g., owner, repo for GitHub)' },
      credentials: { type: 'object', description: 'Inline authentication credentials (will be validated and encrypted). Omit if using jewel_id.' },
      jewel_id: { type: 'string', description: 'ID of stored jewel to use. Omit if providing inline credentials.' }
    },
    (args) => handleToolCall('add_source', args)
  );

  server.tool(
    'sync_source',
    'Manually trigger a sync for a source',
    {
      source_id: { type: 'string' }
    },
    (args) => handleToolCall('sync_source', args)
  );

  server.tool(
    'remove_source',
    'Remove an activity source from an entanglement',
    {
      source_id: { type: 'string' }
    },
    (args) => handleToolCall('remove_source', args)
  );

  server.tool(
    'toggle_source',
    'Enable or disable a source',
    {
      source_id: { type: 'string' },
      enabled: { type: 'boolean' }
    },
    (args) => handleToolCall('toggle_source', args)
  );

  server.tool(
    'add_jewel',
    'Store and validate jewels that can be reused across multiple sources',
    {
      name: { type: 'string', description: 'User-friendly name (e.g., "GitHub - Personal")' },
      type: { type: 'string', enum: ['github', 'gmail', 'zammad', 'gdrive', 'gdocs'] },
      data: { type: 'object', description: 'Authentication credentials (will be validated and encrypted)' }
    },
    (args) => handleToolCall('add_jewel', args)
  );

  server.tool(
    'list_jewels',
    'List stored jewels (without exposing sensitive data)',
    {
      type: { type: 'string', enum: ['github', 'gmail', 'zammad', 'gdrive', 'gdocs'], description: 'Filter by jewel type' },
      limit: { type: 'number', default: 20 }
    },
    (args) => handleToolCall('list_jewels', args)
  );

  server.tool(
    'get_credential',
    'Get jewel details (without exposing sensitive data)',
    {
      id: { type: 'string' }
    },
    (args) => handleToolCall('get_credential', args)
  );

  server.tool(
    'update_jewel',
    'Update jewel name or data (will re-validate if data is updated)',
    {
      id: { type: 'string' },
      name: { type: 'string', description: 'New name for the jewel' },
      data: { type: 'object', description: 'New authentication credentials (will be validated)' }
    },
    (args) => handleToolCall('update_jewel', args)
  );

  server.tool(
    'delete_jewel',
    'Delete a stored jewel (fails if used by any sources)',
    {
      id: { type: 'string' }
    },
    (args) => handleToolCall('delete_jewel', args)
  );

  server.tool(
    'get_jewel_usage',
    'See which sources are using a jewel',
    {
      id: { type: 'string' }
    },
    (args) => handleToolCall('get_jewel_usage', args)
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
    // Create fresh transport and server for this request
    const transport = new StreamableHTTPTransport();
    const server = createMcpServer(db, encryptionKey, logger);

    // Connect server to transport
    await server.connect(transport);

    // Handle the request
    const response = await transport.handleRequest(c);

    logger.info('MCP request completed', logger.withDuration());

    return response;
  } catch (error) {
    logger.error('MCP request failed', error as Error, logger.withDuration());
    return c.json({
      jsonrpc: '2.0',
      id: null,
      error: {
        code: -32603,
        message: error instanceof Error ? error.message : String(error)
      }
    }, 500);
  }
}
