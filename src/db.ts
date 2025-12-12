// Database query helpers

import type { D1Database } from '@cloudflare/workers-types';
import type {
  Volition,
  Entangled,
  Qupt,
  Source,
  Dimension,
  DimensionValue,
  VolitionAttribute,
  MatrixAssignment,
  QuptInput
} from './types';

export class DB {
  constructor(private d1: D1Database) {}

  // Volitions
  async getVolition(id: string): Promise<Volition | null> {
    const result = await this.d1
      .prepare('SELECT * FROM entanglements WHERE id = ?')
      .bind(id)
      .first<Volition>();
    return result || null;
  }

  async listVolitions(filters: {
    parent_id?: string;
    root_only?: boolean;
    limit?: number;
    offset?: number;
  } = {}): Promise<Entanglement[]> {
    let query = 'SELECT * FROM entanglements';
    const conditions: string[] = [];
    const params: any[] = [];

    if (filters.root_only) {
      conditions.push('parent_id IS NULL');
    } else if (filters.parent_id) {
      conditions.push('parent_id = ?');
      params.push(filters.parent_id);
    }

    if (conditions.length > 0) {
      query += ' WHERE ' + conditions.join(' AND ');
    }

    query += ' ORDER BY created_at DESC';

    if (filters.limit) {
      query += ' LIMIT ?';
      params.push(filters.limit);
    }

    if (filters.offset) {
      query += ' OFFSET ?';
      params.push(filters.offset);
    }

    const stmt = this.d1.prepare(query).bind(...params);
    const result = await stmt.all<Volition>();
    return result.results || [];
  }

  async createVolition(data: {
    name: string;
    description?: string;
    parent_id?: string;
  }): Promise<Volition> {
    const id = crypto.randomUUID();
    await this.d1
      .prepare(
        'INSERT INTO entanglements (id, name, description, parent_id) VALUES (?, ?, ?, ?)'
      )
      .bind(id, data.name, data.description || null, data.parent_id || null)
      .run();
    return (await this.getVolition(id))!;
  }

  async updateVolition(
    id: string,
    data: { name?: string; description?: string; parent_id?: string | null }
  ): Promise<void> {
    const updates: string[] = [];
    const params: any[] = [];

    if (data.name !== undefined) {
      updates.push('name = ?');
      params.push(data.name);
    }
    if (data.description !== undefined) {
      updates.push('description = ?');
      params.push(data.description);
    }
    if (data.parent_id !== undefined) {
      updates.push('parent_id = ?');
      params.push(data.parent_id);
    }

    if (updates.length > 0) {
      params.push(id);
      await this.d1
        .prepare(`UPDATE entanglements SET ${updates.join(', ')} WHERE id = ?`)
        .bind(...params)
        .run();
    }
  }

  async deleteVolition(id: string): Promise<void> {
    await this.d1.prepare('DELETE FROM entanglements WHERE id = ?').bind(id).run();
  }

  async getEntanglementChildren(parentId: string): Promise<Entanglement[]> {
    return this.listVolitions({ parent_id: parentId });
  }

  async getEntanglementDescendants(volitionId: string): Promise<Entanglement[]> {
    const query = `
      WITH RECURSIVE descendants AS (
        SELECT id FROM entanglements WHERE id = ?
        UNION ALL
        SELECT v.id FROM entanglements v
        JOIN descendants d ON v.parent_id = d.id
      )
      SELECT v.* FROM entanglements v
      JOIN descendants d ON v.id = d.id
      WHERE v.id != ?
    `;
    const result = await this.d1.prepare(query).bind(volitionId, volitionId).all<Volition>();
    return result.results || [];
  }

  async getEntanglementChildrenCount(volitionId: string): Promise<number> {
    const result = await this.d1
      .prepare('SELECT COUNT(*) as count FROM entanglements WHERE parent_id = ?')
      .bind(volitionId)
      .first<{ count: number }>();
    return result?.count || 0;
  }

