import { Category } from "@/lib/vault/categories";
import { enrichItem, isItemFavorite } from "@/lib/vault/item-display";
import type { IVaultStorage } from "@/lib/vault/storage-interface";
import {
  VaultStorageError,
  ItemNotFoundError,
} from "@/lib/vault/storage-interface";
import type { SyncManager } from "@/lib/vault/sync-manager";
import type {
  AttachmentInfo,
  Item,
  LoadingProgress,
  ProgressCallback,
  RawItemDetails,
  SyncResult,
} from "@/lib/vault/types";
import {
  searchAndSort,
  filterByField,
  sortItems,
  SortField,
  SortOrder,
} from "@/lib/vault/vault-query-engine";
import type { SortOptions } from "@/lib/vault/vault-query-engine";
import type { IVaultSource } from "@/lib/vault/vault-source";
import mitt, { type Emitter } from "mitt";

// Re-export for backward compatibility
export { SortField, SortOrder };
export type { SortOptions };

/** Events emitted by Vault during progressive loading and sync operations */
export type VaultEvents = {
  /** New batch of items loaded from a band */
  "items-changed": Item[];
  /** All bands finished loading */
  "loading-complete": undefined;
  /** Sync operation started */
  "sync-started": undefined;
  /** Sync operation completed */
  "sync-complete": SyncResult;
  /** Sync operation failed */
  "sync-error": string;
};

/** Callbacks for the one-shot progressive loading flow */
export interface ProgressiveCallbacks {
  /** Band loading progress (loaded, total) */
  onProgress?: ProgressCallback;
  /** Signals the caller to navigate (first favourite found, or all bands done) */
  onReadyToNavigate?: () => void;
}

const DEFAULT_SORT: SortOptions = {
  field: SortField.Title,
  order: SortOrder.Asc,
};

export class Vault {
  private storage: IVaultStorage | null = null;
  private items: Item[] | null = null;

  // Event emitter for reactive UI updates
  private emitter: Emitter<VaultEvents> = mitt<VaultEvents>();
  private _isLoading: boolean = false;
  private _loadingProgress: LoadingProgress | null = null;
  private _syncManager: SyncManager | null = null;

  /**
   * Constructor supports two modes:
   * 1. New mode (dependency injection): Pass IVaultStorage
   * 2. Legacy mode (backwards compatible): Pass Item[] directly
   */
  constructor(storageOrItems: IVaultStorage | Item[]) {
    if (Array.isArray(storageOrItems)) {
      // Legacy mode: Direct item array (for existing tests)
      this.items = sortItems(storageOrItems, DEFAULT_SORT);
    } else {
      // New mode: Dependency injection
      this.storage = storageOrItems;
    }
  }

  /** Whether vault is still progressively loading items */
  get isLoading(): boolean {
    return this._isLoading;
  }

  /** Current band loading progress, or null if not loading */
  get loadingProgress(): LoadingProgress | null {
    return this._loadingProgress;
  }

  /** Subscribe to vault events */
  on<K extends keyof VaultEvents>(
    event: K,
    handler: (data: VaultEvents[K]) => void,
  ): void {
    this.emitter.on(event, handler);
  }

  /** Unsubscribe from vault events */
  off<K extends keyof VaultEvents>(
    event: K,
    handler: (data: VaultEvents[K]) => void,
  ): void {
    this.emitter.off(event, handler);
  }

  /** Set the sync manager (called by vault-instance after construction) */
  setSyncManager(manager: SyncManager): void {
    this._syncManager = manager;
  }

  /**
   * Request a sync operation against the original vault directory.
   * Emits sync-started and sync-complete events.
   * If already syncing, joins the in-progress sync.
   */
  async requestSync(
    source: IVaultSource,
    vaultUri: string,
  ): Promise<SyncResult> {
    if (!this._syncManager || !this.storage) {
      throw new VaultStorageError("Sync not available");
    }

    if (this._isLoading) {
      return { changed: false };
    }

    this.emitter.emit("sync-started", undefined);

    const currentItemCount = this.items?.length ?? 0;

    try {
      const result = await this._syncManager.sync(
        source,
        vaultUri,
        async () => {
          if (this.storage!.reloadFromSource) {
            await this.storage!.reloadFromSource();
          }
          const newItems = await this.storage!.loadItems();
          this.items = sortItems(newItems.map(enrichItem), DEFAULT_SORT);
          this.emitter.emit("items-changed", this.items);
          return this.items;
        },
        currentItemCount,
      );

      this.emitter.emit("sync-complete", result);
      return result;
    } catch (err) {
      const message = err instanceof Error ? err.message : "Sync failed";
      this.emitter.emit("sync-error", message);
      throw err;
    }
  }

