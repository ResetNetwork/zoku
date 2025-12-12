import { Hono } from 'hono';
import type { Bindings } from '../types';
import { DB } from '../db';

const app = new Hono<{ Bindings: Bindings }>();

// List entanglements
app.get('/', async (c) => {
  const db = new DB(c.env.DB);

  const rootOnly = c.req.query('root_only') === 'true';
  const parentId = c.req.query('parent_id');
  const limit = c.req.query('limit') ? parseInt(c.req.query('limit')!) : 20;
  const offset = c.req.query('offset') ? parseInt(c.req.query('offset')!) : 0;

  const entanglements = await db.listEntanglements({
    root_only: rootOnly,
    parent_id: parentId,
    limit,
    offset
  });

  // Fetch all attributes in batch (single query)
  const attributesMap = await db.getEntanglementsAttributes(entanglements.map(v => v.id));

  // Enrich with counts and attributes
  const enrichedEntanglements = await Promise.all(
    entanglements.map(async (v) => ({
      ...v,
      children_count: await db.getEntanglementChildrenCount(v.id),
      qupts_count: await db.getEntanglementQuptsCount(v.id, true),
      sources_count: await db.getEntanglementSourcesCount(v.id),
      zoku_count: await db.getEntanglementZokuCount(v.id),
      attributes: attributesMap.get(v.id) || null
    }))
  );

  return c.json({entanglements: enrichedEntanglements });
});

// Get entanglement details
app.get('/:id', async (c) => {
  const db = new DB(c.env.DB);
  const id = c.req.param('id');

  const entanglement = await db.getEntanglement(id);
  if (!entanglement) {
    return c.json({ error: { code: 'NOT_FOUND', message: 'Entanglement not found' } }, 404);
  }

  // Get children
  const children = await db.getEntanglementChildren(id);

  // Get matrix
  const matrix = await db.getMatrix(id);

  // Get attributes
  const attributes = await db.getEntanglementAttributes(id);
  const dimensions = await db.listDimensions();
  const dimensionValues = await db.getAllDimensionValues();

  // Build attributes response
  const attributesMap: Record<string, any> = {};
  for (const attr of attributes) {
    const dimension = dimensions.find(d => d.id === attr.dimension_id);
    const value = dimensionValues.find(v => v.id === attr.value_id);
    if (dimension && value) {
      if (!attributesMap[dimension.name]) {
        attributesMap[dimension.name] = {
          dimension_id: dimension.id,
          label: dimension.label,
          values: []
        };
      }
      attributesMap[dimension.name].values.push({
        id: value.id,
        value: value.value,
        label: value.label
      });
    }
  }

  // Get qupts (aggregated from descendants by default)
  const includeChildren = c.req.query('include_children_qupts') !== 'false';
  const quptsLimit = c.req.query('qupts_limit') ? parseInt(c.req.query('qupts_limit')!) : 20;

  const qupts = await db.listQupts({
    entanglement_id: id,
    recursive: includeChildren,
    limit: quptsLimit
  });

  // Get counts
  const children_count = await db.getEntanglementChildrenCount(id);
  const qupts_count = await db.getEntanglementQuptsCount(id, true);
  const sources_count = await db.getEntanglementSourcesCount(id);
  const zoku_count = await db.getEntanglementZokuCount(id);

  return c.json({
    ...entanglement,
    attributes: attributesMap,
    matrix,
    children: children.map(child => ({
      id: child.id,
      name: child.name,
      created_at: child.created_at
    })),
    qupts,
    children_count,
    qupts_count,
    sources_count,
    zoku_count
  });
});

