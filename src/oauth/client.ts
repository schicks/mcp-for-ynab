import { OAUTH_CONFIG } from './config.ts';
import { startCallbackServer } from './callback-server.ts';

export class OAuthClient {
  async authorize(): Promise<{ access_token: string; refresh_token?: string; expires_in?: number }> {
    // 1. Start local HTTP server on port 3737
    const { promise, url } = await startCallbackServer();

    // 2. Build authorization URL
    const state = crypto.randomUUID();
    const authUrl = new URL(OAUTH_CONFIG.authorizationUrl);
    authUrl.searchParams.set('client_id', OAUTH_CONFIG.clientId);
    authUrl.searchParams.set('redirect_uri', OAUTH_CONFIG.redirectUri);
    authUrl.searchParams.set('response_type', 'code');
    authUrl.searchParams.set('state', state);

    // 3. Open browser for user authorization
    console.error('\nPlease authorize this application in your browser:');
    console.error(`   ${authUrl.toString()}\n`);

    // Use appropriate command for opening browser based on platform
    const platform = process.platform;
    const openCommand = platform === 'darwin' ? 'open' : platform === 'win32' ? 'start' : 'xdg-open';

    try {
      await Bun.spawn([openCommand, authUrl.toString()], {
        stdout: 'ignore',
        stderr: 'ignore',
      }).exited;
    } catch (error) {
      console.error('Could not automatically open browser. Please open the URL above manually.');
    }

    // 4. Wait for callback with authorization code
    const { code, state: returnedState } = await promise;

    // 5. Validate state (CSRF protection)
    if (state !== returnedState) {
      throw new Error('OAuth state mismatch - possible CSRF attack');
    }

    // 6. Exchange authorization code for access token
    const tokenResponse = await fetch(OAUTH_CONFIG.tokenUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        client_id: OAUTH_CONFIG.clientId,
        client_secret: OAUTH_CONFIG.clientSecret,
        redirect_uri: OAUTH_CONFIG.redirectUri,
        grant_type: 'authorization_code',
        code,
      }),
    });

    if (!tokenResponse.ok) {
      const errorText = await tokenResponse.text();
      throw new Error(`Token exchange failed: ${errorText}`);
    }

    return await tokenResponse.json();
  }

  async refreshToken(refreshToken: string): Promise<{ access_token: string; refresh_token?: string; expires_in?: number }> {
    const tokenResponse = await fetch(OAUTH_CONFIG.tokenUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        client_id: OAUTH_CONFIG.clientId,
        client_secret: OAUTH_CONFIG.clientSecret,
        grant_type: 'refresh_token',
        refresh_token: refreshToken,
      }),
    });

    if (!tokenResponse.ok) {
      const errorText = await tokenResponse.text();
      throw new Error(`Token refresh failed: ${errorText}`);
    }

    return await tokenResponse.json();
  }
}
