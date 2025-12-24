import { describe, test, expect } from 'bun:test';
import { getOAuthConfig } from './config.js';

describe('getOAuthConfig', () => {
  test('should generate config with worker URL', () => {
    const env = {
      YNAB_CLIENT_ID: 'test-client-id',
      YNAB_CLIENT_SECRET: 'test-client-secret',
    };
    const workerUrl = 'https://mcp-ynab.workers.dev';

    const config = getOAuthConfig(env, workerUrl);

    expect(config.clientId).toBe('test-client-id');
    expect(config.clientSecret).toBe('test-client-secret');
    expect(config.redirectUri).toBe('https://mcp-ynab.workers.dev/oauth/callback');
    expect(config.authorizationUrl).toBe('https://app.ynab.com/oauth/authorize');
    expect(config.tokenUrl).toBe('https://app.ynab.com/oauth/token');
    expect(config.scopes).toEqual([]);
  });

  test('should handle different worker URLs', () => {
    const env = {
      YNAB_CLIENT_ID: 'client',
      YNAB_CLIENT_SECRET: 'secret',
    };

    const urls = [
      'https://worker1.dev',
      'https://custom-domain.com',
      'http://localhost:8787',
    ];

    urls.forEach((workerUrl) => {
      const config = getOAuthConfig(env, workerUrl);
      expect(config.redirectUri).toBe(`${workerUrl}/oauth/callback`);
    });
  });

  test('should use environment variables for credentials', () => {
    const env1 = {
      YNAB_CLIENT_ID: 'id-1',
      YNAB_CLIENT_SECRET: 'secret-1',
    };
    const env2 = {
      YNAB_CLIENT_ID: 'id-2',
      YNAB_CLIENT_SECRET: 'secret-2',
    };
    const workerUrl = 'https://test.dev';

    const config1 = getOAuthConfig(env1, workerUrl);
    const config2 = getOAuthConfig(env2, workerUrl);

    expect(config1.clientId).toBe('id-1');
    expect(config1.clientSecret).toBe('secret-1');
    expect(config2.clientId).toBe('id-2');
    expect(config2.clientSecret).toBe('secret-2');
  });

  test('should always use YNAB URLs', () => {
    const env = {
      YNAB_CLIENT_ID: 'test',
      YNAB_CLIENT_SECRET: 'test',
    };
    const workerUrl = 'https://any-url.com';

    const config = getOAuthConfig(env, workerUrl);

    expect(config.authorizationUrl).toBe('https://app.ynab.com/oauth/authorize');
    expect(config.tokenUrl).toBe('https://app.ynab.com/oauth/token');
  });

  test('should return empty scopes array', () => {
    const env = {
      YNAB_CLIENT_ID: 'test',
      YNAB_CLIENT_SECRET: 'test',
    };
    const workerUrl = 'https://test.dev';

    const config = getOAuthConfig(env, workerUrl);

    expect(config.scopes).toEqual([]);
    expect(Array.isArray(config.scopes)).toBe(true);
  });
});
