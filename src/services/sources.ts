import { BaseService } from './base';
import { addSourceSchema, updateSourceSchema } from '../lib/validation';
import { NotFoundError, ValidationError } from '../lib/errors';
import { syncSource } from '../handlers';
import type { Source, Env } from '../types';

export class SourceService extends BaseService {
  private env: Env;

  constructor(db: any, user: any, logger: any, requestId: string | undefined, env: Env) {
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

    const data = this.validate(addSourceSchema, input);

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
   * Delete source
   */
  async delete(id: string): Promise<void> {
    this.requireTier('entangled');

    const source = await this.db.getSource(id);
    if (!source) {
      throw new NotFoundError('Source', id);
    }

    await this.db.deleteSource(id);
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

    await syncSource(this.db, source, this.env, this.logger);

    return { success: true, synced_at: new Date().toISOString() };
  }
}
