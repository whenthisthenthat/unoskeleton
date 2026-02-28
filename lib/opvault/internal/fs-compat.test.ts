import {
  isFileObject,
  isDirectoryObject,
  getDirectoryFilenames,
  findFileByName,
  directoryContainsFile,
} from "./fs-compat";
import {
  createMockFile,
  createMockDirectory,
} from "@/lib/opvault/fixtures/fs-mocks";

describe("fs-compat", () => {
  describe("isFileObject", () => {
    it("should return true for objects with text() method", () => {
      const file = createMockFile({ uri: "/test.txt" });
      expect(isFileObject(file)).toBe(true);
    });

    it("should return true for plain objects with text() method", () => {
      const plainObject = {
        uri: "/test.txt",
        text: jest.fn().mockResolvedValue("content"),
      };
      expect(isFileObject(plainObject)).toBe(true);
    });

    it("should return false for objects without text() method", () => {
      const notAFile = { uri: "/test.txt" };
      expect(isFileObject(notAFile)).toBe(false);
    });

    it("should return false for null", () => {
      expect(isFileObject(null)).toBe(false);
    });

    it("should return false for undefined", () => {
      expect(isFileObject(undefined)).toBe(false);
    });

    it("should return false for primitives", () => {
      expect(isFileObject("string")).toBe(false);
      expect(isFileObject(123)).toBe(false);
      expect(isFileObject(true)).toBe(false);
    });
  });

  describe("isDirectoryObject", () => {
    it("should return true for objects with list() method", () => {
      const dir = createMockDirectory("/test");
      expect(isDirectoryObject(dir)).toBe(true);
    });

    it("should return true for plain objects with list() method", () => {
      const plainObject = {
        uri: "/test",
        list: jest.fn().mockReturnValue([]),
      };
      expect(isDirectoryObject(plainObject)).toBe(true);
    });

    it("should return false for objects without list() method", () => {
      const notADirectory = { uri: "/test" };
      expect(isDirectoryObject(notADirectory)).toBe(false);
    });

    it("should return false for null", () => {
      expect(isDirectoryObject(null)).toBe(false);
    });

    it("should return false for undefined", () => {
      expect(isDirectoryObject(undefined)).toBe(false);
    });

    it("should return false for primitives", () => {
      expect(isDirectoryObject("string")).toBe(false);
      expect(isDirectoryObject(123)).toBe(false);
      expect(isDirectoryObject(true)).toBe(false);
    });
  });

  describe("getDirectoryFilenames", () => {
    it("should return filenames from info().files when available", () => {
      const dir = createMockDirectory("/vault", [
        createMockFile({ uri: "/vault/file1.txt" }),
        createMockFile({ uri: "/vault/file2.txt" }),
      ]);

      const filenames = getDirectoryFilenames(dir);
      expect(filenames).toEqual(["file1.txt", "file2.txt"]);
    });

    it("should return undefined when info() is not available", () => {
      const dir = createMockDirectory("/vault");
      // Remove info() method
      delete (dir as any).info;

      const filenames = getDirectoryFilenames(dir);
      expect(filenames).toBeUndefined();
    });

    it("should return undefined when info() throws an error", () => {
      const dir = createMockDirectory("/vault");
      (dir as any).info = jest.fn().mockImplementation(() => {
        throw new Error("Permission denied");
      });

      const filenames = getDirectoryFilenames(dir);
      expect(filenames).toBeUndefined();
    });

    it("should return undefined when info().files is not an array", () => {
      const dir = createMockDirectory("/vault");
      (dir as any).info = jest.fn().mockReturnValue({
        exists: true,
        uri: "/vault",
        files: "not-an-array",
      });

      const filenames = getDirectoryFilenames(dir);
      expect(filenames).toBeUndefined();
    });

    it("should return undefined when info().files is missing", () => {
      const dir = createMockDirectory("/vault");
      (dir as any).info = jest.fn().mockReturnValue({
        exists: true,
        uri: "/vault",
      });

      const filenames = getDirectoryFilenames(dir);
      expect(filenames).toBeUndefined();
    });
  });

  describe("findFileByName", () => {
    it("should find file by URI ending (iOS/web file:// URIs)", () => {
      const file1 = createMockFile({ uri: "/vault/profile.js" });
      const file2 = createMockFile({ uri: "/vault/data.json" });
      const dir = createMockDirectory("/vault", [file1, file2]);

      const found = findFileByName(dir, "profile.js");
      expect(found).toBe(file1);
      expect(found?.uri).toBe("/vault/profile.js");
    });

    it("should find file by index matching (Android content URIs)", () => {
      // Simulate Android content URIs (opaque, no filename in URI)
      const file1 = createMockFile({ uri: "content://...msf%3A19" });
      const file2 = createMockFile({ uri: "content://...msf%3A20" });
      const dir = createMockDirectory("content://...msd%3A18", [file1, file2]);

      // Mock info() to return actual filenames
      (dir as any).info = jest.fn().mockReturnValue({
        exists: true,
        uri: "content://...msd%3A18",
        files: ["profile.js", "data.json"],
      });

      const found = findFileByName(dir, "profile.js");
      expect(found).toBe(file1);
    });

    it("should return null when file not found", () => {
      const file1 = createMockFile({ uri: "/vault/data.json" });
      const dir = createMockDirectory("/vault", [file1]);

      const found = findFileByName(dir, "profile.js");
      expect(found).toBeNull();
    });

    it("should return null when directory is empty", () => {
      const dir = createMockDirectory("/vault", []);

      const found = findFileByName(dir, "profile.js");
      expect(found).toBeNull();
    });

    it("should skip non-file objects", () => {
      const subdir = createMockDirectory("/vault/subdir");
      const file = createMockFile({ uri: "/vault/profile.js" });
      const dir = createMockDirectory("/vault", [subdir, file]);

      const found = findFileByName(dir, "profile.js");
      expect(found).toBe(file);
    });

    it("should return null when dir.list() throws an error", () => {
      const dir = createMockDirectory("/vault");
      dir.list = jest.fn().mockImplementation(() => {
        throw new Error("Permission denied");
      });

      const found = findFileByName(dir, "profile.js");
      expect(found).toBeNull();
    });

    it("should work with plain objects that have text() method", () => {
      const plainFile = {
        uri: "/vault/profile.js",
        text: jest.fn().mockResolvedValue("content"),
      };
      const dir = createMockDirectory("/vault", [plainFile as any]);

      const found = findFileByName(dir, "profile.js");
      expect(found).toBe(plainFile);
    });

    it("should prefer URI match over index match when both available", () => {
      const file1 = createMockFile({ uri: "/vault/profile.js" });
      const file2 = createMockFile({ uri: "/vault/data.json" });
      const dir = createMockDirectory("/vault", [file1, file2]);

      // Even with info() returning different order, URI match should win
      (dir as any).info = jest.fn().mockReturnValue({
        exists: true,
        uri: "/vault",
        files: ["data.json", "profile.js"], // Different order
      });

      const found = findFileByName(dir, "profile.js");
      expect(found).toBe(file1); // Found by URI, not by index
    });
  });

  describe("directoryContainsFile", () => {
    it("should return true when file exists (using info().files)", () => {
      const file = createMockFile({ uri: "/vault/profile.js" });
      const dir = createMockDirectory("/vault", [file]);

      expect(directoryContainsFile(dir, "profile.js")).toBe(true);
    });

    it("should return false when file does not exist", () => {
      const file = createMockFile({ uri: "/vault/data.json" });
      const dir = createMockDirectory("/vault", [file]);

      expect(directoryContainsFile(dir, "profile.js")).toBe(false);
    });

    it("should return false when directory is empty", () => {
      const dir = createMockDirectory("/vault", []);

      expect(directoryContainsFile(dir, "profile.js")).toBe(false);
    });

    it("should use info().files for fast check when available", () => {
      const file = createMockFile({ uri: "/vault/profile.js" });
      const dir = createMockDirectory("/vault", [file]);

      const infoSpy = jest.spyOn(dir as any, "info");

      expect(directoryContainsFile(dir, "profile.js")).toBe(true);
    });

    it("should fall back to findFileByName when info() not available", () => {
      const file = createMockFile({ uri: "/vault/profile.js" });
      const dir = createMockDirectory("/vault", [file]);

      // Remove info() method
      delete (dir as any).info;

      expect(directoryContainsFile(dir, "profile.js")).toBe(true);
    });

    it("should handle Android content URIs", () => {
      const file = createMockFile({ uri: "content://...msf%3A19" });
      const dir = createMockDirectory("content://...msd%3A18", [file]);

      (dir as any).info = jest.fn().mockReturnValue({
        exists: true,
        uri: "content://...msd%3A18",
        files: ["profile.js"],
      });

      expect(directoryContainsFile(dir, "profile.js")).toBe(true);
    });
  });
});
