// Scheduled handler for source collection

import type { Bindings } from './types';
import { DB } from './db';
import { handlers } from './handlers';
import { decryptJewel } from './lib/crypto';
import { Logger, LogLevel } from './lib/logger';

export async function handleScheduled(
  event: ScheduledEvent,
  env: Bindings,
  ctx: ExecutionContext
): Promise<void> {
  // Generate request ID and create logger
  const requestId = `cron-${Date.now().toString(36)}`;
  const logLevel = (env?.LOG_LEVEL as LogLevel) || 'info';
  const logger = new Logger({
    request_id: requestId,
    operation: 'scheduled_sync',
  }, logLevel);

  logger.info('Scheduled sync started', { cron: event.cron });

  const db = new DB(env.DB);

  try {
    // Get all enabled sources
    const sources = await db.getEnabledSources();
    logger.info('Processing sources', { count: sources.length });

    // Process each source
    const results = await Promise.allSettled(
      sources.map(async (source) => {
        // Create child logger for this source
        const sourceLogger = logger.child({
          operation: 'source_sync',
          source_id: source.id,
          source_type: source.type,
          entanglement_id: source.entanglement_id
        });

        const handler = handlers[source.type];
        if (!handler) {
          sourceLogger.warn('No handler for source type');
          return { source_id: source.id, error: 'No handler' };
        }

        sourceLogger.info('Source sync started');
        const startTime = Date.now();

        try {
          const config = JSON.parse(source.config);

          // Get credentials - either from jewel_id or inline
          let credentials = {};
          if (source.jewel_id) {
            const jewel = await db.getJewel(source.jewel_id);
            if (!jewel) {
              sourceLogger.error('Jewel not found', undefined, { jewel_id: source.jewel_id });
              return { source_id: source.id, error: 'Jewel not found', success: false };
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
          }

          // Update sync state - clear errors on success
          await db.updateSource(source.id, {
            last_sync: Math.floor(Date.now() / 1000),
            sync_cursor: cursor,
            last_error: null,
            error_count: 0,
            last_error_at: null
          });

          const duration = Date.now() - startTime;
          sourceLogger.info('Source sync completed', {
            duration_ms: duration,
            qupts_count: qupts.length
          });

          return { source_id: source.id, count: qupts.length, success: true };
        } catch (error) {
          const duration = Date.now() - startTime;

          // Track error with user-friendly message
          let errorMessage = error instanceof Error ? error.message : String(error);
          const currentErrorCount = source.error_count || 0;

          // Clean up Google Docs errors
          if (errorMessage.includes('403') && errorMessage.includes('does not have permission')) {
            errorMessage = 'Access denied. Grant access to the Google account and re-sync.';
          }

          sourceLogger.error('Source sync failed', error as Error, {
            duration_ms: duration,
            error_count: currentErrorCount + 1
          });

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

    logger.info('Scheduled sync completed', {
      total: results.length,
      successful,
      failed
    });

  } catch (error) {
    logger.error('Scheduled sync failed', error as Error);
  }
}
