import { FallbackVaultSource } from "./fallback-vault-source";
import { createMockVaultSource } from "@/lib/opvault/fixtures/fs-mocks";

describe("FallbackVaultSource", () => {
  it("should return primary sourceUri", () => {
    const primary = createMockVaultSource("file:///cache");
    const fallback = createMockVaultSource("content://original");
    const source = new FallbackVaultSource(primary, fallback);

    expect(source.sourceUri).toBe("file:///cache");
  });

  describe("getFileContent", () => {
    it("should return primary result when available", async () => {
      const primary = createMockVaultSource();
      primary.getFileContent.mockResolvedValue("cached data");
      const fallback = createMockVaultSource();
      const source = new FallbackVaultSource(primary, fallback);

      const content = await source.getFileContent("profile.js");

      expect(content).toBe("cached data");
      expect(fallback.getFileContent).not.toHaveBeenCalled();
    });

    it("should fall back to secondary when primary returns null", async () => {
      const primary = createMockVaultSource();
      const fallback = createMockVaultSource();
      fallback.getFileContent.mockResolvedValue("original data");
      const source = new FallbackVaultSource(primary, fallback);

      const content = await source.getFileContent("profile.js");

      expect(content).toBe("original data");
    });

    it("should return null when both sources return null", async () => {
      const primary = createMockVaultSource();
      const fallback = createMockVaultSource();
      const source = new FallbackVaultSource(primary, fallback);

      const content = await source.getFileContent("missing.js");

      expect(content).toBeNull();
    });
  });

  describe("getBinaryContent", () => {
    it("should return primary result when available", async () => {
      const bytes = new Uint8Array([0x01, 0x02]);
      const primary = createMockVaultSource();
      primary.getBinaryContent.mockResolvedValue(bytes);
      const fallback = createMockVaultSource();
      const source = new FallbackVaultSource(primary, fallback);

      const content = await source.getBinaryContent("item.attachment");

      expect(content).toEqual(bytes);
      expect(fallback.getBinaryContent).not.toHaveBeenCalled();
    });

    it("should fall back to secondary when primary returns null", async () => {
      const bytes = new Uint8Array([0x03, 0x04]);
      const primary = createMockVaultSource();
      const fallback = createMockVaultSource();
      fallback.getBinaryContent.mockResolvedValue(bytes);
      const source = new FallbackVaultSource(primary, fallback);

      const content = await source.getBinaryContent("item.attachment");

      expect(content).toEqual(bytes);
    });
  });

  describe("listFiles", () => {
    it("should merge files from both sources", async () => {
      const primary = createMockVaultSource();
      primary.listFiles.mockResolvedValue(["profile.js", "band_0.js"]);
      const fallback = createMockVaultSource();
      fallback.listFiles.mockResolvedValue(["band_A.js", "folders.js"]);
      const source = new FallbackVaultSource(primary, fallback);

      const files = await source.listFiles();

      expect(files).toEqual([
        "profile.js",
        "band_0.js",
        "band_A.js",
        "folders.js",
      ]);
    });

    it("should deduplicate overlapping filenames", async () => {
      const primary = createMockVaultSource();
      primary.listFiles.mockResolvedValue(["profile.js", "band_0.js"]);
      const fallback = createMockVaultSource();
      fallback.listFiles.mockResolvedValue(["profile.js", "band_A.js"]);
      const source = new FallbackVaultSource(primary, fallback);

      const files = await source.listFiles();

      expect(files).toEqual(["profile.js", "band_0.js", "band_A.js"]);
    });
  });
});
