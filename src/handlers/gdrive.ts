import type { SourceHandler } from './index';
import type { QuptInput } from '../types';
import { refreshGoogleAccessToken } from './google-auth';

export const gdriveHandler: SourceHandler = {
  async collect({ source, config, credentials, since, cursor }) {
    const { 
      mode = 'document',
      document_id, 
      folder_id,
      track_comments = true,
      track_revisions = true,
      track_new_files = true
    } = config;

    const qupts: QuptInput[] = [];

    try {
      console.log(`📄 Fetching Google Drive (mode: ${mode})`);

      const accessToken = await refreshGoogleAccessToken(credentials);
      console.log('✅ Got access token');

      const headers = {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json'
      };

      // Route based on mode
      if (mode === 'folder' && folder_id) {
        // Folder mode: List new files
        if (track_new_files) {
          await collectFolderFiles(source, folder_id, headers, since, qupts);
        }
        console.log(`Google Drive handler collected ${qupts.length} qupts for folder ${folder_id}`);
        return { qupts };
      } else if (mode === 'document' && document_id) {
        // Document mode: Track revisions and comments
        await collectDocumentActivity(source, document_id, headers, since, cursor, track_revisions, track_comments, qupts);
        const maxRevisionId = qupts
          .filter(q => q.metadata?.type === 'revision')
          .reduce((max, q) => Math.max(max, parseInt(q.metadata?.revision_id || '0')), cursor ? parseInt(cursor) : 0);
        
        console.log(`Google Drive handler collected ${qupts.length} qupts for document ${document_id}`);
        return { qupts, cursor: String(maxRevisionId) };
      } else {
        throw new Error(`Invalid configuration: mode=${mode}, document_id=${document_id}, folder_id=${folder_id}`);
      }
    } catch (error) {
      console.error(`Google Drive handler error for source ${source.id}:`, error);
      throw error;
    }
  }
};

// Collect new files from a folder
async function collectFolderFiles(
  source: any,
  folder_id: string,
  headers: any,
  since: number | undefined,
  qupts: QuptInput[]
) {
  console.log(`📁 Listing files in folder ${folder_id}...`);
  
  // Build query: files in this folder, created after 'since'
  // If no since (initial sync), get files from last 30 days
  let query = `'${folder_id}' in parents and trashed = false`;
  if (since) {
    // Use >= instead of > to catch files created at the same second
    // Subtract 1 second to avoid missing files during sync timing
    const sinceDate = new Date((since - 1) * 1000).toISOString();
    query += ` and createdTime > '${sinceDate}'`;
    console.log(`📁 Incremental sync since: ${sinceDate} (${since - 1})`);
  } else {
    // Initial sync: get files from last 30 days
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
    query += ` and createdTime > '${thirtyDaysAgo}'`;
    console.log(`📁 Initial sync: getting files from last 30 days (since ${thirtyDaysAgo})`);
  }
  
  console.log(`📁 Query: ${query}`);
  
  // Build API URL with shared drives support
  const apiUrl = new URL('https://www.googleapis.com/drive/v3/files');
  apiUrl.searchParams.set('q', query);
  apiUrl.searchParams.set('fields', 'files(id,name,mimeType,createdTime,owners,webViewLink)');
  apiUrl.searchParams.set('pageSize', '100');
  apiUrl.searchParams.set('orderBy', 'createdTime desc');
  apiUrl.searchParams.set('supportsAllDrives', 'true');
  apiUrl.searchParams.set('includeItemsFromAllDrives', 'true');
  apiUrl.searchParams.set('corpora', 'allDrives');
  
  console.log(`📁 API URL: ${apiUrl.toString()}`);
  
  const filesResponse = await fetch(apiUrl.toString(), { headers });

  console.log(`📁 API Response status: ${filesResponse.status}`);
  
  if (!filesResponse.ok) {
    const errorText = await filesResponse.text();
    console.error(`❌ Google Drive API error: ${errorText}`);
    throw new Error(`Google Drive API error (${filesResponse.status}): ${errorText}`);
  }

  const filesData = await filesResponse.json() as { files?: any[] };
  console.log(`📁 Found ${filesData.files?.length || 0} new files`);
  
  if (filesData.files && filesData.files.length > 0) {
    console.log(`📁 First file: ${filesData.files[0].name} (created: ${filesData.files[0].createdTime})`);
  }

  for (const file of filesData.files || []) {
    const createdTime = new Date(file.createdTime).getTime() / 1000;
    
    qupts.push({
      entanglement_id: source.entanglement_id,
      content: `New file: ${file.name}`,
      source: 'gdrive',
      external_id: `gdrive:folder:${folder_id}:file:${file.id}`,
      metadata: {
        type: 'new_file',
        folder_id,
        file_id: file.id,
        file_name: file.name,
        mime_type: file.mimeType,
        created_by: file.owners?.[0]?.displayName,
        created_by_email: file.owners?.[0]?.emailAddress,
        url: file.webViewLink
      },
      created_at: Math.floor(createdTime)
    });
  }
}

