import type { IVaultSource } from "@/lib/vault/vault-source";
import { File, Directory, Paths } from "expo-file-system";
import { createHash } from "react-native-quick-crypto";

/**
 * Yield to the event loop so pending native touch events can be processed.
 * Uses setTimeout(0) rather than setImmediate because in Hermes/React Native,
 * setImmediate runs before native touch events are dispatched to JS, while
 * setTimeout(0) is a true macrotask that allows native input through first.
 */
function yieldToEventLoop(): Promise<void> {
  return new Promise<void>((resolve) => setTimeout(resolve, 0));
}

/** Metadata stored alongside cached files for incremental sync */
export interface CacheMetadata {
  /** Stored change tags for incremental sync (filename → tag) */
  fileChangeTags?: Record<string, string>;
}

const METADATA_FILENAME = ".cache-meta.json";
const COMPLETE_MARKER = ".cache-complete";

/**
 * Manages a local file cache for vault data.
 *
 * Copies vault files from their original location (potentially slow content://
 * URIs on Android SAF) to app-local storage (fast file:// URIs) under:
 *   documentDirectory/vault-cache/<sha256-of-vault-uri>/
 *
 * Single vault cached for now, but the URI-hash directory structure supports
 * multiple vaults in the future.
 */
export class VaultCacheManager {
  private readonly cacheRoot: Directory;

  constructor() {
    this.cacheRoot = new Directory(Paths.document, "vault-cache");
  }

  /**
   * Get the cache directory for a vault URI.
   * @returns Existing cache Directory, or null if no cache exists.
   */
  getCacheDir(vaultUri: string): Directory | null {
    const hash = this.hashUri(vaultUri);
    const dir = new Directory(this.cacheRoot, hash);
    if (!dir.exists) {
      return null;
    }

    // Verify cache is complete — marker written after all files copied
    const marker = new File(dir, COMPLETE_MARKER);
    if (!marker.exists) {
      return null;
    }

    return dir;
  }

  /**
   * Get or create the cache directory for a vault URI.
   */
  ensureCacheDir(vaultUri: string): Directory {
    if (!this.cacheRoot.exists) {
      this.cacheRoot.create();
    }
    const hash = this.hashUri(vaultUri);
    const dir = new Directory(this.cacheRoot, hash);
    if (!dir.exists) {
      dir.create();
    }
    return dir;
  }

  /**
   * Sync vault files from source to cache (incremental).
   *
   * Optimizations:
   * - Attachment files (*.attachment) already in cache are skipped (immutable)
   * - Text files with unchanged change tags are skipped (if source supports getFileChangeTag)
   *
   * @param source Vault source to sync from
   * @param vaultUri The vault URI (used as cache key)
   * @param isCancelled Optional callback checked between file operations
   */
  async syncCache(
    source: IVaultSource,
    vaultUri: string,
    isCancelled?: () => boolean,
  ): Promise<{ filesCopied: number }> {
    const cacheDir = this.ensureCacheDir(vaultUri);
    const filenames = await source.listFiles();

    // Load existing metadata for change tag comparison
    const existingMeta = this.readMetadataFromDir(cacheDir);
    const storedTags = existingMeta.fileChangeTags ?? {};
    const newTags: Record<string, string> = {};

    let copied = 0;
    let skipped = 0;

    for (const filename of filenames) {
      await yieldToEventLoop();
      if (isCancelled?.()) {
        break;
      }

      const isAttachment = filename.endsWith(".attachment");

      // Skip attachment files already in cache (immutable in OPVault)
      if (isAttachment) {
        const cachedFile = new File(cacheDir, filename);
        if (cachedFile.exists) {
          skipped++;
          continue;
        }
      }

      // Skip unchanged text files via change tag (if source supports it)
      if (!isAttachment && source.getFileChangeTag) {
        const tag = await source.getFileChangeTag(filename);
        if (tag) {
          newTags[filename] = tag;
          if (storedTags[filename] === tag) {
            skipped++;
            continue;
          }
        }
      }

      if (isCancelled?.()) {
        break;
      }

      // Read and cache the file
      if (isAttachment) {
        const content = await source.getBinaryContent(filename);
        if (content) {
          this.cacheBinaryFile(vaultUri, filename, content);
          copied++;
        }
      } else {
        const content = await source.getFileContent(filename);
        if (isCancelled?.()) break;
        if (content) {
          this.cacheFile(vaultUri, filename, content);
          copied++;
        }
      }
    }

    // Write completion marker and change tags only if not cancelled
    if (!isCancelled?.()) {
      if (Object.keys(newTags).length > 0) {
        this.writeChangeTags(cacheDir, newTags);
      }
      const marker = new File(cacheDir, COMPLETE_MARKER);
      marker.write("");
    } else {
    }

    return { filesCopied: copied };
  }

  /**
   * Write a single file to the cache directory (write-through).
   * Used during progressive loading to cache each file as it's read.
   */
  cacheFile(vaultUri: string, filename: string, content: string): void {
    const cacheDir = this.ensureCacheDir(vaultUri);
    const file = new File(cacheDir, filename);
    file.write(content);
  }

  /**
   * Write a single binary file to the cache directory (write-through).
   * Used during progressive loading to cache attachment files as they're read.
   */
  cacheBinaryFile(
    vaultUri: string,
    filename: string,
    content: Uint8Array,
  ): void {
    const cacheDir = this.ensureCacheDir(vaultUri);
    const file = new File(cacheDir, filename);
    file.write(content);
  }

  /**
   * Mark cache as complete (all files written).
   * Called after progressive loading finishes.
   */
  writeCacheComplete(vaultUri: string): void {
    const cacheDir = this.ensureCacheDir(vaultUri);
    const marker = new File(cacheDir, COMPLETE_MARKER);
    marker.write("");
  }

  /**
   * Delete cache for a specific vault.
   */
  deleteCacheForVault(vaultUri: string): void {
    const dir = this.getCacheDir(vaultUri);
    if (dir?.exists) {
      dir.delete();
    }
  }

  /**
   * Delete all cached vaults.
   */
  deleteAllCaches(): void {
    if (this.cacheRoot.exists) {
      this.cacheRoot.delete();
    }
  }

  /**
   * Read cache metadata from a directory (bypasses completion check).
   */
  private readMetadataFromDir(cacheDir: Directory): CacheMetadata {
    try {
      const metaFile = new File(cacheDir, METADATA_FILENAME);
      if (!metaFile.exists) return {};
      return JSON.parse(metaFile.textSync()) as CacheMetadata;
    } catch (err) {
      return {};
    }
  }

  /**
   * Write change tags to metadata (for incremental sync).
   */
  private writeChangeTags(
    cacheDir: Directory,
    tags: Record<string, string>,
  ): void {
    try {
      const meta = this.readMetadataFromDir(cacheDir);
      meta.fileChangeTags = tags;
      const metaFile = new File(cacheDir, METADATA_FILENAME);
      metaFile.write(JSON.stringify(meta));
    } catch (err) {}
  }

  /**
   * SHA-256 hash of vault URI for cache directory naming.
   */
  hashUri(uri: string): string {
    return hashVaultUri(uri);
  }
}

/**
 * SHA-256 hash of a vault URI — 64 hex chars, safe for use in SecureStore keys.
 * Exported so other modules (e.g. biometric-store) can use the same identifier.
 */
export function hashVaultUri(uri: string): string {
  return Buffer.from(createHash("sha256").update(uri).digest()).toString("hex");
}
