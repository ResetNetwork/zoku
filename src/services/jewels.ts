import { BaseService } from './base';
import { createJewelSchema, updateJewelSchema } from '../lib/validation';
import { NotFoundError, ForbiddenError, ValidationError } from '../lib/errors';
import { validateJewel } from '../handlers/validate';
import { encryptJewel } from '../lib/crypto';
import type { Jewel, Env } from '../types';

export class JewelService extends BaseService {
  private env: Env;

  constructor(db: any, user: any, logger: any, requestId: string | undefined, env: Env) {
    super(db, user, logger, requestId);
    this.env = env;
  }

  /**
   * List jewels (ownership filtered, no encrypted data)
   * Prime users can see all jewels
   */
  async list(filters: { type?: string; limit?: number } = {}) {
    this.requireTier('coherent');

    const isPrime = this.user.access_tier === 'prime';

    const jewels = await this.db.listJewels({
      owner_id: isPrime ? undefined : this.user.id, // Prime sees all
      type: filters.type,
      limit: filters.limit || 20
    });

    // Strip encrypted data
    return jewels.map((j: any) => ({
      id: j.id,
      name: j.name,
      type: j.type,
      owner_id: j.owner_id,
      owner_name: j.owner_name, // From JOIN with zoku table
      created_at: j.created_at,
      last_validated_at: j.last_validated_at,
      validation_result: j.validation_result
    }));
  }

  /**
   * Get jewel (no encrypted data)
   * Prime users can view any jewel
   */
  async get(id: string) {
    this.requireTier('coherent');

    const jewel = await this.db.getJewel(id);
    if (!jewel) {
      throw new NotFoundError('Jewel', id);
    }

    const isPrime = this.user.access_tier === 'prime';

    // Check ownership (prime can view all)
    if (!isPrime && jewel.owner_id !== this.user.id) {
      throw new ForbiddenError('You can only view your own jewels');
    }

    return {
      id: jewel.id,
      name: jewel.name,
      type: jewel.type,
      owner_id: jewel.owner_id,
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

    // Encrypt jewel data
    const encryptedData = await encryptJewel(JSON.stringify(data.data), this.env.ENCRYPTION_KEY);

    const jewel = await this.db.createJewel({
      name: data.name,
      type: data.type,
      data: encryptedData,
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
      // Encrypt jewel data
      const encryptedData = await encryptJewel(JSON.stringify(data.data), this.env.ENCRYPTION_KEY);
      updates.data = encryptedData;
      updates.validation_result = validation.info;
      updates.last_validated_at = new Date().toISOString();
    }

    await this.db.updateJewel(id, updates);
  }

  /**
   * Delete jewel
   * Only owner or prime users can delete
   */
  async delete(id: string): Promise<void> {
    this.requireTier('coherent');

    const jewel = await this.db.getJewel(id);
    if (!jewel) {
      throw new NotFoundError('Jewel', id);
    }

    const isPrime = this.user.access_tier === 'prime';

    // Check ownership (prime can delete any)
    if (!isPrime && jewel.owner_id !== this.user.id) {
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
    await this.audit('delete', 'jewel', id, { 
      owner_id: jewel.owner_id,
      deleted_by_prime: isPrime && jewel.owner_id !== this.user.id
    });
  }

  /**
   * Get jewel usage
   * Prime users can view usage for any jewel
   */
  async getUsage(id: string) {
    this.requireTier('coherent');

    const jewel = await this.db.getJewel(id);
    if (!jewel) {
      throw new NotFoundError('Jewel', id);
    }

    const isPrime = this.user.access_tier === 'prime';

    // Check ownership (prime can view all)
    if (!isPrime && jewel.owner_id !== this.user.id) {
      throw new ForbiddenError('You can only view usage for your own jewels');
    }

    return this.db.getJewelUsage(id);
  }
}
