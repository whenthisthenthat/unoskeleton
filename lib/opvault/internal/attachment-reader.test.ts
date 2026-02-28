import {
  indexAttachmentFilenames,
  parseAttachmentHeader,
  parseAttachmentMetadata,
  extractAttachmentContent,
} from "./attachment-reader";

describe("attachment-reader", () => {
  describe("parseAttachmentHeader", () => {
    /**
     * Build a valid 16-byte OPCLDAT header with the given version.
     * Layout: "OPCLDAT" (7) + version (1) + metadataSize LE16 (2) + padding (2) + iconSize LE32 (4)
     */
    function makeHeader(
      version: number,
      metadataSize = 0x016b,
      iconSize = 0x0000ad70,
    ): Uint8Array {
      const buf = Buffer.alloc(16);
      buf.write("OPCLDAT", 0, "utf8");
      buf[7] = version;
      buf.writeUInt16LE(metadataSize, 8);
      buf.writeUInt32LE(iconSize, 12);
      return new Uint8Array(buf);
    }

    it("should parse version 1 header", () => {
      const header = parseAttachmentHeader(makeHeader(0x01, 363, 44400));

      expect(header.metadataSize).toBe(363);
      expect(header.iconSize).toBe(44400);
    });

    it("should parse version 2 header", () => {
      const header = parseAttachmentHeader(makeHeader(0x02, 500, 12345));

      expect(header.metadataSize).toBe(500);
      expect(header.iconSize).toBe(12345);
    });

    it("should throw for version 0", () => {
      expect(() => parseAttachmentHeader(makeHeader(0x00))).toThrow(
        "Invalid attachment version: 0",
      );
    });

    it("should throw for invalid magic", () => {
      const data = makeHeader(0x01);
      data[0] = 0x00; // corrupt magic

      expect(() => parseAttachmentHeader(data)).toThrow(
        "Invalid attachment magic",
      );
    });

    it("should throw for data shorter than 16 bytes", () => {
      expect(() => parseAttachmentHeader(new Uint8Array(10))).toThrow(
        "data too short",
      );
    });
  });

  describe("indexAttachmentFilenames", () => {
    it("should group attachment filenames by item UUID", () => {
      const filenames = [
        "AAAA0000BBBB1111CCCC2222DDDD3333_1111000022223333444455556666AAAA.attachment",
        "AAAA0000BBBB1111CCCC2222DDDD3333_2222000033334444555566667777BBBB.attachment",
        "FFFF0000EEEE1111DDDD2222CCCC3333_3333000044445555666677778888CCCC.attachment",
        "profile.js",
        "band_0.js",
      ];

      const index = indexAttachmentFilenames(filenames);

      expect(index.size).toBe(2);
      expect(index.get("AAAA0000BBBB1111CCCC2222DDDD3333")).toEqual([
        "AAAA0000BBBB1111CCCC2222DDDD3333_1111000022223333444455556666AAAA.attachment",
        "AAAA0000BBBB1111CCCC2222DDDD3333_2222000033334444555566667777BBBB.attachment",
      ]);
      expect(index.get("FFFF0000EEEE1111DDDD2222CCCC3333")).toEqual([
        "FFFF0000EEEE1111DDDD2222CCCC3333_3333000044445555666677778888CCCC.attachment",
      ]);
    });

    it("should return empty map for no attachment filenames", () => {
      const index = indexAttachmentFilenames(["profile.js", "band_0.js"]);

      expect(index.size).toBe(0);
    });

    it("should ignore lowercase hex UUIDs", () => {
      const index = indexAttachmentFilenames([
        "aaaa0000bbbb1111cccc2222dddd3333_1111000022223333444455556666aaaa.attachment",
      ]);

      expect(index.size).toBe(0);
    });
  });

  describe("parseAttachmentMetadata", () => {
    function makeAttachmentBytes(
      metadata: Record<string, unknown>,
      version = 0x01,
      iconSize = 0,
    ): Uint8Array {
      const metadataJson = JSON.stringify(metadata);
      const metadataBytes = Buffer.from(metadataJson, "utf8");

      const header = Buffer.alloc(16);
      header.write("OPCLDAT", 0, "utf8");
      header[7] = version;
      header.writeUInt16LE(metadataBytes.length, 8);
      header.writeUInt32LE(iconSize, 12);

      return new Uint8Array(Buffer.concat([header, metadataBytes]));
    }

    it("should parse header and JSON metadata from valid attachment bytes", () => {
      const meta = {
        itemUUID: "AAAA0000BBBB1111CCCC2222DDDD3333",
        uuid: "1111000022223333444455556666AAAA",
        contentsSize: 1024,
        external: false,
        createdAt: 1700000000,
        updatedAt: 1700000001,
        txTimestamp: 1700000002,
        overview: "base64data==",
      };
      const bytes = makeAttachmentBytes(meta);
      const result = parseAttachmentMetadata(bytes);

      expect(result.header.metadataSize).toBe(JSON.stringify(meta).length);
      expect(result.header.iconSize).toBe(0);
      expect(result.metadata.uuid).toBe("1111000022223333444455556666AAAA");
      expect(result.metadata.contentsSize).toBe(1024);
    });

    it("should throw when file is too short for metadata section", () => {
      // Header says metadataSize=500, but we only provide 20 bytes total
      const header = Buffer.alloc(16);
      header.write("OPCLDAT", 0, "utf8");
      header[7] = 0x01;
      header.writeUInt16LE(500, 8);
      header.writeUInt32LE(0, 12);

      const bytes = new Uint8Array(Buffer.concat([header, Buffer.alloc(4)]));
      expect(() => parseAttachmentMetadata(bytes)).toThrow(
        "file too short for metadata",
      );
    });
  });

  describe("extractAttachmentContent", () => {
    it("should extract content section after header + metadata + icon", () => {
      const metadataSize = 50;
      const iconSize = 100;
      const contentData = Buffer.from("encrypted-content-here");
      const totalSize = 16 + metadataSize + iconSize + contentData.length;

      const bytes = Buffer.alloc(totalSize);
      // Fill metadata region with dummy data
      bytes.fill(0x01, 16, 16 + metadataSize);
      // Fill icon region with dummy data
      bytes.fill(0x02, 16 + metadataSize, 16 + metadataSize + iconSize);
      // Write content at the end
      contentData.copy(bytes, 16 + metadataSize + iconSize);

      const result = extractAttachmentContent(new Uint8Array(bytes), {
        metadataSize,
        iconSize,
      });

      expect(Buffer.from(result).toString()).toBe("encrypted-content-here");
    });

    it("should throw when file is too short for content section", () => {
      // File has only header + metadata, no content
      const bytes = new Uint8Array(16 + 50);

      expect(() =>
        extractAttachmentContent(bytes, { metadataSize: 50, iconSize: 0 }),
      ).toThrow("file too short for content");
    });
  });
});
