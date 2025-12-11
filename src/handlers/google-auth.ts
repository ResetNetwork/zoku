// Shared Google OAuth token refresh helper

export async function refreshGoogleAccessToken(credentials: {
  client_id: string;
  client_secret: string;
  refresh_token: string;
}): Promise<string> {
  const response = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: credentials.client_id,
      client_secret: credentials.client_secret,
      refresh_token: credentials.refresh_token,
      grant_type: 'refresh_token'
    })
  });

  const data = await response.json() as { access_token?: string; error?: string; error_description?: string };

  if (!data.access_token) {
    throw new Error(`Google OAuth error: ${data.error_description || data.error}`);
  }

  return data.access_token;
}
