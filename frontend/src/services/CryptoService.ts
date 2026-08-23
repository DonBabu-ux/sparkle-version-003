/**
 * CryptoService.ts
 * Sparkle Enterprise Ephemeral Media Delivery v2
 *
 * Client-Side AES-256-GCM encryption & decryption and SHA-256 integrity hash.
 */

export class CryptoService {
  /**
   * Calculate SHA-256 hex digest of an ArrayBuffer or Uint8Array
   */
  static async sha256(buffer: ArrayBuffer | Uint8Array): Promise<string> {
    const hashBuf = await crypto.subtle.digest('SHA-256', buffer);
    return Array.from(new Uint8Array(hashBuf))
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('');
  }

  /**
   * Generate a secure random 256-bit AES key
   */
  static async generateAESKey(): Promise<CryptoKey> {
    return crypto.subtle.generateKey(
      { name: 'AES-GCM', length: 256 },
      true,
      ['encrypt', 'decrypt']
    );
  }

  /**
   * Export AES key to raw hex string
   */
  static async exportKey(key: CryptoKey): Promise<string> {
    const raw = await crypto.subtle.exportKey('raw', key);
    return Array.from(new Uint8Array(raw))
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('');
  }

  /**
   * Import AES key from raw hex string
   */
  static async importKey(hexKey: string): Promise<CryptoKey> {
    const match = hexKey.match(/.{1,2}/g);
    const bytes = new Uint8Array(match ? match.map((byte) => parseInt(byte, 16)) : []);
    return crypto.subtle.importKey('raw', bytes, { name: 'AES-GCM' }, true, ['encrypt', 'decrypt']);
  }

  /**
   * Encrypt ArrayBuffer using AES-256-GCM with a fresh 12-byte IV
   */
  static async encrypt(data: ArrayBuffer, key: CryptoKey): Promise<{ ciphertext: ArrayBuffer; ivHex: string }> {
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const ciphertext = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, data);
    const ivHex = Array.from(iv)
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('');
    return { ciphertext, ivHex };
  }

  /**
   * Decrypt AES-256-GCM ciphertext using IV hex and AES key
   */
  static async decrypt(ciphertext: ArrayBuffer, key: CryptoKey, ivHex: string): Promise<ArrayBuffer> {
    const match = ivHex.match(/.{1,2}/g);
    const iv = new Uint8Array(match ? match.map((byte) => parseInt(byte, 16)) : []);
    return crypto.subtle.decrypt({ name: 'AES-GCM', iv }, key, ciphertext);
  }
}

export default CryptoService;
