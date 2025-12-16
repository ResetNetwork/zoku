import { Hono } from 'hono';
import type { HonoEnv, Bindings, Zoku } from '../types';
import { DB } from '../db';
import { Logger } from '../lib/logger';
import { EntanglementService } from '../services/entanglements';
import { SourceService } from '../services/sources';

const app = new Hono<HonoEnv>();

// Helper to create service
const getService = (c: any) => {
  const db = new DB(c.env.DB);
  const user = c.get('user') as Zoku;
  const logger = c.get('logger') as Logger;
  const requestId = c.get('request_id') as string;
  return new EntanglementService(db, user, logger, requestId);
};

const getSourceService = (c: any) => {
  const db = new DB(c.env.DB);
  const user = c.get('user') as Zoku;
  const logger = c.get('logger') as Logger;
  const requestId = c.get('request_id') as string;
  return new SourceService(db, user, logger, requestId, c.env);
};

// List entanglements
app.get('/', async (c) => {
  const service = getService(c);
  const result = await service.list({
    root_only: c.req.query('root_only') === 'true',
    parent_id: c.req.query('parent_id'),
    limit: c.req.query('limit') ? parseInt(c.req.query('limit')!) : 20,
    offset: c.req.query('offset') ? parseInt(c.req.query('offset')!) : 0
  });
  return c.json(result);
});

// Get entanglement details
app.get('/:id', async (c) => {
  const service = getService(c);
  const result = await service.get(
    c.req.param('id'),
    c.req.query('include_children_qupts') !== 'false',
    c.req.query('qupts_limit') ? parseInt(c.req.query('qupts_limit')!) : 20
  );
  return c.json(result);
});

// Create entanglement
app.post('/', async (c) => {
  const service = getService(c);
  const body = await c.req.json();
  const entanglement = await service.create(body);
  return c.json(entanglement, 201);
});

// Update entanglement
app.patch('/:id', async (c) => {
  const service = getService(c);
  const body = await c.req.json();
  const entanglement = await service.update(c.req.param('id'), body);
  return c.json(entanglement);
});

// Delete entanglement
app.delete('/:id', async (c) => {
  const service = getService(c);
  const confirm = c.req.query('confirm') === 'true';
  await service.delete(c.req.param('id'), confirm);
  return c.json({ success: true });
});

// Get PASCI matrix
app.get('/:id/matrix', async (c) => {
  const service = getService(c);
  const matrix = await service.getMatrix(c.req.param('id'));
  return c.json({ entanglement_id: c.req.param('id'), matrix });
});

// Assign to matrix
app.post('/:id/matrix', async (c) => {
  const service = getService(c);
  const body = await c.req.json();
  await service.assignToMatrix(c.req.param('id'), body);
  return c.json({ success: true });
});

// Remove from matrix
app.delete('/:id/matrix/:zoku_id/:role', async (c) => {
  const service = getService(c);
  await service.removeFromMatrix(
    c.req.param('id'),
    c.req.param('zoku_id'),
    c.req.param('role')
  );
  return c.json({ success: true });
});

// Get attributes
app.get('/:id/attributes', async (c) => {
  const service = getService(c);
  const result = await service.getAttributes(c.req.param('id'));
  return c.json(result);
});

// List sources
app.get('/:id/sources', async (c) => {
  const service = getService(c);
  const sources = await service.listSources(c.req.param('id'));
  
  // Enrich with jewel info
  const db = new DB(c.env.DB);
  const enriched = await Promise.all(sources.map(async (s: any) => {
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
      ...s,
      jewels: undefined,
      credential: credentialInfo
    };
  }));
  
  return c.json({ sources: enriched });
});

// Add source
app.post('/:id/sources', async (c) => {
  const sourceService = getSourceService(c);
  const body = await c.req.json();
  const source = await sourceService.create(c.req.param('id'), body);
  return c.json(source, 201);
});

export default app;
