import { AttachmentHandler } from "@/lib/opvault/attachment-handler";
import { opvaultCodeToCategory } from "@/lib/opvault/category-map";
import { getOrCompute } from "@/lib/opvault/internal/get-or-compute";
import {
  decryptItemKeys,
  decryptOverview,
  decryptDetails,
} from "@/lib/opvault/internal/item-decryptor";
import { deriveVaultKeys } from "@/lib/opvault/internal/key-derivation";
import {
  readAndParseProfile,
  readAndParseBands,
  readAndParseBandsProgressively,
} from "@/lib/opvault/internal/reader";
import type {
  BandFile,
  Profile,
  OPVaultItem,
  MasterKeys,
  OverviewKeys,
  ItemKeys,
} from "@/lib/opvault/types";
import { zeroizeKeyPair } from "@/lib/opvault/types";
import { unixToDate } from "@/lib/vault/date-conversion";
import type { IVaultStorage } from "@/lib/vault/storage-interface";
import {
  VaultNotUnlockedError,
  ItemNotFoundError,
  WrongPasswordError,
  VaultCorruptedError,
  NotImplementedError,
  errorMessage,
  wrapCorruptedError,
} from "@/lib/vault/storage-interface";
import type {
  AttachmentInfo,
  ItemOverview,
  RawItemDetails,
  StorageItem,
} from "@/lib/vault/types";
import type { IVaultSource } from "@/lib/vault/vault-source";

/**
 * OPVault Low-Level Client (LLC)
 *
 * Implements IVaultStorage interface for OPVault format
 * Handles reading and decrypting 1Password OPVault directories
 *
 * Architecture:
 * - Constructor takes IVaultSource for band/profile reading and optionally
 *   a separate IVaultSource for attachment reading
 * - unlock() loads profile, derives keys, loads all band files
 * - loadItems() decrypts all item overviews and maps to StorageItem interface
 * - getItemDetails() lazily decrypts item.d on demand
 * - lock() clears all keys from memory
 *
 * Security:
 * - Keys stored in memory only while unlocked
 * - All keys cleared on lock()
 * - HMAC verification before all decryption (Verify-then-Decrypt)
 * - Item details lazily decrypted (only when viewed)
 */
export class OPVaultClient implements IVaultStorage {
  private readonly source: IVaultSource;
  private readonly attachments: AttachmentHandler;

  // Vault data (loaded during unlock)
  private profile: Profile | null = null;
  private items: Map<string, OPVaultItem> = new Map();

  // Decryption keys (derived during unlock, cleared on lock)
  private masterKeys: MasterKeys | null = null;
  private overviewKeys: OverviewKeys | null = null;

  // Cached decrypted overviews (for performance)
  private overviewCache: Map<string, ItemOverview> = new Map();

  // Cached item keys (for lazy details decryption)
  private itemKeysCache: Map<string, ItemKeys> = new Map();

  // Unlock state
  private _unlocked: boolean = false;

  /**
   * Create OPVault client for a specific vault source
   *
   * @param source IVaultSource for bands, profile, and folders
   * @param attachmentSource IVaultSource for attachment files (defaults to source;
   *   pass a FallbackVaultSource on warm path for partial attachment caches)
   */
  constructor(source: IVaultSource, attachmentSource?: IVaultSource) {
    this.source = source;
    this.attachments = new AttachmentHandler(attachmentSource ?? source);
  }

  /**
   * Assert vault is unlocked and return typed key references.
   * Eliminates per-method null checks and non-null assertions.
   */
  private requireUnlocked(): {
    masterKeys: MasterKeys;
    overviewKeys: OverviewKeys;
  } {
    if (!this._unlocked || !this.masterKeys || !this.overviewKeys) {
      throw new VaultNotUnlockedError();
    }
    return { masterKeys: this.masterKeys, overviewKeys: this.overviewKeys };
  }

  /**
   * Handle errors during unlock, preserving password hint before clearing state.
   * Rethrows WrongPasswordError with hint, passes through VaultCorruptedError,
   * wraps all other errors as VaultCorruptedError.
   */
  private handleUnlockError(error: unknown): never {
    const hint = this.profile?.passwordHint;
    this.lock();

    if (error instanceof WrongPasswordError) {
      throw new WrongPasswordError(hint);
    }
    if (error instanceof VaultCorruptedError) {
      throw error;
    }
    throw new VaultCorruptedError(
      `Failed to unlock vault: ${errorMessage(error)}`,
    );
  }

