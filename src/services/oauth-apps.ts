import { BaseService } from './base';
import type { Env, OAuthApplication, Zoku } from '../types';
import { encryptJewel, decryptJewel } from '../lib/crypto';
import { DB } from '../db';
import type { Logger } from '../lib/logger';

/**
 * Service for managing OAuth Applications (centralized OAuth credentials)
 * Prime tier only - admins configure OAuth apps for the entire instance
 */
export class OAuthApplicationService extends BaseService {
  private env: Env;

  constructor(db: DB, user: Zoku, logger: Logger, requestId: string | undefined, env: Env) {
    super(db, user, logger, requestId);
    this.env = env;
  }

  /**
   * List all OAuth applications (decrypted client_secret for prime tier only)
   */
  async list(options: { provider?: string; decrypt?: boolean } = {}): Promise<OAuthApplication[]> {
    // Only prime tier can view OAuth applications
    this.requireTier('prime');

    this.logger.info('Listing OAuth applications', { provider: options.provider });

    let query = 'SELECT * FROM oauth_applications';
    const params: any[] = [];

    if (options.provider) {
      query += ' WHERE provider = ?';
      params.push(options.provider);
    }

    query += ' ORDER BY created_at DESC';

    const stmt = this.db.d1.prepare(query);
    if (params.length > 0) {
      stmt.bind(...params);
    }
    const result = await stmt.all();
    const results = result.results as OAuthApplication[];

    // Decrypt client_secret if requested (prime tier only)
    if (options.decrypt) {
      for (const app of results) {
        try {
          app.client_secret = decryptJewel(app.client_secret, this.env.ENCRYPTION_KEY);
        } catch (error) {
          this.logger.error('Failed to decrypt client_secret', { oauth_app_id: app.id, error });
          app.client_secret = '[DECRYPTION_FAILED]';
        }
      }
    } else {
      // Hide client_secret by default
      for (const app of results) {
        app.client_secret = '[ENCRYPTED]';
      }
    }

    // Parse JSON fields
    for (const app of results) {
      app.scopes = JSON.parse(app.scopes as any);
      if (app.metadata) {
        app.metadata = JSON.parse(app.metadata as any);
      }
    }

    this.logger.info('OAuth applications listed', { count: results.length });
    return results;
  }

  /**
   * Get single OAuth application
   */
  async get(id: string, options: { decrypt?: boolean } = {}): Promise<OAuthApplication | null> {
    this.requireTier('prime');

    this.logger.info('Getting OAuth application', { oauth_app_id: id });

    const result = await this.db.d1
      .prepare('SELECT * FROM oauth_applications WHERE id = ?')
      .bind(id)
      .first();

    if (!result) {
      this.logger.info('OAuth application not found', { oauth_app_id: id });
      return null;
    }

    const app = result as OAuthApplication;

    // Decrypt client_secret if requested
    if (options.decrypt) {
      try {
        app.client_secret = decryptJewel(app.client_secret, this.env.ENCRYPTION_KEY);
      } catch (error) {
        this.logger.error('Failed to decrypt client_secret', { oauth_app_id: id, error });
        app.client_secret = '[DECRYPTION_FAILED]';
      }
    } else {
      app.client_secret = '[ENCRYPTED]';
    }

    // Parse JSON fields
    app.scopes = JSON.parse(app.scopes as any);
    if (app.metadata) {
      app.metadata = JSON.parse(app.metadata as any);
    }

    return app;
  }

  /**
   * Create new OAuth application
   */
  async create(input: {
    name: string;
    provider: string;
    client_id: string;
    client_secret: string;
    scopes: string[];
    metadata?: Record<string, any>;
  }): Promise<OAuthApplication> {
    this.requireTier('prime');

    // Validate input
    if (!input.name || !input.provider || !input.client_id || !input.client_secret) {
      throw new Error('Missing required fields: name, provider, client_id, client_secret');
    }

    if (!Array.isArray(input.scopes) || input.scopes.length === 0) {
      throw new Error('Scopes must be a non-empty array');
    }

    this.logger.info('Creating OAuth application', {
      name: input.name,
      provider: input.provider,
      scopes: input.scopes
    });

    const id = `oauth-app-${crypto.randomUUID()}`;
    const now = Math.floor(Date.now() / 1000);

    // Encrypt client_secret
    const encryptedSecret = await encryptJewel(input.client_secret, this.env.ENCRYPTION_KEY);

    await this.db.d1
      .prepare(`INSERT INTO oauth_applications (id, name, provider, client_id, client_secret, scopes, metadata, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`)
      .bind(
        id,
        input.name,
        input.provider,
        input.client_id,
        encryptedSecret,
        JSON.stringify(input.scopes),
        input.metadata ? JSON.stringify(input.metadata) : null,
        now,
        now
      )
      .run();

    // Audit log
    await this.audit('oauth_app_created', 'oauth_application', id, {
      name: input.name,
      provider: input.provider,
      scopes: input.scopes
    });

    this.logger.info('OAuth application created', { oauth_app_id: id });

    return {
      id,
      name: input.name,
      provider: input.provider,
      client_id: input.client_id,
      client_secret: '[ENCRYPTED]',
      scopes: input.scopes,
      metadata: input.metadata || null,
      created_at: now,
      updated_at: now
    };
  }

