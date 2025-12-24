import { TokenManager } from '../oauth/token-manager.ts';

export class YnabApiClient {
  private baseUrl = 'https://api.ynab.com/v1';

  constructor(private tokenManager: TokenManager) {}

  async callApi(options: {
    method: string;
    endpoint: string;
    body?: unknown;
    headers?: Record<string, string>;
  }): Promise<{ data?: unknown; error?: unknown }> {
    const { method, endpoint, body, headers = {} } = options;

    // Get access token (will trigger auth if needed)
    const accessToken = await this.tokenManager.getAccessToken();

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
