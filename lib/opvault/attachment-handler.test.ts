import { AttachmentHandler } from "@/lib/opvault/attachment-handler";
import {
  decryptOpdata01,
  decryptOpdata01Raw,
} from "@/lib/opvault/crypto/opdata";
import { createMockVaultSource } from "@/lib/opvault/fixtures/fs-mocks";
import {
  createMockMasterKeys,
  createMockOPVaultItem,
} from "@/lib/opvault/fixtures/test-vectors";
import { decryptItemKeys } from "@/lib/opvault/internal/item-decryptor";
import type { ItemKeys, OverviewKeys } from "@/lib/opvault/types";

// Mock crypto/opdata for overview decryption
jest.mock("@/lib/opvault/crypto/opdata", () => ({
  decryptOpdata01: jest.fn(),
  decryptOpdata01Raw: jest.fn(),
}));

// Mock item-decryptor for item key derivation
jest.mock("@/lib/opvault/internal/item-decryptor", () => ({
  decryptItemKeys: jest.fn(),
}));

const mockedDecryptOpdata01 = decryptOpdata01 as jest.Mock;
const mockedDecryptOpdata01Raw = decryptOpdata01Raw as jest.Mock;
const mockedDecryptItemKeys = decryptItemKeys as jest.Mock;

const ITEM_UUID = "AAAA0000BBBB1111CCCC2222DDDD3333";
const ATTACH_UUID = "1111000022223333444455556666AAAA";
const ATTACH_FILENAME = `${ITEM_UUID}_${ATTACH_UUID}.attachment`;

/** Build a minimal attachment binary: 16-byte header + JSON metadata */
function makeAttachmentBytes(metadata: Record<string, unknown>): Uint8Array {
  const metadataJson = JSON.stringify(metadata);
  const metadataBytes = Buffer.from(metadataJson, "utf8");

  const header = Buffer.alloc(16);
  header.write("OPCLDAT", 0, "utf8");
  header[7] = 0x01; // version
  header.writeUInt16LE(metadataBytes.length, 8);
  header.writeUInt32LE(0, 12); // no icon

  // Add some fake content after header+metadata so extractAttachmentContent works
  const content = Buffer.from("encrypted-content");
  return new Uint8Array(Buffer.concat([header, metadataBytes, content]));
}

const mockOverviewKeys: OverviewKeys = {
  encryptionKey: Buffer.alloc(32, 0x01),
  macKey: Buffer.alloc(32, 0x02),
};