// Create entanglement
app.post('/', async (c) => {
  const db = new DB(c.env.DB);
  const body = await c.req.json();

  if (!body.name) {
    return c.json({ error: { code: 'VALIDATION_ERROR', message: 'Name is required' } }, 400);
  }

  // Validate parent exists if provided
  if (body.parent_id) {
    const parent = await db.getEntanglement(body.parent_id);
    if (!parent) {
      return c.json({ error: { code: 'PARENT_NOT_FOUND', message: 'Parent entanglement not found' } }, 404);
    }
  }

  const entanglement = await db.createEntanglement({
    name: body.name,
    description: body.description,
    parent_id: body.parent_id
  });

  // Add initial zoku assignments if provided
  if (body.initial_zoku && Array.isArray(body.initial_zoku)) {
    for (const assignment of body.initial_zoku) {
      if (assignment.zoku_id && assignment.role) {
        try {
          await db.assignToMatrix(entanglement.id, assignment.zoku_id, assignment.role);
        } catch (error) {
          console.warn(`Failed to assign ${assignment.zoku_id} to ${assignment.role}:`, error);
        }
      }
    }
  }

  return c.json(entanglement, 201);
});

// Update entanglement
app.patch('/:id', async (c) => {
  const db = new DB(c.env.DB);
  const id = c.req.param('id');
  const body = await c.req.json();

  const entanglement = await db.getEntanglement(id);
  if (!entanglement) {
    return c.json({ error: { code: 'NOT_FOUND', message: 'Entanglement not found' } }, 404);
  }

  // Validate parent if being changed
  if (body.parent_id !== undefined && body.parent_id !== null) {
    // Check parent exists
    const parent = await db.getEntanglement(body.parent_id);
    if (!parent) {
      return c.json({ error: { code: 'PARENT_NOT_FOUND', message: 'Parent entanglement not found' } }, 404);
    }

    // Check for circular reference
    const descendants = await db.getEntanglementDescendants(id);
    if (descendants.some(d => d.id === body.parent_id)) {
      return c.json({ error: { code: 'CIRCULAR_REFERENCE', message: 'Cannot set parent: would create circular reference' } }, 400);
    }
  }

  await db.updateEntanglement(id, {
    name: body.name,
    description: body.description,
    parent_id: body.parent_id
  });

  return c.json({ success: true });
});

// Delete entanglement
app.delete('/:id', async (c) => {
  const db = new DB(c.env.DB);
  const id = c.req.param('id');

  const entanglement = await db.getEntanglement(id);
  if (!entanglement) {
    return c.json({ error: { code: 'NOT_FOUND', message: 'Entanglement not found' } }, 404);
  }

  await db.deleteEntanglement(id);
  return c.json({ success: true });
});

// Get PASCI matrix
app.get('/:id/matrix', async (c) => {
  const db = new DB(c.env.DB);
  const id = c.req.param('id');

  const entanglement = await db.getEntanglement(id);
  if (!entanglement) {
    return c.json({ error: { code: 'NOT_FOUND', message: 'Entanglement not found' } }, 404);
  }

  const matrix = await db.getMatrix(id);
  return c.json({ entanglement_id: id, matrix });
});

// Assign to matrix
app.post('/:id/matrix', async (c) => {
  const db = new DB(c.env.DB);
  const entanglementId = c.req.param('id');
  const body = await c.req.json();

  if (!body.zoku_id || !body.role) {
    return c.json({ error: { code: 'VALIDATION_ERROR', message: 'zoku_id and role are required' } }, 400);
  }

  const validRoles = ['perform', 'accountable', 'control', 'support', 'informed'];
  if (!validRoles.includes(body.role)) {
    return c.json({ error: { code: 'VALIDATION_ERROR', message: 'Invalid role' } }, 400);
  }

  // Verify entanglement exists
  const entanglement = await db.getEntanglement(entanglementId);
  if (!entanglement) {
    return c.json({ error: { code: 'NOT_FOUND', message: 'Entanglement not found' } }, 404);
  }

  // Verify zoku exists
  const zoku = await db.getZoku(body.zoku_id);
  if (!zoku) {
    return c.json({ error: { code: 'NOT_FOUND', message: 'Zoku not found' } }, 404);
  }

  // Validate accountable constraint
  if (body.role === 'accountable') {
    const matrix = await db.getMatrix(entanglementId);
    if (matrix.accountable.length > 0 && !matrix.accountable.some(e => e.id === body.zoku_id)) {
      // Warn but allow (not enforced, just a warning)
      console.warn(`Multiple accountable entities on entanglement ${entanglementId}`);
    }
  }

  await db.assignToMatrix(entanglementId, body.zoku_id, body.role);
  return c.json({ success: true });
});

