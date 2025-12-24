export interface Env {
  // KV Namespace
  MCP_FOR_YNAB: KVNamespace;

  // OAuth Configuration
  YNAB_CLIENT_ID: string;
  YNAB_CLIENT_SECRET: string;

  // Encryption Key (32 bytes hex string)
  TOKEN_ENCRYPTION_KEY: string;
}

export interface SessionData {
  userId: string;
  createdAt: number;
  lastAccessedAt: number;
}

export interface StoredTokenData {
  accessToken: string;
  refreshToken?: string;
  expiresAt?: number;
  encryptedAt: number;
}