// Collect revisions and comments from a single document
async function collectDocumentActivity(
  source: any,
  document_id: string,
  headers: any,
  since: number | undefined,
  cursor: string | undefined,
  track_revisions: boolean,
  track_comments: boolean,
  qupts: QuptInput[]
) {
  // Get document title
  const docResponse = await fetch(
    `https://docs.googleapis.com/v1/documents/${document_id}?fields=title`,
    { headers }
  );

  if (!docResponse.ok) {
    const errorText = await docResponse.text();
    throw new Error(`Google Docs API error (${docResponse.status}): ${errorText}`);
  }

  const doc = await docResponse.json() as { title: string };
  const docTitle = doc.title;
  const lastProcessedId = cursor ? parseInt(cursor) : 0;

  // Fetch revisions
  if (track_revisions) {
    const revisionsResponse = await fetch(
      `https://www.googleapis.com/drive/v3/files/${document_id}/revisions?fields=revisions(id,modifiedTime,lastModifyingUser)&pageSize=100`,
      { headers }
    );

    if (revisionsResponse.ok) {
      const revisionsData = await revisionsResponse.json() as { revisions?: any[] };

      for (const revision of revisionsData.revisions || []) {
        const revisionId = parseInt(revision.id);
        const revisionTime = new Date(revision.modifiedTime).getTime() / 1000;

        if (revisionId <= lastProcessedId) continue;
        if (since && revisionTime <= since) continue;

        qupts.push({
          entanglement_id: source.entanglement_id,
          content: `${docTitle}: Edited by ${revision.lastModifyingUser?.displayName || 'Someone'}`,
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
    }
  }

  // Fetch comments
  if (track_comments) {
    const commentsResponse = await fetch(
      `https://www.googleapis.com/drive/v3/files/${document_id}/comments?fields=comments(id,content,createdTime,author,resolved)&pageSize=100`,
      { headers }
    );

    if (commentsResponse.ok) {
      const commentsData = await commentsResponse.json() as { comments?: any[] };

      for (const comment of commentsData.comments || []) {
        const commentTime = new Date(comment.createdTime).getTime() / 1000;

        if (since && commentTime <= since) continue;

        qupts.push({
          entanglement_id: source.entanglement_id,
          content: `${docTitle}: Comment by ${comment.author?.displayName || 'Someone'}`,
          source: 'gdrive',
          external_id: `gdrive:${document_id}:comment:${comment.id}`,
          metadata: {
            type: 'comment',
            document_id,
            document_title: docTitle,
            comment_id: comment.id,
            comment_text: comment.content,
            author: comment.author?.displayName,
            author_email: comment.author?.emailAddress,
            resolved: comment.resolved,
            url: `https://docs.google.com/document/d/${document_id}/edit`
          },
          created_at: Math.floor(commentTime)
        });
      }
    }
  }
}
