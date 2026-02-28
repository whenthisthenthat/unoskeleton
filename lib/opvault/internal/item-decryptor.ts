import {
  decryptAES256CBC,
  verifyHMAC,
  validateBufferLength,
} from "@/lib/opvault/crypto/cipher";
import {
  decryptOpdata01,
  IV_LENGTH,
  MAC_LENGTH,
} from "@/lib/opvault/crypto/opdata";
import type {
  OPVaultItem,
  ItemKeys,
  MasterKeys,
  OverviewKeys,
} from "@/lib/opvault/types";
import { wrapCorruptedError } from "@/lib/vault/storage-interface";
import type { ItemOverview, RawItemDetails } from "@/lib/vault/types";

/**
 * Item Decryption Module
 *
 * OPVault item encryption structure:
 * 1. Item Keys (item.k): Encrypted with master keys (NOT opdata format)
 *    - Format: 16-byte IV + ciphertext + 32-byte HMAC
 *    - Decrypts to: 64 random bytes
 *    - Derive via SHA-512: 32-byte enc key + 32-byte MAC key
 *
 * 2. Item Overview (item.o): Encrypted with overview keys (opdata01 format)
 *    - Contains: title, URLs, username, etc. (category-specific)
 *    - Used for list views without decrypting sensitive data
 *
 * 3. Item Details (item.d): Encrypted with item-specific keys (opdata01 format)
 *    - Contains: passwords, secure notes, credit card numbers, etc.
 *    - Lazily decrypted only when viewing item details
 */

/**
 * Decrypt item-specific encryption keys from item.k field
 *
 * Unlike profile keys, item.k uses a simpler format (not opdata01):
 * - 16 bytes: Random IV
 * - N bytes: AES-256-CBC ciphertext (64 random bytes when decrypted)
 * - 32 bytes: HMAC-SHA256 over (IV + ciphertext)
 *
 * @param item OPVault item with encrypted keys
 * @param masterKeys Master encryption and MAC keys
 * @returns Item-specific encryption and MAC keys
 * @throws VaultCorruptedError if decryption fails or HMAC verification fails
 */
export function decryptItemKeys(
  item: OPVaultItem,
  masterKeys: MasterKeys,
): ItemKeys {
  return wrapCorruptedError(() => {
    // Base64 decode item.k
    const data = Buffer.from(item.k, "base64");

    if (data.length < IV_LENGTH + MAC_LENGTH) {
      throw new Error("Invalid item.k: data too short");
    }

    // Extract components: IV + ciphertext + MAC
    const iv = data.subarray(0, IV_LENGTH);
    const mac = data.subarray(data.length - MAC_LENGTH);
    const ciphertext = data.subarray(IV_LENGTH, data.length - MAC_LENGTH);

    // Verify HMAC over (IV + ciphertext)
    const dataToVerify = data.subarray(0, data.length - MAC_LENGTH);
    if (!verifyHMAC(dataToVerify, mac, masterKeys.macKey)) {
      throw new Error("HMAC verification failed for item keys");
    }

    // Decrypt with AES-256-CBC (no padding — plaintext is exactly 64 bytes)
    const decrypted = decryptAES256CBC(
      ciphertext,
      masterKeys.encryptionKey,
      iv,
    );

    validateBufferLength(decrypted, 64, "item key material");

    // Split directly: first 32 bytes = enc key, last 32 bytes = MAC key
    // Unlike profile keys, item keys are NOT hashed with SHA-512
    return {
      encryptionKey: Buffer.from(decrypted.subarray(0, 32)),
      macKey: Buffer.from(decrypted.subarray(32, 64)),
    };
  }, `Failed to decrypt item keys for ${item.uuid}`);
}

/**
 * Decrypt item overview data from item.o field
 *
 * Overview contains non-sensitive metadata for displaying in lists:
 * - title: Item title
 * - URLs: Associated URLs (for Logins)
 * - ainfo: Additional info (username for Logins, cardholder for Credit Cards)
 * - ps: Password strength (for Logins)
 * - tags: Item tags
 *
 * Structure varies by category; title defaults to "" if absent
 *
 * @param item OPVault item with encrypted overview
 * @param overviewKeys Overview encryption and MAC keys
 * @returns Decrypted overview as JSON object
 * @throws VaultCorruptedError if decryption fails
 */
export function decryptOverview(
  item: OPVaultItem,
  overviewKeys: OverviewKeys,
): ItemOverview {
  return wrapCorruptedError(() => {
    // Decrypt opdata01 format
    const decrypted = decryptOpdata01(
      item.o,
      overviewKeys.encryptionKey,
      overviewKeys.macKey,
    );

    // Parse JSON
    const overview = JSON.parse(decrypted.toString("utf8"));

    // Validate required fields
    if (typeof overview !== "object" || overview === null) {
      throw new Error("Overview is not a valid object");
    }

    if (typeof overview.title !== "string") {
      overview.title = "";
    }

    return overview as ItemOverview;
  }, `Failed to decrypt overview for ${item.uuid}`);
}

/**
 * Decrypt item details data from item.d field (lazy loading)
 *
 * Details contain sensitive data:
 * - fields: Array of secure fields (name, value, type)
 * - sections: Grouped sections of fields
 * - notesPlain: Plain text secure notes
 * - password: Actual password (for Logins)
 * - ccnum: Credit card number (for Credit Cards)
 *
 * Structure is category-specific and complex
 * Should only be decrypted when user views item details
 *
 * @param item OPVault item with encrypted details
 * @param itemKeys Item-specific encryption and MAC keys
 * @returns Decrypted details as JSON object
 * @throws VaultCorruptedError if decryption fails
 */
export function decryptDetails(
  item: OPVaultItem,
  itemKeys: ItemKeys,
): RawItemDetails {
  return wrapCorruptedError(() => {
    // Decrypt opdata01 format
    const decrypted = decryptOpdata01(
      item.d,
      itemKeys.encryptionKey,
      itemKeys.macKey,
    );

    // Parse JSON
    const details = JSON.parse(decrypted.toString("utf8"));

    // Basic validation
    if (typeof details !== "object" || details === null) {
      throw new Error("Details is not a valid object");
    }

    return details;
  }, `Failed to decrypt details for ${item.uuid}`);
}
