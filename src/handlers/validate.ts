// Source validation helpers
import type { Env } from '../types';

export interface ValidationResult {
  valid: boolean;
  warnings: string[];
  errors: string[];
  metadata?: Record<string, any>;
  info?: Record<string, any>;
  error?: string;
}

/**
 * Validate jewel credentials based on type
 * Used by JewelService for credential validation
 */
export async function validateJewel(type: string, data: any, env: Env): Promise<ValidationResult> {
  switch (type) {
    case 'github':
      return await validateGitHubCredential(data);
    case 'zammad':
      return await validateZammadCredential(data);
    case 'gdrive':
      return await validateGoogleDocsCredential(data, data.client_id, data.client_secret);
    case 'gmail':
      return await validateGmailCredential(data, data.client_id, data.client_secret);
    default:
      return {
        valid: false,
        warnings: [],
        errors: [`Unknown jewel type: ${type}`],
        error: `Unknown jewel type: ${type}`
      };
  }
}

/**
 * Validate GitHub credentials only (no repo-specific checks)
 */
export async function validateGitHubCredential(credentials: any): Promise<ValidationResult> {
  const { token } = credentials;

  const warnings: string[] = [];
  const errors: string[] = [];
  const metadata: Record<string, any> = {};

  try {
    // Test: Check if token is valid and get user info
    const userResponse = await fetch('https://api.github.com/user', {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Accept': 'application/vnd.github+json',
        'User-Agent': 'Zoku/1.0',
        'X-GitHub-Api-Version': '2022-11-28'
      }
    });

    if (!userResponse.ok) {
      if (userResponse.status === 401) {
        errors.push('GitHub token is invalid or expired');
        return { valid: false, warnings, errors };
      }
      errors.push(`GitHub API error: ${userResponse.status} ${userResponse.statusText}`);
      return { valid: false, warnings, errors };
    }

    const user = await userResponse.json();
    metadata.authenticated_as = user.login;
    metadata.user_type = user.type;

    // Check token scopes
    const scopes = userResponse.headers.get('X-OAuth-Scopes');
    metadata.scopes = scopes ? scopes.split(', ') : [];

    // Validate recommended scopes
    const recommendedScopes = ['repo', 'public_repo'];
    const hasRecommendedScope = metadata.scopes.some((scope: string) =>
      recommendedScopes.includes(scope) || scope === 'repo'
    );

    if (!hasRecommendedScope) {
      warnings.push(`Token may need 'repo' or 'public_repo' scope for full access. Current scopes: ${metadata.scopes.join(', ')}`);
    }

    // Check rate limit
    const rateLimit = userResponse.headers.get('X-RateLimit-Remaining');
    if (rateLimit) {
      metadata.rate_limit_remaining = parseInt(rateLimit);
      if (metadata.rate_limit_remaining < 100) {
        warnings.push(`GitHub rate limit is low: ${metadata.rate_limit_remaining} requests remaining`);
      }
    }

    return {
      valid: true,
      warnings,
      errors,
      metadata
    };

  } catch (error) {
    errors.push(`Validation error: ${error instanceof Error ? error.message : String(error)}`);
    return { valid: false, warnings, errors };
  }
}

/**
 * Validate GitHub source configuration and token
 */
