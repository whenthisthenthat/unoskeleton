import { LocalDirectorySource } from "./local-directory-source";
import {
  createMockDirectory,
  createMockFile,
} from "@/lib/opvault/fixtures/fs-mocks";

describe("LocalDirectorySource", () => {
  it("should return the directory URI as sourceUri", () => {
    const dir = createMockDirectory("file:///vault/default");
    const source = new LocalDirectorySource(dir);
    expect(source.sourceUri).toBe("file:///vault/default");
  });

  describe("getFileContent", () => {
    it("should return file text when file exists", async () => {
      const file = createMockFile({
        uri: "file:///vault/default/profile.js",
        text: jest.fn().mockResolvedValue("var profile = {};"),
      });
      const dir = createMockDirectory("file:///vault/default", [file]);
      const source = new LocalDirectorySource(dir);

      const content = await source.getFileContent("profile.js");
      expect(content).toBe("var profile = {};");
    });

    it("should return null when file does not exist", async () => {
      const dir = createMockDirectory("file:///vault/default", []);
      const source = new LocalDirectorySource(dir);

      const content = await source.getFileContent("missing.js");
      expect(content).toBeNull();
    });
  });

  describe("getBinaryContent", () => {
    it("should return bytes when file exists", async () => {
      const expectedBytes = new Uint8Array([0x01, 0x02, 0x03]);
      const file = createMockFile({
        uri: "file:///vault/default/item.attachment",
      });
      // Override bytes() on the mock file
      (file as any).bytes = jest.fn().mockResolvedValue(expectedBytes);

      const dir = createMockDirectory("file:///vault/default", [file]);
      const source = new LocalDirectorySource(dir);

      const content = await source.getBinaryContent("item.attachment");
      expect(content).toEqual(expectedBytes);
    });

    it("should return null when file does not exist", async () => {
      const dir = createMockDirectory("file:///vault/default", []);
      const source = new LocalDirectorySource(dir);

      const content = await source.getBinaryContent("missing.attachment");
      expect(content).toBeNull();
    });
  });

  describe("listFiles", () => {
    it("should return filenames from directory info", async () => {
      const dir = createMockDirectory("file:///vault/default", [
        createMockFile({ uri: "file:///vault/default/profile.js" }),
        createMockFile({ uri: "file:///vault/default/band_0.js" }),
      ]);
      const source = new LocalDirectorySource(dir);

      const files = await source.listFiles();
      expect(files).toEqual(["profile.js", "band_0.js"]);
    });

    it("should return empty array when directory has no files", async () => {
      const dir = createMockDirectory("file:///vault/default", []);
      const source = new LocalDirectorySource(dir);

      const files = await source.listFiles();
      expect(files).toEqual([]);
    });
  });

  describe("getFileChangeTag", () => {
    it("should return size:mtime when file exists with modificationTime", async () => {
      const file = createMockFile({
        uri: "file:///vault/default/band_0.js",
        size: 1024,
        modificationTime: 1700000000,
      });
      const dir = createMockDirectory("file:///vault/default", [file]);
      const source = new LocalDirectorySource(dir);

      const tag = await source.getFileChangeTag("band_0.js");
      expect(tag).toBe("1024:1700000000");
    });

    it("should return null when file does not exist", async () => {
      const dir = createMockDirectory("file:///vault/default", []);
      const source = new LocalDirectorySource(dir);

      const tag = await source.getFileChangeTag("missing.js");
      expect(tag).toBeNull();
    });

    it("should return null when modificationTime is null", async () => {
      const file = createMockFile({
        uri: "file:///vault/default/band_0.js",
        size: 1024,
        modificationTime: null,
      });
      const dir = createMockDirectory("file:///vault/default", [file]);
      const source = new LocalDirectorySource(dir);

      const tag = await source.getFileChangeTag("band_0.js");
      expect(tag).toBeNull();
    });
  });
});
