import type {
  AttachmentInfo,
  ProgressCallback,
  RawItemDetails,
  StorageItem,
} from "@/lib/vault/types";

/**
 * Abstract storage interface for Vault
 * Allows different storage backends (OPVault, SQLite, Cloud sync, etc.)
 */
export interface IVaultStorage {
  /**
   * Unlock the vault with password
   * This loads and decrypts the vault keys but doesn't load items yet
   * @param password Master password
   * @param onProgress Optional callback to track loading progress (loaded/total bands)
   * @throws WrongPasswordError if password is incorrect
   * @throws VaultCorruptedError if data integrity check fails
   */
  unlock(password: string, onProgress?: ProgressCallback): Promise<void>;

  /**
   * Check if vault is unlocked
   * @returns true if unlocked and ready to access items
   */
  readonly isUnlocked: boolean;

  /**
   * Load all items from storage
   * Only decrypts overview data (title, subtitle, category, tags, fav)
   * Item details remain encrypted for lazy loading
   * @returns Array of items with overview data
   * @throws VaultNotUnlockedError if vault is locked
   */
  loadItems(): Promise<StorageItem[]>;

  /**
   * Get decrypted details for a specific item (lazy loading)
   * @param itemId Item UUID
   * @returns Decrypted item details (passwords, notes, fields, etc.)
   * @throws ItemNotFoundError if item doesn't exist
   * @throws VaultNotUnlockedError if vault is locked
   */
  getItemDetails(itemId: string): Promise<RawItemDetails>;

  /**
   * Lock the vault
   * Clears all decryption keys from memory
   */
  lock(): void;

  /**
   * Clear crypto keys only, preserving items and caches.
   * Used by auto-lock for seamless resume after re-authentication.
   * Optional — if not implemented, falls back to lock().
   */
  clearKeysOnly?(): void;

  /**
   * Unlock vault keys only (no band/item loading)
   * Fast-fail on wrong password. Keys are derived and cached.
   * Optional — if not implemented, falls back to unlock().
   */
  unlockKeysOnly?(password: string): Promise<void>;

  /**
   * Load items progressively, one band at a time
   * Calls onBatch with Items from each band after decrypting overviews.
   * Calls onProgress after each band completes.
   * Optional — if not implemented, falls back to loadItems().
   */
  loadItemsProgressively?(
    onBatch: (items: StorageItem[]) => void,
    onProgress?: ProgressCallback,
  ): Promise<void>;

  /**
   * Get attachment metadata for an item (lazy, on-demand).
   * Reads .attachment files, parses headers, decrypts overview for filename.
   * Optional — not all storage backends support attachments.
   * @param itemId Item UUID
   * @returns Array of attachment info (filename, size, dates)
   */
  getAttachments?(itemId: string): Promise<AttachmentInfo[]>;

  /**
   * Decrypt and return attachment file content.
   * Optional — not all storage backends support attachments.
   * @param itemId Item UUID (owner of the attachment)
   * @param attachmentId Attachment UUID
   * @returns Decrypted attachment content
   */
  getAttachmentContent?(
    itemId: string,
    attachmentId: string,
  ): Promise<Uint8Array>;

  /**
   * Write changes back to the original storage location.
   * Optional — not implemented in read-only MVP.
   * @throws NotImplementedError until write support is added
   */
  writeBack?(): Promise<void>;

  /**
   * Re-read raw items from the underlying source.
   * Clears internal caches so the next loadItems() returns fresh data.
   * Called after sync updates files on disk.
   * Optional — not all storage backends need this.
   */
  reloadFromSource?(): Promise<void>;
}

/**
 * Base error for storage operations
 */
export class VaultStorageError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "VaultStorageError";
  }
}

/**
 * Password verification failed
 */
export class WrongPasswordError extends VaultStorageError {
  readonly passwordHint?: string;

  constructor(passwordHint?: string) {
    super("Incorrect password");
    this.name = "WrongPasswordError";
    this.passwordHint = passwordHint;
  }
}

/**
 * Vault data is corrupted or tampered with
 */
export class VaultCorruptedError extends VaultStorageError {
  constructor(message: string = "Vault data is corrupted") {
    super(message);
    this.name = "VaultCorruptedError";
  }
}

/**
 * Item not found in vault
 */
export class ItemNotFoundError extends VaultStorageError {
  constructor(public readonly itemId: string) {
    super(`Item not found: ${itemId}`);
    this.name = "ItemNotFoundError";
  }
}

/**
 * Extract a human-readable message from an unknown caught error
 */
export function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

/**
 * Run a function and wrap any non-vault errors in VaultCorruptedError.
 * Re-throws VaultCorruptedError and WrongPasswordError as-is.
 */
export function wrapCorruptedError<T>(fn: () => T, context: string): T {
  try {
    return fn();
  } catch (error) {
    if (
      error instanceof VaultCorruptedError ||
      error instanceof WrongPasswordError
    ) {
      throw error;
    }
    throw new VaultCorruptedError(`${context}: ${errorMessage(error)}`);
  }
}

/**
 * Attempting to access vault when locked
 */
export class VaultNotUnlockedError extends VaultStorageError {
  constructor() {
    super("Vault is locked. Call unlock() first.");
    this.name = "VaultNotUnlockedError";
  }
}

/**
 * Operation not yet implemented (placeholder for future features)
 */
export class NotImplementedError extends VaultStorageError {
  constructor(operation: string) {
    super(`${operation} is not yet implemented`);
    this.name = "NotImplementedError";
  }
}
