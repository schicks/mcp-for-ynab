export const OAUTH_CONFIG = {
  clientId: process.env.YNAB_CLIENT_ID || '',
  clientSecret: process.env.YNAB_CLIENT_SECRET || '',
  redirectUri: 'http://localhost:3737/oauth/callback',
  authorizationUrl: 'https://app.ynab.com/oauth/authorize',
  tokenUrl: 'https://app.ynab.com/oauth/token',
  scopes: [] as string[], // YNAB doesn't use scopes
} as const;
