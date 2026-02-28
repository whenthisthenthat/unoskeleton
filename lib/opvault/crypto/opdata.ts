import { verifyHMAC } from "@/lib/opvault/crypto/cipher";
import { createDecipheriv } from "react-native-quick-crypto";

/**
 * opdata01 Format Specification:
 * - Bytes 0-7: "opdata01" header
 * - Bytes 8-15: Plaintext length (little-endian uint64)
 * - Bytes 16-31: Random IV (16 bytes)
 * - Bytes 32 to -32: AES-256-CBC ciphertext (includes random padding)
 * - Last 32 bytes: HMAC-SHA256 over all preceding bytes
 *
 * Padding scheme:
 * - If plaintext length is multiple of 16: prepend 1 block (16 bytes) of random data
 * - Otherwise: prepend 1-15 bytes of random data to align to 16-byte blocks
 */

const OPDATA_HEADER = "opdata01";
const HEADER_LENGTH = 8;
const PLAINTEXT_LENGTH_SIZE = 8;
/** AES-256 initialization vector size (16 bytes) */
export const IV_LENGTH = 16;
/** HMAC-SHA256 digest size (32 bytes) */
export const MAC_LENGTH = 32;
const BLOCK_SIZE = 16;

/**
 * Core opdata01 decryption logic operating on raw Buffer.
 * Shared by both base64 and raw binary entry points.
 */
function decodeOpdataBuffer(
  data: Buffer,
  encryptionKey: Buffer,
  macKey: Buffer,
): Buffer {
  if (
    data.length <
    HEADER_LENGTH + PLAINTEXT_LENGTH_SIZE + IV_LENGTH + MAC_LENGTH
  ) {
    throw new Error("Invalid opdata01: data too short");
  }

  // 1. Verify HMAC (Verify-then-Decrypt)
  const mac = data.subarray(data.length - MAC_LENGTH);
  const dataToVerify = data.subarray(0, data.length - MAC_LENGTH);

  if (!verifyHMAC(dataToVerify, mac, macKey)) {
    throw new Error(
      "HMAC verification failed: data may be corrupted or tampered",
    );
  }

  // 2. Verify header
  const header = data.subarray(0, HEADER_LENGTH).toString("utf8");
  if (header !== OPDATA_HEADER) {
    throw new Error(
      `Invalid opdata01 header: expected "${OPDATA_HEADER}", got "${header}"`,
    );
  }

  // 3. Read plaintext length (little-endian uint64)
  const plaintextLength = Number(data.readBigUInt64LE(HEADER_LENGTH));

  // 4. Extract IV
  const ivOffset = HEADER_LENGTH + PLAINTEXT_LENGTH_SIZE;
  const iv = data.subarray(ivOffset, ivOffset + IV_LENGTH);

  // 5. Extract ciphertext (everything between IV and MAC)
  const ciphertextOffset = ivOffset + IV_LENGTH;
  const ciphertext = data.subarray(ciphertextOffset, data.length - MAC_LENGTH);

  // 6. Decrypt with AES-256-CBC
  const decipher = createDecipheriv("aes-256-cbc", encryptionKey, iv);
  decipher.setAutoPadding(false); // We handle padding ourselves

  const decrypted = Buffer.concat([
    decipher.update(ciphertext),
    decipher.final(),
  ]);

  // 7. Strip random padding
  // Padding calculation: if plaintext % 16 == 0, prepend 16 bytes; otherwise prepend (16 - (plaintext % 16)) bytes
  const paddingLength =
    plaintextLength % BLOCK_SIZE === 0
      ? BLOCK_SIZE
      : BLOCK_SIZE - (plaintextLength % BLOCK_SIZE);

  if (decrypted.length < paddingLength + plaintextLength) {
    throw new Error(
      "Invalid opdata01: decrypted data too short for specified plaintext length",
    );
  }

  // 8. Return plaintext (skip padding)
  return decrypted.subarray(paddingLength, paddingLength + plaintextLength);
}

/**
 * Decode and decrypt base64-encoded opdata01 format
 * Used for item overviews, details, and profile keys in band/profile files.
 * @param encodedData Base64-encoded opdata01 string
 * @param encryptionKey 32-byte AES-256 encryption key
 * @param macKey 32-byte HMAC-SHA256 key
 * @returns Decrypted plaintext as Buffer
 * @throws Error if HMAC verification fails or format is invalid
 */
export function decryptOpdata01(
  encodedData: string,
  encryptionKey: Buffer,
  macKey: Buffer,
): Buffer {
  const data = Buffer.from(encodedData, "base64");
  return decodeOpdataBuffer(data, encryptionKey, macKey);
}

/**
 * Decode and decrypt raw binary opdata01 format
 * Used for attachment icon and content sections where opdata01 is NOT base64-encoded.
 * @param data Raw binary opdata01 Buffer
 * @param encryptionKey 32-byte AES-256 encryption key
 * @param macKey 32-byte HMAC-SHA256 key
 * @returns Decrypted plaintext as Buffer
 * @throws Error if HMAC verification fails or format is invalid
 */
export function decryptOpdata01Raw(
  data: Buffer,
  encryptionKey: Buffer,
  macKey: Buffer,
): Buffer {
  return decodeOpdataBuffer(data, encryptionKey, macKey);
}

/**
 * Verify HMAC without decrypting (for validation)
 * @param encodedData Base64-encoded opdata01 string
 * @param macKey 32-byte HMAC-SHA256 key
 * @returns true if HMAC is valid, false otherwise
 */
export function verifyOpdata01HMAC(
  encodedData: string,
  macKey: Buffer,
): boolean {
  try {
    const data = Buffer.from(encodedData, "base64");

    if (data.length < MAC_LENGTH) {
      return false;
    }

    const mac = data.subarray(data.length - MAC_LENGTH);
    const dataToVerify = data.subarray(0, data.length - MAC_LENGTH);

    return verifyHMAC(dataToVerify, mac, macKey);
  } catch {
    return false;
  }
}
