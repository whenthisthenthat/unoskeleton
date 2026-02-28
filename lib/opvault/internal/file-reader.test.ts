/**
 * Tests for OPVault file I/O operations
 * Validates file reading, error handling, and band file discovery
 */
import {
  readProfileFile,
  readBandFileContent,
  readFoldersFile,
  discoverBandLetters,
} from "./file-reader";
import { createMockVaultSource } from "@/lib/opvault/fixtures/fs-mocks";

describe("file-reader", () => {
  describe("readProfileFile", () => {
    it("should read profile.js from vault source", async () => {
      const mockContent = `var profile={"salt":"test","masterKey":"key"};`;
      const source = createMockVaultSource("path/to/vault");
      source.getFileContent.mockResolvedValue(mockContent);

      const result = await readProfileFile(source);

      expect(source.getFileContent).toHaveBeenCalledWith("profile.js");
      expect(result).toBe(mockContent);
    });

    it("should throw error when profile.js does not exist", async () => {
      const source = createMockVaultSource("path/to/vault");
      source.getFileContent.mockResolvedValue(null);

      await expect(readProfileFile(source)).rejects.toThrow(
        "Failed to read profile.js",
      );
    });

    it("should propagate file read errors", async () => {
      const source = createMockVaultSource("path/to/vault");
      source.getFileContent.mockRejectedValue(new Error("Permission denied"));

      await expect(readProfileFile(source)).rejects.toThrow(
        "Permission denied",
      );
    });
  });

  describe("readBandFileContent", () => {
    it("should read existing band file and return content", async () => {
      const mockContent = `ld({"uuid-123":{"k":"itemkey"}});`;
      const source = createMockVaultSource("path/to/vault");
      source.getFileContent.mockResolvedValue(mockContent);

      const result = await readBandFileContent(source, "0");

      expect(source.getFileContent).toHaveBeenCalledWith("band_0.js");
      expect(result).toBe(mockContent);
    });

    it("should return null when band file does not exist", async () => {
      const source = createMockVaultSource("path/to/vault");
      source.getFileContent.mockResolvedValue(null);

      const result = await readBandFileContent(source, "A");

      expect(source.getFileContent).toHaveBeenCalledWith("band_A.js");
      expect(result).toBeNull();
    });

    it("should propagate file read errors", async () => {
      const source = createMockVaultSource("path/to/vault");
      source.getFileContent.mockRejectedValue(new Error("Permission denied"));

      await expect(readBandFileContent(source, "F")).rejects.toThrow(
        "Permission denied",
      );
    });

    it("should handle all band letters correctly", async () => {
      const source = createMockVaultSource("vault");
      source.getFileContent.mockResolvedValue("content");

      await readBandFileContent(source, "0");
      expect(source.getFileContent).toHaveBeenCalledWith("band_0.js");

      await readBandFileContent(source, "A");
      expect(source.getFileContent).toHaveBeenCalledWith("band_A.js");

      await readBandFileContent(source, "F");
      expect(source.getFileContent).toHaveBeenCalledWith("band_F.js");
    });
  });

  describe("readFoldersFile", () => {
    it("should read folders.js from vault source", async () => {
      const mockContent = `ld({"folder-1":{"title":"Work"}});`;
      const source = createMockVaultSource("path/to/vault");
      source.getFileContent.mockResolvedValue(mockContent);

      const result = await readFoldersFile(source);

      expect(source.getFileContent).toHaveBeenCalledWith("folders.js");
      expect(result).toBe(mockContent);
    });

    it("should throw error when folders.js does not exist", async () => {
      const source = createMockVaultSource("path/to/vault");
      source.getFileContent.mockResolvedValue(null);

      await expect(readFoldersFile(source)).rejects.toThrow(
        "Failed to read folders.js",
      );
    });

    it("should propagate file read errors", async () => {
      const source = createMockVaultSource("path/to/vault");
      source.getFileContent.mockRejectedValue(new Error("Disk error"));

      await expect(readFoldersFile(source)).rejects.toThrow("Disk error");
    });
  });

  describe("discoverBandLetters", () => {
    it("should return array of existing band letters", async () => {
      const source = createMockVaultSource("content://vault/default");
      source.listFiles.mockResolvedValue([
        "profile.js",
        "band_0.js",
        "band_A.js",
        "band_F.js",
      ]);

      const result = await discoverBandLetters(source);

      expect(result).toEqual(["0", "A", "F"]);
      expect(source.listFiles).toHaveBeenCalledTimes(1);
    });

    it("should return empty array when no band files exist", async () => {
      const source = createMockVaultSource("content://vault/default");
      source.listFiles.mockResolvedValue(["profile.js", "folders.js"]);

      const result = await discoverBandLetters(source);

      expect(result).toEqual([]);
    });

    it("should handle mixed existing/non-existing files", async () => {
      const source = createMockVaultSource("content://vault/default");
      source.listFiles.mockResolvedValue([
        "profile.js",
        "band_0.js",
        "band_1.js",
        "band_2.js",
        "band_3.js",
        "band_4.js",
        "band_5.js",
        "band_6.js",
        "band_7.js",
        "band_8.js",
        "band_A.js",
        "band_D.js",
        "band_E.js",
        "band_F.js",
        "folders.js",
      ]);

      const result = await discoverBandLetters(source);

      expect(result).toEqual([
        "0",
        "1",
        "2",
        "3",
        "4",
        "5",
        "6",
        "7",
        "8",
        "A",
        "D",
        "E",
        "F",
      ]);
    });

    it("should propagate error when file listing fails", async () => {
      const source = createMockVaultSource("content://vault/default");
      source.listFiles.mockRejectedValue(new Error("Cannot access"));

      await expect(discoverBandLetters(source)).rejects.toThrow(
        "Cannot access",
      );
    });
  });
});