  async getEntanglementQuptsCount(volitionId: string, recursive = true): Promise<number> {
    if (!recursive) {
      const result = await this.d1
        .prepare('SELECT COUNT(*) as count FROM qupts WHERE entanglement_id = ?')
        .bind(volitionId)
        .first<{ count: number }>();
      return result?.count || 0;
    }

    // Recursive count including descendants
    const query = `
      WITH RECURSIVE descendants AS (
        SELECT id FROM entanglements WHERE id = ?
        UNION ALL
        SELECT v.id FROM entanglements v
        JOIN descendants d ON v.parent_id = d.id
      )
      SELECT COUNT(*) as count FROM qupts q
      JOIN descendants d ON q.entanglement_id = d.id
    `;
    const result = await this.d1.prepare(query).bind(volitionId).first<{ count: number }>();
    return result?.count || 0;
  }

  async getEntanglementSourcesCount(volitionId: string): Promise<number> {
    const result = await this.d1
      .prepare('SELECT COUNT(*) as count FROM sources WHERE entanglement_id = ?')
      .bind(volitionId)
      .first<{ count: number }>();
    return result?.count || 0;
  }

  async getEntanglementZokuCount(volitionId: string): Promise<number> {
    const result = await this.d1
      .prepare('SELECT COUNT(DISTINCT zoku_id) as count FROM entanglement_zoku WHERE entanglement_id = ?')
      .bind(volitionId)
      .first<{ count: number }>();
    return result?.count || 0;
  }

  // Entangled
  async getEntangled(id: string): Promise<Entangled | null> {
    const result = await this.d1
      .prepare('SELECT * FROM zoku WHERE id = ?')
      .bind(id)
      .first<Entangled>();
    return result || null;
  }

  async listZoku(filters: { type?: string; limit?: number; offset?: number } = {}): Promise<Zoku[]> {
    let query = 'SELECT * FROM zoku';
    const params: any[] = [];

    if (filters.type) {
      query += ' WHERE type = ?';
      params.push(filters.type);
    }

    query += ' ORDER BY name ASC';

    if (filters.limit) {
      query += ' LIMIT ?';
      params.push(filters.limit);
    }

    if (filters.offset) {
      query += ' OFFSET ?';
      params.push(filters.offset);
    }

    const result = await this.d1.prepare(query).bind(...params).all<Entangled>();
    return result.results || [];
  }

  async createEntangled(data: {
    name: string;
    description?: string;
    type: 'human' | 'agent';
    metadata?: Record<string, any>;
  }): Promise<Entangled> {
    const id = crypto.randomUUID();
    const metadata = data.metadata ? JSON.stringify(data.metadata) : null;
    await this.d1
      .prepare('INSERT INTO zoku (id, name, description, type, metadata) VALUES (?, ?, ?, ?, ?)')
      .bind(id, data.name, data.description || null, data.type, metadata)
      .run();
    return (await this.getEntangled(id))!;
  }

  async updateEntangled(
    id: string,
    data: { name?: string; description?: string; metadata?: Record<string, any> }
  ): Promise<void> {
    const updates: string[] = [];
    const params: any[] = [];

    if (data.name !== undefined) {
      updates.push('name = ?');
      params.push(data.name);
    }
    if (data.description !== undefined) {
      updates.push('description = ?');
      params.push(data.description);
    }
    if (data.metadata !== undefined) {
      updates.push('metadata = ?');
      params.push(JSON.stringify(data.metadata));
    }

    if (updates.length > 0) {
      params.push(id);
      await this.d1
        .prepare(`UPDATE zoku SET ${updates.join(', ')} WHERE id = ?`)
        .bind(...params)
        .run();
    }
  }

  async deleteEntangled(id: string): Promise<void> {
    await this.d1.prepare('DELETE FROM zoku WHERE id = ?').bind(id).run();
  }

