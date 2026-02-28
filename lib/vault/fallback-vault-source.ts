import type { IVaultSource } from "@/lib/vault/vault-source";

/**
 * Decorator that tries the primary source first, falls back to secondary on miss.
 *
 * Used on warm path for attachments: cache directory is primary (fast),
 * original source (SAF/cloud) is fallback for files not yet cached.
 * The cached file's existence IS the per-file marker — no manifest needed.
 */
export class FallbackVaultSource implements IVaultSource {
  constructor(
    private readonly primary: IVaultSource,
    private readonly fallback: IVaultSource,
  ) {}

  get sourceUri(): string {
    return this.primary.sourceUri;
  }

  async getFileContent(filename: string): Promise<string | null> {
    return (
      (await this.primary.getFileContent(filename)) ??
      this.fallback.getFileContent(filename)
    );
  }

  async getBinaryContent(filename: string): Promise<Uint8Array | null> {
    return (
      (await this.primary.getBinaryContent(filename)) ??
      this.fallback.getBinaryContent(filename)
    );
  }

  async listFiles(): Promise<string[]> {
    const [a, b] = await Promise.all([
      this.primary.listFiles(),
      this.fallback.listFiles(),
    ]);
    return [...new Set([...a, ...b])];
  }
}
