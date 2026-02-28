import { SyncManager } from "./sync-manager";
import type { VaultCacheManager } from "@/lib/opvault/cache/cache-manager";
import type { Item } from "@/lib/vault/types";

function createMockCacheManager(): jest.Mocked<VaultCacheManager> {
  return {
    getCacheDir: jest.fn(),
    ensureCacheDir: jest.fn(),
    syncCache: jest.fn().mockResolvedValue({ filesCopied: 0 }),
    deleteCacheForVault: jest.fn(),
    deleteAllCaches: jest.fn(),
    hashUri: jest.fn().mockReturnValue("abc123"),
  } as any;
}

function createMockDir(uri: string) {
  return { uri } as any;
}

describe("SyncManager", () => {
  let cacheManager: jest.Mocked<VaultCacheManager>;
  let syncManager: SyncManager;

  const originalDir = createMockDir("content://vault");
  const vaultUri = "content://vault";

  beforeEach(() => {
    cacheManager = createMockCacheManager();
    syncManager = new SyncManager(cacheManager);
  });

  describe("isSyncing", () => {
    it("should be false initially", () => {
      expect(syncManager.isSyncing).toBe(false);
    });

    it("should be true during sync", async () => {
      let resolveSyncCache: (value: { filesCopied: number }) => void;
      cacheManager.syncCache.mockImplementation(
        () =>
          new Promise((resolve) => {
            resolveSyncCache = resolve;
          }),
      );

      // Start sync but don't await it yet
      const syncPromise = syncManager.sync(
        originalDir,
        vaultUri,
        async () => [],
        0,
      );

      // While sync is in-flight, isSyncing should be true
      expect(syncManager.isSyncing).toBe(true);

      // Resolve and complete
      resolveSyncCache!({ filesCopied: 0 });
      await syncPromise;
    });

    it("should be false after sync completes", async () => {
      await syncManager.sync(originalDir, vaultUri, async () => [], 0);

      expect(syncManager.isSyncing).toBe(false);
    });
  });

  describe("sync", () => {
    it("should return { changed: false } when no files copied", async () => {
      cacheManager.syncCache.mockResolvedValue({ filesCopied: 0 });

      const reloadItems = jest.fn();
      const result = await syncManager.sync(
        originalDir,
        vaultUri,
        reloadItems,
        0,
      );

      expect(result).toEqual({ changed: false });
      expect(cacheManager.syncCache).toHaveBeenCalledWith(
        originalDir,
        vaultUri,
        expect.any(Function),
      );
      expect(reloadItems).not.toHaveBeenCalled();
    });

    it("should reload items when files were copied", async () => {
      cacheManager.syncCache.mockResolvedValue({ filesCopied: 3 });

      const mockItems: Item[] = [
        { uuid: "1", title: "Test" } as Item,
        { uuid: "2", title: "Test2" } as Item,
      ];
      const reloadItems = jest.fn().mockResolvedValue(mockItems);

      const result = await syncManager.sync(
        originalDir,
        vaultUri,
        reloadItems,
        0,
      );

      expect(result.changed).toBe(true);
      expect(result.newItemCount).toBe(2);
      expect(reloadItems).toHaveBeenCalled();
    });

    it("should compute positive newItemCount from difference", async () => {
      cacheManager.syncCache.mockResolvedValue({ filesCopied: 1 });

      const mockItems: Item[] = [
        { uuid: "1" } as Item,
        { uuid: "2" } as Item,
        { uuid: "3" } as Item,
      ];
      const reloadItems = jest.fn().mockResolvedValue(mockItems);

      const result = await syncManager.sync(
        originalDir,
        vaultUri,
        reloadItems,
        2, // previously had 2 items
      );

      expect(result.newItemCount).toBe(1); // 3 - 2 = 1
    });

    it("should compute negative newItemCount when items removed", async () => {
      cacheManager.syncCache.mockResolvedValue({ filesCopied: 1 });

      const mockItems: Item[] = [{ uuid: "1" } as Item];
      const reloadItems = jest.fn().mockResolvedValue(mockItems);

      const result = await syncManager.sync(
        originalDir,
        vaultUri,
        reloadItems,
        3, // previously had 3 items
      );

      expect(result.newItemCount).toBe(-2); // 1 - 3 = -2
    });

    it("should omit newItemCount when count is unchanged", async () => {
      cacheManager.syncCache.mockResolvedValue({ filesCopied: 1 });

      const mockItems: Item[] = [{ uuid: "1" } as Item, { uuid: "2" } as Item];
      const reloadItems = jest.fn().mockResolvedValue(mockItems);

      const result = await syncManager.sync(
        originalDir,
        vaultUri,
        reloadItems,
        2, // same count
      );

      expect(result.changed).toBe(true);
      expect(result.newItemCount).toBeUndefined();
    });

    it("should guard against concurrent syncs (return same promise)", async () => {
      let resolveSyncCache: (value: { filesCopied: number }) => void;
      cacheManager.syncCache.mockImplementation(
        () =>
          new Promise((resolve) => {
            resolveSyncCache = resolve;
          }),
      );

      const reloadItems = jest.fn().mockResolvedValue([]);

      // Start two syncs concurrently
      const promise1 = syncManager.sync(originalDir, vaultUri, reloadItems, 0);
      const promise2 = syncManager.sync(originalDir, vaultUri, reloadItems, 0);

      // Resolve syncCache
      resolveSyncCache!({ filesCopied: 0 });

      const [result1, result2] = await Promise.all([promise1, promise2]);

      // Both should get the same result
      expect(result1).toEqual({ changed: false });
      expect(result2).toEqual({ changed: false });

      // syncCache should only be called once (guard prevented second sync)
      expect(cacheManager.syncCache).toHaveBeenCalledTimes(1);
    });

    it("should reset guard after sync fails", async () => {
      cacheManager.syncCache.mockRejectedValueOnce(new Error("Network error"));

      await expect(
        syncManager.sync(originalDir, vaultUri, async () => [], 0),
      ).rejects.toThrow("Network error");

      // Guard should be reset — isSyncing should be false
      expect(syncManager.isSyncing).toBe(false);

      // Can start a new sync
      cacheManager.syncCache.mockResolvedValue({ filesCopied: 0 });
      const result = await syncManager.sync(
        originalDir,
        vaultUri,
        async () => [],
        0,
      );
      expect(result.changed).toBe(false);
    });
  });

  describe("reset", () => {
    it("should clear sync state", () => {
      syncManager.reset();
      expect(syncManager.isSyncing).toBe(false);
    });
  });
});