  async getZokuEntanglements(entangledId: string): Promise<any[]> {
    const query = `
      SELECT DISTINCT v.id, v.name, v.created_at,
        GROUP_CONCAT(ve.role) as roles
      FROM entanglement_zoku ve
      JOIN entanglements v ON ve.entanglement_id = v.id
      WHERE ve.zoku_id = ?
      GROUP BY v.id, v.name, v.created_at
      ORDER BY v.name
    `;
    const result = await this.d1.prepare(query).bind(entangledId).all<any>();

    return (result.results || []).map(row => ({
      id: row.id,
      name: row.name,
      created_at: row.created_at,
      roles: row.roles ? row.roles.split(',') : []
    }));
  }

  // PASCI Matrix
  async getMatrix(volitionId: string): Promise<Record<string, Zoku[]>> {
    const result = await this.d1
      .prepare(`
        SELECT ve.role, e.* FROM entanglement_zoku ve
        JOIN zoku e ON ve.zoku_id = e.id
        WHERE ve.entanglement_id = ?
        ORDER BY ve.role, e.name
      `)
      .bind(volitionId)
      .all<MatrixAssignment & Entangled>();

    const matrix: Record<string, Zoku[]> = {
      perform: [],
      accountable: [],
      control: [],
      support: [],
      informed: []
    };

    for (const row of result.results || []) {
      matrix[row.role].push({
        id: row.id,
        name: row.name,
        type: row.type,
        metadata: row.metadata,
        created_at: row.created_at
      });
    }

    return matrix;
  }

  async assignToMatrix(volitionId: string, entangledId: string, role: string): Promise<void> {
    await this.d1
      .prepare(
        'INSERT OR IGNORE INTO volition_entangled (entanglement_id, zoku_id, role) VALUES (?, ?, ?)'
      )
      .bind(volitionId, entangledId, role)
      .run();
  }

  async removeFromMatrix(volitionId: string, entangledId: string, role: string): Promise<void> {
    await this.d1
      .prepare(
        'DELETE FROM entanglement_zoku WHERE entanglement_id = ? AND zoku_id = ? AND role = ?'
      )
      .bind(volitionId, entangledId, role)
      .run();
  }

  // Qupts
  async getQupt(id: string): Promise<Qupt | null> {
    const result = await this.d1
      .prepare('SELECT * FROM qupts WHERE id = ?')
      .bind(id)
      .first<Qupt>();
    return result || null;
  }

  async listQupts(filters: {
    entanglement_id?: string;
    recursive?: boolean;
    zoku_id?: string;
    source?: string;
    limit?: number;
    offset?: number;
  } = {}): Promise<Qupt[]> {
    let query: string;
    const params: any[] = [];

    if (filters.entanglement_id && filters.recursive) {
      // Get qupts for volition and all descendants
      query = `
        WITH RECURSIVE descendants AS (
          SELECT id FROM entanglements WHERE id = ?
          UNION ALL
          SELECT v.id FROM entanglements v
          JOIN descendants d ON v.parent_id = d.id
        )
        SELECT q.*, v.name as volition_name FROM qupts q
        JOIN descendants d ON q.entanglement_id = d.id
        JOIN entanglements v ON q.entanglement_id = v.id
      `;
      params.push(filters.entanglement_id);
    } else {
      query = 'SELECT q.*, v.name as volition_name FROM qupts q JOIN entanglements v ON q.entanglement_id = v.id';
      const conditions: string[] = [];

      if (filters.entanglement_id) {
        conditions.push('entanglement_id = ?');
        params.push(filters.entanglement_id);
      }

      if (filters.zoku_id) {
        conditions.push('zoku_id = ?');
        params.push(filters.zoku_id);
      }

      if (filters.source) {
        conditions.push('source = ?');
        params.push(filters.source);
      }

      if (conditions.length > 0) {
        query += ' WHERE ' + conditions.join(' AND ');
      }
    }

    query += ' ORDER BY created_at DESC';

    if (filters.limit) {
      query += ' LIMIT ?';
      params.push(filters.limit);
    }

    if (filters.offset) {
      query += ' OFFSET ?';
      params.push(filters.offset);
    }

    const result = await this.d1.prepare(query).bind(...params).all<Qupt>();
    return result.results || [];
  }

