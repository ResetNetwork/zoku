import { BaseService } from './base';
import { createZokuSchema, updateZokuSchema, updateZokuTierSchema } from '../lib/validation';
import { NotFoundError } from '../lib/errors';
import type { Zoku } from '../types';

export class ZokuService extends BaseService {
  /**
   * List zoku with optional filters
   */
  async list(filters: { type?: string; limit?: number; offset?: number } = {}) {
    return this.db.listZoku({
      type: filters.type as 'human' | 'agent' | undefined,
      limit: filters.limit || 20,
      offset: filters.offset || 0
    });
  }

  /**
   * Get single zoku by ID
   */
  async get(id: string) {
    const zoku = await this.db.getZoku(id);
    if (!zoku) {
      throw new NotFoundError('Zoku', id);
    }

    // Get their entanglements and roles
    const entanglements = await this.db.getZokuEntanglements(id);

    return {
      ...zoku,
      entanglements
    };
  }

  /**
   * Create new zoku
   */
  async create(input: unknown): Promise<Zoku> {
    this.requireTier('entangled');

    const data = this.validate(createZokuSchema, input);

    // Entangled users can only create as 'observed'
    const access_tier = 'observed';

    const zoku = await this.db.createZoku({
      name: data.name,
      description: data.description,
      type: data.type,
      email: data.email || null,
      access_tier,
      created_by: this.user.id,
      metadata: data.metadata
    });

    await this.audit('create', 'zoku', zoku.id, { tier: access_tier });

    return zoku;
  }

  /**
   * Update zoku
   */
  async update(id: string, input: unknown): Promise<void> {
    const data = this.validate(updateZokuSchema, input);

    const zoku = await this.db.getZoku(id);
    if (!zoku) {
      throw new NotFoundError('Zoku', id);
    }

    await this.db.updateZoku(id, {
      name: data.name,
      description: data.description,
      metadata: data.metadata
    });
  }

  /**
   * Delete zoku
   */
  async delete(id: string): Promise<void> {
    const zoku = await this.db.getZoku(id);
    if (!zoku) {
      throw new NotFoundError('Zoku', id);
    }

    await this.db.deleteZoku(id);
  }

  /**
   * Update zoku tier (Prime only)
   */
  async updateTier(targetId: string, input: unknown) {
    this.requireTier('prime');

    const data = this.validate(updateZokuTierSchema, input);

    const target = await this.db.getZoku(targetId);
    if (!target) {
      throw new NotFoundError('Zoku', targetId);
    }

    const oldTier = target.access_tier;
    const newTier = data.tier;

    // Update tier and metadata atomically
    await this.db.updateZoku(targetId, {
      access_tier: newTier,
      updated_by: this.user.id
    });

    await this.audit('tier_change', 'zoku', targetId, { from: oldTier, to: newTier });

    return { success: true, tier: newTier };
  }
}
