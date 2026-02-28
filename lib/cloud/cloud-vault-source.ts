import type { ICloudProvider } from "@/lib/cloud/cloud-provider";
import type { CancellationToken } from "@/lib/vault/cancellation";
import type { IVaultSource } from "@/lib/vault/vault-source";

/**
 * Bridges an ICloudProvider to IVaultSource.
 *
 * Pure downloader — no caching logic. Wrap with CachingVaultSource
 * for write-through caching, or compose with FallbackVaultSource
 * for warm-path attachment reads.
 *
 * Supports cooperative cancellation via an optional CancellationToken.
 * When cancelled, getFileContent/getBinaryContent return null.
 */
export class CloudVaultSource implements IVaultSource {
  getFileChangeTag?: (filename: string) => Promise<string | null>;

  constructor(
    private readonly provider: ICloudProvider,
    private readonly cloudPath: string,
    private readonly cancellation?: CancellationToken,
  ) {
    // Conditionally expose getFileChangeTag if provider supports it
    if (provider.getFileChangeTag) {
      this.getFileChangeTag = (filename: string) =>
        provider.getFileChangeTag!(this.cloudPath, filename);
    }
  }

  get sourceUri(): string {
    return `${this.provider.name}://${this.cloudPath}`;
  }

  async listFiles(): Promise<string[]> {
    return this.provider.listFiles(this.cloudPath);
  }

  async getFileContent(filename: string): Promise<string | null> {
    if (this.cancellation?.isCancelled) return null;
    return this.provider.downloadFile(this.cloudPath, filename);
  }

  async getBinaryContent(filename: string): Promise<Uint8Array | null> {
    if (this.cancellation?.isCancelled) return null;
    return this.provider.downloadBinaryFile(this.cloudPath, filename);
  }
}
