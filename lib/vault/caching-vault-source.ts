import type { VaultCacheManager } from "@/lib/opvault/cache/cache-manager";
import type { IVaultSource } from "@/lib/vault/vault-source";

/**
 * Decorator that adds write-through caching to any IVaultSource.
 *
 * Each read delegates to the inner source, then writes the result to cache.
 * Text files use cacheFile(), binary files use cacheBinaryFile().
 * The inner source remains pure (read-only or download-only).
 */
export class CachingVaultSource implements IVaultSource {
  constructor(
    private readonly inner: IVaultSource,
    private readonly cacheManager: VaultCacheManager,
    private readonly vaultUri: string,
  ) {}

  get sourceUri(): string {
    return this.inner.sourceUri;
  }

  async getFileContent(filename: string): Promise<string | null> {
    const content = await this.inner.getFileContent(filename);
    if (content) {
      this.cacheManager.cacheFile(this.vaultUri, filename, content);
    }
    return content;
  }

  async getBinaryContent(filename: string): Promise<Uint8Array | null> {
    const content = await this.inner.getBinaryContent(filename);
    if (content) {
      this.cacheManager.cacheBinaryFile(this.vaultUri, filename, content);
    }
    return content;
  }

  async listFiles(): Promise<string[]> {
    return this.inner.listFiles();
  }
}
