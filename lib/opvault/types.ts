/**
 * OPVault Format Type Definitions
 * Based on: https://support.1password.com/cs/opvault-design/
 */

/**
 * Category codes defined by the OPVault specification.
 * Does NOT include synthetic UI codes (000 All Items, 999 Archive).
 */
export type OPVaultCategoryCode =
  | "001" // Login
  | "002" // Credit Card
  | "003" // Secure Note
  | "004" // Identity
  | "005" // Password
  | "099" // Tombstone (deleted item)
  | "100" // Software License
  | "101" // Bank Account
  | "102" // Database
  | "103" // Driver License
  | "104" // Outdoor License
  | "105" // Membership
  | "106" // Passport
  | "107" // Rewards
  | "108" // SSN
  | "109" // Router
  | "110" // Server
  | "111"; // Email

/**
 * Profile data from profile.js
 * Contains encrypted master and overview keys
 */
export interface Profile {
  lastUpdatedBy: string;
  updatedAt: number; // Unix timestamp
  profileName: string;
  salt: string; // Base64-encoded 16-byte salt for PBKDF2
  passwordHint?: string; // Optional password hint
  masterKey: string; // Base64-encoded opdata01 (256 random bytes when decrypted)
  iterations: number; // PBKDF2 iteration count
  uuid: string; // Profile UUID
  overviewKey: string; // Base64-encoded opdata01 (64 random bytes when decrypted)
  createdAt: number; // Unix timestamp
}

/**
 * Item data from band files
 * Each item contains encrypted overview (o) and details (d)
 */
export interface OPVaultItem {
  uuid: string; // Item UUID (also used as key in band file)
  category: string; // Category code (001=Login, 002=Credit Card, etc.)
  created: number; // Unix timestamp
  updated: number; // Unix timestamp
  tx: number; // Transaction timestamp (for sync)
  folder?: string; // UUID of folder (optional)
  fave?: number; // Favorite sort index (optional, presence indicates favorite)
  trashed?: boolean; // Whether item is in trash (optional)
  k: string; // Base64-encoded encrypted item keys (IV + ciphertext + MAC, NOT opdata format)
  o: string; // Base64-encoded opdata01 encrypted overview
  d: string; // Base64-encoded opdata01 encrypted details
  hmac: string; // Base64-encoded HMAC-SHA256 over all fields except hmac and folder
}

/**
 * Folder data from folders.js
 */
export interface Folder {
  uuid: string;
  created: number; // Unix timestamp (may be 0 for old data)
  updated: number; // Unix timestamp (may be 0 for old data)
  tx: number; // Transaction timestamp
  overview: string; // Base64-encoded opdata01 encrypted folder name
  smart?: boolean; // Whether this is a smart folder (optional)
}

/**
 * Band file structure
 * Maps UUID → OPVaultItem
 */
export type BandFile = Record<string, OPVaultItem>;

/**
 * Base type for all encryption/MAC key pairs (32 bytes each).
 */
export interface KeyPair {
  encryptionKey: Buffer; // 32 bytes
  macKey: Buffer; // 32 bytes
}

/** Decrypted item keys (from item.k field) */
export type ItemKeys = KeyPair;

/** Master keys (decrypted from profile.masterKey) */
export type MasterKeys = KeyPair;

/** Overview keys (decrypted from profile.overviewKey) */
export type OverviewKeys = KeyPair;

/** Zero out a key pair's buffers for secure memory cleanup */
export function zeroizeKeyPair(keys: KeyPair): void {
  keys.encryptionKey.fill(0);
  keys.macKey.fill(0);
}

/**
 * Parsed header from .attachment binary file (16 bytes)
 * See: https://support.1password.com/cs/opvault-design/#attachments
 */
export interface AttachmentHeader {
  metadataSize: number; // uint16 LE at bytes 8-9
  iconSize: number; // uint32 LE at bytes 12-15
}

/**
 * Parsed JSON metadata from .attachment file
 * Embedded after the 16-byte binary header
 */
export interface AttachmentMetadata {
  itemUUID: string;
  uuid: string;
  contentsSize: number;
  external: boolean;
  createdAt: number; // Unix timestamp
  updatedAt: number; // Unix timestamp
  txTimestamp: number;
  overview: string; // Base64-encoded opdata01 (encrypted with overview keys)
}
