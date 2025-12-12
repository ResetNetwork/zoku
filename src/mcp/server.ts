// MCP Server implementation using official SDK
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StreamableHTTPTransport } from '@hono/mcp';
import { z } from 'zod';
import { zodToJsonSchema } from 'zod-to-json-schema';
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

// Helper to convert Zod schema to MCP SDK format
function zodToMcpSchema(zodSchema: z.ZodTypeAny): any {
  const jsonSchema = zodToJsonSchema(zodSchema, { target: 'openApi3', $refStrategy: 'none' });
  // The MCP SDK expects just the properties object, not the full JSON Schema
  if (jsonSchema && typeof jsonSchema === 'object' && 'properties' in jsonSchema) {
    return jsonSchema.properties;
  }
  // For empty objects or non-object schemas
  return {};
}

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
            status: input.status,
            function: input.function,
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

        case 'get_entanglement': {
          const input = schemas.get_entanglement.parse(args);
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

          // Validate source configuration if jewels are provided
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
          } else if (input.jewels) {
            // Validate inline jewels
            const { validateGitHubSource, validateZammadSource, validateGoogleDocsSource } = await import('../handlers/validate');

            let validationResult;
            switch (input.type) {
              case 'github':
                validationResult = await validateGitHubSource(input.config, input.jewels);
                break;
              case 'zammad':
                validationResult = await validateZammadSource(input.config, input.jewels);
                break;
              case 'gdocs':
              case 'gdrive':
                validationResult = await validateGoogleDocsSource(input.config, input.jewels);
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
            credentials: input.jewels,  // Store as credentials in DB for backward compat
            jewel_id: input.jewel_id
          });

          // Set initial sync window to last 30 days (mandatory)
          const thirtyDaysAgo = Math.floor(Date.now() / 1000) - (30 * 24 * 60 * 60);
          await db.updateSource(source.id, { last_sync: thirtyDaysAgo });
          toolLogger.info(`Set initial sync window to last 30 days for source ${source.id}`);

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
              // For Google, just validate OAuth credentials work (no document needed)
              validationResult = await validateGoogleDocsSource({}, input.data);
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

        case 'get_jewel': {
          const input = schemas.get_jewel.parse(args);
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
                validationResult = await validateGoogleDocsSource({}, input.data);
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
  // NOTE: Tool schemas are now auto-generated from Zod schemas using zodToJsonSchema.
  // This eliminates the previous duplication between Zod schemas (for validation) and
  // SDK schemas (for documentation). All field descriptions are now defined once in the
  // Zod schemas using .describe().
  //
  // When adding/modifying tools, only update the Zod schema in the `schemas` object.
  server.tool(
    'list_entanglements',
    'List entanglements in the Zoku system',
    zodToMcpSchema(schemas.list_entanglements),
    (args) => handleToolCall('list_entanglements', args)
  );

  server.tool(
    'get_entanglement',
    'Get entanglement details. By default returns minimal info (counts only). Use detailed=true for full nested data.',
    zodToMcpSchema(schemas.get_entanglement),
    (args) => handleToolCall('get_entanglement', args)
  );

  server.tool(
    'get_child_entanglements',
    'Get child entanglements of a parent entanglement',
    zodToMcpSchema(schemas.get_child_entanglements),
    (args) => handleToolCall('get_child_entanglements', args)
  );

  server.tool(
    'create_entanglement',
    'Create a new entanglement/initiative, optionally as a child of another entanglement with initial team assignments',
    zodToMcpSchema(schemas.create_entanglement),
    (args) => handleToolCall('create_entanglement', args)
  );

  server.tool(
    'update_entanglement',
    "Update an entanglement's name, description, or parent",
    zodToMcpSchema(schemas.update_entanglement),
    (args) => handleToolCall('update_entanglement', args)
  );

  server.tool(
    'move_entanglement',
    'Move an entanglement to become a child of another entanglement, or make it a root entanglement',
    zodToMcpSchema(schemas.move_entanglement),
    (args) => handleToolCall('move_entanglement', args)
  );

  server.tool(
    'delete_entanglement',
    'Delete an entanglement. WARNING: Also deletes all child entanglements, qupts, sources, and assignments.',
    zodToMcpSchema(schemas.delete_entanglement),
    (args) => handleToolCall('delete_entanglement', args)
  );

  server.tool(
    'create_qupt',
    'Record activity or update on an entanglement',
    zodToMcpSchema(schemas.create_qupt),
    (args) => handleToolCall('create_qupt', args)
  );

  server.tool(
    'list_qupts',
    'List activity for an entanglement. By default omits metadata for brevity. Use detailed=true for full metadata.',
    zodToMcpSchema(schemas.list_qupts),
    (args) => handleToolCall('list_qupts', args)
  );

  server.tool(
    'list_zoku',
    'List all zoku partners (humans and AI agents)',
    zodToMcpSchema(schemas.list_zoku),
    (args) => handleToolCall('list_zoku', args)
  );

  server.tool(
    'create_zoku',
    'Register a new zoku partner (human or AI agent)',
    zodToMcpSchema(schemas.create_zoku),
    (args) => handleToolCall('create_zoku', args)
  );

  server.tool(
    'get_entangled',
    'Get details of a zoku partner including their entanglements and roles',
    zodToMcpSchema(schemas.get_entangled),
    (args) => handleToolCall('get_entangled', args)
  );

  server.tool(
    'entangle',
    'Assign a zoku partner to a PASCI role on an entanglement',
    zodToMcpSchema(schemas.entangle),
    (args) => handleToolCall('entangle', args)
  );

  server.tool(
    'disentangle',
    'Remove a zoku partner from a PASCI role on an entanglement',
    zodToMcpSchema(schemas.disentangle),
    (args) => handleToolCall('disentangle', args)
  );

  server.tool(
    'get_matrix',
    'Get the PASCI responsibility matrix showing who is assigned to each role',
    zodToMcpSchema(schemas.get_matrix),
    (args) => handleToolCall('get_matrix', args)
  );

  server.tool(
    'list_dimensions',
    'List all taxonomy dimensions and their available values',
    zodToMcpSchema(schemas.list_dimensions),
    (args) => handleToolCall('list_dimensions', args)
  );

  server.tool(
    'set_attributes',
    'Set taxonomy attributes on an entanglement (function, pillar, service area, etc.)',
    zodToMcpSchema(schemas.set_attributes),
    (args) => handleToolCall('set_attributes', args)
  );

  server.tool(
    'get_attributes',
    'Get taxonomy attributes assigned to an entanglement',
    zodToMcpSchema(schemas.get_attributes),
    (args) => handleToolCall('get_attributes', args)
  );

  server.tool(
    'list_sources',
    'List activity sources configured for an entanglement',
    zodToMcpSchema(schemas.list_sources),
    (args) => handleToolCall('list_sources', args)
  );

  server.tool(
    'add_source',
    'Add an activity source to an entanglement. Can use stored jewels (via jewel_id) or provide inline jewels.',
    zodToMcpSchema(schemas.add_source),
    (args) => handleToolCall('add_source', args)
  );

  server.tool(
    'sync_source',
    'Manually trigger a sync for a source',
    zodToMcpSchema(schemas.sync_source),
    (args) => handleToolCall('sync_source', args)
  );

  server.tool(
    'remove_source',
    'Remove an activity source from an entanglement',
    zodToMcpSchema(schemas.remove_source),
    (args) => handleToolCall('remove_source', args)
  );

  server.tool(
    'toggle_source',
    'Enable or disable a source',
    zodToMcpSchema(schemas.toggle_source),
    (args) => handleToolCall('toggle_source', args)
  );

  server.tool(
    'add_jewel',
    'Store and validate jewels that can be reused across multiple sources',
    zodToMcpSchema(schemas.add_jewel),
    (args) => handleToolCall('add_jewel', args)
  );

  server.tool(
    'list_jewels',
    'List stored jewels (without exposing sensitive data)',
    zodToMcpSchema(schemas.list_jewels),
    (args) => handleToolCall('list_jewels', args)
  );

  server.tool(
    'get_jewel',
    'Get jewel details (without exposing sensitive data)',
    zodToMcpSchema(schemas.get_jewel),
    (args) => handleToolCall('get_jewel', args)
  );

  server.tool(
    'update_jewel',
    'Update jewel name or data (will re-validate if data is updated)',
    zodToMcpSchema(schemas.update_jewel),
    (args) => handleToolCall('update_jewel', args)
  );

  server.tool(
    'delete_jewel',
    'Delete a stored jewel (fails if used by any sources)',
    zodToMcpSchema(schemas.delete_jewel),
    (args) => handleToolCall('delete_jewel', args)
  );

  server.tool(
    'get_jewel_usage',
    'See which sources are using a jewel',
    zodToMcpSchema(schemas.get_jewel_usage),
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