export async function validateGitHubSource(config: any, credentials: any): Promise<ValidationResult> {
  const { owner, repo } = config;
  const { token } = credentials;

  const warnings: string[] = [];
  const errors: string[] = [];
  const metadata: Record<string, any> = {};

  // First validate the jewel itself
  const jewelValidation = await validateGitHubCredential(credentials);
  if (!jewelValidation.valid) {
    return jewelValidation;
  }

  warnings.push(...jewelValidation.warnings);
  Object.assign(metadata, jewelValidation.metadata);

  // Only validate repo access if owner/repo are provided
  if (!owner || !repo) {
    return { valid: true, warnings, errors, metadata };
  }

  try {
    // Check if token has access to the specified repo
    const repoResponse = await fetch(`https://api.github.com/repos/${owner}/${repo}`, {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Accept': 'application/vnd.github+json',
        'User-Agent': 'Zoku/1.0',
        'X-GitHub-Api-Version': '2022-11-28'
      }
    });

    if (!repoResponse.ok) {
      if (repoResponse.status === 404) {
        errors.push(`Cannot access repository ${owner}/${repo}. Either it doesn't exist or the token lacks permission. Consider adding a token with access to this repo.`);
        return { valid: false, warnings, errors, metadata };
      }
      if (repoResponse.status === 403) {
        errors.push(`Access forbidden to ${owner}/${repo}. The token needs permission to access this repository.`);
        return { valid: false, warnings, errors, metadata };
      }
      errors.push(`Cannot verify repository access: ${repoResponse.status} ${repoResponse.statusText}`);
      return { valid: false, warnings, errors, metadata };
    }

    const repoData = await repoResponse.json();
    metadata.repo_name = repoData.full_name;
    metadata.repo_private = repoData.private;
    metadata.repo_permissions = repoData.permissions;

    // Check permissions
    if (!repoData.permissions?.pull) {
      warnings.push('Token may not have read access to this repository');
    }

    // Try to fetch events to verify we can actually collect data
    const eventsResponse = await fetch(`https://api.github.com/repos/${owner}/${repo}/events?per_page=1`, {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Accept': 'application/vnd.github+json',
        'User-Agent': 'Zoku/1.0',
        'X-GitHub-Api-Version': '2022-11-28'
      }
    });

    if (!eventsResponse.ok) {
      warnings.push(`Cannot fetch events from ${owner}/${repo}. Collection may fail.`);
    }

    return {
      valid: true,
      warnings,
      errors,
      metadata
    };

  } catch (error) {
    errors.push(`Validation error: ${error instanceof Error ? error.message : String(error)}`);
    return { valid: false, warnings, errors };
  }
}

/**
 * Validate Zammad credentials only
 */
export async function validateZammadCredential(credentials: any): Promise<ValidationResult> {
  const { url, token } = credentials;

  const warnings: string[] = [];
  const errors: string[] = [];
  const metadata: Record<string, any> = {};

  if (!url || !token) {
    errors.push('Zammad credentials require both url and token');
    return { valid: false, warnings, errors };
  }

  // Store URL in metadata for display
  metadata.url = url;

  try {
    // Test connection and authentication
    const response = await fetch(`${url}/api/v1/users/me`, {
      headers: {
        'Authorization': `Token token=${token}`,
        'Content-Type': 'application/json'
      }
    });

    if (!response.ok) {
      if (response.status === 401) {
        errors.push('Zammad token is invalid');
        return { valid: false, warnings, errors };
      }
      errors.push(`Zammad API error: ${response.status} ${response.statusText}`);
      return { valid: false, warnings, errors };
    }

    const user = await response.json();
    metadata.authenticated_as = `${user.firstname} ${user.lastname}`;
    metadata.email = user.email;
    metadata.zammad_url = url;

    return {
      valid: true,
      warnings,
      errors,
      metadata
    };

  } catch (error) {
    errors.push(`Validation error: ${error instanceof Error ? error.message : String(error)}`);
    return { valid: false, warnings, errors };
  }
}

/**
 * Validate Zammad source configuration and token
 */
export async function validateZammadSource(config: any, credentials: any): Promise<ValidationResult> {
  const { tag } = config;
  const { token, url } = credentials;  // URL always comes from credentials now

  if (!url) {
    return {
      valid: false,
      warnings: [],
      errors: ['Zammad URL must be stored in jewel'],
      metadata: {}
    };
  }

  const warnings: string[] = [];
  const errors: string[] = [];
  const metadata: Record<string, any> = {};

  try {
    // Test connection and authentication
    const response = await fetch(`${url}/api/v1/users/me`, {
      headers: {
        'Authorization': `Token token=${token}`,
        'Content-Type': 'application/json'
      }
    });

    if (!response.ok) {
      if (response.status === 401) {
        errors.push('Zammad token is invalid');
        return { valid: false, warnings, errors };
      }
      errors.push(`Zammad API error: ${response.status} ${response.statusText}`);
      return { valid: false, warnings, errors };
    }

    const user = await response.json();
    metadata.authenticated_as = `${user.firstname} ${user.lastname}`;
    metadata.email = user.email;

    return {
      valid: true,
      warnings,
      errors,
      metadata
    };

  } catch (error) {
    errors.push(`Validation error: ${error instanceof Error ? error.message : String(error)}`);
    return { valid: false, warnings, errors };
  }
}

