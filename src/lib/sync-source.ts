// Source synchronization utility
import { DB } from '../db';
import { Logger } from './logger';
import { handlers } from '../handlers';
import { decryptJewel } from './crypto';
import type { Source, Env } from '../types';

/**
 * Synchronize a single source
 * Used by both scheduled sync and manual sync trigger
 */
export async function syncSource(db: DB, source: Source, env: Env, logger: Logger): Promise<void> {
  const handler = handlers[source.type];
  if (!handler) {
    throw new Error(`No handler for source type: ${source.type}`);
  }

  const config = JSON.parse(source.config);
  
  // Decrypt credentials
  let credentials: any = {};
  if (source.jewel_id) {
    const jewel = await db.getJewel(source.jewel_id);
    if (!jewel) {
      throw new Error('Jewel not found');
    }
    credentials = JSON.parse(await decryptJewel(jewel.data, env.ENCRYPTION_KEY));
  } else if (source.credentials) {
    credentials = JSON.parse(await decryptJewel(source.credentials, env.ENCRYPTION_KEY));
  }

  // Fetch new activity
  const { qupts, cursor } = await handler.collect({
    source,
    config,
    credentials,
    since: source.last_sync,
    cursor: source.sync_cursor
  });

  if (qupts.length > 0) {
    // Batch insert qupts with deduplication
    await db.batchCreateQupts(qupts);
    
    logger.info('Source sync completed', {
      source_id: source.id,
      qupts_count: qupts.length
    });
  }

  // Update source with new cursor and last_sync
  await db.updateSource(source.id, {
    last_sync: Math.floor(Date.now() / 1000),
    sync_cursor: cursor,
    last_error: null,
    error_count: 0,
    last_error_at: null
  });
}
