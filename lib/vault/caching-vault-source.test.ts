import { CachingVaultSource } from "./caching-vault-source";
import type { VaultCacheManager } from "@/lib/opvault/cache/cache-manager";
import { createMockVaultSource } from "@/lib/opvault/fixtures/fs-mocks";

function createMockCacheManager(): jest.Mocked<
  Pick<VaultCacheManager, "cacheFile" | "cacheBinaryFile">
> {
  return {
    cacheFile: jest.fn(),
    cacheBinaryFile: jest.fn(),
  };
}

describe("CachingVaultSource", () => {
  const vaultUri = "content://vault";

  it("should delegate sourceUri to inner source", () => {
    const inner = createMockVaultSource("content://vault");
    const cache = createMockCacheManager();
    const source = new CachingVaultSource(inner, cache as any, vaultUri);

    expect(source.sourceUri).toBe("content://vault");
  });

  describe("getFileContent", () => {
    it("should delegate to inner and cache the result", async () => {
      const inner = createMockVaultSource();
      inner.getFileContent.mockResolvedValue("var profile = {};");
      const cache = createMockCacheManager();
      const source = new CachingVaultSource(inner, cache as any, vaultUri);

      const content = await source.getFileContent("profile.js");

      expect(content).toBe("var profile = {};");
      expect(inner.getFileContent).toHaveBeenCalledWith("profile.js");
      expect(cache.cacheFile).toHaveBeenCalledWith(
        vaultUri,
        "profile.js",
        "var profile = {};",
      );
    });

    it("should not cache when inner returns null", async () => {
      const inner = createMockVaultSource();
      const cache = createMockCacheManager();
      const source = new CachingVaultSource(inner, cache as any, vaultUri);

      const content = await source.getFileContent("missing.js");

      expect(content).toBeNull();
      expect(cache.cacheFile).not.toHaveBeenCalled();
    });
  });

  describe("getBinaryContent", () => {
    it("should delegate to inner and cache the result", async () => {
      const bytes = new Uint8Array([0x01, 0x02]);
      const inner = createMockVaultSource();
      inner.getBinaryContent.mockResolvedValue(bytes);
      const cache = createMockCacheManager();
      const source = new CachingVaultSource(inner, cache as any, vaultUri);

      const content = await source.getBinaryContent("item.attachment");

      expect(content).toEqual(bytes);
      expect(cache.cacheBinaryFile).toHaveBeenCalledWith(
        vaultUri,
        "item.attachment",
        bytes,
      );
    });

    it("should not cache when inner returns null", async () => {
      const inner = createMockVaultSource();
      const cache = createMockCacheManager();
      const source = new CachingVaultSource(inner, cache as any, vaultUri);

      const content = await source.getBinaryContent("missing.attachment");

      expect(content).toBeNull();
      expect(cache.cacheBinaryFile).not.toHaveBeenCalled();
    });
  });

  describe("listFiles", () => {
    it("should delegate to inner source", async () => {
      const inner = createMockVaultSource();
      inner.listFiles.mockResolvedValue(["profile.js", "band_0.js"]);
      const cache = createMockCacheManager();
      const source = new CachingVaultSource(inner, cache as any, vaultUri);

      const files = await source.listFiles();
      expect(files).toEqual(["profile.js", "band_0.js"]);
    });
  });
});
