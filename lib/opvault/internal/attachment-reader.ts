import { ATTACHMENT_FILENAME_PATTERN } from "@/lib/opvault/internal/patterns";
import type { AttachmentHeader, AttachmentMetadata } from "@/lib/opvault/types";

const ATTACHMENT_HEADER_SIZE = 16;
const ATTACHMENT_MAGIC = "OPCLDAT";

/**
 * Build an index of attachment filenames grouped by item UUID.
 * Designed to piggyback on the directory listing already performed during unlock.
 *
 * @param filenames Array of filenames from source.listFiles()
 * @returns Map of itemUUID → attachment filenames[]
 */
export function indexAttachmentFilenames(
  filenames: string[],
): Map<string, string[]> {
  const index = new Map<string, string[]>();

  for (const filename of filenames) {
    const match = filename.match(ATTACHMENT_FILENAME_PATTERN);
    if (match) {
      const itemUUID = match[1];
      let list = index.get(itemUUID);
      if (!list) {
        list = [];
        index.set(itemUUID, list);
      }
      list.push(filename);
    }
  }

  return index;
}

/**
 * Parse the 16-byte binary header from an attachment file.
 *
 * Header layout:
 * - Bytes 0-6: "OPCLDAT" magic
 * - Byte 7: Version (0x01)
 * - Bytes 8-9: Metadata size (uint16 LE)
 * - Bytes 10-11: Padding
 * - Bytes 12-15: Icon size (uint32 LE)
 *
 * @param data Raw binary data (at least 16 bytes)
 * @returns Parsed header with metadataSize and iconSize
 * @throws Error if magic or version is invalid
 */
export function parseAttachmentHeader(data: Uint8Array): AttachmentHeader {
  if (data.length < ATTACHMENT_HEADER_SIZE) {
    throw new Error(
      `Invalid attachment: data too short (${data.length} < ${ATTACHMENT_HEADER_SIZE})`,
    );
  }

  const buf = Buffer.from(data.buffer, data.byteOffset, data.byteLength);

  // Verify magic
  const magic = buf.subarray(0, 7).toString("utf8");
  if (magic !== ATTACHMENT_MAGIC) {
    throw new Error(
      `Invalid attachment magic: expected "${ATTACHMENT_MAGIC}", got "${magic}"`,
    );
  }

  // Verify version (accept v1 and later; magic check confirms format)
  const version = buf[7];
  if (version < 1) {
    throw new Error(`Invalid attachment version: ${version}`);
  }

  const metadataSize = buf.readUInt16LE(8);
  const iconSize = buf.readUInt32LE(12);

  return { metadataSize, iconSize };
}

/**
 * Parse attachment metadata from raw binary data.
 * Extracts header + JSON metadata section.
 *
 * @param bytes Raw binary file content
 * @returns Parsed header and metadata
 * @throws Error if format invalid
 */
export function parseAttachmentMetadata(bytes: Uint8Array): {
  header: AttachmentHeader;
  metadata: AttachmentMetadata;
} {
  const header = parseAttachmentHeader(bytes);

  // Extract metadata JSON after the 16-byte header
  const metadataStart = ATTACHMENT_HEADER_SIZE;
  const metadataEnd = metadataStart + header.metadataSize;

  if (bytes.length < metadataEnd) {
    throw new Error("Invalid attachment: file too short for metadata");
  }

  const metadataJson = Buffer.from(
    bytes.buffer,
    bytes.byteOffset + metadataStart,
    header.metadataSize,
  ).toString("utf8");

  const metadata: AttachmentMetadata = JSON.parse(metadataJson);

  return { header, metadata };
}

/**
 * Extract the encrypted content section from raw attachment bytes.
 * Content starts after header + metadata + icon.
 *
 * @param bytes Raw binary file content
 * @param header Previously parsed header (for offset calculation)
 * @returns Raw binary opdata01 Buffer of the encrypted content
 * @throws Error if offsets invalid
 */
export function extractAttachmentContent(
  bytes: Uint8Array,
  header: AttachmentHeader,
): Buffer {
  const contentStart =
    ATTACHMENT_HEADER_SIZE + header.metadataSize + header.iconSize;

  if (bytes.length <= contentStart) {
    throw new Error("Invalid attachment: file too short for content");
  }

  return Buffer.from(
    bytes.buffer,
    bytes.byteOffset + contentStart,
    bytes.byteLength - contentStart,
  );
}
