import { TokenEncryption } from '../crypto/encryption.js';
import type { StoredTokenData } from '../worker-env.js';

export interface TokenData {
  accessToken: string;
  refreshToken?: string;
  expiresAt?: number;
}

export class KVTokenStore {
  private encryption: TokenEncryption;

  constructor(
    private kv: KVNamespace,
    private encryptionKey: string
  ) {
    this.encryption = new TokenEncryption();
  }

  async initialize(): Promise<void> {
    await this.encryption.initialize(this.encryptionKey);
  }

  /**
   * Store tokens for a session (encrypted)
   * Key format: token:sessionId
   */
  async storeTokens(sessionId: string, tokens: TokenData): Promise<void> {
    const data: StoredTokenData = {
      accessToken: await this.encryption.encrypt(tokens.accessToken),
      refreshToken: tokens.refreshToken
        ? await this.encryption.encrypt(tokens.refreshToken)
        : undefined,
      expiresAt: tokens.expiresAt,
      encryptedAt: Date.now(),
    };

    const key = `token:${sessionId}`;

    // Store with 90-day expiration (YNAB tokens expire after 90 days of inactivity)
    await this.kv.put(key, JSON.stringify(data), {
      expirationTtl: 90 * 24 * 60 * 60, // 90 days in seconds
    });
  }

  /**
   * Retrieve and decrypt tokens for a session
   */
  async getTokens(sessionId: string): Promise<TokenData | null> {
    const key = `token:${sessionId}`;
    const stored = await this.kv.get<StoredTokenData>(key, 'json');

    if (!stored) return null;

    return {
      accessToken: await this.encryption.decrypt(stored.accessToken),
      refreshToken: stored.refreshToken
        ? await this.encryption.decrypt(stored.refreshToken)
        : undefined,
      expiresAt: stored.expiresAt,
    };
  }

  /**
   * Delete tokens for a session
   */
  async deleteTokens(sessionId: string): Promise<void> {
    const key = `token:${sessionId}`;
    await this.kv.delete(key);
  }

  /**
   * Store OAuth state for CSRF protection
   * Key format: oauth_state:state
   * Short TTL (10 minutes)
   */
  async storeOAuthState(state: string, sessionId: string): Promise<void> {
    const key = `oauth_state:${state}`;
    await this.kv.put(key, sessionId, {
      expirationTtl: 10 * 60, // 10 minutes
    });
  }

  /**
   * Retrieve and delete OAuth state (one-time use)
   */
  async consumeOAuthState(state: string): Promise<string | null> {
    const key = `oauth_state:${state}`;
    const sessionId = await this.kv.get(key, 'text');

    if (sessionId) {
      await this.kv.delete(key);
    }

    return sessionId;
  }
}
