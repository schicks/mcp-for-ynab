import { WorkerTokenManager } from '../oauth/worker-token-manager.js';

export class YnabApiClient {
  private baseUrl = 'https://api.ynab.com/v1';

  constructor(
    private tokenManager: WorkerTokenManager,
    private sessionId: string
  ) {}

  async callApi(options: {
    method: string;
    endpoint: string;
    body?: unknown;
    headers?: Record<string, string>;
  }): Promise<{ data?: unknown; error?: unknown }> {
    const { method, endpoint, body, headers = {} } = options;

    // Get access token for this session
    const accessToken = await this.tokenManager.getAccessToken(this.sessionId);

    if (!accessToken) {
      return {
        error: {
          error: {
            id: 'unauthorized',
            name: 'Unauthorized',
            detail: 'Please authenticate by visiting /oauth/authorize with your session ID in the MCP-Session-Id header',
          },
        },
      };
    }

    // Build full URL
    const url = endpoint.startsWith('http')
      ? endpoint
      : `${this.baseUrl}${endpoint.startsWith('/') ? endpoint : '/' + endpoint}`;

    // Make request
    const response = await fetch(url, {
      method: method.toUpperCase(),
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
        ...headers,
      },
      body: body ? JSON.stringify(body) : undefined,
    });

    // Parse response
    const contentType = response.headers.get('content-type');
    let responseData: unknown;

    if (contentType?.includes('application/json')) {
      responseData = await response.json();
    } else {
      responseData = await response.text();
    }

    // YNAB wraps all responses in { data: ... } or { error: ... }
    if (!response.ok) {
      return {
        error: responseData,
      };
    }

    return responseData as { data?: unknown; error?: unknown };
  }
}