describe("AttachmentHandler", () => {
  let source: ReturnType<typeof createMockVaultSource>;
  let handler: AttachmentHandler;

  beforeEach(() => {
    jest.clearAllMocks();
    source = createMockVaultSource();
    handler = new AttachmentHandler(source);
  });

  describe("buildIndex", () => {
    it("should index attachment filenames from source listing", async () => {
      source.listFiles.mockResolvedValue([
        ATTACH_FILENAME,
        "profile.js",
        "band_0.js",
      ]);

      await handler.buildIndex();

      expect(handler.getAttachmentCount(ITEM_UUID)).toBe(1);
    });

    it("should handle empty file listing", async () => {
      source.listFiles.mockResolvedValue([]);

      await handler.buildIndex();

      expect(handler.getAttachmentCount(ITEM_UUID)).toBe(0);
    });

    it("should group multiple attachments per item", async () => {
      const secondAttach = `${ITEM_UUID}_BBBB000011112222333344445555CCCC.attachment`;
      source.listFiles.mockResolvedValue([ATTACH_FILENAME, secondAttach]);

      await handler.buildIndex();

      expect(handler.getAttachmentCount(ITEM_UUID)).toBe(2);
    });
  });

  describe("getAttachmentCount", () => {
    it("should return 0 for unknown item UUID", () => {
      expect(handler.getAttachmentCount("UNKNOWN")).toBe(0);
    });
  });

  describe("getAttachments", () => {
    const metadata = {
      itemUUID: ITEM_UUID,
      uuid: ATTACH_UUID,
      contentsSize: 1024,
      external: false,
      createdAt: 1700000000,
      updatedAt: 1700000001,
      txTimestamp: 1700000002,
      overview: "base64data==",
    };

    beforeEach(async () => {
      source.listFiles.mockResolvedValue([ATTACH_FILENAME]);
      await handler.buildIndex();
    });

    it("should return empty array when item has no attachments", async () => {
      const result = await handler.getAttachments(
        "NO_ATTACHMENTS",
        mockOverviewKeys,
      );

      expect(result).toEqual([]);
    });

    it("should read attachment files and return metadata", async () => {
      const bytes = makeAttachmentBytes(metadata);
      source.getBinaryContent.mockResolvedValue(bytes);
      mockedDecryptOpdata01.mockReturnValue(
        Buffer.from(JSON.stringify({ filename: "photo.jpg" })),
      );

      const result = await handler.getAttachments(ITEM_UUID, mockOverviewKeys);

      expect(result).toHaveLength(1);
      expect(result[0]).toEqual(
        expect.objectContaining({
          uuid: ATTACH_UUID,
          filename: "photo.jpg",
          size: 1024,
        }),
      );
      expect(result[0].createdAt).toBeInstanceOf(Date);
      expect(result[0].updatedAt).toBeInstanceOf(Date);
    });

    it("should fall back to overview.title when filename is missing", async () => {
      const bytes = makeAttachmentBytes(metadata);
      source.getBinaryContent.mockResolvedValue(bytes);
      mockedDecryptOpdata01.mockReturnValue(
        Buffer.from(JSON.stringify({ title: "My Document" })),
      );

      const result = await handler.getAttachments(ITEM_UUID, mockOverviewKeys);

      expect(result[0].filename).toBe("My Document");
    });

    it("should fall back to UUID when both filename and title are missing", async () => {
      const bytes = makeAttachmentBytes(metadata);
      source.getBinaryContent.mockResolvedValue(bytes);
      mockedDecryptOpdata01.mockReturnValue(Buffer.from(JSON.stringify({})));

      const result = await handler.getAttachments(ITEM_UUID, mockOverviewKeys);

      expect(result[0].filename).toBe(ATTACH_UUID);
    });

    it("should skip attachment when binary file not found", async () => {
      source.getBinaryContent.mockResolvedValue(null);

      const result = await handler.getAttachments(ITEM_UUID, mockOverviewKeys);

      expect(result).toHaveLength(0);
    });
  });

  describe("getAttachmentContent", () => {
    const opItem = createMockOPVaultItem({ uuid: ITEM_UUID });
    const masterKeys = createMockMasterKeys();
    const mockItemKeys: ItemKeys = {
      encryptionKey: Buffer.alloc(32, 0x03),
      macKey: Buffer.alloc(32, 0x04),
    };

    it("should decrypt and return attachment content", async () => {
      const fakeContent = Buffer.from("decrypted-file-data");
      source.getBinaryContent.mockResolvedValue(
        makeAttachmentBytes({
          itemUUID: ITEM_UUID,
          uuid: ATTACH_UUID,
          contentsSize: 100,
          external: false,
          createdAt: 1700000000,
          updatedAt: 1700000001,
          txTimestamp: 1700000002,
          overview: "base64data==",
        }),
      );
      mockedDecryptItemKeys.mockReturnValue(mockItemKeys);
      mockedDecryptOpdata01Raw.mockReturnValue(fakeContent);

      const result = await handler.getAttachmentContent(
        ITEM_UUID,
        ATTACH_UUID,
        opItem,
        masterKeys,
        new Map(),
      );

      expect(result).toBeInstanceOf(Uint8Array);
      expect(mockedDecryptItemKeys).toHaveBeenCalledWith(opItem, masterKeys);
    });

    it("should use cached item keys when available", async () => {
      const fakeContent = Buffer.from("decrypted");
      source.getBinaryContent.mockResolvedValue(
        makeAttachmentBytes({
          itemUUID: ITEM_UUID,
          uuid: ATTACH_UUID,
          contentsSize: 100,
          external: false,
          createdAt: 1700000000,
          updatedAt: 1700000001,
          txTimestamp: 1700000002,
          overview: "base64data==",
        }),
      );
      mockedDecryptOpdata01Raw.mockReturnValue(fakeContent);

      const cache = new Map<string, ItemKeys>();
      cache.set(ITEM_UUID, mockItemKeys);

      await handler.getAttachmentContent(
        ITEM_UUID,
        ATTACH_UUID,
        opItem,
        masterKeys,
        cache,
      );

      // decryptItemKeys should NOT be called because keys are cached
      expect(mockedDecryptItemKeys).not.toHaveBeenCalled();
    });

    it("should throw when attachment file not found", async () => {
      source.getBinaryContent.mockResolvedValue(null);

      await expect(
        handler.getAttachmentContent(
          ITEM_UUID,
          ATTACH_UUID,
          opItem,
          masterKeys,
          new Map(),
        ),
      ).rejects.toThrow("not found");
    });
  });

  describe("clear", () => {
    it("should clear the index", async () => {
      source.listFiles.mockResolvedValue([ATTACH_FILENAME]);
      await handler.buildIndex();
      expect(handler.getAttachmentCount(ITEM_UUID)).toBe(1);

      handler.clear();

      expect(handler.getAttachmentCount(ITEM_UUID)).toBe(0);
    });
  });
});
