import { BaseService } from './base';
import { createSourceSchema, updateSourceSchema } from '../lib/validation';
import { NotFoundError, ValidationError } from '../lib/errors';
import { syncSource } from '../lib/sync-source';
import type { Source, Env } from '../types';

export class SourceService extends BaseService {
  private env: Env;

  constructor(db: DB, user: Zoku, logger: Logger, requestId: string | undefined, env: Env) {
    super(db, user, logger, requestId);
    this.env = env;
  }

  /**
   * Get source by ID
   */
  async get(id: string) {
    const source = await this.db.getSource(id);
    if (!source) {
      throw new NotFoundError('Source', id);
    }

    // Strip encrypted jewels
    return {
      ...source,
      jewels: undefined
    };
  }

  /**
   * Create source
   */
  async create(entanglementId: string, input: unknown): Promise<Source> {
    this.requireTier('entangled');

    const data = this.validate(createSourceSchema, input);

    // Verify entanglement exists
    const entanglement = await this.db.getEntanglement(entanglementId);
    if (!entanglement) {
      throw new NotFoundError('Entanglement', entanglementId);
    }

    // If using jewel_id, verify it exists and user owns it
    if (data.jewel_id) {
      const jewel = await this.db.getJewel(data.jewel_id);
      if (!jewel) {
        throw new NotFoundError('Jewel', data.jewel_id);
      }
      if (jewel.owner_id !== this.user.id) {
        throw new ValidationError('You can only use your own jewels');
      }
    }

    const source = await this.db.createSource({
      entanglement_id: entanglementId,
      type: data.type,
      config: data.config,
      jewels: data.jewels,
      jewel_id: data.jewel_id
    });

    return source;
  }

  /**
   * Update source
   */
  async update(id: string, input: unknown): Promise<void> {
    this.requireTier('entangled');

    const data = this.validate(updateSourceSchema, input);

    const source = await this.db.getSource(id);
    if (!source) {
      throw new NotFoundError('Source', id);
    }

    const updates: any = {};
    if (data.config !== undefined) {
      updates.config = data.config;
    }
    if (data.enabled !== undefined) {
      updates.enabled = data.enabled;
    }
    if (data.sync_interval !== undefined) {
      updates.sync_interval = data.sync_interval;
    }

    await this.db.updateSource(id, updates);
  }

  /**
   * Delete source (optionally with cascade delete of associated qupts)
   */
  async delete(id: string, cascadeQupts: boolean = false): Promise<void> {
    this.requireTier('entangled');

    const source = await this.db.getSource(id);
    if (!source) {
      throw new NotFoundError('Source', id);
    }

    // Delete source and optionally cascade delete qupts atomically
    if (cascadeQupts) {
      // Build batch: delete qupts + delete source
      const batch = [
        this.db.d1
          .prepare('DELETE FROM qupts WHERE source = ? AND entanglement_id = ?')
          .bind(source.type, source.entanglement_id),
        this.db.d1
          .prepare('DELETE FROM sources WHERE id = ?')
          .bind(id)
      ];
      
      const results = await this.db.d1.batch(batch);
      const quptsDeleted = results[0].meta.changes || 0;
      
      this.logger.info('Cascade deleted source with qupts atomically', { 
        source_id: id, 
        source_type: source.type,
        entanglement_id: source.entanglement_id,
        qupts_deleted: quptsDeleted
      });
      
      await this.audit('delete_with_qupts', 'source', id, { 
        source_type: source.type,
        qupts_deleted: quptsDeleted
      });
    } else {
      await this.db.deleteSource(id);
      await this.audit('delete', 'source', id);
    }
  }

  /**
   * Manual sync trigger
   */
  async sync(id: string) {
    this.requireTier('entangled');

    const source = await this.db.getSource(id);
    if (!source) {
      throw new NotFoundError('Source', id);
    }

    if (!source.enabled) {
      throw new ValidationError('Cannot sync disabled source');
    }

    try {
      await syncSource(this.db, source, this.env, this.logger);
      return { success: true, synced_at: new Date().toISOString() };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown sync error';
      this.logger.error('Source sync failed', { source_id: id, error: errorMessage });
      
      // Update source with error info
      await this.db.updateSourceError(id, errorMessage);
      
      // Return error instead of throwing
      return { 
        success: false, 
        error: errorMessage,
        synced_at: new Date().toISOString() 
      };
    }
  }
}
