/**
 * Abstract file source for reading vault data.
 *
 * Replaces raw `Directory` parameters throughout the reading pipeline,
 * enabling both local filesystem and cloud storage backends.
 *
 * Implementations:
 * - LocalDirectorySource: wraps expo-file-system Directory (local/SAF)
 * - CloudVaultSource: downloads via ICloudProvider (future)
 *
 * Decorators:
 * - CachingVaultSource: adds write-through caching to any source
 * - FallbackVaultSource: tries primary source, falls back to secondary
 */
export interface IVaultSource {
  /** Read a text file by name. Returns null if not found. */
  getFileContent(filename: string): Promise<string | null>;

  /** Read a binary file by name. Returns null if not found. */
  getBinaryContent(filename: string): Promise<Uint8Array | null>;

  /** List all filenames in the source. */
  listFiles(): Promise<string[]>;

  /** URI identifying this source (for logging/cache keys). */
  readonly sourceUri: string;

  /**
   * Optional: get a change tag for a file (ETag, content hash, revision ID, etc.).
   * Used by syncCache to skip unchanged files during sync.
   * If not implemented, syncCache always re-fetches text files (safe default).
   */
  getFileChangeTag?(filename: string): Promise<string | null>;
}
