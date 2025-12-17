import { BaseService } from './base';
import {
  createEntanglementSchema,
  updateEntanglementSchema,
  assignToMatrixSchema
} from '../lib/validation';
import { NotFoundError, ValidationError } from '../lib/errors';
import type { Entanglement } from '../types';

export class EntanglementService extends BaseService {
  /**
   * List entanglements with optional filters
   */
  async list(filters: {
    root_only?: boolean;
    parent_id?: string;
    limit?: number;
    offset?: number;
  } = {}) {
    const entanglements = await this.db.listEntanglements({
      root_only: filters.root_only || false,
      parent_id: filters.parent_id,
      limit: filters.limit || 20,
      offset: filters.offset || 0
    });

    // Enrich with counts and attributes
    const attributesMap = await this.db.getEntanglementsAttributes(
      entanglements.map(v => v.id)
    );

    const enriched = await Promise.all(
      entanglements.map(async (v) => ({
        ...v,
        children_count: await this.db.getEntanglementChildrenCount(v.id),
        qupts_count: await this.db.getEntanglementQuptsCount(v.id, true),
        sources_count: await this.db.getEntanglementSourcesCount(v.id),
        zoku_count: await this.db.getEntanglementZokuCount(v.id),
        attributes: attributesMap.get(v.id) || null
      }))
    );

    return { entanglements: enriched };
  }

  /**
   * Get single entanglement by ID
   */
  async get(id: string, includeChildrenQupts = true, quptsLimit = 20) {
    const entanglement = await this.db.getEntanglement(id);
    if (!entanglement) {
      throw new NotFoundError('Entanglement', id);
    }

    // Get related data
    const [children, matrix, attributes, qupts, counts] = await Promise.all([
      this.db.getEntanglementChildren(id),
      this.db.getMatrix(id),
      this.db.getEntanglementAttributes(id),
      this.db.listQupts({
        entanglement_id: id,
        recursive: includeChildrenQupts,
        limit: quptsLimit
      }),
      Promise.all([
        this.db.getEntanglementChildrenCount(id),
        this.db.getEntanglementQuptsCount(id, true),
        this.db.getEntanglementSourcesCount(id),
        this.db.getEntanglementZokuCount(id)
      ])
    ]);

    const [children_count, qupts_count, sources_count, zoku_count] = counts;

    // Build attributes map
    const dimensions = await this.db.listDimensions();
    const dimensionValues = await this.db.getAllDimensionValues();
    const attributesMap: Record<string, any> = {};

    for (const attr of attributes) {
      const dimension = dimensions.find(d => d.id === attr.dimension_id);
      const value = dimensionValues.find(v => v.id === attr.value_id);
      if (dimension && value) {
        if (!attributesMap[dimension.name]) {
          attributesMap[dimension.name] = {
            dimension_id: dimension.id,
            label: dimension.label,
            values: []
          };
        }
        attributesMap[dimension.name].values.push({
          id: value.id,
          value: value.value,
          label: value.label
        });
      }
    }

    return {
      ...entanglement,
      attributes: attributesMap,
      matrix,
      children: children.map(c => ({
        id: c.id,
        name: c.name,
        created_at: c.created_at
      })),
      qupts,
      children_count,
      qupts_count,
      sources_count,
      zoku_count
    };
  }

  /**
   * Get child entanglements
   */
  async getChildren(parentId: string, recursive = false) {
    if (recursive) {
      return this.db.getEntanglementDescendants(parentId);
    }
    return this.db.getEntanglementChildren(parentId);
  }

  /**
   * Create new entanglement
   */
  async create(input: unknown): Promise<Entanglement> {
    this.requireTier('entangled');

    // Validate input
    const data = this.validate(createEntanglementSchema, input);

    // Verify parent exists if provided
    if (data.parent_id) {
      const parent = await this.db.getEntanglement(data.parent_id);
      if (!parent) {
        throw new NotFoundError('Parent entanglement', data.parent_id);
      }
    }

    // Create entanglement with initial PASCI assignments atomically
    const entanglement = await this.db.createEntanglementWithMatrix(
      {
        name: data.name,
        description: data.description,
        parent_id: data.parent_id
      },
      data.initial_zoku
    );

    return entanglement;
  }

  /**
   * Update entanglement
   */
  async update(id: string, input: unknown): Promise<Entanglement> {
    this.requireTier('entangled');

    // Validate input
    const data = this.validate(updateEntanglementSchema, input);

    // Check entanglement exists
    const entanglement = await this.db.getEntanglement(id);
    if (!entanglement) {
      throw new NotFoundError('Entanglement', id);
    }

    // Validate parent if being changed
    if (data.parent_id !== undefined && data.parent_id !== null) {
      const parent = await this.db.getEntanglement(data.parent_id);
      if (!parent) {
        throw new NotFoundError('Parent entanglement', data.parent_id);
      }

      // Check for circular reference
      const descendants = await this.db.getEntanglementDescendants(id);
      if (descendants.some(d => d.id === data.parent_id)) {
        throw new ValidationError('Cannot set parent: would create circular reference');
      }
    }

    // Update
    await this.db.updateEntanglement(id, data);

    // Return updated
    const updated = await this.db.getEntanglement(id);
    return updated!;
  }

