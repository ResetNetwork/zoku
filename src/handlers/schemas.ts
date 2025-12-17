import { z } from 'zod';

/**
 * Zod schemas for validating external API responses
 * 
 * These schemas provide runtime type safety for data from external sources:
 * - GitHub API
 * - Zammad API
 * - Google Drive API
 * - Gmail API
 * 
 * All schemas are defensive (use .catch() for optional fields) to handle
 * API changes gracefully without breaking sync.
 */

// ============================================================================
// GitHub API Schemas
// ============================================================================

const GitHubUserSchema = z.object({
  login: z.string().catch('unknown'),
  id: z.number().optional(),
  type: z.string().optional(),
});

const GitHubCommitSchema = z.object({
  sha: z.string(),
  commit: z.object({
    message: z.string().catch(''),
    author: z.object({
      name: z.string().optional(),
      email: z.string().optional(),
      date: z.string().optional(),
    }).optional(),
  }).optional(),
  html_url: z.string().optional(),
});

const GitHubPullRequestSchema = z.object({
  number: z.number(),
  title: z.string().catch(''),
  state: z.string().catch('open'),
  html_url: z.string().optional(),
  user: GitHubUserSchema.optional(),
  body: z.string().nullable().optional(),
  merged: z.boolean().optional(),
  draft: z.boolean().optional(),
  created_at: z.string().optional(),
  updated_at: z.string().optional(),
});

const GitHubIssueSchema = z.object({
  number: z.number(),
  title: z.string().catch(''),
  state: z.string().catch('open'),
  html_url: z.string().optional(),
  user: GitHubUserSchema.optional(),
  body: z.string().nullable().optional(),
});

const GitHubEventPayloadSchema = z.object({
  ref: z.string().optional(),
  ref_type: z.string().optional(),
  action: z.string().optional(),
  head: z.string().optional(),
  size: z.number().optional(),
  commits: z.array(z.object({
    sha: z.string().optional(),
    message: z.string().optional(),
  })).optional(),
  pull_request: z.object({
    number: z.number().optional(),
    title: z.string().optional(),
    html_url: z.string().optional(),
  }).optional(),
  issue: z.object({
    number: z.number().optional(),
    title: z.string().optional(),
    html_url: z.string().optional(),
  }).optional(),
  comment: z.object({
    body: z.string().optional(),
  }).optional(),
}).passthrough(); // Allow extra fields we don't care about

export const GitHubEventSchema = z.object({
  id: z.string(),
  type: z.string(),
  actor: GitHubUserSchema.optional(),
  repo: z.object({
    id: z.number().optional(),
    name: z.string().optional(),
    url: z.string().optional(),
  }).optional(),
  payload: GitHubEventPayloadSchema.catch({}),
  public: z.boolean().optional(),
  created_at: z.string(),
});

export const GitHubEventsArraySchema = z.array(GitHubEventSchema);
export const GitHubCommitDetailSchema = GitHubCommitSchema;
export const GitHubPRDetailSchema = GitHubPullRequestSchema;

// ============================================================================
// Zammad API Schemas
// ============================================================================

const ZammadArticleSchema = z.object({
  id: z.number(),
  ticket_id: z.number(),
  from: z.string().nullable().catch(null),
  to: z.string().nullable().catch(null),
  subject: z.string().nullable().catch(null),
  body: z.string().catch(''),
  content_type: z.string().optional(),
  type: z.string().catch('note'),
  internal: z.boolean().optional(),
  sender: z.string().optional(),
  created_at: z.string(),
  updated_at: z.string().optional(),
  created_by_id: z.number().optional(),
});

export const ZammadTicketSchema = z.object({
  id: z.number(),
  number: z.number().catch(0),
  title: z.string().catch(''),
  state_id: z.number().optional(),
  state: z.string().optional(),
  priority_id: z.number().optional(),
  priority: z.string().optional(),
  group_id: z.number().optional(),
  group: z.string().optional(),
  owner_id: z.number().optional(),
  owner: z.string().optional(),
  customer_id: z.number().optional(),
  customer: z.string().optional(),
  note: z.string().nullable().catch(null),
  body: z.string().nullable().catch(null),
  created_at: z.string(),
  updated_at: z.string(),
});

export const ZammadTicketsArraySchema = z.array(ZammadTicketSchema);
export const ZammadArticlesArraySchema = z.array(ZammadArticleSchema);

// Zammad can return tickets as array or wrapped in assets object
export const ZammadSearchResponseSchema = z.union([
  z.array(ZammadTicketSchema),
  z.object({
    assets: z.object({
      Ticket: z.record(ZammadTicketSchema).optional(),
    }).optional(),
  }).passthrough(),
]);

// ============================================================================
// Google Drive API Schemas
// ============================================================================

