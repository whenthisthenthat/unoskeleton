import { VaultCacheManager } from "./cache-manager";
import {
  createMockDirectory,
  createMockFile,
  createMockVaultSource,
} from "@/lib/opvault/fixtures/fs-mocks";
import { File, Directory } from "expo-file-system";

// Mock expo-file-system
jest.mock("expo-file-system");

const MockFile = File as jest.MockedClass<typeof File>;
const MockDirectory = Directory as jest.MockedClass<typeof Directory>;

describe("VaultCacheManager", () => {
  let manager: VaultCacheManager;
  let mockCacheRoot: any;
  let mockVaultCacheDir: any;

  beforeEach(() => {
    jest.clearAllMocks();

    mockCacheRoot = createMockDirectory("file:///docs/vault-cache");
    mockCacheRoot.create = jest.fn();
    mockCacheRoot.delete = jest.fn();

    mockVaultCacheDir = createMockDirectory("file:///docs/vault-cache/abc123");
    mockVaultCacheDir.create = jest.fn();
    mockVaultCacheDir.delete = jest.fn();

    // Directory constructor calls during VaultCacheManager():
    // 1. Paths.document getter → new Directory("file:///mock-document-dir") (from __mocks__)
    // 2. new Directory(Paths.document, "vault-cache") → cacheRoot
    // After constructor, subsequent calls create vault-specific cache dirs.
    let dirCallCount = 0;
    MockDirectory.mockImplementation((..._args: any[]) => {
      dirCallCount++;
      if (dirCallCount <= 2) return mockCacheRoot as any; // Paths.document + cacheRoot
      return mockVaultCacheDir as any;
    });

    manager = new VaultCacheManager();
  });

  describe("hashUri", () => {
    it("should produce consistent SHA-256 hex for same URI", () => {
      const hash1 = manager.hashUri("content://vault/default");
      const hash2 = manager.hashUri("content://vault/default");
      expect(hash1).toBe(hash2);
      expect(hash1).toHaveLength(64);
    });

    it("should produce different hashes for different URIs", () => {
      const hash1 = manager.hashUri("content://vault-a/default");
      const hash2 = manager.hashUri("content://vault-b/default");
      expect(hash1).not.toBe(hash2);
    });
  });

  describe("getCacheDir", () => {
    it("should return null if cache directory does not exist", () => {
      (mockVaultCacheDir as any).exists = false;
      expect(manager.getCacheDir("content://vault")).toBeNull();
    });

    it("should return Directory if cache exists and has completion marker", () => {
      (mockVaultCacheDir as any).exists = true;
      const mockMarkerFile = createMockFile({
        uri: "file:///cache/.cache-complete",
        exists: true,
      });
      MockFile.mockImplementation(() => mockMarkerFile as any);

      const dir = manager.getCacheDir("content://vault");
      expect(dir).toBe(mockVaultCacheDir);
    });

    it("should return null if cache directory exists but completion marker is missing", () => {
      (mockVaultCacheDir as any).exists = true;
      const mockMissingMarker = createMockFile({
        uri: "file:///cache/.cache-complete",
        exists: false,
      });
      MockFile.mockImplementation(() => mockMissingMarker as any);

      expect(manager.getCacheDir("content://vault")).toBeNull();
    });
  });

  describe("ensureCacheDir", () => {
    it("should create cacheRoot if it does not exist", () => {
      (mockCacheRoot as any).exists = false;
      (mockVaultCacheDir as any).exists = false;
      mockCacheRoot.create = jest.fn();
      mockVaultCacheDir.create = jest.fn();

      manager.ensureCacheDir("content://vault");

      expect(mockCacheRoot.create).toHaveBeenCalled();
      expect(mockVaultCacheDir.create).toHaveBeenCalled();
    });

    it("should create vault cache dir if it does not exist", () => {
      (mockCacheRoot as any).exists = true;
      (mockVaultCacheDir as any).exists = false;
      mockVaultCacheDir.create = jest.fn();

      manager.ensureCacheDir("content://vault");

      expect(mockVaultCacheDir.create).toHaveBeenCalled();
    });

    it("should not create dirs if both already exist", () => {
      (mockCacheRoot as any).exists = true;
      (mockVaultCacheDir as any).exists = true;
      mockCacheRoot.create = jest.fn();
      mockVaultCacheDir.create = jest.fn();

      manager.ensureCacheDir("content://vault");

      expect(mockCacheRoot.create).not.toHaveBeenCalled();
      expect(mockVaultCacheDir.create).not.toHaveBeenCalled();
    });
  });

  describe("syncCache", () => {
    it("should copy all files from source to cache directory", async () => {
      (mockCacheRoot as any).exists = true;
      (mockVaultCacheDir as any).exists = true;

      const profileContent =
        "var profile = {updatedAt:1700000000,salt:'abc',masterKey:'abc',overviewKey:'abc',iterations:1000,uuid:'test',profileName:'test',lastUpdatedBy:'test',createdAt:0};";

      const source = createMockVaultSource("content://vault");
      source.listFiles.mockResolvedValue(["profile.js", "band_0.js"]);
      source.getFileContent.mockImplementation((filename: string) => {
        if (filename === "profile.js") return Promise.resolve(profileContent);
        if (filename === "band_0.js") return Promise.resolve("ld({});");
        return Promise.resolve(null);
      });

      const writtenFiles: { name: string; content: string | Uint8Array }[] = [];
      MockFile.mockImplementation((...args: any[]) => {
        const mockFile = createMockFile({
          uri: `file:///cache/${args[1]}`,
          exists: false,
        });
        (mockFile as any).write = jest.fn((content: string | Uint8Array) => {
          writtenFiles.push({ name: args[1], content });
        });
        return mockFile as any;
      });

      const result = await manager.syncCache(source, "content://vault");

      // 3 files: profile.js, band_0.js, .cache-complete
      expect(writtenFiles).toHaveLength(3);
      expect(writtenFiles[0].name).toBe("profile.js");
      expect(writtenFiles[0].content).toContain("updatedAt");
      expect(writtenFiles[1]).toEqual({
        name: "band_0.js",
        content: "ld({});",
      });
      // Completion marker written last
      expect(writtenFiles[2]).toEqual({
        name: ".cache-complete",
        content: "",
      });
      expect(result).toEqual({ filesCopied: 2 });
    });

    it("should skip attachment files already in cache", async () => {
      (mockCacheRoot as any).exists = true;
      (mockVaultCacheDir as any).exists = true;

      const source = createMockVaultSource("content://vault");
      source.listFiles.mockResolvedValue([
        "profile.js",
        "uuid1_att1.attachment",
      ]);
      source.getFileContent.mockResolvedValue(
        "var profile = {updatedAt:1,salt:'a',masterKey:'a',overviewKey:'a',iterations:1,uuid:'t',profileName:'t',lastUpdatedBy:'t',createdAt:0};",
      );

      MockFile.mockImplementation((...args: any[]) => {
        const filename = args[1] as string;
        const existsInCache = filename.endsWith(".attachment");
        const mockFile = createMockFile({
          uri: `file:///cache/${filename}`,
          exists: existsInCache,
        });
        (mockFile as any).write = jest.fn();
        return mockFile as any;
      });

      await manager.syncCache(source, "content://vault");

      // Attachment already in cache — getBinaryContent should NOT be called
      expect(source.getBinaryContent).not.toHaveBeenCalled();
    });

    it("should propagate listFiles errors", async () => {
      const source = createMockVaultSource("content://vault");
      source.listFiles.mockRejectedValue(new Error("Cannot access"));

      await expect(
        manager.syncCache(source, "content://vault"),
      ).rejects.toThrow("Cannot access");
    });

    it("should stop and not write marker when cancelled mid-loop", async () => {
      (mockCacheRoot as any).exists = true;
      (mockVaultCacheDir as any).exists = true;

      const source = createMockVaultSource("content://vault");
      source.listFiles.mockResolvedValue(["profile.js", "band_0.js"]);
      source.getFileContent.mockResolvedValue("content");

      const writtenFiles: string[] = [];
      MockFile.mockImplementation((...args: any[]) => {
        const mockFile = createMockFile({
          uri: `file:///cache/${args[1]}`,
          exists: false,
        });
        (mockFile as any).write = jest.fn(() => {
          writtenFiles.push(args[1]);
        });
        // For metadata read (textSync)
        (mockFile as any).textSync = jest.fn().mockReturnValue("{}");
        return mockFile as any;
      });

      let callCount = 0;
      await manager.syncCache(source, "content://vault", () => {
        callCount++;
        return callCount > 1; // Cancel after first file processed
      });

      // Completion marker should NOT be written
      expect(writtenFiles).not.toContain(".cache-complete");
    });

    it("should skip unchanged text files via change tags", async () => {
      (mockCacheRoot as any).exists = true;
      (mockVaultCacheDir as any).exists = true;

      const source = createMockVaultSource("content://vault") as any;
      source.listFiles.mockResolvedValue(["band_0.js"]);
      source.getFileChangeTag = jest.fn().mockResolvedValue("etag-123");

      const storedMeta = JSON.stringify({
        fileChangeTags: { "band_0.js": "etag-123" },
      });
      const writtenFiles: string[] = [];
      MockFile.mockImplementation((...args: any[]) => {
        const filename = args[1] as string;
        const isMetaFile = filename === ".cache-meta.json";
        const mockFile = createMockFile({
          uri: `file:///cache/${filename}`,
          exists: isMetaFile, // Metadata file exists with stored tags
        });
        (mockFile as any).write = jest.fn(() => {
          writtenFiles.push(filename);
        });
        (mockFile as any).textSync = jest.fn().mockReturnValue(storedMeta);
        return mockFile as any;
      });

      const result = await manager.syncCache(source, "content://vault");

      // File should be skipped (tag matches)
      expect(source.getFileContent).not.toHaveBeenCalled();
      // But change tags and marker should still be written
      expect(writtenFiles).toContain(".cache-complete");
      expect(result).toEqual({ filesCopied: 0 });
    });

    it("should re-read file when change tag differs", async () => {
      (mockCacheRoot as any).exists = true;
      (mockVaultCacheDir as any).exists = true;

      const source = createMockVaultSource("content://vault") as any;
      source.listFiles.mockResolvedValue(["band_0.js"]);
      source.getFileChangeTag = jest.fn().mockResolvedValue("etag-NEW");
      source.getFileContent.mockResolvedValue("ld({});");

      MockFile.mockImplementation((...args: any[]) => {
        const mockFile = createMockFile({
          uri: `file:///cache/${args[1]}`,
          exists: false,
        });
        (mockFile as any).write = jest.fn();
        (mockFile as any).textSync = jest
          .fn()
          .mockReturnValue(
            JSON.stringify({ fileChangeTags: { "band_0.js": "etag-OLD" } }),
          );
        return mockFile as any;
      });

      await manager.syncCache(source, "content://vault");

      // File should be re-read because tag differs
      expect(source.getFileContent).toHaveBeenCalledWith("band_0.js");
    });

    it("should cache binary attachment files not already in cache", async () => {
      (mockCacheRoot as any).exists = true;
      (mockVaultCacheDir as any).exists = true;

      const attachmentBytes = new Uint8Array([1, 2, 3, 4]);
      const source = createMockVaultSource("content://vault");
      source.listFiles.mockResolvedValue(["uuid1_att1.attachment"]);
      source.getBinaryContent.mockResolvedValue(attachmentBytes);

      const writtenFiles: { name: string; content: string | Uint8Array }[] = [];
      MockFile.mockImplementation((...args: any[]) => {
        const mockFile = createMockFile({
          uri: `file:///cache/${args[1]}`,
          exists: false, // Attachment NOT in cache
        });
        (mockFile as any).write = jest.fn((content: string | Uint8Array) => {
          writtenFiles.push({ name: args[1], content });
        });
        (mockFile as any).textSync = jest.fn().mockReturnValue("{}");
        return mockFile as any;
      });

      await manager.syncCache(source, "content://vault");

      expect(source.getBinaryContent).toHaveBeenCalledWith(
        "uuid1_att1.attachment",
      );
      const attachmentWrite = writtenFiles.find((f) =>
        f.name.endsWith(".attachment"),
      );
      expect(attachmentWrite).toBeDefined();
    });
  });

  describe("cacheBinaryFile", () => {
    it("should write binary data to cache directory", () => {
      (mockCacheRoot as any).exists = true;
      (mockVaultCacheDir as any).exists = true;

      const writeFn = jest.fn();
      MockFile.mockImplementation(
        () =>
          ({
            ...createMockFile({ exists: false }),
            write: writeFn,
          }) as any,
      );

      const data = new Uint8Array([10, 20, 30]);
      manager.cacheBinaryFile("content://vault", "test.attachment", data);

      expect(writeFn).toHaveBeenCalledWith(data);
    });
  });

  describe("writeCacheComplete", () => {
    it("should write completion marker file", () => {
      (mockCacheRoot as any).exists = true;
      (mockVaultCacheDir as any).exists = true;

      const writeFn = jest.fn();
      MockFile.mockImplementation(
        () =>
          ({
            ...createMockFile({ exists: false }),
            write: writeFn,
          }) as any,
      );

      manager.writeCacheComplete("content://vault");

      expect(writeFn).toHaveBeenCalledWith("");
    });
  });

  describe("deleteCacheForVault", () => {
    it("should delete the vault cache directory", () => {
      (mockVaultCacheDir as any).exists = true;
      mockVaultCacheDir.delete = jest.fn();
      // Mock the completion marker check in getCacheDir
      MockFile.mockImplementation(
        () => createMockFile({ exists: true }) as any,
      );

      manager.deleteCacheForVault("content://vault");

      expect(mockVaultCacheDir.delete).toHaveBeenCalled();
    });

    it("should be safe to call when cache does not exist", () => {
      (mockVaultCacheDir as any).exists = false;
      manager.deleteCacheForVault("content://vault");
    });
  });

  describe("deleteAllCaches", () => {
    it("should delete the entire cache root directory", () => {
      (mockCacheRoot as any).exists = true;
      mockCacheRoot.delete = jest.fn();

      manager.deleteAllCaches();

      expect(mockCacheRoot.delete).toHaveBeenCalled();
    });

    it("should be safe to call when cache root does not exist", () => {
      (mockCacheRoot as any).exists = false;
      manager.deleteAllCaches();
    });
  });
});
