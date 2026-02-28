import type { KeyPair } from "@/lib/opvault/types";
import {
  createDecipheriv,
  createHmac,
  createHash,
} from "react-native-quick-crypto";

/**
 * Decrypt data using AES-256-CBC
 * @param ciphertext Encrypted data
 * @param key 32-byte AES-256 key
 * @param iv 16-byte initialization vector
 * @param autoPadding Whether to use automatic PKCS7 padding (default: false)
 * @returns Decrypted plaintext
 */
export function decryptAES256CBC(
  ciphertext: Buffer,
  key: Buffer,
  iv: Buffer,
): Buffer {
  const decipher = createDecipheriv("aes-256-cbc", key, iv);
  decipher.setAutoPadding(false);

  return Buffer.concat([decipher.update(ciphertext), decipher.final()]);
}

/**
 * Compute HMAC-SHA256
 * @param data Data to authenticate
 * @param key 32-byte HMAC key
 * @returns 32-byte HMAC digest
 */
export function computeHMAC(data: Buffer, key: Buffer): Buffer {
  return Buffer.from(createHmac("sha256", key).update(data).digest());
}

/**
 * Verify HMAC-SHA256 using constant-time comparison
 * @param data Data that was authenticated
 * @param mac HMAC to verify
 * @param key 32-byte HMAC key
 * @returns true if MAC is valid, false otherwise
 */
export function verifyHMAC(data: Buffer, mac: Buffer, key: Buffer): boolean {
  const computedMac = computeHMAC(data, key);
  return mac.equals(computedMac); // Buffer.equals uses constant-time comparison
}

/**
 * Compute SHA-512 hash
 * @param data Data to hash
 * @returns 64-byte SHA-512 digest
 */
export function sha512(data: Buffer): Buffer {
  return Buffer.from(createHash("sha512").update(data).digest());
}

/**
 * Validate that a buffer has the expected length
 * @param buffer Buffer to validate
 * @param expected Expected byte length
 * @param context Description for error message (e.g., "master key material")
 * @throws Error if length doesn't match
 */
export function validateBufferLength(
  buffer: Buffer,
  expected: number,
  context: string,
): void {
  if (buffer.length !== expected) {
    throw new Error(
      `Expected ${expected} bytes for ${context}, got ${buffer.length}`,
    );
  }
}

/**
 * Derive master or overview key pair from random data
 * Per OPVault spec: SHA-512 hash of decrypted key material
 * - First 32 bytes: encryption key
 * - Last 32 bytes: MAC key
 *
 * @param keyMaterial Decrypted random bytes (256 for master, 64 for overview)
 * @returns Encryption and MAC keys
 */
export function deriveKeyPairFromMaterial(keyMaterial: Buffer): KeyPair {
  const hash = sha512(keyMaterial);

  return {
    encryptionKey: Buffer.from(hash.subarray(0, 32)),
    macKey: Buffer.from(hash.subarray(32, 64)),
  };
}
