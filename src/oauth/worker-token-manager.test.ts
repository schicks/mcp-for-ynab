import { describe, test, expect, beforeEach, mock } from 'bun:test';
import { WorkerTokenManager } from './worker-token-manager.js';
import { KVTokenStore } from '../storage/kv-token-store.js';
import { WebOAuthClient } from './web-client.js';
import type { OAuthConfig } from './config.js';

// Mock KVNamespace
class MockKVNamespace implements KVNamespace {
  private store = new Map<string, { value: string; expirationTtl?: number }>();

  async get<T = unknown>(key: string, type?: 'text' | 'json' | 'arrayBuffer' | 'stream'): Promise<T | null> {
    const stored = this.store.get(key);
    if (!stored) return null;
    if (type === 'json') return JSON.parse(stored.value) as T;
    return stored.value as T;
  }

  async put(key: string, value: string, options?: { expirationTtl?: number }): Promise<void> {
    this.store.set(key, { value, expirationTtl: options?.expirationTtl });
  }

  async delete(key: string): Promise<void> {
    this.store.delete(key);
  }

  async list(): Promise<{ keys: { name: string }[] }> {
    return { keys: Array.from(this.store.keys()).map(name => ({ name })) };
  }

  getWithMetadata = mock(() => Promise.resolve({ value: null, metadata: null }));
  async *[Symbol.asyncIterator]() {}
}