// Remove from matrix
app.delete('/:id/matrix/:zoku_id/:role', async (c) => {
  const db = new DB(c.env.DB);
  const entanglementId = c.req.param('id');
  const zokuId = c.req.param('zoku_id');
  const role = c.req.param('role');

  // Check if removing last accountable
  if (role === 'accountable') {
    const matrix = await db.getMatrix(entanglementId);
    if (matrix.accountable.length === 1 && matrix.accountable[0].id === zokuId) {
      return c.json({
        error: {
          code: 'MATRIX_NO_ACCOUNTABLE',
          message: 'Cannot remove last Accountable. Entanglement must have exactly one Accountable.'
        }
      }, 400);
    }
  }

  await db.removeFromMatrix(entanglementId, zokuId, role);
  return c.json({ success: true });
});

// Get attributes
app.get('/:id/attributes', async (c) => {
  const db = new DB(c.env.DB);
  const id = c.req.param('id');

  const entanglement = await db.getEntanglement(id);
  if (!entanglement) {
    return c.json({ error: { code: 'NOT_FOUND', message: 'Entanglement not found' } }, 404);
  }

  const attributes = await db.getEntanglementAttributes(id);
  const dimensions = await db.listDimensions();
  const dimensionValues = await db.getAllDimensionValues();

  const attributesMap: Record<string, any> = {};
  for (const attr of attributes) {
    const dimension = dimensions.find(d => d.id === attr.dimension_id);
    const value = dimensionValues.find(v => v.id === attr.value_id);
    if (dimension && value) {
      if (!attributesMap[dimension.name]) {
        attributesMap[dimension.name] = {
          dimension_id: dimension.id,
          label: dimension.label,
          values: []
        };
      }
      attributesMap[dimension.name].values.push({
        id: value.id,
        value: value.value,
        label: value.label
      });
    }
  }

  return c.json({ entanglement_id: id, attributes: attributesMap });
});

// Set attributes (replace all)
app.put('/:id/attributes', async (c) => {
  const db = new DB(c.env.DB);
  const id = c.req.param('id');
  const body = await c.req.json();

  if (!body.attributes || !Array.isArray(body.attributes)) {
    return c.json({ error: { code: 'VALIDATION_ERROR', message: 'attributes array is required' } }, 400);
  }

  const entanglement = await db.getEntanglement(id);
  if (!entanglement) {
    return c.json({ error: { code: 'NOT_FOUND', message: 'Entanglement not found' } }, 404);
  }

  // Convert dimension names to IDs
  const dimensions = await db.listDimensions();
  const dimensionValues = await db.getAllDimensionValues();

  const attributesToSet: Array<{ dimension_id: string; value_id: string }> = [];

  for (const attr of body.attributes) {
    const dimension = dimensions.find(d => d.name === attr.dimension);
    if (!dimension) {
      return c.json({ error: { code: 'VALIDATION_ERROR', message: `Unknown dimension: ${attr.dimension}` } }, 400);
    }

    const value = dimensionValues.find(v => v.dimension_id === dimension.id && v.value === attr.value);
    if (!value) {
      return c.json({ error: { code: 'VALIDATION_ERROR', message: `Unknown value: ${attr.value} for dimension ${attr.dimension}` } }, 400);
    }

    attributesToSet.push({ dimension_id: dimension.id, value_id: value.id });
  }

  await db.setEntanglementAttributes(id, attributesToSet);
  return c.json({ success: true });
});

