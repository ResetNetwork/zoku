import type { SourceHandler } from './index';
import type { QuptInput } from '../types';
import { refreshGoogleAccessToken } from './google-auth';

export const gdriveHandler: SourceHandler = {
  async collect({ source, config, credentials, since, cursor }) {
    const { document_id, track_comments = true } = config;

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
          source: 'gdrive',
          external_id: `gdrive:${document_id}:rev:${revision.id}`,
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

      // Fetch comments if enabled
      if (track_comments) {
        console.log(`📝 Fetching comments for ${document_id}...`);
        const commentsResponse = await fetch(
          `https://www.googleapis.com/drive/v3/files/${document_id}/comments?fields=comments(id,content,createdTime,author,resolved,quotedFileContent)&pageSize=100`,
          { headers }
        );

        if (commentsResponse.ok) {
          const commentsData = await commentsResponse.json() as { comments?: any[] };

          for (const comment of commentsData.comments || []) {
            const commentTime = new Date(comment.createdTime).getTime() / 1000;

            // Skip if before last sync time
            if (since && commentTime <= since) continue;

            qupts.push({
              volition_id: source.volition_id,
              content: formatCommentContent(comment, docTitle),
              source: 'gdrive',
              external_id: `gdrive:${document_id}:comment:${comment.id}`,
              metadata: {
                type: 'comment',
                document_id,
                document_title: docTitle,
                comment_id: comment.id,
                author: comment.author?.displayName,
                author_email: comment.author?.emailAddress,
                resolved: comment.resolved || false,
                quoted_content: comment.quotedFileContent?.value,
                url: `https://docs.google.com/document/d/${document_id}/edit`
              },
              created_at: Math.floor(commentTime)
            });
          }
          console.log(`📝 Collected ${commentsData.comments?.length || 0} comments`);
        } else {
          console.warn(`Could not fetch comments: ${commentsResponse.status}`);
        }
      }

      // Use highest revision ID as cursor
      const maxRevisionId = revisionsData.revisions?.length
        ? Math.max(...revisionsData.revisions.map((r: any) => parseInt(r.id)))
        : lastProcessedId;

      console.log(`Google Drive handler collected ${qupts.length} qupts for document ${document_id} (${revisionsData.revisions?.length || 0} revisions, ${track_comments ? 'comments enabled' : 'comments disabled'})`);
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

function formatCommentContent(comment: any, docTitle: string): string {
  const author = comment.author?.displayName || 'Someone';
  const preview = comment.content.substring(0, 100) + (comment.content.length > 100 ? '...' : '');
  return `${author} commented on "${docTitle}": ${preview}`;
}