  /**
   * Delete entanglement
   */
  async delete(id: string, confirm = false): Promise<void> {
    this.requireTier('entangled');

    if (!confirm) {
      throw new ValidationError('Must set confirm=true to delete entanglement');
    }

    const entanglement = await this.db.getEntanglement(id);
    if (!entanglement) {
      throw new NotFoundError('Entanglement', id);
    }

    await this.db.deleteEntanglement(id);
  }

  /**
   * Move entanglement to new parent
   */
  async move(id: string, newParentId: string | null): Promise<void> {
    this.requireTier('entangled');

    const entanglement = await this.db.getEntanglement(id);
    if (!entanglement) {
      throw new NotFoundError('Entanglement', id);
    }

    // Validate new parent if provided
    if (newParentId !== null) {
      const parent = await this.db.getEntanglement(newParentId);
      if (!parent) {
        throw new NotFoundError('Parent entanglement', newParentId);
      }

      // Check circular reference
      const descendants = await this.db.getEntanglementDescendants(id);
      if (descendants.some(d => d.id === newParentId)) {
        throw new ValidationError('Cannot move: would create circular reference');
      }
    }

    await this.db.updateEntanglement(id, { parent_id: newParentId });
  }

  /**
   * Get PASCI matrix
   */
  async getMatrix(entanglementId: string) {
    const entanglement = await this.db.getEntanglement(entanglementId);
    if (!entanglement) {
      throw new NotFoundError('Entanglement', entanglementId);
    }

    return this.db.getMatrix(entanglementId);
  }

  /**
   * Assign zoku to PASCI role
   */
  async assignToMatrix(entanglementId: string, input: unknown): Promise<void> {
    this.requireTier('entangled');

    const data = this.validate(assignToMatrixSchema, input);

    // Verify entanglement exists
    const entanglement = await this.db.getEntanglement(entanglementId);
    if (!entanglement) {
      throw new NotFoundError('Entanglement', entanglementId);
    }

    // Verify zoku exists
    const zoku = await this.db.getZoku(data.zoku_id);
    if (!zoku) {
      throw new NotFoundError('Zoku', data.zoku_id);
    }

    // Validate accountable constraint (warn only)
    if (data.role === 'accountable') {
      const matrix = await this.db.getMatrix(entanglementId);
      if (matrix.accountable.length > 0 && !matrix.accountable.some(e => e.id === data.zoku_id)) {
        this.logger.warn('Multiple accountable entities', undefined, {
          entanglement_id: entanglementId,
          existing: matrix.accountable.map(z => z.id),
          new: data.zoku_id
        });
      }
    }

    await this.db.assignToMatrix(entanglementId, data.zoku_id, data.role);
  }

  /**
   * Remove zoku from PASCI role
   */
  async removeFromMatrix(entanglementId: string, zokuId: string, role: string): Promise<void> {
    this.requireTier('entangled');

    // Check if removing last accountable
    if (role === 'accountable') {
      const matrix = await this.db.getMatrix(entanglementId);
      if (matrix.accountable.length === 1 && matrix.accountable[0].id === zokuId) {
        throw new ValidationError(
          'Cannot remove last Accountable. Entanglement must have exactly one Accountable.'
        );
      }
    }

    await this.db.removeFromMatrix(entanglementId, zokuId, role);
  }

  /**
   * Get attributes
   */
  async getAttributes(id: string) {
    const entanglement = await this.db.getEntanglement(id);
    if (!entanglement) {
      throw new NotFoundError('Entanglement', id);
    }

    const attributes = await this.db.getEntanglementAttributes(id);
    const dimensions = await this.db.listDimensions();
    const dimensionValues = await this.db.getAllDimensionValues();

    const attributesMap: Record<string, any> = {};
    for (const attr of attributes) {
      const dimension = dimensions.find(d => d.id === attr.dimension_id);
      const value = dimensionValues.find(v => v.id === attr.value_id);
      if (dimension && value) {
        if (!attributesMap[dimension.name]) {
          attributesMap[dimension.name] = {
            dimension_id: dimension.id,
            label: dimension.label,
            values: []
          };
        }
        attributesMap[dimension.name].values.push({
          id: value.id,
          value: value.value,
          label: value.label
        });
      }
    }

    return { entanglement_id: id, attributes: attributesMap };
  }

  /**
   * List sources for entanglement
   */
  async listSources(id: string) {
    const entanglement = await this.db.getEntanglement(id);
    if (!entanglement) {
      throw new NotFoundError('Entanglement', id);
    }

    return this.db.listSources(id);
  }
}
