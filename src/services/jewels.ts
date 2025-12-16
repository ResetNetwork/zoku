import { BaseService } from './base';
import { createJewelSchema, updateJewelSchema } from '../lib/validation';
import { NotFoundError, ForbiddenError, ValidationError } from '../lib/errors';
import { validateJewel } from '../handlers/validate';
import type { Jewel, Env } from '../types';

export class JewelService extends BaseService {
  private env: Env;

  constructor(db: any, user: any, logger: any, requestId: string | undefined, env: Env) {
    super(db, user, logger, requestId);
    this.env = env;
  }

  /**
   * List jewels (ownership filtered, no encrypted data)
   */
  async list(filters: { type?: string; limit?: number } = {}) {
    this.requireTier('coherent');

    const jewels = await this.db.listJewels({
      owner_id: this.user.id,
      type: filters.type,
      limit: filters.limit || 20
    });

    // Strip encrypted data
    return jewels.map((j: any) => ({
      id: j.id,
      name: j.name,
      type: j.type,
      created_at: j.created_at,
      last_validated_at: j.last_validated_at,
      validation_result: j.validation_result
    }));
  }

  /**
   * Get jewel (no encrypted data)
   */
  async get(id: string) {
    this.requireTier('coherent');

    const jewel = await this.db.getJewel(id);
    if (!jewel) {
      throw new NotFoundError('Jewel', id);
    }

    // Check ownership
    if (jewel.owner_id !== this.user.id) {
      throw new ForbiddenError('You can only view your own jewels');
    }

    return {
      id: jewel.id,
      name: jewel.name,
      type: jewel.type,
      created_at: jewel.created_at,
      last_validated_at: jewel.last_validated_at,
      validation_result: jewel.validation_result
    };
  }

  /**
   * Create jewel with validation
   */
  async create(input: unknown): Promise<Jewel> {
    this.requireTier('coherent');

    const data = this.validate(createJewelSchema, input);

    // Validate jewel
    const validation = await validateJewel(data.type, data.data, this.env);
    if (!validation.valid) {
      throw new ValidationError(`Jewel validation failed: ${validation.error}`);
    }

    const jewel = await this.db.createJewel({
      name: data.name,
      type: data.type,
      data: data.data,
      owner_id: this.user.id,
      validation_result: validation.info
    });

    await this.audit('create', 'jewel', jewel.id, { type: data.type });

    return {
      id: jewel.id,
      name: jewel.name,
      type: jewel.type,
      created_at: jewel.created_at,
      last_validated_at: jewel.last_validated_at,
      validation_result: jewel.validation_result
    };
  }

  /**
   * Update jewel
   */
  async update(id: string, input: unknown): Promise<void> {
    this.requireTier('coherent');

    const data = this.validate(updateJewelSchema, input);

    const jewel = await this.db.getJewel(id);
    if (!jewel) {
      throw new NotFoundError('Jewel', id);
    }

    // Check ownership
    if (jewel.owner_id !== this.user.id) {
      throw new ForbiddenError('You can only update your own jewels');
    }

    const updates: any = {};
    if (data.name !== undefined) {
      updates.name = data.name;
    }

    if (data.data !== undefined) {
      // Re-validate
      const validation = await validateJewel(jewel.type, data.data, this.env);
      if (!validation.valid) {
        throw new ValidationError(`Jewel validation failed: ${validation.error}`);
      }
      updates.data = data.data;
      updates.validation_result = validation.info;
      updates.last_validated_at = new Date().toISOString();
    }

    await this.db.updateJewel(id, updates);
  }

  /**
   * Delete jewel
   */
  async delete(id: string): Promise<void> {
    this.requireTier('coherent');

    const jewel = await this.db.getJewel(id);
    if (!jewel) {
      throw new NotFoundError('Jewel', id);
    }

    // Check ownership
    if (jewel.owner_id !== this.user.id) {
      throw new ForbiddenError('You can only delete your own jewels');
    }

    // Check if in use
    const usage = await this.db.getJewelUsage(id);
    if (usage.length > 0) {
      throw new ValidationError(
        `Cannot delete jewel: in use by ${usage.length} source(s). Remove sources first.`
      );
    }

    await this.db.deleteJewel(id);
    await this.audit('delete', 'jewel', id);
  }

  /**
   * Get jewel usage
   */
  async getUsage(id: string) {
    this.requireTier('coherent');

    const jewel = await this.db.getJewel(id);
    if (!jewel) {
      throw new NotFoundError('Jewel', id);
    }

    // Check ownership
    if (jewel.owner_id !== this.user.id) {
      throw new ForbiddenError('You can only view usage for your own jewels');
    }

    return this.db.getJewelUsage(id);
  }
}