  /**
   * Initialize vault by loading items from storage
   * Required when using IVaultStorage constructor mode
   * @param password Master password for unlocking vault
   */
  async initialize(
    password: string,
    onProgress?: ProgressCallback,
  ): Promise<void> {
    if (!this.storage) {
      throw new VaultStorageError(
        "Cannot initialize: Vault was created with direct items array",
      );
    }

    // Unlock vault with progress callback
    await this.storage.unlock(password, onProgress);

    const loadedItems = await this.storage.loadItems();

    this.items = sortItems(loadedItems.map(enrichItem), DEFAULT_SORT);
  }

  /**
   * Initialize vault with progressive band loading
   *
   * Phase 1: Key derivation (fast-fail on wrong password)
   * Phase 2: Read bands one at a time, decrypt overviews, emit items-changed
   * Phase 3: Sort all items, emit loading-complete
   *
   * Signals onReadyToNavigate when first favourite is found (or after all bands).
   * Falls back to initialize() if storage lacks progressive methods.
   */
  async initializeProgressive(
    password: string,
    callbacks?: ProgressiveCallbacks,
  ): Promise<void> {
    if (!this.storage) {
      throw new VaultStorageError(
        "Cannot initialize: Vault was created with direct items array",
      );
    }

    // Fallback if storage doesn't support progressive loading
    if (!this.storage.unlockKeysOnly || !this.storage.loadItemsProgressively) {
      await this.initialize(password, callbacks?.onProgress);
      callbacks?.onReadyToNavigate?.();
      return;
    }

    // Phase 1: Key derivation (fast-fail on wrong password)
    await this.storage.unlockKeysOnly(password);

    // Phase 2: Progressive band loading
    this._isLoading = true;
    this.items = [];

    let readySignalled = false;

    const wrappedOnProgress = (loaded: number, total: number) => {
      this._loadingProgress = { loaded, total };
      callbacks?.onProgress?.(loaded, total);
    };

    await this.storage.loadItemsProgressively((storageItems) => {
      const batchItems = storageItems.map(enrichItem);
      this.items!.push(...batchItems);
      this.items = sortItems(this.items!, DEFAULT_SORT);
      this.emitter.emit("items-changed", batchItems);

      // Signal ready on first batch containing a favourite
      if (!readySignalled && batchItems.some(isItemFavorite)) {
        readySignalled = true;
        callbacks?.onReadyToNavigate?.();
      }
    }, wrappedOnProgress);

    this._isLoading = false;
    this._loadingProgress = null;

    // If no favourites found in any band, signal ready now
    if (!readySignalled) {
      callbacks?.onReadyToNavigate?.();
    }

    this.emitter.emit("loading-complete", undefined);
  }

  /**
   * Check if vault is unlocked and ready to use
   */
  get isUnlocked(): boolean {
    if (this.storage) {
      return this.storage.isUnlocked;
    }
    // Legacy mode: always unlocked (direct item array)
    return this.items !== null;
  }

  /**
   * Get decrypted details for a specific item (lazy loading)
   * Only available when using IVaultStorage mode
   * @param itemId Item UUID
   * @returns Decrypted item details
   */
  async getItemDetails(itemId: string): Promise<RawItemDetails> {
    if (!this.storage) {
      throw new VaultStorageError(
        "getItemDetails only available with IVaultStorage mode",
      );
    }
    return await this.storage.getItemDetails(itemId);
  }

  /**
   * Get attachment metadata for a specific item (lazy loading)
   * Only available when storage supports attachments
   * @param itemId Item UUID
   * @returns Array of attachment info, or empty array if unsupported
   */
  async getAttachments(itemId: string): Promise<AttachmentInfo[]> {
    if (!this.storage?.getAttachments) {
      return [];
    }
    return await this.storage.getAttachments(itemId);
  }

  /**
   * Decrypt and return attachment file content
   * Only available when storage supports attachments
   * @param itemId Item UUID (owner of the attachment)
   * @param attachmentId Attachment UUID
   * @returns Decrypted attachment content
   */
  async getAttachmentContent(
    itemId: string,
    attachmentId: string,
  ): Promise<Uint8Array> {
    if (!this.storage?.getAttachmentContent) {
      throw new VaultStorageError(
        "Attachment content not supported by storage backend",
      );
    }
    return await this.storage.getAttachmentContent(itemId, attachmentId);
  }

  /**
   * Lock vault and clear all keys from memory
   * Only available when using IVaultStorage mode
   */
  lock(): void {
    if (this.storage) {
      this.storage.lock();
      this.items = null;
    }
    this._isLoading = false;
    this._loadingProgress = null;
    if (this._syncManager) {
      this._syncManager.reset();
      this._syncManager = null;
    }
    this.emitter.all.clear();
  }