  async createQupt(data: QuptInput): Promise<Qupt> {
    const id = crypto.randomUUID();
    const metadata = data.metadata ? JSON.stringify(data.metadata) : null;
    const createdAt = data.created_at || Math.floor(Date.now() / 1000);

    await this.d1
      .prepare(`
        INSERT INTO qupts (id, entanglement_id, zoku_id, content, source, external_id, metadata, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `)
      .bind(
        id,
        data.entanglement_id,
        data.zoku_id || null,
        data.content,
        data.source,
        data.external_id || null,
        metadata,
        createdAt
      )
      .run();

    return (await this.getQupt(id))!;
  }

  async batchCreateQupts(qupts: QuptInput[]): Promise<void> {
    const batch = qupts.map(q => {
      const id = crypto.randomUUID();
      const metadata = q.metadata ? JSON.stringify(q.metadata) : null;
      const createdAt = q.created_at || Math.floor(Date.now() / 1000);

      return this.d1
        .prepare(`
          INSERT OR IGNORE INTO qupts (id, entanglement_id, zoku_id, content, source, external_id, metadata, created_at)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        `)
        .bind(
          id,
          q.entanglement_id,
          q.zoku_id || null,
          q.content,
          q.source,
          q.external_id || null,
          metadata,
          createdAt
        );
    });

    await this.d1.batch(batch);
  }

  async deleteQupt(id: string): Promise<void> {
    await this.d1.prepare('DELETE FROM qupts WHERE id = ?').bind(id).run();
  }

  // Sources
  async getSource(id: string): Promise<Source | null> {
    const result = await this.d1
      .prepare('SELECT * FROM sources WHERE id = ?')
      .bind(id)
      .first<Source>();
    return result || null;
  }

  async listSources(volitionId?: string): Promise<Source[]> {
    let query = 'SELECT * FROM sources';
    const params: any[] = [];

    if (volitionId) {
      query += ' WHERE entanglement_id = ?';
      params.push(volitionId);
    }

    query += ' ORDER BY created_at DESC';

    const result = await this.d1.prepare(query).bind(...params).all<Source>();
    return result.results || [];
  }

  async getEnabledSources(): Promise<Source[]> {
    const result = await this.d1
      .prepare('SELECT * FROM sources WHERE enabled = 1')
      .all<Source>();
    return result.results || [];
  }

  async createSource(data: {
    entanglement_id: string;
    type: string;
    config: Record<string, any>;
    credentials?: Record<string, any>;
    jewel_id?: string;
  }): Promise<Source> {
    const id = crypto.randomUUID();
    const config = JSON.stringify(data.config);
    const credentials = data.credentials ? JSON.stringify(data.credentials) : null;

    await this.d1
      .prepare(`
        INSERT INTO sources (id, entanglement_id, type, config, credentials, jewel_id)
        VALUES (?, ?, ?, ?, ?, ?)
      `)
      .bind(id, data.entanglement_id, data.type, config, credentials, data.jewel_id || null)
      .run();

    return (await this.getSource(id))!;
  }

  async updateSource(
    id: string,
    data: {
      config?: Record<string, any>;
      credentials?: Record<string, any>;
      enabled?: boolean;
      last_sync?: number;
      sync_cursor?: string | null;
      last_error?: string | null;
      error_count?: number;
      last_error_at?: number | null;
    }
  ): Promise<void> {
    const updates: string[] = [];
    const params: any[] = [];

    if (data.config !== undefined) {
      updates.push('config = ?');
      params.push(JSON.stringify(data.config));
    }
    if (data.credentials !== undefined) {
      updates.push('credentials = ?');
      params.push(JSON.stringify(data.credentials));
    }
    if (data.enabled !== undefined) {
      updates.push('enabled = ?');
      params.push(data.enabled ? 1 : 0);
    }
    if (data.last_sync !== undefined) {
      updates.push('last_sync = ?');
      params.push(data.last_sync);
    }
    if (data.sync_cursor !== undefined) {
      updates.push('sync_cursor = ?');
      params.push(data.sync_cursor);
    }
    if (data.last_error !== undefined) {
      updates.push('last_error = ?');
      params.push(data.last_error);
    }
    if (data.error_count !== undefined) {
      updates.push('error_count = ?');
      params.push(data.error_count);
    }
    if (data.last_error_at !== undefined) {
      updates.push('last_error_at = ?');
      params.push(data.last_error_at);
    }

    if (updates.length > 0) {
      params.push(id);
      await this.d1
        .prepare(`UPDATE sources SET ${updates.join(', ')} WHERE id = ?`)
        .bind(...params)
        .run();
    }
  }

