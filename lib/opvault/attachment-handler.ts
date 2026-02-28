import {
  decryptOpdata01,
  decryptOpdata01Raw,
} from "@/lib/opvault/crypto/opdata";
import {
  extractAttachmentContent,
  indexAttachmentFilenames,
  parseAttachmentHeader,
  parseAttachmentMetadata,
} from "@/lib/opvault/internal/attachment-reader";
import { getOrCompute } from "@/lib/opvault/internal/get-or-compute";
import { decryptItemKeys } from "@/lib/opvault/internal/item-decryptor";
import type {
  OPVaultItem,
  MasterKeys,
  OverviewKeys,
  ItemKeys,
} from "@/lib/opvault/types";
import { unixToDate } from "@/lib/vault/date-conversion";
import type { AttachmentInfo } from "@/lib/vault/types";
import type { IVaultSource } from "@/lib/vault/vault-source";

/**
 * Handles attachment indexing, metadata reading, and content decryption
 * for OPVault items. Extracted from OPVaultClient to reduce class size.
 */
export class AttachmentHandler {
  private readonly source: IVaultSource;
  private index: Map<string, string[]> = new Map();

  constructor(source: IVaultSource) {
    this.source = source;
  }

  /**
   * Build attachment filename index from source file listing.
   */
  async buildIndex(): Promise<void> {
    const filenames = await this.source.listFiles();
    this.index = indexAttachmentFilenames(filenames);
  }

  /**
   * Get attachment count for an item.
   */
  getAttachmentCount(itemUUID: string): number {
    return this.index.get(itemUUID)?.length ?? 0;
  }

  /**
   * Get attachment metadata for an item.
   * Reads .attachment files on demand, parses headers, decrypts overview for filename.
   */
  async getAttachments(
    itemId: string,
    overviewKeys: OverviewKeys,
  ): Promise<AttachmentInfo[]> {
    const filenames = this.index.get(itemId);
    if (!filenames || filenames.length === 0) {
      return [];
    }

    const results: AttachmentInfo[] = [];

    for (const filename of filenames) {
      const bytes = await this.source.getBinaryContent(filename);
      if (!bytes) {
        continue;
      }

      const { metadata } = parseAttachmentMetadata(bytes);

      // Decrypt overview to get filename (base64-encoded opdata01 with overview keys)
      const overviewBuf = decryptOpdata01(
        metadata.overview,
        overviewKeys.encryptionKey,
        overviewKeys.macKey,
      );
      const overview = JSON.parse(overviewBuf.toString("utf8"));

      results.push({
        uuid: metadata.uuid,
        filename: overview.filename ?? overview.title ?? metadata.uuid,
        size: metadata.contentsSize,
        createdAt: unixToDate(metadata.createdAt),
        updatedAt: unixToDate(metadata.updatedAt),
      });
    }

    return results;
  }

  /**
   * Decrypt and return attachment file content.
   * Uses item keys to decrypt the raw binary opdata01 content section.
   */
  async getAttachmentContent(
    itemId: string,
    attachmentId: string,
    opItem: OPVaultItem,
    masterKeys: MasterKeys,
    itemKeysCache: Map<string, ItemKeys>,
  ): Promise<Uint8Array> {
    const filename = `${itemId}_${attachmentId}.attachment`;

    // Read the full file once
    const bytes = await this.source.getBinaryContent(filename);
    if (!bytes) {
      throw new Error(`Attachment file not found: ${filename}`);
    }

    // Parse header for offsets, then extract content section
    const header = parseAttachmentHeader(bytes);
    const contentBuffer = extractAttachmentContent(bytes, header);

    // Get or decrypt item keys (shared cache with getItemDetails)
    const itemKeys = getOrCompute(itemKeysCache, itemId, () =>
      decryptItemKeys(opItem, masterKeys),
    );

    // Decrypt content (raw binary opdata01, not base64)
    const decrypted = decryptOpdata01Raw(
      contentBuffer,
      itemKeys.encryptionKey,
      itemKeys.macKey,
    );

    return new Uint8Array(
      decrypted.buffer,
      decrypted.byteOffset,
      decrypted.byteLength,
    );
  }

  /**
   * Clear the index and release references.
   */
  clear(): void {
    this.index.clear();
  }
}
