// Source validation helpers

export interface ValidationResult {
  valid: boolean;
  warnings: string[];
  errors: string[];
  metadata?: Record<string, any>;
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

  // First validate the credential itself
  const credentialValidation = await validateGitHubCredential(credentials);
  if (!credentialValidation.valid) {
    return credentialValidation;
  }

  warnings.push(...credentialValidation.warnings);
  Object.assign(metadata, credentialValidation.metadata);

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
  const { url } = config;
  const { token } = credentials;

  // If credentials include URL, use credential validation
  if (credentials.url) {
    return validateZammadCredential(credentials);
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

    // Test document access
    const docResponse = await fetch(
      `https://docs.googleapis.com/v1/documents/${document_id}?fields=title`,
      {
        headers: { 'Authorization': `Bearer ${accessToken}` }
      }
    );

    if (!docResponse.ok) {
      if (docResponse.status === 404) {
        errors.push(`Document ${document_id} not found or not accessible`);
        return { valid: false, warnings, errors };
      }
      if (docResponse.status === 403) {
        errors.push('Insufficient permissions to access this document. Grant access to the document or update OAuth scopes.');
        return { valid: false, warnings, errors };
      }
      errors.push(`Google Docs API error: ${docResponse.status}`);
      return { valid: false, warnings, errors };
    }

    const doc = await docResponse.json();
    metadata.document_title = doc.title;

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
