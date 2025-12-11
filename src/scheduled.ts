// Scheduled handler for source collection

import type { Bindings } from './types';
import { DB } from './db';
import { handlers } from './handlers';
import { decryptCredentials } from './lib/crypto';

export async function handleScheduled(
  event: ScheduledEvent,
  env: Bindings,
  ctx: ExecutionContext
): Promise<void> {
  console.log('Scheduled handler triggered:', event.cron);

  const db = new DB(env.DB);

  try {
    // Get all enabled sources
    const sources = await db.getEnabledSources();
    console.log(`Processing ${sources.length} enabled sources`);

    // Process each source
    const results = await Promise.allSettled(
      sources.map(async (source) => {
        const handler = handlers[source.type];
        if (!handler) {
          console.warn(`No handler for source type: ${source.type}`);
          return { source_id: source.id, error: 'No handler' };
        }

        try {
          const config = JSON.parse(source.config);

          // Decrypt credentials before use
          const credentials = source.credentials
            ? JSON.parse(await decryptCredentials(source.credentials, env.ENCRYPTION_KEY))
            : {};

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
            console.log(`Inserted ${qupts.length} qupts for source ${source.id}`);
          }

          // Update sync state
          await db.updateSource(source.id, {
            last_sync: Math.floor(Date.now() / 1000),
            sync_cursor: cursor
          });

          return { source_id: source.id, count: qupts.length, success: true };
        } catch (error) {
          console.error(`Error processing source ${source.id} (${source.type}):`, error);
          // Don't update last_sync on error - will retry next time
          return {
            source_id: source.id,
            error: error instanceof Error ? error.message : String(error),
            success: false
          };
        }
      })
    );

    // Log summary
    const successful = results.filter(r => r.status === 'fulfilled' && r.value.success).length;
    const failed = results.length - successful;
    console.log(`Sync complete: ${successful} successful, ${failed} failed`);

    // Log individual results
    for (const result of results) {
      if (result.status === 'fulfilled') {
        if (result.value.success) {
          console.log(`✓ Source ${result.value.source_id}: ${result.value.count} qupts`);
        } else {
          console.error(`✗ Source ${result.value.source_id}: ${result.value.error}`);
        }
      } else {
        console.error(`✗ Source processing failed:`, result.reason);
      }
    }
  } catch (error) {
    console.error('Scheduled handler error:', error);
  }
}