/**
 * Validate Google Docs source configuration and credentials
 */
/**
 * Validate Google Docs/Drive credentials (OAuth refresh token only)
 * Uses backend's GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET from environment
 */
export async function validateGoogleDocsCredential(credentials: any, clientId: string, clientSecret: string): Promise<ValidationResult> {
  console.log('🔍 validateGoogleDocsCredential called');
  const { refresh_token } = credentials;

  const warnings: string[] = [];
  const errors: string[] = [];
  const metadata: Record<string, any> = {};

  if (!refresh_token) {
    errors.push('refresh_token is required');
    return { valid: false, warnings, errors };
  }

  if (!clientId || !clientSecret) {
    errors.push('Google OAuth not configured on backend (missing client_id or client_secret)');
    return { valid: false, warnings, errors };
  }

  console.log('🔄 Refreshing Google access token...');

  try {
    // Test token refresh
    const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: clientId,
        client_secret: clientSecret,
        refresh_token,
        grant_type: 'refresh_token'
      })
    });

    const tokenData = await tokenResponse.json();

    if (!tokenData.access_token) {
      errors.push(`Token refresh failed: ${tokenData.error_description || tokenData.error}`);
      return { valid: false, warnings, errors };
    }

    metadata.token_type = tokenData.token_type;
    metadata.scope = tokenData.scope;
    metadata.expires_in = tokenData.expires_in;

    // Get user info (email) from Google Drive API
    try {
      const aboutResponse = await fetch('https://www.googleapis.com/drive/v3/about?fields=user', {
        headers: { 'Authorization': `Bearer ${tokenData.access_token}` }
      });
      if (aboutResponse.ok) {
        const aboutData = await aboutResponse.json();
        if (aboutData.user) {
          metadata.email = aboutData.user.emailAddress;
          metadata.name = aboutData.user.displayName;
          console.log('✅ Fetched Google account info:', { email: aboutData.user.emailAddress, name: aboutData.user.displayName });
        }
      } else {
        console.warn('Could not fetch Google account info, status:', aboutResponse.status);
      }
    } catch (e) {
      console.warn('Could not fetch Google account info:', e);
      // User info is optional, don't fail validation
    }

    return { valid: true, warnings, errors, metadata };

  } catch (error) {
    errors.push(`Validation error: ${error instanceof Error ? error.message : 'Unknown error'}`);
    return { valid: false, warnings, errors };
  }
}

