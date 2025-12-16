import { BaseService } from './base';
import { createQuptSchema, batchCreateQuptsSchema } from '../lib/validation';
import { NotFoundError } from '../lib/errors';
import type { Qupt } from '../types';

export class QuptService extends BaseService {
  /**
   * List qupts with filters
   */
  async list(filters: {
    entanglement_id?: string;
    recursive?: boolean;
    zoku_id?: string;
    source?: string;
    limit?: number;
    offset?: number;
  } = {}) {
    return this.db.listQupts({
      entanglement_id: filters.entanglement_id,
      recursive: filters.recursive ?? true,
      zoku_id: filters.zoku_id,
      source: filters.source,
      limit: filters.limit || 20,
      offset: filters.offset || 0
    });
  }

  /**
   * Get single qupt
   */
  async get(id: string) {
    const qupt = await this.db.getQupt(id);
    if (!qupt) {
      throw new NotFoundError('Qupt', id);
    }
    return qupt;
  }

  /**
   * Create qupt
   */
  async create(input: unknown): Promise<Qupt> {
    this.requireTier('entangled');

    const data = this.validate(createQuptSchema, input);

    // Verify entanglement exists
    const entanglement = await this.db.getEntanglement(data.entanglement_id);
    if (!entanglement) {
      throw new NotFoundError('Entanglement', data.entanglement_id);
    }

    // Verify zoku exists if provided
    if (data.zoku_id) {
      const zoku = await this.db.getZoku(data.zoku_id);
      if (!zoku) {
        throw new NotFoundError('Zoku', data.zoku_id);
      }
    }

    return this.db.createQupt({
      entanglement_id: data.entanglement_id,
      zoku_id: data.zoku_id,
      content: data.content,
      source: data.source || 'manual',
      external_id: data.external_id,
      metadata: data.metadata
    });
  }

  /**
   * Batch create qupts
   */
  async batchCreate(input: unknown) {
    const data = this.validate(batchCreateQuptsSchema, input);
    await this.db.batchCreateQupts(data.qupts);
    return { success: true, count: data.qupts.length };
  }

  /**
   * Delete qupt
   */
  async delete(id: string): Promise<void> {
    this.requireTier('entangled');

    const qupt = await this.db.getQupt(id);
    if (!qupt) {
      throw new NotFoundError('Qupt', id);
    }

    await this.db.deleteQupt(id);
  }
}
