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
      .prepare('SELECT * FROM volitions WHERE id = ?')
      .bind(id)
      .first<Volition>();
    return result || null;
  }

  async listVolitions(filters: {
    parent_id?: string;
    root_only?: boolean;
    limit?: number;
    offset?: number;
  } = {}): Promise<Volition[]> {
    let query = 'SELECT * FROM volitions';
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
        'INSERT INTO volitions (id, name, description, parent_id) VALUES (?, ?, ?, ?)'
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
        .prepare(`UPDATE volitions SET ${updates.join(', ')} WHERE id = ?`)
        .bind(...params)
        .run();
    }
  }

  async deleteVolition(id: string): Promise<void> {
    await this.d1.prepare('DELETE FROM volitions WHERE id = ?').bind(id).run();
  }

  async getVolitionChildren(parentId: string): Promise<Volition[]> {
    return this.listVolitions({ parent_id: parentId });
  }

  async getVolitionDescendants(volitionId: string): Promise<Volition[]> {
    const query = `
      WITH RECURSIVE descendants AS (
        SELECT id FROM volitions WHERE id = ?
        UNION ALL
        SELECT v.id FROM volitions v
        JOIN descendants d ON v.parent_id = d.id
      )
      SELECT v.* FROM volitions v
      JOIN descendants d ON v.id = d.id
      WHERE v.id != ?
    `;
    const result = await this.d1.prepare(query).bind(volitionId, volitionId).all<Volition>();
    return result.results || [];
  }

  // Entangled
  async getEntangled(id: string): Promise<Entangled | null> {
    const result = await this.d1
      .prepare('SELECT * FROM entangled WHERE id = ?')
      .bind(id)
      .first<Entangled>();
    return result || null;
  }

  async listEntangled(filters: { type?: string; limit?: number; offset?: number } = {}): Promise<Entangled[]> {
    let query = 'SELECT * FROM entangled';
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
    type: 'human' | 'agent';
    metadata?: Record<string, any>;
  }): Promise<Entangled> {
    const id = crypto.randomUUID();
    const metadata = data.metadata ? JSON.stringify(data.metadata) : null;
    await this.d1
      .prepare('INSERT INTO entangled (id, name, type, metadata) VALUES (?, ?, ?, ?)')
      .bind(id, data.name, data.type, metadata)
      .run();
    return (await this.getEntangled(id))!;
  }

  async updateEntangled(
    id: string,
    data: { name?: string; metadata?: Record<string, any> }
  ): Promise<void> {
    const updates: string[] = [];
    const params: any[] = [];

    if (data.name !== undefined) {
      updates.push('name = ?');
      params.push(data.name);
    }
    if (data.metadata !== undefined) {
      updates.push('metadata = ?');
      params.push(JSON.stringify(data.metadata));
    }

    if (updates.length > 0) {
      params.push(id);
      await this.d1
        .prepare(`UPDATE entangled SET ${updates.join(', ')} WHERE id = ?`)
        .bind(...params)
        .run();
    }
  }

  async deleteEntangled(id: string): Promise<void> {
    await this.d1.prepare('DELETE FROM entangled WHERE id = ?').bind(id).run();
  }

  // PASCI Matrix
  async getMatrix(volitionId: string): Promise<Record<string, Entangled[]>> {
    const result = await this.d1
      .prepare(`
        SELECT ve.role, e.* FROM volition_entangled ve
        JOIN entangled e ON ve.entangled_id = e.id
        WHERE ve.volition_id = ?
        ORDER BY ve.role, e.name
      `)
      .bind(volitionId)
      .all<MatrixAssignment & Entangled>();

    const matrix: Record<string, Entangled[]> = {
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
        'INSERT OR IGNORE INTO volition_entangled (volition_id, entangled_id, role) VALUES (?, ?, ?)'
      )
      .bind(volitionId, entangledId, role)
      .run();
  }

  async removeFromMatrix(volitionId: string, entangledId: string, role: string): Promise<void> {
    await this.d1
      .prepare(
        'DELETE FROM volition_entangled WHERE volition_id = ? AND entangled_id = ? AND role = ?'
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
    volition_id?: string;
    recursive?: boolean;
    entangled_id?: string;
    source?: string;
    limit?: number;
    offset?: number;
  } = {}): Promise<Qupt[]> {
    let query: string;
    const params: any[] = [];

    if (filters.volition_id && filters.recursive) {
      // Get qupts for volition and all descendants
      query = `
        WITH RECURSIVE descendants AS (
          SELECT id FROM volitions WHERE id = ?
          UNION ALL
          SELECT v.id FROM volitions v
          JOIN descendants d ON v.parent_id = d.id
        )
        SELECT q.* FROM qupts q
        JOIN descendants d ON q.volition_id = d.id
      `;
      params.push(filters.volition_id);
    } else {
      query = 'SELECT * FROM qupts';
      const conditions: string[] = [];

      if (filters.volition_id) {
        conditions.push('volition_id = ?');
        params.push(filters.volition_id);
      }

      if (filters.entangled_id) {
        conditions.push('entangled_id = ?');
        params.push(filters.entangled_id);
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
        INSERT INTO qupts (id, volition_id, entangled_id, content, source, external_id, metadata, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `)
      .bind(
        id,
        data.volition_id,
        data.entangled_id || null,
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
          INSERT OR IGNORE INTO qupts (id, volition_id, entangled_id, content, source, external_id, metadata, created_at)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        `)
        .bind(
          id,
          q.volition_id,
          q.entangled_id || null,
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
      query += ' WHERE volition_id = ?';
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
    volition_id: string;
    type: string;
    config: Record<string, any>;
    credentials?: Record<string, any>;
    credential_id?: string;
  }): Promise<Source> {
    const id = crypto.randomUUID();
    const config = JSON.stringify(data.config);
    const credentials = data.credentials ? JSON.stringify(data.credentials) : null;

    await this.d1
      .prepare(`
        INSERT INTO sources (id, volition_id, type, config, credentials, credential_id)
        VALUES (?, ?, ?, ?, ?, ?)
      `)
      .bind(id, data.volition_id, data.type, config, credentials, data.credential_id || null)
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

  // Volition Attributes
  async getVolitionAttributes(volitionId: string): Promise<VolitionAttribute[]> {
    const result = await this.d1
      .prepare('SELECT * FROM volition_attributes WHERE volition_id = ?')
      .bind(volitionId)
      .all<VolitionAttribute>();
    return result.results || [];
  }

  async setVolitionAttributes(volitionId: string, attributes: Array<{ dimension_id: string; value_id: string }>): Promise<void> {
    // Delete existing attributes
    await this.d1
      .prepare('DELETE FROM volition_attributes WHERE volition_id = ?')
      .bind(volitionId)
      .run();

    // Insert new attributes
    if (attributes.length > 0) {
      const batch = attributes.map(attr =>
        this.d1
          .prepare('INSERT INTO volition_attributes (volition_id, dimension_id, value_id) VALUES (?, ?, ?)')
          .bind(volitionId, attr.dimension_id, attr.value_id)
      );
      await this.d1.batch(batch);
    }
  }

  async addVolitionAttribute(volitionId: string, dimensionId: string, valueId: string): Promise<void> {
    await this.d1
      .prepare('INSERT OR IGNORE INTO volition_attributes (volition_id, dimension_id, value_id) VALUES (?, ?, ?)')
      .bind(volitionId, dimensionId, valueId)
      .run();
  }

  async removeVolitionAttributes(volitionId: string, dimensionId: string): Promise<void> {
    await this.d1
      .prepare('DELETE FROM volition_attributes WHERE volition_id = ? AND dimension_id = ?')
      .bind(volitionId, dimensionId)
      .run();
  }

  // Credentials management
  async createCredential(params: {
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
        INSERT INTO credentials (id, name, type, data, last_validated, validation_metadata, created_at, updated_at)
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
      .prepare('SELECT * FROM credentials WHERE id = ?')
      .bind(id)
      .first<Credential>();

    return result || null;
  }

  async listCredentials(params?: {
    type?: string;
    limit?: number;
  }): Promise<Credential[]> {
    let query = 'SELECT * FROM credentials';
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

  async updateCredential(id: string, params: {
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
      .prepare(`UPDATE credentials SET ${updates.join(', ')} WHERE id = ?`)
      .bind(...bindings)
      .run();
  }

  async deleteCredential(id: string): Promise<void> {
    await this.d1
      .prepare('DELETE FROM credentials WHERE id = ?')
      .bind(id)
      .run();
  }

  async getCredentialUsage(credentialId: string): Promise<{ volition_id: string; volition_name: string; source_type: string; source_id: string }[]> {
    const result = await this.d1
      .prepare(`
        SELECT s.id as source_id, s.volition_id, s.type as source_type, v.name as volition_name
        FROM sources s
        JOIN volitions v ON s.volition_id = v.id
        WHERE s.credential_id = ?
      `)
      .bind(credentialId)
      .all<{ source_id: string; volition_id: string; source_type: string; volition_name: string }>();

    return result.results || [];
  }
}
