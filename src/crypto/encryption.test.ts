import { describe, test, expect, beforeEach } from 'bun:test';
import { TokenEncryption } from './encryption.js';

describe('TokenEncryption', () => {
  let encryption: TokenEncryption;
  const testKey = '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef'; // 64 hex chars = 32 bytes

  beforeEach(async () => {
    encryption = new TokenEncryption();
    await encryption.initialize(testKey);
  });

  test('should encrypt and decrypt a simple string', async () => {
    const plaintext = 'Hello, World!';
    const encrypted = await encryption.encrypt(plaintext);
    const decrypted = await encryption.decrypt(encrypted);

    expect(decrypted).toBe(plaintext);
    expect(encrypted).not.toBe(plaintext);
  });

  test('should encrypt and decrypt a complex token', async () => {
    const token = 'ya29.a0AfH6SMBxyz123...very-long-token-string';
    const encrypted = await encryption.encrypt(token);
    const decrypted = await encryption.decrypt(encrypted);

    expect(decrypted).toBe(token);
  });

  test('should produce different ciphertext for same plaintext (unique IV)', async () => {
    const plaintext = 'Same message';
    const encrypted1 = await encryption.encrypt(plaintext);
    const encrypted2 = await encryption.encrypt(plaintext);

    expect(encrypted1).not.toBe(encrypted2);

    // But both should decrypt to the same plaintext
    expect(await encryption.decrypt(encrypted1)).toBe(plaintext);
    expect(await encryption.decrypt(encrypted2)).toBe(plaintext);
  });

  test('should handle empty strings', async () => {
    const plaintext = '';
    const encrypted = await encryption.encrypt(plaintext);
    const decrypted = await encryption.decrypt(encrypted);

    expect(decrypted).toBe(plaintext);
  });

  test('should handle unicode characters', async () => {
    const plaintext = '🔐 Encrypted: 日本語 Español';
    const encrypted = await encryption.encrypt(plaintext);
    const decrypted = await encryption.decrypt(encrypted);

    expect(decrypted).toBe(plaintext);
  });

  test('should throw error when encrypting before initialization', async () => {
    const uninitializedEncryption = new TokenEncryption();

    await expect(uninitializedEncryption.encrypt('test')).rejects.toThrow(
      'Encryption key not initialized'
    );
  });

  test('should throw error when decrypting before initialization', async () => {
    const uninitializedEncryption = new TokenEncryption();

    await expect(uninitializedEncryption.decrypt('dGVzdA==')).rejects.toThrow(
      'Encryption key not initialized'
    );
  });

  test('should throw error when decrypting invalid ciphertext', async () => {
    await expect(encryption.decrypt('invalid-base64!')).rejects.toThrow();
  });

  test('should produce base64-encoded output', async () => {
    const plaintext = 'test';
    const encrypted = await encryption.encrypt(plaintext);

    // Base64 should only contain valid characters
    expect(encrypted).toMatch(/^[A-Za-z0-9+/]+=*$/);
  });

  test('should handle long strings', async () => {
    const plaintext = 'A'.repeat(10000);
    const encrypted = await encryption.encrypt(plaintext);
    const decrypted = await encryption.decrypt(encrypted);

    expect(decrypted).toBe(plaintext);
    expect(decrypted.length).toBe(10000);
  });
});