  /**
   * Unlock vault with master password
   *
   * Two-phase approach for fast-fail on wrong password:
   * 1. Read profile.js only and verify password (fast-fail path)
   * 2. Read band files only if password is correct
   *
   * @param password Master vault password
   * @throws WrongPasswordError if password is incorrect
   * @throws VaultCorruptedError if vault data is corrupted
   */
  async unlock(
    password: string,
    onProgress?: (loaded: number, total: number) => void,
  ): Promise<void> {
    try {
      // PHASE 1: Read profile only and verify password (fast-fail path)
      this.profile = await readAndParseProfile(this.source);

      // Verify password by deriving keys
      // This throws WrongPasswordError if incorrect
      const { masterKeys, overviewKeys } = deriveVaultKeys(
        password,
        this.profile,
      );

      // Password is correct! Cache the keys
      this.masterKeys = masterKeys;
      this.overviewKeys = overviewKeys;

      // PHASE 2: Read band files (only if password correct)
      this.items = await readAndParseBands(this.source, onProgress);

      // Build attachment filename index from source listing
      await this.attachments.buildIndex();

      // Clear caches
      this.overviewCache.clear();
      this.itemKeysCache.clear();

      this._unlocked = true;
    } catch (error) {
      this.handleUnlockError(error);
    } finally {
    }
  }

  /**
   * Check if vault is unlocked
   *
   * @returns true if unlocked and ready to access items
   */
  get isUnlocked(): boolean {
    return this._unlocked;
  }

  /**
   * Decrypt overview and construct a StorageItem from an OPVaultItem
   */
  private buildItem(
    uuid: string,
    opItem: OPVaultItem,
    overviewKeys: OverviewKeys,
  ): StorageItem | null {
    const category = opvaultCodeToCategory(opItem.category);
    if (category === null) return null; // Tombstone / deleted item

    const overview = getOrCompute(this.overviewCache, uuid, () =>
      decryptOverview(opItem, overviewKeys),
    );

    return {
      uuid: opItem.uuid,
      category,
      created: unixToDate(opItem.created),
      updated: unixToDate(opItem.updated),
      tx: opItem.tx,
      folder: opItem.folder,
      fave: opItem.fave,
      trashed: opItem.trashed,
      title: overview.title,
      overview: overview,
      attachmentCount: this.attachments.getAttachmentCount(uuid),
    };
  }

  /**
   * Load all items from vault
   *
   * Decrypts all item overviews (title, subtitle, category, tags)
   * Item details (passwords, notes) remain encrypted for lazy loading
   *
   * @returns Array of items with overview data
   * @throws VaultNotUnlockedError if vault is locked
   */
  async loadItems(): Promise<StorageItem[]> {
    const { overviewKeys } = this.requireUnlocked();

    return wrapCorruptedError(() => {
      const items: StorageItem[] = [];
      for (const [uuid, opItem] of this.items.entries()) {
        const item = this.buildItem(uuid, opItem, overviewKeys);
        if (item) items.push(item);
      }
      return items;
    }, "Failed to load items");
  }

  /**
   * Get decrypted details for a specific item (lazy loading)
   *
   * Decrypts item details on-demand:
   * 1. Decrypt item keys from item.k (if not cached)
   * 2. Decrypt item details from item.d
   *
   * @param itemId Item UUID
   * @returns Decrypted item details (passwords, notes, fields, etc.)
   * @throws ItemNotFoundError if item doesn't exist
   * @throws VaultNotUnlockedError if vault is locked
   */
  async getItemDetails(itemId: string): Promise<RawItemDetails> {
    const { masterKeys } = this.requireUnlocked();

    const opItem = this.items.get(itemId);
    if (!opItem) {
      throw new ItemNotFoundError(itemId);
    }

    return wrapCorruptedError(() => {
      const itemKeys = getOrCompute(this.itemKeysCache, itemId, () =>
        decryptItemKeys(opItem, masterKeys),
      );
      return decryptDetails(opItem, itemKeys);
    }, `Failed to decrypt item details for ${itemId}`);
  }

  /**
   * Unlock vault keys only — no band loading
   *
   * Reads profile.js, derives keys, and fast-fails on wrong password.
   * Call loadItemsProgressively() afterwards to stream items per-band.
   *
   * @param password Master vault password
   * @throws WrongPasswordError if password is incorrect
   * @throws VaultCorruptedError if vault data is corrupted
   */
  async unlockKeysOnly(password: string): Promise<void> {
    try {
      this.profile = await readAndParseProfile(this.source);
      const { masterKeys, overviewKeys } = deriveVaultKeys(
        password,
        this.profile,
      );

      this.masterKeys = masterKeys;
      this.overviewKeys = overviewKeys;
      this.overviewCache.clear();
      this.itemKeysCache.clear();
      await this.attachments.buildIndex();
      this._unlocked = true;
    } catch (error) {
      // Keys-only unlock failed: preserve items in memory so user can retry.
      // Do NOT call lock() here — that would destroy the items map that was
      // preserved through the soft-lock.
      const hint = this.profile?.passwordHint;
      this.masterKeys = null;
      this.overviewKeys = null;
      this.itemKeysCache.clear();
      this._unlocked = false;

      if (error instanceof WrongPasswordError) {
        throw new WrongPasswordError(hint);
      }
      if (error instanceof VaultCorruptedError) {
        throw error;
      }
      throw new VaultCorruptedError(
        `Failed to unlock vault: ${errorMessage(error)}`,
      );
    }
  }

