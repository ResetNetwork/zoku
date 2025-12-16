import { DB } from '../db';
import type { Zoku } from '../types';
import { Logger } from '../lib/logger';
import { ForbiddenError } from '../lib/errors';

/**
 * Base class for all services
 * Provides common functionality: validation, authorization, logging
 */
export abstract class BaseService {
  protected db: DB;
  protected user: Zoku;
  protected logger: Logger;
  protected requestId?: string;

  constructor(db: DB, user: Zoku, logger: Logger, requestId?: string) {
    this.db = db;
    this.user = user;
    this.logger = logger;
    this.requestId = requestId;
  }

  /**
   * Validate input against Zod schema
   * Throws ZodError on validation failure
   */
  protected validate<T>(schema: { parse: (data: any) => T }, data: unknown): T {
    return schema.parse(data);
  }

  /**
   * Check user has minimum tier
   * Throws ForbiddenError if insufficient
   */
  protected requireTier(minTier: 'coherent' | 'entangled' | 'prime') {
    const tierLevels = {
      observed: 0,
      coherent: 1,
      entangled: 2,
      prime: 3
    };

    const userLevel = tierLevels[this.user.access_tier];
    const requiredLevel = tierLevels[minTier];

    if (userLevel < requiredLevel) {
      throw new ForbiddenError(
        `This action requires ${minTier} access or higher. You have ${this.user.access_tier} access.`
      );
    }
  }

  /**
   * Create audit log entry
   */
  protected async audit(action: string, resourceType: string, resourceId: string, details?: any) {
    await this.db.createAuditLog({
      zoku_id: this.user.id,
      action,
      resource_type: resourceType,
      resource_id: resourceId,
      details: details ? JSON.stringify(details) : null,
      request_id: this.requestId
    });
  }
}
