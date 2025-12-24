import { KVTokenStore } from '../storage/kv-token-store.js';
import { WebOAuthClient } from '../oauth/web-client.js';
import type { Env } from '../worker-env.js';
import { getOAuthConfig } from '../oauth/config.js';

const AUTH_INITIATION_HTML = (authUrl: string) => `
<!DOCTYPE html>
<html>
<head>
  <title>YNAB Authorization</title>
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <style>
    body {
      font-family: system-ui, -apple-system, sans-serif;
      max-width: 600px;
      margin: 50px auto;
      padding: 20px;
      text-align: center;
      background: #f5f5f5;
    }
    .card {
      background: white;
      border-radius: 12px;
      padding: 40px;
      box-shadow: 0 2px 8px rgba(0,0,0,0.1);
    }
    h1 {
      color: #333;
      margin-bottom: 10px;
    }
    p {
      color: #666;
      line-height: 1.6;
    }
    .btn {
      display: inline-block;
      background: #0066cc;
      color: white;
      padding: 12px 24px;
      text-decoration: none;
      border-radius: 6px;
      font-size: 16px;
      margin-top: 20px;
      transition: background 0.2s;
    }
    .btn:hover {
      background: #0052a3;
    }
    .info {
      margin-top: 30px;
      padding: 15px;
      background: #f0f7ff;
      border-radius: 6px;
      font-size: 14px;
      color: #004085;
    }
  </style>
</head>
<body>
  <div class="card">
    <h1>🔐 Connect to YNAB</h1>
    <p>This MCP server needs access to your YNAB account to retrieve budget data.</p>
    <p>Click the button below to authorize this application.</p>
    <a href="${authUrl}" class="btn">Authorize with YNAB</a>
    <div class="info">
      Your session ID will be preserved and returned after authorization.
      All tokens are encrypted and stored securely.
    </div>
  </div>
</body>
</html>
`;

const SUCCESS_HTML = `
<!DOCTYPE html>
<html>
<head>
  <title>Authorization Successful</title>
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <style>
    body {
      font-family: system-ui, -apple-system, sans-serif;
      max-width: 600px;
      margin: 50px auto;
      padding: 20px;
      text-align: center;
      background: #f5f5f5;
    }
    .card {
      background: white;
      border-radius: 12px;
      padding: 40px;
      box-shadow: 0 2px 8px rgba(0,0,0,0.1);
    }
    .success {
      color: #22c55e;
      font-size: 64px;
      margin-bottom: 20px;
    }
    h1 {
      color: #333;
      margin-bottom: 10px;
    }
    p {
      color: #666;
      line-height: 1.6;
    }
    .info {
      margin-top: 30px;
      padding: 15px;
      background: #f0fdf4;
      border-radius: 6px;
      font-size: 14px;
      color: #166534;
    }
  </style>
</head>
<body>
  <div class="card">
    <div class="success">✓</div>
    <h1>Authorization Successful!</h1>
    <p>You've successfully connected your YNAB account.</p>
    <p>You can now close this window and return to your MCP client.</p>
    <div class="info">
      Your tokens are securely stored and encrypted.
      The MCP server can now access your YNAB data.
    </div>
  </div>
</body>
</html>
`;

const ERROR_HTML = (error: string) => `
<!DOCTYPE html>
<html>
<head>
  <title>Authorization Failed</title>
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <style>
    body {
      font-family: system-ui, -apple-system, sans-serif;
      max-width: 600px;
      margin: 50px auto;
      padding: 20px;
      text-align: center;
      background: #f5f5f5;
    }
    .card {
      background: white;
      border-radius: 12px;
      padding: 40px;
      box-shadow: 0 2px 8px rgba(0,0,0,0.1);
    }
    .error {
      color: #ef4444;
      font-size: 64px;
      margin-bottom: 20px;
    }
    h1 {
      color: #333;
      margin-bottom: 10px;
    }
    p {
      color: #666;
      line-height: 1.6;
    }
    .error-details {
      margin-top: 30px;
      padding: 15px;
      background: #fef2f2;
      border-radius: 6px;
      font-size: 14px;
      color: #991b1b;
      word-break: break-word;
    }
  </style>
</head>
<body>
  <div class="card">
    <div class="error">✗</div>
    <h1>Authorization Failed</h1>
    <p>There was a problem connecting to your YNAB account.</p>
    <div class="error-details">
      <strong>Error:</strong> ${error}
    </div>
    <p style="margin-top: 20px; font-size: 14px;">
      Please try again or contact support if the problem persists.
    </p>
  </div>
</body>
</html>
`;

/**
 * Handle GET /oauth/authorize - Initiate OAuth flow
 */
export async function handleOAuthAuthorize(
  request: Request,
  env: Env,
  sessionId: string
): Promise<Response> {
  const workerUrl = new URL(request.url).origin;
  const config = getOAuthConfig(env, workerUrl);
  const oauthClient = new WebOAuthClient(config);

  // Generate state for CSRF protection
  const state = crypto.randomUUID();

  // Store state in KV (linked to session)
  const tokenStore = new KVTokenStore(env.MCP_FOR_YNAB, env.TOKEN_ENCRYPTION_KEY);
  await tokenStore.initialize();
  await tokenStore.storeOAuthState(state, sessionId);

  // Generate authorization URL
  const authUrl = oauthClient.getAuthorizationUrl(state);

  // Return HTML page with authorization link
  return new Response(AUTH_INITIATION_HTML(authUrl), {
    headers: {
      'Content-Type': 'text/html',
      'MCP-Session-Id': sessionId,
    },
  });
}

/**
 * Handle GET /oauth/callback - OAuth callback from YNAB
 */
export async function handleOAuthCallback(
  request: Request,
  env: Env
): Promise<Response> {
  const url = new URL(request.url);
  const code = url.searchParams.get('code');
  const state = url.searchParams.get('state');
  const error = url.searchParams.get('error');
  const errorDescription = url.searchParams.get('error_description');

  if (error) {
    return new Response(ERROR_HTML(errorDescription || error), {
      headers: { 'Content-Type': 'text/html' },
      status: 400,
    });
  }

  if (!code || !state) {
    return new Response(ERROR_HTML('Missing code or state parameter'), {
      headers: { 'Content-Type': 'text/html' },
      status: 400,
    });
  }

  // Verify and consume state
  const tokenStore = new KVTokenStore(env.MCP_FOR_YNAB, env.TOKEN_ENCRYPTION_KEY);
  await tokenStore.initialize();
  const sessionId = await tokenStore.consumeOAuthState(state);

  if (!sessionId) {
    return new Response(
      ERROR_HTML('Invalid or expired state parameter (CSRF check failed)'),
      {
        headers: { 'Content-Type': 'text/html' },
        status: 400,
      }
    );
  }

  // Exchange code for token
  const workerUrl = url.origin;
  const config = getOAuthConfig(env, workerUrl);
  const oauthClient = new WebOAuthClient(config);

  try {
    const tokens = await oauthClient.exchangeCodeForToken(code);

    // Store tokens
    await tokenStore.storeTokens(sessionId, {
      accessToken: tokens.access_token,
      refreshToken: tokens.refresh_token,
      expiresAt: tokens.expires_in
        ? Math.floor(Date.now() / 1000) + tokens.expires_in
        : undefined,
    });

    return new Response(SUCCESS_HTML, {
      headers: {
        'Content-Type': 'text/html',
        'MCP-Session-Id': sessionId,
      },
    });
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    return new Response(ERROR_HTML(`Token exchange failed: ${errorMsg}`), {
      headers: { 'Content-Type': 'text/html' },
      status: 500,
    });
  }
}
