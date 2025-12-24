import { OAuthClient } from './client.ts';

interface TokenData {
  accessToken: string;
  refreshToken?: string;
  expiresAt?: number; // Unix timestamp
}

export class TokenManager {
  private tokenData: TokenData | null = null;
  private oauthClient = new OAuthClient();

  async getAccessToken(): Promise<string> {
    // If no token, initiate OAuth flow
    if (!this.tokenData) {
      await this.authenticate();
    }

    // Check if token is expired (with 5-minute buffer)
    if (this.tokenData!.expiresAt) {
      const now = Date.now() / 1000;
      const buffer = 5 * 60; // 5 minutes

      if (now >= this.tokenData!.expiresAt - buffer) {
        if (this.tokenData!.refreshToken) {
          await this.refresh();
        } else {
          // No refresh token, need to re-authenticate
          await this.authenticate();
        }
      }
    }

    return this.tokenData!.accessToken;
  }

  private async authenticate(): Promise<void> {
    console.error('Starting OAuth authentication...');
    const tokens = await this.oauthClient.authorize();

    this.tokenData = {
      accessToken: tokens.access_token,
      refreshToken: tokens.refresh_token,
      expiresAt: tokens.expires_in ? Math.floor(Date.now() / 1000) + tokens.expires_in : undefined,
    };

    console.error('Authentication successful!\n');
  }

  private async refresh(): Promise<void> {
    if (!this.tokenData?.refreshToken) {
      throw new Error('No refresh token available');
    }

    console.error('Refreshing access token...');
    const tokens = await this.oauthClient.refreshToken(this.tokenData.refreshToken);

    this.tokenData = {
      accessToken: tokens.access_token,
      refreshToken: tokens.refresh_token || this.tokenData.refreshToken,
      expiresAt: tokens.expires_in ? Math.floor(Date.now() / 1000) + tokens.expires_in : undefined,
    };

    console.error('Token refreshed!\n');
  }

  isAuthenticated(): boolean {
    return this.tokenData !== null;
  }

  clear(): void {
    this.tokenData = null;
  }
}