// Add single attribute
app.post('/:id/attributes', async (c) => {
  const db = new DB(c.env.DB);
  const id = c.req.param('id');
  const body = await c.req.json();

  if (!body.dimension || !body.value) {
    return c.json({ error: { code: 'VALIDATION_ERROR', message: 'dimension and value are required' } }, 400);
  }

  const entanglement = await db.getEntanglement(id);
  if (!entanglement) {
    return c.json({ error: { code: 'NOT_FOUND', message: 'Entanglement not found' } }, 404);
  }

  const dimensions = await db.listDimensions();
  const dimensionValues = await db.getAllDimensionValues();

  const dimension = dimensions.find(d => d.name === body.dimension);
  if (!dimension) {
    return c.json({ error: { code: 'VALIDATION_ERROR', message: `Unknown dimension: ${body.dimension}` } }, 400);
  }

  const value = dimensionValues.find(v => v.dimension_id === dimension.id && v.value === body.value);
  if (!value) {
    return c.json({ error: { code: 'VALIDATION_ERROR', message: `Unknown value: ${body.value} for dimension ${body.dimension}` } }, 400);
  }

  await db.addEntanglementAttribute(id, dimension.id, value.id);
  return c.json({ success: true });
});

// Remove attributes for dimension
app.delete('/:id/attributes/:dimension_id', async (c) => {
  const db = new DB(c.env.DB);
  const entanglementId = c.req.param('id');
  const dimensionId = c.req.param('dimension_id');

  await db.removeEntanglementAttributes(entanglementId, dimensionId);
  return c.json({ success: true });
});

// List sources for entanglement
app.get('/:id/sources', async (c) => {
  const db = new DB(c.env.DB);
  const id = c.req.param('id');

  const entanglement = await db.getEntanglement(id);
  if (!entanglement) {
    return c.json({ error: { code: 'NOT_FOUND', message: 'Entanglement not found' } }, 404);
  }

  const sources = await db.listSources(id);

  // Enrich with jewel info (without exposing encrypted data)
  const enriched = await Promise.all(sources.map(async (s) => {
    let credentialInfo = null;

    if (s.jewel_id) {
      const jewel = await db.getJewel(s.jewel_id);
      if (jewel) {
        const validationMetadata = jewel.validation_metadata
          ? JSON.parse(jewel.validation_metadata)
          : {};

        credentialInfo = {
          id: jewel.id,
          name: jewel.name,
          email: validationMetadata.email || validationMetadata.authenticated_as || null
        };
      }
    }

    return {
      id: s.id,
      entanglement_id: s.entanglement_id,
      type: s.type,
      config: s.config,
      enabled: s.enabled,
      last_sync: s.last_sync,
      sync_cursor: s.sync_cursor,
      last_error: s.last_error,
      error_count: s.error_count,
      last_error_at: s.last_error_at,
      created_at: s.created_at,
      credential: credentialInfo
    };
  }));

  return c.json({ sources: enriched });
});