  /**
   * Soft lock: clear crypto keys but preserve items and event listeners.
   * Used by auto-lock so the UI can remain mounted and restore seamlessly
   * after re-authentication via reUnlock().
   */
  clearKeys(): void {
    if (this.storage) {
      if (this.storage.clearKeysOnly) {
        this.storage.clearKeysOnly();
      } else {
        this.storage.lock();
      }
    }
    if (this._syncManager) {
      this._syncManager.reset();
      this._syncManager = null;
    }
  }

  /**
   * Re-derive crypto keys after a soft lock (clearKeys).
   * Items are still in memory — only keys need to be restored.
   * @param password Master password
   * @throws WrongPasswordError if password is incorrect
   */
  async reUnlock(password: string): Promise<void> {
    if (!this.storage) {
      throw new VaultStorageError(
        "Cannot re-unlock: Vault was created with direct items array",
      );
    }
    if (!this.storage.unlockKeysOnly) {
      await this.storage.unlock(password);
      return;
    }
    await this.storage.unlockKeysOnly(password);
  }

  /**
   * Ensure items are loaded (helper method)
   * @throws VaultError if items are not loaded
   */
  private ensureItemsLoaded(): Item[] {
    if (this.items === null) {
      throw new VaultStorageError(
        "Vault not initialized. Call initialize() first or unlock the vault.",
      );
    }
    return this.items;
  }

  /**
   * Filter out trashed items from an array
   */
  private excludeTrashed(items: Item[]): Item[] {
    return items.filter((item) => !item.trashed);
  }

  /**
   * Get all items
   * @param query Optional search query to filter items
   * @param sortOptions Optional sorting configuration
   */
  getAllItems(query?: string, sortOptions?: SortOptions): Item[] {
    const items = this.excludeTrashed(this.ensureItemsLoaded());
    return searchAndSort(items, query, sortOptions);
  }

  /**
   * Find item by UUID
   * @throws {ItemNotFoundError} If item with the given UUID is not found
   */
  getItemByUuid(uuid: string): Item {
    const items = this.ensureItemsLoaded();
    const item = items.find((item) => item.uuid === uuid);
    if (!item) {
      throw new ItemNotFoundError(uuid);
    }
    return item;
  }

  /**
   * Get all favorite items
   * @param query Optional search query to filter items
   * @param sortOptions Optional sorting configuration
   */
  getFavoriteItems(query?: string, sortOptions?: SortOptions): Item[] {
    const items = this.excludeTrashed(this.ensureItemsLoaded());
    const filtered = items.filter(isItemFavorite);
    return searchAndSort(filtered, query, sortOptions);
  }

  /**
   * Get items by category
   * Uses exact match for category field
   * Special case: Category.AllItems returns all items
   * @param category Category to filter by (e.g., Category.Login)
   * @param query Optional search query to filter items
   * @param sortOptions Optional sorting configuration
   */
  getItemsByCategory(
    category: Category,
    query?: string,
    sortOptions?: SortOptions,
  ): Item[] {
    const allItems = this.ensureItemsLoaded();

    // Special case: Archive returns only trashed items
    if (category === Category.Archive) {
      const trashed = allItems.filter((item) => item.trashed);
      return searchAndSort(trashed, query, sortOptions);
    }

    // All other categories: exclude trashed items
    const items = this.excludeTrashed(allItems);

    // Filter by category first
    const filtered =
      category === Category.AllItems
        ? items
        : filterByField(items, category, "category");

    // Apply query filter
    return searchAndSort(filtered, query, sortOptions);
  }

  /**
   * Get items by tag
   * Uses exact match for tags field
   * @param tag Tag to filter by
   * @param query Optional search query to filter items
   * @param sortOptions Optional sorting configuration
   */
  getItemsByTag(
    tag: string,
    query?: string,
    sortOptions?: SortOptions,
  ): Item[] {
    const items = this.excludeTrashed(this.ensureItemsLoaded());
    // Filter by tag first
    const filtered = filterByField(items, tag, "tags");

    // Apply query filter
    return searchAndSort(filtered, query, sortOptions);
  }

  /**
   * Get count of items by category
   * Special case: Category.AllItems returns total count
   */
  getCountByCategory(category: Category): number {
    return this.getItemsByCategory(category).length;
  }

  /**
   * Get counts for all tags across all items
   * Returns Map<tag, count>
   */
  getAllTagCounts(): Map<string, number> {
    const items = this.excludeTrashed(this.ensureItemsLoaded());
    const counts = new Map<string, number>();
    items.forEach((item) => {
      item.tags?.forEach((tag) => {
        counts.set(tag, (counts.get(tag) || 0) + 1);
      });
    });
    return counts;
  }
}