describe('WorkerTokenManager', () => {
  let tokenManager: WorkerTokenManager;
  let tokenStore: KVTokenStore;
  let oauthClient: WebOAuthClient;
  const encryptionKey = '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef';

  const mockConfig: OAuthConfig = {
    clientId: 'test-client',
    clientSecret: 'test-secret',
    redirectUri: 'https://worker.dev/callback',
    authorizationUrl: 'https://app.ynab.com/oauth/authorize',
    tokenUrl: 'https://app.ynab.com/oauth/token',
    scopes: [],
  };

  beforeEach(async () => {
    const kv = new MockKVNamespace();
    tokenStore = new KVTokenStore(kv as unknown as KVNamespace, encryptionKey);
    await tokenStore.initialize();

    oauthClient = new WebOAuthClient(mockConfig);
    tokenManager = new WorkerTokenManager(tokenStore, oauthClient);
  });

  describe('getAccessToken', () => {
    test('should return access token for authenticated session', async () => {
      const sessionId = 'session-123';
      await tokenStore.storeTokens(sessionId, {
        accessToken: 'valid-token',
        expiresAt: Math.floor(Date.now() / 1000) + 3600, // Expires in 1 hour
      });

      const token = await tokenManager.getAccessToken(sessionId);
      expect(token).toBe('valid-token');
    });

    test('should return null for unauthenticated session', async () => {
      const token = await tokenManager.getAccessToken('non-existent-session');
      expect(token).toBeNull();
    });

    test('should return token without expiry', async () => {
      const sessionId = 'session-no-expiry';
      await tokenStore.storeTokens(sessionId, {
        accessToken: 'token-without-expiry',
      });

      const token = await tokenManager.getAccessToken(sessionId);
      expect(token).toBe('token-without-expiry');
    });

    test('should refresh token when close to expiry (5-minute buffer)', async () => {
      const sessionId = 'session-expiring';
      const now = Math.floor(Date.now() / 1000);

      // Token expires in 4 minutes (within 5-minute buffer)
      await tokenStore.storeTokens(sessionId, {
        accessToken: 'old-token',
        refreshToken: 'refresh-token',
        expiresAt: now + 240, // 4 minutes
      });

      // Mock the OAuth client refresh
      global.fetch = mock(() =>
        Promise.resolve(
          new Response(
            JSON.stringify({
              access_token: 'refreshed-token',
              refresh_token: 'new-refresh-token',
              expires_in: 3600,
            }),
            { status: 200 }
          )
        )
      );

      const token = await tokenManager.getAccessToken(sessionId);
      expect(token).toBe('refreshed-token');

      // Verify new token was stored
      const storedTokens = await tokenStore.getTokens(sessionId);
      expect(storedTokens?.accessToken).toBe('refreshed-token');
    });

    test('should return null when token expired and no refresh token', async () => {
      const sessionId = 'session-expired';
      const now = Math.floor(Date.now() / 1000);

      // Expired token with no refresh token
      await tokenStore.storeTokens(sessionId, {
        accessToken: 'expired-token',
        expiresAt: now - 100, // Expired 100 seconds ago
      });

      const token = await tokenManager.getAccessToken(sessionId);
      expect(token).toBeNull();
    });

    test('should not refresh token that is still valid (outside buffer)', async () => {
      const sessionId = 'session-valid';
      const now = Math.floor(Date.now() / 1000);

      // Token expires in 10 minutes (outside 5-minute buffer)
      await tokenStore.storeTokens(sessionId, {
        accessToken: 'still-valid-token',
        refreshToken: 'refresh-token',
        expiresAt: now + 600, // 10 minutes
      });

      const token = await tokenManager.getAccessToken(sessionId);
      expect(token).toBe('still-valid-token');
    });
  });

  describe('storeTokens', () => {
    test('should store tokens with expiry', async () => {
      const sessionId = 'session-store-test';
      await tokenManager.storeTokens(sessionId, 'access-123', 'refresh-456', 3600);

      const tokens = await tokenStore.getTokens(sessionId);
      expect(tokens?.accessToken).toBe('access-123');
      expect(tokens?.refreshToken).toBe('refresh-456');
      expect(tokens?.expiresAt).toBeGreaterThan(Date.now() / 1000);
    });

    test('should store tokens without refresh token', async () => {
      const sessionId = 'session-no-refresh';
      await tokenManager.storeTokens(sessionId, 'access-only');

      const tokens = await tokenStore.getTokens(sessionId);
      expect(tokens?.accessToken).toBe('access-only');
      expect(tokens?.refreshToken).toBeUndefined();
    });

    test('should store tokens without expiry', async () => {
      const sessionId = 'session-no-expiry';
      await tokenManager.storeTokens(sessionId, 'token-123', 'refresh-456');

      const tokens = await tokenStore.getTokens(sessionId);
      expect(tokens?.accessToken).toBe('token-123');
      expect(tokens?.expiresAt).toBeUndefined();
    });
  });

  describe('isAuthenticated', () => {
    test('should return true for authenticated session', async () => {
      const sessionId = 'session-auth';
      await tokenStore.storeTokens(sessionId, {
        accessToken: 'token',
      });

      const isAuth = await tokenManager.isAuthenticated(sessionId);
      expect(isAuth).toBe(true);
    });

    test('should return false for unauthenticated session', async () => {
      const isAuth = await tokenManager.isAuthenticated('no-session');
      expect(isAuth).toBe(false);
    });
  });

  describe('clearTokens', () => {
    test('should clear tokens for session', async () => {
      const sessionId = 'session-clear';
      await tokenStore.storeTokens(sessionId, {
        accessToken: 'token-to-clear',
      });

      expect(await tokenManager.isAuthenticated(sessionId)).toBe(true);

      await tokenManager.clearTokens(sessionId);

      expect(await tokenManager.isAuthenticated(sessionId)).toBe(false);
    });

    test('should not error when clearing non-existent session', async () => {
      // Should complete without throwing
      await tokenManager.clearTokens('non-existent');
      // If we get here, it didn't throw
      expect(true).toBe(true);
    });
  });

  describe('Token Refresh Flow', () => {
    test('should use new refresh token if provided by refresh endpoint', async () => {
      const sessionId = 'session-refresh-flow';
      const now = Math.floor(Date.now() / 1000);

      await tokenStore.storeTokens(sessionId, {
        accessToken: 'old-access',
        refreshToken: 'old-refresh',
        expiresAt: now + 200, // Within buffer
      });

      global.fetch = mock(() =>
        Promise.resolve(
          new Response(
            JSON.stringify({
              access_token: 'new-access',
              refresh_token: 'new-refresh', // New refresh token
              expires_in: 3600,
            }),
            { status: 200 }
          )
        )
      );

      await tokenManager.getAccessToken(sessionId);

      const tokens = await tokenStore.getTokens(sessionId);
      expect(tokens?.refreshToken).toBe('new-refresh');
    });

    test('should keep old refresh token if not provided by refresh endpoint', async () => {
      const sessionId = 'session-keep-refresh';
      const now = Math.floor(Date.now() / 1000);

      await tokenStore.storeTokens(sessionId, {
        accessToken: 'old-access',
        refreshToken: 'keep-this-refresh',
        expiresAt: now + 200,
      });

      global.fetch = mock(() =>
        Promise.resolve(
          new Response(
            JSON.stringify({
              access_token: 'new-access',
              // No refresh_token in response
              expires_in: 3600,
            }),
            { status: 200 }
          )
        )
      );

      await tokenManager.getAccessToken(sessionId);

      const tokens = await tokenStore.getTokens(sessionId);
      expect(tokens?.refreshToken).toBe('keep-this-refresh');
    });
  });
});