  async deleteSource(id: string): Promise<void> {
    await this.d1.prepare('DELETE FROM sources WHERE id = ?').bind(id).run();
  }

  // Dimensions
  async getDimension(id: string): Promise<Dimension | null> {
    const result = await this.d1
      .prepare('SELECT * FROM dimensions WHERE id = ?')
      .bind(id)
      .first<Dimension>();
    return result || null;
  }

  async listDimensions(): Promise<Dimension[]> {
    const result = await this.d1
      .prepare('SELECT * FROM dimensions ORDER BY name')
      .all<Dimension>();
    return result.results || [];
  }

  async getDimensionValues(dimensionId: string): Promise<DimensionValue[]> {
    const result = await this.d1
      .prepare('SELECT * FROM dimension_values WHERE dimension_id = ? ORDER BY sort_order, label')
      .bind(dimensionId)
      .all<DimensionValue>();
    return result.results || [];
  }

  async getAllDimensionValues(): Promise<DimensionValue[]> {
    const result = await this.d1
      .prepare('SELECT * FROM dimension_values ORDER BY dimension_id, sort_order, label')
      .all<DimensionValue>();
    return result.results || [];
  }

  // Volition Attributes (Batch)
  async getEntanglementsAttributes(volitionIds: string[]): Promise<Map<string, Record<string, string>>> {
    if (volitionIds.length === 0) return new Map();

    const query = `
      SELECT
        va.entanglement_id,
        d.name as dimension_name,
        dv.label as value_label
      FROM entanglement_attributes va
      JOIN dimensions d ON va.dimension_id = d.id
      JOIN dimension_values dv ON va.value_id = dv.id
      WHERE va.entanglement_id IN (${volitionIds.map(() => '?').join(',')})
      ORDER BY va.entanglement_id, d.name
    `;

    const result = await this.d1.prepare(query).bind(...volitionIds).all();

    // Group by entanglement_id
    const attributesMap = new Map<string, Record<string, string>>();
    for (const row of result.results as any[]) {
      if (!attributesMap.has(row.entanglement_id)) {
        attributesMap.set(row.entanglement_id, {});
      }
      attributesMap.get(row.entanglement_id)![row.dimension_name] = row.value_label;
    }

    return attributesMap;
  }

  // Volition Attributes (Single)
  async getEntanglementAttributes(volitionId: string): Promise<VolitionAttribute[]> {
    const result = await this.d1
      .prepare('SELECT * FROM entanglement_attributes WHERE entanglement_id = ?')
      .bind(volitionId)
      .all<VolitionAttribute>();
    return result.results || [];
  }

  async setEntanglementAttributes(volitionId: string, attributes: Array<{ dimension_id: string; value_id: string }>): Promise<void> {
    // Delete existing attributes
    await this.d1
      .prepare('DELETE FROM entanglement_attributes WHERE entanglement_id = ?')
      .bind(volitionId)
      .run();

    // Insert new attributes
    if (attributes.length > 0) {
      const batch = attributes.map(attr =>
        this.d1
          .prepare('INSERT INTO entanglement_attributes (entanglement_id, dimension_id, value_id) VALUES (?, ?, ?)')
          .bind(volitionId, attr.dimension_id, attr.value_id)
      );
      await this.d1.batch(batch);
    }
  }