export async function validateGoogleDocsSource(config: any, credentials: any): Promise<ValidationResult> {
  const { document_id } = config;
  const { client_id, client_secret, refresh_token } = credentials;

  const warnings: string[] = [];
  const errors: string[] = [];
  const metadata: Record<string, any> = {};

  try {
    // Test token refresh
    const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id,
        client_secret,
        refresh_token,
        grant_type: 'refresh_token'
      })
    });

    if (!tokenResponse.ok) {
      const errorData = await tokenResponse.json();
      errors.push(`Google OAuth error: ${errorData.error_description || errorData.error}`);
      return { valid: false, warnings, errors };
    }

    const tokenData = await tokenResponse.json();
    const accessToken = tokenData.access_token;

    // Get user info and storage quota from Google Drive API
    try {
      const aboutResponse = await fetch('https://www.googleapis.com/drive/v3/about?fields=kind,user,storageQuota', {
        headers: { 'Authorization': `Bearer ${accessToken}` }
      });
      if (aboutResponse.ok) {
        const aboutData = await aboutResponse.json();
        if (aboutData.user) {
          metadata.email = aboutData.user.emailAddress;
          metadata.name = aboutData.user.displayName;
        }
        if (aboutData.storageQuota) {
          metadata.storage_limit = aboutData.storageQuota.limit;
          metadata.storage_usage = aboutData.storageQuota.usage;
        }
      }
    } catch (e) {
      // User info is optional
    }

    // Test document access only if document_id is provided
    if (document_id) {
      const docResponse = await fetch(
        `https://docs.googleapis.com/v1/documents/${document_id}?fields=title`,
        {
          headers: { 'Authorization': `Bearer ${accessToken}` }
        }
      );

      if (!docResponse.ok) {
        const accountInfo = metadata.email || 'your Google account';
        if (docResponse.status === 404) {
          errors.push(`Document not found. The document ID may be incorrect, or ${accountInfo} does not have access.`);
          return { valid: false, warnings, errors, metadata };
        }
        if (docResponse.status === 403) {
          errors.push(`Access denied. Please share the document with ${accountInfo} or update OAuth scopes.`);
          return { valid: false, warnings, errors, metadata };
        }
        errors.push(`Google Docs API error: ${docResponse.status}`);
        return { valid: false, warnings, errors, metadata };
      }

      const doc = await docResponse.json();
      metadata.document_title = doc.title;
    } else {
      // No document ID provided - just validating account access
      warnings.push('No test document provided - validated account only');
    }

    return {
      valid: true,
      warnings,
      errors,
      metadata
    };

  } catch (error) {
    errors.push(`Validation error: ${error instanceof Error ? error.message : String(error)}`);
    return { valid: false, warnings, errors };
  }
}

/**
 * Validate Gmail credentials (Google OAuth)
 */
export async function validateGmailCredential(credentials: any, clientId: string, clientSecret: string): Promise<ValidationResult> {
  const { refresh_token } = credentials;
  const warnings: string[] = [];
  const errors: string[] = [];
  const metadata: Record<string, any> = {};

  if (!refresh_token) {
    errors.push('Missing refresh_token');
    return { valid: false, warnings, errors };
  }

  if (!clientId || !clientSecret) {
    errors.push('Missing client_id or client_secret');
    return { valid: false, warnings, errors };
  }

  try {
    // Refresh the token to get an access token
    const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: clientId,
        client_secret: clientSecret,
        refresh_token: refresh_token,
        grant_type: 'refresh_token'
      })
    });

    if (!tokenResponse.ok) {
      const errorData = await tokenResponse.json() as any;
      errors.push(`Token refresh failed: ${errorData.error_description || errorData.error}`);
      return { valid: false, warnings, errors };
    }

    const tokenData = await tokenResponse.json() as { access_token: string };
    const accessToken = tokenData.access_token;

    // Test Gmail API access by fetching user profile
    const profileResponse = await fetch(
      'https://gmail.googleapis.com/gmail/v1/users/me/profile',
      {
        headers: {
          'Authorization': `Bearer ${accessToken}`
        }
      }
    );

    if (!profileResponse.ok) {
      const errorText = await profileResponse.text();
      errors.push(`Gmail API access failed: ${errorText}`);
      return { valid: false, warnings, errors };
    }

    const profile = await profileResponse.json() as {
      emailAddress: string;
      messagesTotal: number;
      threadsTotal: number;
    };

    metadata.email = profile.emailAddress;
    metadata.messages_total = profile.messagesTotal;
    metadata.threads_total = profile.threadsTotal;

    // Check if we have the required Gmail scope
    warnings.push('Ensure Gmail API is enabled and https://www.googleapis.com/auth/gmail.readonly scope is granted');

    return {
      valid: true,
      warnings,
      errors,
      metadata,
      info: {
        authenticated_as: profile.emailAddress,
        messages_total: profile.messagesTotal
      }
    };

  } catch (error) {
    errors.push(`Validation error: ${error instanceof Error ? error.message : String(error)}`);
    return { valid: false, warnings, errors };
  }
}
