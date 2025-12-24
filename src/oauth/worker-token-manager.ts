import { KVTokenStore } from '../storage/kv-token-store.js';
import { WebOAuthClient } from './web-client.js';

export class WorkerTokenManager {
  constructor(
    private tokenStore: KVTokenStore,
    private oauthClient: WebOAuthClient
  ) {}

  /**
   * Get access token for a session, refreshing if necessary
   */
  async getAccessToken(sessionId: string): Promise<string | null> {
    const tokens = await this.tokenStore.getTokens(sessionId);

    if (!tokens) {
      return null; // User needs to authenticate
    }

    // Check if token is expired (with 5-minute buffer)
    if (tokens.expiresAt) {
      const now = Date.now() / 1000;
      const buffer = 5 * 60; // 5 minutes

      if (now >= tokens.expiresAt - buffer) {
        if (tokens.refreshToken) {
          // Auto-refresh token
          return await this.refreshAccessToken(sessionId, tokens.refreshToken);
        } else {
          // No refresh token, need to re-authenticate
          return null;
        }
      }
    }

    return tokens.accessToken;
  }

  /**
   * Store tokens after successful OAuth flow
   */
  async storeTokens(
    sessionId: string,
    accessToken: string,
    refreshToken?: string,
    expiresIn?: number
  ): Promise<void> {
    await this.tokenStore.storeTokens(sessionId, {
      accessToken,
      refreshToken,
      expiresAt: expiresIn ? Math.floor(Date.now() / 1000) + expiresIn : undefined,
    });
  }

  /**
   * Refresh access token
   */
  private async refreshAccessToken(
    sessionId: string,
    refreshToken: string
  ): Promise<string> {
    const tokens = await this.oauthClient.refreshToken(refreshToken);

    await this.storeTokens(
      sessionId,
      tokens.access_token,
      tokens.refresh_token || refreshToken,
      tokens.expires_in
    );

    return tokens.access_token;
  }

  /**
   * Check if session is authenticated
   */
  async isAuthenticated(sessionId: string): Promise<boolean> {
    const tokens = await this.tokenStore.getTokens(sessionId);
    return tokens !== null;
  }

  /**
   * Clear tokens for a session
   */
  async clearTokens(sessionId: string): Promise<void> {
    await this.tokenStore.deleteTokens(sessionId);
  }
}