// Add source to entanglement
app.post('/:id/sources', async (c) => {
  const db = new DB(c.env.DB);
  const entanglementId = c.req.param('id');
  const body = await c.req.json();

  if (!body.type || !body.config) {
    return c.json({ error: { code: 'VALIDATION_ERROR', message: 'type and config are required' } }, 400);
  }

  const entanglement = await db.getEntanglement(entanglementId);
  if (!entanglement) {
    return c.json({ error: { code: 'NOT_FOUND', message: 'Entanglement not found' } }, 404);
  }

  // Validate source configuration if credentials are provided
  const warnings: string[] = [];
  let validationMetadata: Record<string, any> = {};

  // If jewel_id is provided, verify it exists, matches type, and has access to the resource
  if (body.jewel_id) {
    const jewel = await db.getJewel(body.jewel_id);
    if (!jewel) {
      return c.json({
        error: { code: 'NOT_FOUND', message: 'Jewel not found' }
      }, 404);
    }
    if (jewel.type !== body.type) {
      return c.json({
        error: {
          code: 'TYPE_MISMATCH',
          message: `Jewel type mismatch: jewel is ${jewel.type}, source is ${body.type}`
        }
      }, 400);
    }

    // Validate source access with the jewel
    const { decryptJewel } = await import('../lib/crypto');
    const decryptedCreds = JSON.parse(await decryptJewel(jewel.data, c.env.ENCRYPTION_KEY));

    // Validate access to the specific resource
    const { validateGitHubSource, validateZammadSource, validateGoogleDocsSource } = await import('../handlers/validate');

    console.log(`🔍 Validating ${body.type} source access for document_id:`, body.config.document_id);

    let accessValidation;
    try {
      switch (body.type) {
        case 'github':
          accessValidation = await validateGitHubSource(body.config, decryptedCreds);
          break;
        case 'zammad':
          accessValidation = await validateZammadSource(body.config, decryptedCreds);
          break;
        case 'gdrive':
          console.log('🔍 Calling validateGoogleDocsSource...');
          accessValidation = await validateGoogleDocsSource(body.config, decryptedCreds);
          console.log('✅ Validation result:', {
            valid: accessValidation.valid,
            errors: accessValidation.errors,
            warnings: accessValidation.warnings,
            metadata: accessValidation.metadata
          });
          break;
      }

      if (accessValidation && !accessValidation.valid) {
        console.log('❌ Validation failed, blocking source creation');

        // Get account info from validation metadata
        let accountInfo = '';
        if (jewel.validation_metadata) {
          const metadata = JSON.parse(jewel.validation_metadata);
          accountInfo = metadata.authenticated_as || metadata.email || 'the jewel';
        }

        return c.json({
          error: {
            code: 'ACCESS_DENIED',
            message: `Cannot access this resource. Please ensure ${accountInfo} has permission to access it.`,
            details: accessValidation.errors
          }
        }, 403);
      }

      if (accessValidation && accessValidation.valid) {
        warnings.push(...accessValidation.warnings);
        validationMetadata = accessValidation.metadata || {};
      }
    } catch (error) {
      console.error('Source validation error:', error);
      warnings.push(`Could not validate access: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  } else if (body.credentials) {
    const { validateGitHubSource, validateZammadSource, validateGoogleDocsSource } = await import('../handlers/validate');

    let validationResult;
    switch (body.type) {
      case 'github':
        validationResult = await validateGitHubSource(body.config, body.credentials);
        break;
      case 'zammad':
        validationResult = await validateZammadSource(body.config, body.credentials);
        break;
      case 'gdrive':
        validationResult = await validateGoogleDocsSource(body.config, body.credentials);
        break;
      default:
        // Other source types don't have validation yet
        break;
    }

    if (validationResult) {
      if (!validationResult.valid) {
        return c.json({
          error: {
            code: 'VALIDATION_FAILED',
            message: 'Source validation failed',
            errors: validationResult.errors,
            warnings: validationResult.warnings
          }
        }, 400);
      }

      warnings.push(...validationResult.warnings);
      validationMetadata = validationResult.metadata || {};
    }
  }

  // If credentials provided, encrypt them
  let credentials = body.credentials;
  if (credentials && c.env.ENCRYPTION_KEY) {
    const { encryptJewel } = await import('../lib/crypto');
    credentials = await encryptJewel(JSON.stringify(credentials), c.env.ENCRYPTION_KEY);
  }

  const source = await db.createSource({
    entanglement_id: entanglementId,
    type: body.type,
    config: body.config,
    jewels: credentials ? { encrypted: credentials } : undefined,
    jewel_id: body.jewel_id
  });

  // Trigger initial sync to pull last 30 days of activity (ensures at least 20 items for active sources)
  const thirtyDaysAgo = Math.floor(Date.now() / 1000) - (30 * 24 * 60 * 60);
  try {
    await db.updateSource(source.id, { last_sync: thirtyDaysAgo });
    console.log(`Set initial sync window to last 30 days for source ${source.id}`);
  } catch (error) {
    console.warn(`Failed to set initial sync window for source ${source.id}:`, error);
  }

  // Return response with validation warnings if any
  const response: any = {
    id: source.id,
    entanglement_id: source.entanglement_id,
    type: source.type,
    config: source.config,
    enabled: source.enabled,
    created_at: source.created_at
  };

  if (warnings.length > 0) {
    response.warnings = warnings;
  }

  if (Object.keys(validationMetadata).length > 0) {
    response.validation = validationMetadata;
  }

  return c.json(response, 201);
});

export default app;
