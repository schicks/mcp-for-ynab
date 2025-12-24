import { describe, test, expect, beforeEach, mock } from 'bun:test';
import { WebOAuthClient } from './web-client.js';
import type { OAuthConfig } from './config.js';

describe('WebOAuthClient', () => {
  let client: WebOAuthClient;
  const mockConfig: OAuthConfig = {
    clientId: 'test-client-id',
    clientSecret: 'test-client-secret',
    redirectUri: 'https://worker.dev/oauth/callback',
    authorizationUrl: 'https://app.ynab.com/oauth/authorize',
    tokenUrl: 'https://app.ynab.com/oauth/token',
    scopes: [],
  };

  beforeEach(() => {
    client = new WebOAuthClient(mockConfig);
  });

  describe('getAuthorizationUrl', () => {
    test('should generate valid authorization URL', () => {
      const state = 'random-state-123';
      const url = client.getAuthorizationUrl(state);

      expect(url).toContain('https://app.ynab.com/oauth/authorize');
      expect(url).toContain('client_id=test-client-id');
      expect(url).toContain('redirect_uri=https%3A%2F%2Fworker.dev%2Foauth%2Fcallback');
      expect(url).toContain('response_type=code');
      expect(url).toContain('state=random-state-123');
    });

    test('should include all required OAuth parameters', () => {
      const state = 'test-state';
      const url = new URL(client.getAuthorizationUrl(state));

      expect(url.searchParams.get('client_id')).toBe('test-client-id');
      expect(url.searchParams.get('redirect_uri')).toBe('https://worker.dev/oauth/callback');
      expect(url.searchParams.get('response_type')).toBe('code');
      expect(url.searchParams.get('state')).toBe('test-state');
    });

    test('should handle different state values', () => {
      const states = ['abc123', 'xyz-789', crypto.randomUUID()];

      states.forEach((state) => {
        const url = client.getAuthorizationUrl(state);
        expect(url).toContain(`state=${state}`);
      });
    });
  });

  describe('exchangeCodeForToken', () => {
    test('should exchange code for token successfully', async () => {
      const mockResponse = {
        access_token: 'access-token-123',
        refresh_token: 'refresh-token-456',
        expires_in: 3600,
      };

      global.fetch = mock(() =>
        Promise.resolve(
          new Response(JSON.stringify(mockResponse), {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
          })
        )
      );

      const result = await client.exchangeCodeForToken('auth-code-123');

      expect(result.access_token).toBe('access-token-123');
      expect(result.refresh_token).toBe('refresh-token-456');
      expect(result.expires_in).toBe(3600);
    });

    test('should send correct parameters to token endpoint', async () => {
      const fetchMock = mock(() =>
        Promise.resolve(
          new Response(JSON.stringify({ access_token: 'token' }), { status: 200 })
        )
      );
      global.fetch = fetchMock;

      await client.exchangeCodeForToken('test-code');

      expect(fetchMock).toHaveBeenCalledWith(
        'https://app.ynab.com/oauth/token',
        expect.objectContaining({
          method: 'POST',
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
          },
        })
      );

      const callArgs = fetchMock.mock.calls[0];
      const body = callArgs[1].body as URLSearchParams;
      expect(body.get('client_id')).toBe('test-client-id');
      expect(body.get('client_secret')).toBe('test-client-secret');
      expect(body.get('redirect_uri')).toBe('https://worker.dev/oauth/callback');
      expect(body.get('grant_type')).toBe('authorization_code');
      expect(body.get('code')).toBe('test-code');
    });

    test('should throw error on failed token exchange', async () => {
      global.fetch = mock(() =>
        Promise.resolve(
          new Response('Invalid authorization code', { status: 400 })
        )
      );

      await expect(client.exchangeCodeForToken('invalid-code')).rejects.toThrow(
        'Token exchange failed'
      );
    });

    test('should handle network errors', async () => {
      global.fetch = mock(() => Promise.reject(new Error('Network error')));

      await expect(client.exchangeCodeForToken('test-code')).rejects.toThrow(
        'Network error'
      );
    });
  });

  describe('refreshToken', () => {
    test('should refresh token successfully', async () => {
      const mockResponse = {
        access_token: 'new-access-token',
        refresh_token: 'new-refresh-token',
        expires_in: 7200,
      };

      global.fetch = mock(() =>
        Promise.resolve(
          new Response(JSON.stringify(mockResponse), {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
          })
        )
      );

      const result = await client.refreshToken('old-refresh-token');

      expect(result.access_token).toBe('new-access-token');
      expect(result.refresh_token).toBe('new-refresh-token');
      expect(result.expires_in).toBe(7200);
    });

    test('should send correct parameters for token refresh', async () => {
      const fetchMock = mock(() =>
        Promise.resolve(
          new Response(JSON.stringify({ access_token: 'token' }), { status: 200 })
        )
      );
      global.fetch = fetchMock;

      await client.refreshToken('refresh-token-xyz');

      expect(fetchMock).toHaveBeenCalledWith(
        'https://app.ynab.com/oauth/token',
        expect.objectContaining({
          method: 'POST',
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
          },
        })
      );

      const callArgs = fetchMock.mock.calls[0];
      const body = callArgs[1].body as URLSearchParams;
      expect(body.get('client_id')).toBe('test-client-id');
      expect(body.get('client_secret')).toBe('test-client-secret');
      expect(body.get('grant_type')).toBe('refresh_token');
      expect(body.get('refresh_token')).toBe('refresh-token-xyz');
    });

    test('should throw error on failed token refresh', async () => {
      global.fetch = mock(() =>
        Promise.resolve(
          new Response('Invalid refresh token', { status: 400 })
        )
      );

      await expect(client.refreshToken('invalid-token')).rejects.toThrow(
        'Token refresh failed'
      );
    });

    test('should handle expired refresh token', async () => {
      global.fetch = mock(() =>
        Promise.resolve(
          new Response('Refresh token has expired', { status: 401 })
        )
      );

      await expect(client.refreshToken('expired-token')).rejects.toThrow(
        'Token refresh failed'
      );
    });
  });
});