  async addVolitionAttribute(volitionId: string, dimensionId: string, valueId: string): Promise<void> {
    await this.d1
      .prepare('INSERT OR IGNORE INTO volition_attributes (entanglement_id, dimension_id, value_id) VALUES (?, ?, ?)')
      .bind(volitionId, dimensionId, valueId)
      .run();
  }

  async removeEntanglementAttributes(volitionId: string, dimensionId: string): Promise<void> {
    await this.d1
      .prepare('DELETE FROM entanglement_attributes WHERE entanglement_id = ? AND dimension_id = ?')
      .bind(volitionId, dimensionId)
      .run();
  }

  // Credentials management
  async createJewel(params: {
    name: string;
    type: string;
    data: string;  // Already encrypted
    last_validated?: number | null;
    validation_metadata?: Record<string, any> | null;
  }): Promise<Credential> {
    const id = crypto.randomUUID();
    const now = Math.floor(Date.now() / 1000);

    await this.d1
      .prepare(`
        INSERT INTO jewels (id, name, type, data, last_validated, validation_metadata, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `)
      .bind(
        id,
        params.name,
        params.type,
        params.data,
        params.last_validated || null,
        params.validation_metadata ? JSON.stringify(params.validation_metadata) : null,
        now,
        now
      )
      .run();

    return this.getCredential(id) as Promise<Credential>;
  }

  async getCredential(id: string): Promise<Credential | null> {
    const result = await this.d1
      .prepare('SELECT * FROM jewels WHERE id = ?')
      .bind(id)
      .first<Credential>();

    return result || null;
  }

  async listJewels(params?: {
    type?: string;
    limit?: number;
  }): Promise<Jewel[]> {
    let query = 'SELECT * FROM jewels';
    const bindings: any[] = [];

    if (params?.type) {
      query += ' WHERE type = ?';
      bindings.push(params.type);
    }

    query += ' ORDER BY created_at DESC';

    if (params?.limit) {
      query += ' LIMIT ?';
      bindings.push(params.limit);
    }

    const result = await this.d1.prepare(query).bind(...bindings).all<Credential>();
    return result.results || [];
  }

  async updateJewel(id: string, params: {
    name?: string;
    data?: string;  // Already encrypted
    last_validated?: number | null;
    validation_metadata?: Record<string, any> | null;
  }): Promise<void> {
    const updates: string[] = [];
    const bindings: any[] = [];

    if (params.name !== undefined) {
      updates.push('name = ?');
      bindings.push(params.name);
    }

    if (params.data !== undefined) {
      updates.push('data = ?');
      bindings.push(params.data);
    }

    if (params.last_validated !== undefined) {
      updates.push('last_validated = ?');
      bindings.push(params.last_validated);
    }

    if (params.validation_metadata !== undefined) {
      updates.push('validation_metadata = ?');
      bindings.push(params.validation_metadata ? JSON.stringify(params.validation_metadata) : null);
    }

    if (updates.length === 0) return;

    updates.push('updated_at = ?');
    bindings.push(Math.floor(Date.now() / 1000));

    bindings.push(id);

    await this.d1
      .prepare(`UPDATE jewels SET ${updates.join(', ')} WHERE id = ?`)
      .bind(...bindings)
      .run();
  }

  async deleteJewel(id: string): Promise<void> {
    await this.d1
      .prepare('DELETE FROM jewels WHERE id = ?')
      .bind(id)
      .run();
  }

  async getJewelUsage(credentialId: string): Promise<{ entanglement_id: string; volition_name: string; source_type: string; source_id: string }[]> {
    const result = await this.d1
      .prepare(`
        SELECT s.id as source_id, s.entanglement_id, s.type as source_type, v.name as volition_name
        FROM sources s
        JOIN entanglements v ON s.entanglement_id = v.id
        WHERE s.jewel_id = ?
      `)
      .bind(credentialId)
      .all<{ source_id: string; entanglement_id: string; source_type: string; volition_name: string }>();

    return result.results || [];
  }
}
