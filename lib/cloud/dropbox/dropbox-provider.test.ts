import { DropboxProvider } from "./dropbox-provider";
import {
  TokenExpiredError,
  type DropboxEntry,
} from "@/lib/cloud/dropbox/dropbox-api";

// Must mock before importing provider (which imports these)
jest.mock("@/lib/cloud/dropbox/dropbox-api");
jest.mock("@/lib/cloud/dropbox/dropbox-auth", () => ({
  getValidToken: jest.fn().mockResolvedValue("test-token"),
}));

/* eslint-disable @typescript-eslint/no-require-imports */
const dropboxApi =
  require("@/lib/cloud/dropbox/dropbox-api") as typeof import("@/lib/cloud/dropbox/dropbox-api");
const dropboxAuth =
  require("@/lib/cloud/dropbox/dropbox-auth") as typeof import("@/lib/cloud/dropbox/dropbox-auth");
/* eslint-enable @typescript-eslint/no-require-imports */

const MockApi = dropboxApi as jest.Mocked<typeof dropboxApi>;
const MockAuth = dropboxAuth as jest.Mocked<typeof dropboxAuth>;

describe("DropboxProvider", () => {
  let provider: DropboxProvider;

  beforeEach(() => {
    jest.clearAllMocks();
    MockAuth.getValidToken.mockResolvedValue("test-token");
    provider = new DropboxProvider();
  });

  it("should have name 'dropbox'", () => {
    expect(provider.name).toBe("dropbox");
  });

  describe("listFiles", () => {
    it("should return only filenames (not folders)", async () => {
      MockApi.listFolder.mockResolvedValue([
        {
          ".tag": "file",
          name: "profile.js",
          path_lower: "/v/profile.js",
          path_display: "/v/profile.js",
        },
        {
          ".tag": "folder",
          name: "sub",
          path_lower: "/v/sub",
          path_display: "/v/sub",
        },
        {
          ".tag": "file",
          name: "band_0.js",
          path_lower: "/v/band_0.js",
          path_display: "/v/band_0.js",
        },
      ] as DropboxEntry[]);

      const files = await provider.listFiles("/vault");

      expect(files).toEqual(["profile.js", "band_0.js"]);
      expect(MockApi.listFolder).toHaveBeenCalledWith("test-token", "/vault");
    });
  });

  describe("listFolderContents", () => {
    it("should return files and folders with metadata", async () => {
      MockApi.listFolder.mockResolvedValue([
        {
          ".tag": "folder",
          name: "default",
          path_lower: "/opvault/default",
          path_display: "/OPVault/default",
        },
        {
          ".tag": "file",
          name: "readme.txt",
          path_lower: "/opvault/readme.txt",
          path_display: "/OPVault/readme.txt",
        },
      ] as DropboxEntry[]);

      const entries = await provider.listFolderContents("/OPVault");

      expect(entries).toEqual([
        { name: "default", path: "/OPVault/default", isFolder: true },
        { name: "readme.txt", path: "/OPVault/readme.txt", isFolder: false },
      ]);
    });
  });

  describe("downloadFile", () => {
    it("should download text file at cloudPath/filename", async () => {
      MockApi.downloadFileText.mockResolvedValue("var profile = {};");

      const content = await provider.downloadFile("/vault", "profile.js");

      expect(content).toBe("var profile = {};");
      expect(MockApi.downloadFileText).toHaveBeenCalledWith(
        "test-token",
        "/vault/profile.js",
      );
    });

    it("should return null when file not found", async () => {
      MockApi.downloadFileText.mockResolvedValue(null);

      const content = await provider.downloadFile("/vault", "missing.js");

      expect(content).toBeNull();
    });
  });

  describe("downloadBinaryFile", () => {
    it("should download binary file at cloudPath/filename", async () => {
      const bytes = new Uint8Array([0x01, 0x02]);
      MockApi.downloadFileBinary.mockResolvedValue(bytes);

      const content = await provider.downloadBinaryFile(
        "/vault",
        "item.attachment",
      );

      expect(content).toEqual(bytes);
      expect(MockApi.downloadFileBinary).toHaveBeenCalledWith(
        "test-token",
        "/vault/item.attachment",
      );
    });
  });

  describe("getFileChangeTag", () => {
    it("should return content_hash from metadata", async () => {
      MockApi.getMetadata.mockResolvedValue({
        ".tag": "file",
        name: "profile.js",
        path_lower: "/vault/profile.js",
        content_hash: "hash123",
      });

      const tag = await provider.getFileChangeTag("/vault", "profile.js");

      expect(tag).toBe("hash123");
      expect(MockApi.getMetadata).toHaveBeenCalledWith(
        "test-token",
        "/vault/profile.js",
      );
    });

    it("should return null when metadata has no content_hash", async () => {
      MockApi.getMetadata.mockResolvedValue({
        ".tag": "folder",
        name: "vault",
        path_lower: "/vault",
      });

      const tag = await provider.getFileChangeTag("/vault", "subfolder");

      expect(tag).toBeNull();
    });

    it("should return null when file not found", async () => {
      MockApi.getMetadata.mockResolvedValue(null);

      const tag = await provider.getFileChangeTag("/vault", "missing.js");

      expect(tag).toBeNull();
    });
  });

  describe("token refresh on 401", () => {
    it("should retry with fresh token after TokenExpiredError", async () => {
      MockApi.listFolder
        .mockRejectedValueOnce(new TokenExpiredError())
        .mockResolvedValueOnce([]);
      MockAuth.getValidToken
        .mockResolvedValueOnce("old-token")
        .mockResolvedValueOnce("fresh-token");

      const files = await provider.listFiles("/vault");

      expect(files).toEqual([]);
      expect(MockApi.listFolder).toHaveBeenCalledTimes(2);
      expect(MockAuth.getValidToken).toHaveBeenCalledTimes(2);
    });
  });
});
