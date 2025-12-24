import { describe, test, expect, beforeEach, mock } from 'bun:test';
import { KVTokenStore } from './kv-token-store.js';
import type { TokenData } from './kv-token-store.js';

// Mock KVNamespace
class MockKVNamespace implements KVNamespace {
  private store = new Map<string, { value: string; expirationTtl?: number }>();

  async get<T = unknown>(key: string, type?: 'text' | 'json' | 'arrayBuffer' | 'stream'): Promise<T | null> {
    const stored = this.store.get(key);
    if (!stored) return null;

    if (type === 'json') {
      return JSON.parse(stored.value) as T;
    }
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

  // Additional methods required by KVNamespace interface
  getWithMetadata = mock(() => Promise.resolve({ value: null, metadata: null }));

  // Stubs for other required methods
  async *[Symbol.asyncIterator]() {}
}

describe('KVTokenStore', () => {
  let kv: MockKVNamespace;
  let tokenStore: KVTokenStore;
  const encryptionKey = '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef';

  beforeEach(async () => {
    kv = new MockKVNamespace();
    tokenStore = new KVTokenStore(kv as unknown as KVNamespace, encryptionKey);
    await tokenStore.initialize();
  });

  describe('Token Storage', () => {
    test('should store and retrieve tokens', async () => {
      const sessionId = 'test-session-123';
      const tokens: TokenData = {
        accessToken: 'access-token-abc',
        refreshToken: 'refresh-token-xyz',
        expiresAt: Math.floor(Date.now() / 1000) + 3600,
      };

      await tokenStore.storeTokens(sessionId, tokens);
      const retrieved = await tokenStore.getTokens(sessionId);

      expect(retrieved).not.toBeNull();
      expect(retrieved?.accessToken).toBe(tokens.accessToken);
      expect(retrieved?.refreshToken).toBe(tokens.refreshToken);
      expect(retrieved?.expiresAt).toBe(tokens.expiresAt);
    });

    test('should store tokens without refresh token', async () => {
      const sessionId = 'test-session-456';
      const tokens: TokenData = {
        accessToken: 'access-token-only',
      };

      await tokenStore.storeTokens(sessionId, tokens);
      const retrieved = await tokenStore.getTokens(sessionId);

      expect(retrieved).not.toBeNull();
      expect(retrieved?.accessToken).toBe(tokens.accessToken);
      expect(retrieved?.refreshToken).toBeUndefined();
    });

    test('should return null for non-existent session', async () => {
      const retrieved = await tokenStore.getTokens('non-existent-session');
      expect(retrieved).toBeNull();
    });

    test('should delete tokens', async () => {
      const sessionId = 'test-session-789';
      const tokens: TokenData = {
        accessToken: 'will-be-deleted',
      };

      await tokenStore.storeTokens(sessionId, tokens);
      expect(await tokenStore.getTokens(sessionId)).not.toBeNull();

      await tokenStore.deleteTokens(sessionId);
      expect(await tokenStore.getTokens(sessionId)).toBeNull();
    });

    test('should encrypt tokens before storage', async () => {
      const sessionId = 'encryption-test';
      const tokens: TokenData = {
        accessToken: 'plaintext-token',
      };

      await tokenStore.storeTokens(sessionId, tokens);

      // Access KV directly to verify encryption
      const stored = await kv.get(`token:${sessionId}`, 'text');
      expect(stored).not.toBeNull();
      expect(stored).not.toContain('plaintext-token');
    });

    test('should handle multiple sessions independently', async () => {
      const session1 = 'session-1';
      const session2 = 'session-2';

      const tokens1: TokenData = { accessToken: 'token-1' };
      const tokens2: TokenData = { accessToken: 'token-2' };

      await tokenStore.storeTokens(session1, tokens1);
      await tokenStore.storeTokens(session2, tokens2);

      const retrieved1 = await tokenStore.getTokens(session1);
      const retrieved2 = await tokenStore.getTokens(session2);

      expect(retrieved1?.accessToken).toBe('token-1');
      expect(retrieved2?.accessToken).toBe('token-2');
    });
  });

  describe('OAuth State Management', () => {
    test('should store and consume OAuth state', async () => {
      const state = 'random-state-xyz';
      const sessionId = 'session-abc';

      await tokenStore.storeOAuthState(state, sessionId);
      const retrieved = await tokenStore.consumeOAuthState(state);

      expect(retrieved).toBe(sessionId);
    });

    test('should return null for non-existent state', async () => {
      const retrieved = await tokenStore.consumeOAuthState('non-existent-state');
      expect(retrieved).toBeNull();
    });

    test('should delete state after consuming (one-time use)', async () => {
      const state = 'one-time-state';
      const sessionId = 'session-123';

      await tokenStore.storeOAuthState(state, sessionId);

      // First consumption should succeed
      const first = await tokenStore.consumeOAuthState(state);
      expect(first).toBe(sessionId);

      // Second consumption should fail
      const second = await tokenStore.consumeOAuthState(state);
      expect(second).toBeNull();
    });

    test('should handle multiple states independently', async () => {
      const state1 = 'state-1';
      const state2 = 'state-2';
      const session1 = 'session-1';
      const session2 = 'session-2';

      await tokenStore.storeOAuthState(state1, session1);
      await tokenStore.storeOAuthState(state2, session2);

      expect(await tokenStore.consumeOAuthState(state1)).toBe(session1);
      expect(await tokenStore.consumeOAuthState(state2)).toBe(session2);
    });
  });

  describe('TTL Configuration', () => {
    test('should set 90-day TTL for tokens', async () => {
      const sessionId = 'ttl-test';
      const tokens: TokenData = { accessToken: 'test' };

      const putSpy = mock((kv as any).put.bind(kv));
      (kv as any).put = putSpy;

      await tokenStore.storeTokens(sessionId, tokens);

      // Verify expirationTtl was set to 90 days
      expect(putSpy).toHaveBeenCalled();
      const call = putSpy.mock.calls[0];
      expect(call[2]?.expirationTtl).toBe(90 * 24 * 60 * 60);
    });

    test('should set 10-minute TTL for OAuth state', async () => {
      const state = 'state-ttl-test';
      const sessionId = 'session';

      const putSpy = mock((kv as any).put.bind(kv));
      (kv as any).put = putSpy;

      await tokenStore.storeOAuthState(state, sessionId);

      // Verify expirationTtl was set to 10 minutes
      expect(putSpy).toHaveBeenCalled();
      const call = putSpy.mock.calls[0];
      expect(call[2]?.expirationTtl).toBe(10 * 60);
    });
  });

  describe('Key Formats', () => {
    test('should use correct key format for tokens', async () => {
      const sessionId = 'my-session';
      const tokens: TokenData = { accessToken: 'test' };

      const putSpy = mock((kv as any).put.bind(kv));
      (kv as any).put = putSpy;

      await tokenStore.storeTokens(sessionId, tokens);

      expect(putSpy).toHaveBeenCalledWith(
        'token:my-session',
        expect.any(String),
        expect.any(Object)
      );
    });

    test('should use correct key format for OAuth state', async () => {
      const state = 'my-state';
      const sessionId = 'session';

      const putSpy = mock((kv as any).put.bind(kv));
      (kv as any).put = putSpy;

      await tokenStore.storeOAuthState(state, sessionId);

      expect(putSpy).toHaveBeenCalledWith(
        'oauth_state:my-state',
        sessionId,
        expect.any(Object)
      );
    });
  });
});
