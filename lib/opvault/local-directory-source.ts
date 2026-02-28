import {
  findFileByName,
  getDirectoryFilenames,
} from "@/lib/opvault/internal/fs-compat";
import type { IVaultSource } from "@/lib/vault/vault-source";
import type { Directory } from "expo-file-system";

/**
 * Wraps an expo-file-system Directory into the IVaultSource interface.
 * Pure read-only adapter — no caching, no network.
 *
 * Works with both file:// URIs (iOS/web) and Android content:// URIs (SAF).
 */
export class LocalDirectorySource implements IVaultSource {
  constructor(private readonly dir: Directory) {}

  get sourceUri(): string {
    return this.dir.uri;
  }

  async getFileContent(filename: string): Promise<string | null> {
    const file = findFileByName(this.dir, filename);
    if (!file?.exists) return null;
    return file.text();
  }

  async getBinaryContent(filename: string): Promise<Uint8Array | null> {
    const file = findFileByName(this.dir, filename);
    if (!file?.exists) return null;
    return file.bytes();
  }

  async listFiles(): Promise<string[]> {
    return getDirectoryFilenames(this.dir) ?? [];
  }

  async getFileChangeTag(filename: string): Promise<string | null> {
    const file = findFileByName(this.dir, filename);
    if (!file?.exists) return null;
    const mtime = file.modificationTime;
    if (mtime == null) return null;
    return `${file.size}:${mtime}`;
  }
}