const GoogleDriveUserSchema = z.object({
  displayName: z.string().catch('Unknown'),
  emailAddress: z.string().optional(),
  photoLink: z.string().optional(),
});

export const GoogleDriveFileSchema = z.object({
  id: z.string(),
  name: z.string().catch('Untitled'),
  mimeType: z.string(),
  createdTime: z.string().optional(),
  modifiedTime: z.string(),
  owners: z.array(GoogleDriveUserSchema).optional(),
  lastModifyingUser: GoogleDriveUserSchema.optional(),
  webViewLink: z.string().optional(),
  iconLink: z.string().optional(),
  size: z.string().optional(),
  trashed: z.boolean().optional(),
  parents: z.array(z.string()).optional(),
});

export const GoogleDriveRevisionSchema = z.object({
  id: z.string(),
  modifiedTime: z.string(),
  lastModifyingUser: GoogleDriveUserSchema.optional(),
  keepForever: z.boolean().optional(),
  published: z.boolean().optional(),
  size: z.string().optional(),
});

export const GoogleDriveCommentSchema = z.object({
  id: z.string(),
  content: z.string().catch(''),
  author: GoogleDriveUserSchema.optional(),
  createdTime: z.string(),
  modifiedTime: z.string().optional(),
  deleted: z.boolean().optional(),
  resolved: z.boolean().optional(),
  quotedFileContent: z.object({
    value: z.string().optional(),
  }).optional(),
  replies: z.array(z.object({
    id: z.string(),
    content: z.string().catch(''),
    author: GoogleDriveUserSchema.optional(),
    createdTime: z.string(),
  })).optional(),
});

export const GoogleDriveChangesListSchema = z.object({
  changes: z.array(z.object({
    changeType: z.string(),
    time: z.string(),
    removed: z.boolean().optional(),
    file: GoogleDriveFileSchema.optional(),
    fileId: z.string().optional(),
    driveId: z.string().optional(),
    type: z.string().optional(),
  })),
  newStartPageToken: z.string().optional(),
  nextPageToken: z.string().optional(),
});

export const GoogleDriveFilesListSchema = z.object({
  files: z.array(GoogleDriveFileSchema),
  nextPageToken: z.string().optional(),
});

export const GoogleDriveRevisionsListSchema = z.object({
  revisions: z.array(GoogleDriveRevisionSchema),
  nextPageToken: z.string().optional(),
});

export const GoogleDriveCommentsListSchema = z.object({
  comments: z.array(GoogleDriveCommentSchema),
  nextPageToken: z.string().optional(),
});

// ============================================================================
// Gmail API Schemas
// ============================================================================

const GmailHeaderSchema = z.object({
  name: z.string(),
  value: z.string(),
});

const GmailPartSchema: z.ZodType<any> = z.lazy(() => z.object({
  partId: z.string().optional(),
  mimeType: z.string().optional(),
  filename: z.string().optional(),
  headers: z.array(GmailHeaderSchema).optional(),
  body: z.object({
    size: z.number().optional(),
    data: z.string().optional(),
  }).optional(),
  parts: z.array(GmailPartSchema).optional(),
}).passthrough());

export const GmailMessageSchema = z.object({
  id: z.string(),
  threadId: z.string(),
  labelIds: z.array(z.string()).optional(),
  snippet: z.string().catch(''),
  payload: z.object({
    partId: z.string().optional(),
    mimeType: z.string().optional(),
    filename: z.string().optional(),
    headers: z.array(GmailHeaderSchema).optional(),
    body: z.object({
      size: z.number().optional(),
      data: z.string().optional(),
    }).optional(),
    parts: z.array(GmailPartSchema).optional(),
  }).optional(),
  sizeEstimate: z.number().optional(),
  historyId: z.string().optional(),
  internalDate: z.string(),
});

export const GmailMessagesListSchema = z.object({
  messages: z.array(z.object({
    id: z.string(),
    threadId: z.string(),
  })).optional().catch([]),
  nextPageToken: z.string().optional(),
  resultSizeEstimate: z.number().optional(),
});

// ============================================================================
// Helper types
// ============================================================================

export type GitHubEvent = z.infer<typeof GitHubEventSchema>;
export type GitHubCommit = z.infer<typeof GitHubCommitDetailSchema>;
export type GitHubPullRequest = z.infer<typeof GitHubPRDetailSchema>;
export type ZammadTicket = z.infer<typeof ZammadTicketSchema>;
export type ZammadArticle = z.infer<typeof ZammadArticleSchema>;
export type GoogleDriveFile = z.infer<typeof GoogleDriveFileSchema>;
export type GoogleDriveRevision = z.infer<typeof GoogleDriveRevisionSchema>;
export type GoogleDriveComment = z.infer<typeof GoogleDriveCommentSchema>;
export type GmailMessage = z.infer<typeof GmailMessageSchema>;
