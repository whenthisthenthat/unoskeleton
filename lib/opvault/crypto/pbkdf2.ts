import type { KeyPair } from "@/lib/opvault/types";
import { pbkdf2Sync } from "react-native-quick-crypto";

/** Key pair derived from vault password */
export type DerivedKeys = KeyPair;

/**
 * Derive encryption and MAC keys from vault password using PBKDF2-HMAC-SHA512
 *
 * OPVault Spec:
 * - Password converted to UTF-8 null-terminated string
 * - PBKDF2 with HMAC-SHA512 as PRF
 * - Output: 64 bytes (512 bits)
 * - First 32 bytes: encryption key
 * - Last 32 bytes: MAC key
 *
 * @param password Vault master password
 * @param salt Base64-encoded salt from profile.js
 * @param iterations PBKDF2 iteration count (typically 50,000+)
 * @returns Derived encryption and MAC keys
 */
export function deriveKeysFromPassword(
  password: string,
  salt: string,
  iterations: number,
): DerivedKeys {
  // 1. Convert password to UTF-8 null-terminated string
  const passwordBuffer = Buffer.from(password + "\0", "utf8");

  // 2. Decode salt from base64
  const saltBuffer = Buffer.from(salt, "base64");

  // 3. Derive 64 bytes using PBKDF2-HMAC-SHA512
  const derived = pbkdf2Sync(
    passwordBuffer,
    saltBuffer,
    iterations,
    64, // 512 bits = 64 bytes
    "SHA-512",
  );

  // 4. Split into encryption key (first 32 bytes) and MAC key (last 32 bytes)
  return {
    encryptionKey: Buffer.from(derived.subarray(0, 32)),
    macKey: Buffer.from(derived.subarray(32, 64)),
  };
}
