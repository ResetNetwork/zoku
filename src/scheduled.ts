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

          // Get credentials - either from credential_id or inline
          let credentials = {};
          if (source.credential_id) {
            const credential = await db.getCredential(source.credential_id);
            if (!credential) {
              console.error(`Credential ${source.credential_id} not found for source ${source.id}`);
              return { source_id: source.id, error: 'Credential not found', success: false };
            }
            credentials = JSON.parse(await decryptCredentials(credential.data, env.ENCRYPTION_KEY));
          } else if (source.credentials) {
            credentials = JSON.parse(await decryptCredentials(source.credentials, env.ENCRYPTION_KEY));
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
            console.log(`Inserted ${qupts.length} qupts for source ${source.id}`);
          }

          // Update sync state - clear errors on success
          await db.updateSource(source.id, {
            last_sync: Math.floor(Date.now() / 1000),
            sync_cursor: cursor,
            last_error: null,
            error_count: 0,
            last_error_at: null
          });

          return { source_id: source.id, count: qupts.length, success: true };
        } catch (error) {
          console.error(`Error processing source ${source.id} (${source.type}):`, error);

          // Track error with user-friendly message
          let errorMessage = error instanceof Error ? error.message : String(error);
          const currentErrorCount = source.error_count || 0;

          // Clean up Google Docs errors
          if (errorMessage.includes('403') && errorMessage.includes('does not have permission')) {
            errorMessage = 'Access denied. Grant access to the Google account and re-sync.';
          }

          await db.updateSource(source.id, {
            last_error: errorMessage,
            error_count: currentErrorCount + 1,
            last_error_at: Math.floor(Date.now() / 1000)
          });

          // Don't update last_sync on error - will retry next time
          return {
            source_id: source.id,
            error: errorMessage,
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
