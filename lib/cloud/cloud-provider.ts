/** Entry returned when browsing cloud folder contents */
export interface CloudFolderEntry {
  name: string;
  path: string;
  isFolder: boolean;
}

/**
 * Interface for cloud storage backends (iCloud, Dropbox, Google Drive, etc.).
 *
 * Each concrete provider implements this to bridge its native API to the
 * vault reading pipeline via CloudVaultSource.
 */
export interface ICloudProvider {
  /** Display name of the provider (e.g., "icloud", "dropbox") */
  readonly name: string;

  /** List all files at the given cloud path */
  listFiles(cloudPath: string): Promise<string[]>;

  /** List folder contents (files and subfolders) for vault browsing UI */
  listFolderContents(cloudPath: string): Promise<CloudFolderEntry[]>;

  /** Download a text file. Returns null if file not found. */
  downloadFile(cloudPath: string, filename: string): Promise<string | null>;

  /** Download a binary file. Returns null if file not found. */
  downloadBinaryFile(
    cloudPath: string,
    filename: string,
  ): Promise<Uint8Array | null>;

  /**
   * Optional: get a change tag for a file.
   * Maps to provider-native tokens: HTTP ETag, Dropbox content_hash,
   * iCloud recordChangeTag, etc.
   * Used by syncCache to skip unchanged files.
   */
  getFileChangeTag?(
    cloudPath: string,
    filename: string,
  ): Promise<string | null>;
}
