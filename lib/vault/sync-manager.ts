import type { VaultCacheManager } from "@/lib/opvault/cache/cache-manager";
import { CancellationToken } from "@/lib/vault/cancellation";
import type { Item, SyncResult } from "@/lib/vault/types";
import type { IVaultSource } from "@/lib/vault/vault-source";

/**
 * Orchestrates vault sync: cache update → item reload.
 *
 * Always runs syncCache (no pre-flight change detection — profile.js
 * updatedAt is not updated on band changes in OPVault format).
 * Uses syncCache's filesCopied count to skip reloadItems when nothing changed.
 *
 * Guarantees at most 1 sync process at a time via a Promise-based guard.
 * Concurrent sync requests join the in-flight promise.
 */
export class SyncManager {
  private _syncPromise: Promise<SyncResult> | null = null;
  private _token: CancellationToken | null = null;

  constructor(private readonly cacheManager: VaultCacheManager) {}

  /** Whether a sync is currently in progress */
  get isSyncing(): boolean {
    return this._syncPromise !== null;
  }

  /**
   * Run a sync operation. If one is already in progress, returns
   * the existing promise (concurrent callers share the same result).
   *
   * @param source Original vault source (e.g., LocalDirectorySource for SAF, CloudVaultSource)
   * @param vaultUri Vault URI used as cache key
   * @param reloadItems Callback to re-read items from the (updated) cache
   * @param currentItemCount Current number of items for computing diff
   */
  async sync(
    source: IVaultSource,
    vaultUri: string,
    reloadItems: () => Promise<Item[]>,
    currentItemCount: number,
  ): Promise<SyncResult> {
    // Guard: at most 1 sync at a time
    if (this._syncPromise) {
      return this._syncPromise;
    }

    this._token = new CancellationToken();
    const token = this._token;
    this._syncPromise = this.doSync(
      source,
      vaultUri,
      reloadItems,
      currentItemCount,
      token,
    );

    try {
      return await this._syncPromise;
    } finally {
      this._syncPromise = null;
    }
  }

  private async doSync(
    source: IVaultSource,
    vaultUri: string,
    reloadItems: () => Promise<Item[]>,
    currentItemCount: number,
    token: CancellationToken,
  ): Promise<SyncResult> {
    // Step 1: Sync cache from original source (always — no pre-flight check)
    const { filesCopied } = await this.cacheManager.syncCache(
      source,
      vaultUri,
      () => token.isCancelled,
    );

    if (token.isCancelled) {
      return { changed: false };
    }

    if (filesCopied === 0) {
      return { changed: false };
    }

    // Step 2: Re-load items from updated cache
    const newItems = await reloadItems();
    const newItemCount = newItems.length - currentItemCount;

    return {
      changed: true,
      newItemCount: newItemCount !== 0 ? newItemCount : undefined,
    };
  }

  /** Cancel the current sync (reads will stop between files) */
  cancel(): void {
    this._token?.cancel();
  }

  /** Reset sync state (called on vault lock) */
  reset(): void {
    this._token?.cancel();
    this._syncPromise = null;
  }
}