  /**
   * Update OAuth application
   */
  async update(
    id: string,
    updates: {
      name?: string;
      client_id?: string;
      client_secret?: string;
      scopes?: string[];
      metadata?: Record<string, any>;
    }
  ): Promise<OAuthApplication> {
    this.requireTier('prime');

    this.logger.info('Updating OAuth application', { oauth_app_id: id });

    const existing = await this.get(id);
    if (!existing) {
      throw new Error('OAuth application not found');
    }

    const sets: string[] = [];
    const values: any[] = [];

    if (updates.name !== undefined) {
      sets.push('name = ?');
      values.push(updates.name);
    }

    if (updates.client_id !== undefined) {
      sets.push('client_id = ?');
      values.push(updates.client_id);
    }

    if (updates.client_secret !== undefined) {
      sets.push('client_secret = ?');
      const encrypted = await encryptJewel(updates.client_secret, this.env.ENCRYPTION_KEY);
      values.push(encrypted);
    }

    if (updates.scopes !== undefined) {
      sets.push('scopes = ?');
      values.push(JSON.stringify(updates.scopes));
    }

    if (updates.metadata !== undefined) {
      sets.push('metadata = ?');
      values.push(JSON.stringify(updates.metadata));
    }

    sets.push('updated_at = ?');
    values.push(Math.floor(Date.now() / 1000));

    values.push(id);

    await this.db.d1
      .prepare(`UPDATE oauth_applications SET ${sets.join(', ')} WHERE id = ?`)
      .bind(...values)
      .run();

    // Audit log
    await this.audit('oauth_app_updated', 'oauth_application', id, {
      updates: Object.keys(updates)
    });

    this.logger.info('OAuth application updated', { oauth_app_id: id });

    return (await this.get(id))!;
  }

  /**
   * Delete OAuth application
   */
  async delete(id: string): Promise<void> {
    this.requireTier('prime');

    this.logger.info('Deleting OAuth application', { oauth_app_id: id });

    const existing = await this.get(id);
    if (!existing) {
      throw new Error('OAuth application not found');
    }

    // Check if any jewels are using this OAuth app
    const result = await this.db.d1
      .prepare('SELECT id, name, type FROM jewels WHERE oauth_app_id = ?')
      .bind(id)
      .all();
    const jewelsUsingApp = result.results;

    if (jewelsUsingApp.length > 0) {
      throw new Error(
        `Cannot delete OAuth application: ${jewelsUsingApp.length} jewel(s) are using it. ` +
        `Remove or migrate jewels first: ${jewelsUsingApp.map((j: any) => j.name).join(', ')}`
      );
    }

    await this.db.d1
      .prepare('DELETE FROM oauth_applications WHERE id = ?')
      .bind(id)
      .run();

    // Audit log
    await this.audit('oauth_app_deleted', 'oauth_application', id, {
      name: existing.name,
      provider: existing.provider
    });

    this.logger.info('OAuth application deleted', { oauth_app_id: id });
  }

  /**
   * Get OAuth application by provider (for OAuth flows)
   */
  async getByProvider(provider: string): Promise<OAuthApplication | null> {
    // This method doesn't require prime tier - it's used by OAuth flows
    // But we don't decrypt the secret - that's done server-side only

    this.logger.info('Getting OAuth application by provider', { provider });

    const result = await this.db.d1
      .prepare('SELECT * FROM oauth_applications WHERE provider = ? ORDER BY created_at DESC LIMIT 1')
      .bind(provider)
      .first();

    if (!result) {
      this.logger.info('No OAuth application found for provider', { provider });
      return null;
    }

    const app = result as OAuthApplication;

    // Parse JSON but keep secret encrypted
    app.scopes = JSON.parse(app.scopes as any);
    if (app.metadata) {
      app.metadata = JSON.parse(app.metadata as any);
    }

    return app;
  }

  /**
   * List jewels using this OAuth application
   */
  async listJewelsUsingApp(id: string): Promise<any[]> {
    this.requireTier('prime');

    this.logger.info('Listing jewels using OAuth application', { oauth_app_id: id });

    const result = await this.db.d1
      .prepare(`SELECT id, name, type, owner_id, created_at, updated_at
       FROM jewels
       WHERE oauth_app_id = ?
       ORDER BY created_at DESC`)
      .bind(id)
      .all();

    const jewels = result.results;

    this.logger.info('Jewels using OAuth app listed', {
      oauth_app_id: id,
      count: jewels.length
    });

    return jewels;
  }
}