  /**
   * Load items progressively, one band at a time
   *
   * Reads each band file, decrypts overviews, and calls onBatch with
   * the constructed StorageItems. Also populates the internal items map so
   * getItemDetails() works for already-loaded items.
   *
   * @param onBatch Called with StorageItems from each band after decryption
   * @param onProgress Called with (loaded, total) after each band
   * @throws VaultNotUnlockedError if vault is locked
   */
  async loadItemsProgressively(
    onBatch: (items: StorageItem[]) => void,
    onProgress?: (loaded: number, total: number) => void,
  ): Promise<void> {
    const { overviewKeys } = this.requireUnlocked();

    await readAndParseBandsProgressively(
      this.source,
      (bandData: BandFile) => {
        const batchItems: StorageItem[] = [];

        for (const [uuid, opItem] of Object.entries(bandData)) {
          // Store raw item for getItemDetails()
          this.items.set(uuid, opItem);

          try {
            const item = this.buildItem(uuid, opItem, overviewKeys);
            if (item) batchItems.push(item);
          } catch (err) {}
        }

        if (batchItems.length > 0) {
          onBatch(batchItems);
        }
      },
      onProgress,
    );
  }

  /**
   * Re-read band files from the source and rebuild internal state.
   * Clears overview and item-key caches since the underlying data has changed.
   * Called after cache sync updates files on disk.
   */
  async reloadFromSource(): Promise<void> {
    this.requireUnlocked();
    this.items = await readAndParseBands(this.source);
    this.overviewCache.clear();
    this.itemKeysCache.clear();
    await this.attachments.buildIndex();
  }

  /**
   * Lock vault and clear all keys from memory
   *
   * Security: Zeros out all key buffers before clearing references
   */
  lock(): void {
    // Zero out key buffers
    if (this.masterKeys) {
      zeroizeKeyPair(this.masterKeys);
    }

    if (this.overviewKeys) {
      zeroizeKeyPair(this.overviewKeys);
    }

    // Zero out cached item keys
    for (const itemKeys of this.itemKeysCache.values()) {
      zeroizeKeyPair(itemKeys);
    }

    // Clear all state
    this.profile = null;
    this.masterKeys = null;
    this.overviewKeys = null;
    this.items.clear();
    this.overviewCache.clear();
    this.itemKeysCache.clear();
    this.attachments.clear();
    this._unlocked = false;
  }

  /**
   * Clear crypto keys only, preserving items and caches.
   * Used by auto-lock so the UI can resume after re-authentication
   * without reloading band files.
   */
  clearKeysOnly(): void {
    if (this.masterKeys) {
      zeroizeKeyPair(this.masterKeys);
    }
    if (this.overviewKeys) {
      zeroizeKeyPair(this.overviewKeys);
    }
    for (const itemKeys of this.itemKeysCache.values()) {
      zeroizeKeyPair(itemKeys);
    }

    this.masterKeys = null;
    this.overviewKeys = null;
    this.itemKeysCache.clear();
    this._unlocked = false;
    // Keep: items, overviewCache, profile, attachments
  }

  /**
   * Get attachment metadata for an item.
   * Reads .attachment files on demand, parses headers, decrypts overview for filename.
   */
  async getAttachments(itemId: string): Promise<AttachmentInfo[]> {
    const { overviewKeys } = this.requireUnlocked();

    return this.attachments.getAttachments(itemId, overviewKeys);
  }

  /**
   * Decrypt and return attachment file content.
   * Uses item keys to decrypt the raw binary opdata01 content section.
   */
  async getAttachmentContent(
    itemId: string,
    attachmentId: string,
  ): Promise<Uint8Array> {
    const { masterKeys } = this.requireUnlocked();

    const opItem = this.items.get(itemId);
    if (!opItem) {
      throw new ItemNotFoundError(itemId);
    }

    return this.attachments.getAttachmentContent(
      itemId,
      attachmentId,
      opItem,
      masterKeys,
      this.itemKeysCache,
    );
  }

  /**
   * Write changes back to the original vault directory.
   * @throws NotImplementedError — write support not yet implemented
   */
  async writeBack(): Promise<void> {
    throw new NotImplementedError("OPVaultClient.writeBack");
  }
}
