import type { SourceHandler } from './index';
import type { QuptInput } from '../types';
import { refreshGoogleAccessToken } from './google-auth';

export const gdocsHandler: SourceHandler = {
  async collect({ source, config, credentials, since, cursor }) {
    const { document_id, track_suggestions = false } = config;

    const qupts: QuptInput[] = [];

    try {
      console.log(`📄 Fetching Google Doc: ${document_id}`);

      // Credentials now include client_id and client_secret from user's Google Cloud project
      const accessToken = await refreshGoogleAccessToken(credentials);
      console.log('✅ Got access token');

      const headers = {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json'
      };

      // Get document metadata for title
      const docResponse = await fetch(
        `https://docs.googleapis.com/v1/documents/${document_id}?fields=title`,
        { headers }
      );

      console.log(`📡 Document fetch status: ${docResponse.status}`);

      if (!docResponse.ok) {
        const errorText = await docResponse.text();
        console.error(`❌ Google Docs API error (${docResponse.status}):`, errorText);
        throw new Error(`Google Docs API error (${docResponse.status}): ${errorText}`);
      }

      const doc = await docResponse.json() as { title: string };
      const docTitle = doc.title;

      // Fetch revisions from Drive API
      const revisionsResponse = await fetch(
        `https://www.googleapis.com/drive/v3/files/${document_id}/revisions?fields=revisions(id,modifiedTime,lastModifyingUser)&pageSize=100`,
        { headers }
      );

      if (!revisionsResponse.ok) {
        const errorText = await revisionsResponse.text();
        throw new Error(`Google Drive API error (${revisionsResponse.status}): ${errorText}`);
      }

      const revisionsData = await revisionsResponse.json() as { revisions?: any[] };
      const lastProcessedId = cursor ? parseInt(cursor) : 0;

      for (const revision of revisionsData.revisions || []) {
        const revisionId = parseInt(revision.id);
        const revisionTime = new Date(revision.modifiedTime).getTime() / 1000;

        // Skip already processed revisions
        if (revisionId <= lastProcessedId) continue;

        // Skip if before last sync time
        if (since && revisionTime <= since) continue;

        qupts.push({
          volition_id: source.volition_id,
          content: formatRevisionContent(revision, docTitle),
          source: 'gdocs',
          external_id: `gdocs:${document_id}:rev:${revision.id}`,
          metadata: {
            type: 'revision',
            document_id,
            document_title: docTitle,
            revision_id: revision.id,
            modified_by: revision.lastModifyingUser?.displayName,
            modified_by_email: revision.lastModifyingUser?.emailAddress,
            url: `https://docs.google.com/document/d/${document_id}/edit`
          },
          created_at: Math.floor(revisionTime)
        });
      }

      // Track suggestions if enabled (simplified - full implementation would need document API)
      if (track_suggestions) {
        // Note: Suggestions tracking would require parsing document content
        // For now, we'll just log that it's not fully implemented
        console.log(`Suggestions tracking requested for ${document_id} but not yet fully implemented`);
      }

      // Use highest revision ID as cursor
      const maxRevisionId = revisionsData.revisions?.length
        ? Math.max(...revisionsData.revisions.map((r: any) => parseInt(r.id)))
        : lastProcessedId;

      console.log(`Google Docs handler collected ${qupts.length} qupts for document ${document_id}`);
      return { qupts, cursor: String(maxRevisionId) };
    } catch (error) {
      console.error(`Google Docs handler error for source ${source.id}:`, error);
      // Re-throw so sync endpoint can catch and store the error
      throw error;
    }
  }
};

function formatRevisionContent(revision: any, docTitle: string): string {
  const user = revision.lastModifyingUser?.displayName || 'Someone';
  return `${user} edited "${docTitle}"`;
}
