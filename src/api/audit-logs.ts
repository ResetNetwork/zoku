// Audit Log API - Prime only
import { Hono } from 'hono';
import { requireTier } from '../middleware/auth';
import { DB } from '../db';
import type { Bindings } from '../types';

const app = new Hono<{ Bindings: Bindings }>();

// List audit logs (Prime only)
app.get('/', requireTier('prime'), async (c) => {
  const db = new DB(c.env.DB);
  const limit = Number(c.req.query('limit')) || 100;
  
  const logs = await db.getAuditLogs({ limit });
  
  return c.json({ logs });
});

export default app;
