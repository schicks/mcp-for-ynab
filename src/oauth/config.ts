export interface OAuthConfig {
  clientId: string;
  clientSecret: string;
  redirectUri: string;
  authorizationUrl: string;
  tokenUrl: string;
  scopes: string[];
}

export function getOAuthConfig(
  env: { YNAB_CLIENT_ID: string; YNAB_CLIENT_SECRET: string },
  workerUrl: string
): OAuthConfig {
  return {
    clientId: env.YNAB_CLIENT_ID,
    clientSecret: env.YNAB_CLIENT_SECRET,
    redirectUri: `${workerUrl}/oauth/callback`,
    authorizationUrl: 'https://app.ynab.com/oauth/authorize',
    tokenUrl: 'https://app.ynab.com/oauth/token',
    scopes: [], // YNAB doesn't use scopes
  };
}
