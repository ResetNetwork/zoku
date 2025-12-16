import { Hono } from 'hono';
import type { HonoEnv, Bindings } from '../types';
import { DB } from '../db';

const app = new Hono<HonoEnv>();

// List all dimensions with their values
app.get('/', async (c) => {
  const db = new DB(c.env.DB);

  const dimensions = await db.listDimensions();
  const allValues = await db.getAllDimensionValues();

  const result = dimensions.map(dim => ({
    ...dim,
    values: allValues.filter(v => v.dimension_id === dim.id)
  }));

  return c.json({ dimensions: result });
});

// Get single dimension with values
app.get('/:id', async (c) => {
  const db = new DB(c.env.DB);
  const id = c.req.param('id');

  const dimension = await db.getDimension(id);
  if (!dimension) {
    return c.json({ error: { code: 'NOT_FOUND', message: 'Dimension not found' } }, 404);
  }

  const values = await db.getDimensionValues(id);

  return c.json({ ...dimension, values });
});

export default app;
