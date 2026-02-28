import type { ICloudProvider } from "./cloud-provider";
import { CloudVaultSource } from "./cloud-vault-source";
import { CancellationToken } from "@/lib/vault/cancellation";

function createMockProvider(
  options: { withChangeTag?: boolean } = {},
): jest.Mocked<ICloudProvider> {
  const provider: jest.Mocked<ICloudProvider> = {
    name: "testcloud",
    listFiles: jest.fn().mockResolvedValue([]),
    listFolderContents: jest.fn().mockResolvedValue([]),
    downloadFile: jest.fn().mockResolvedValue(null),
    downloadBinaryFile: jest.fn().mockResolvedValue(null),
  };
  if (options.withChangeTag) {
    provider.getFileChangeTag = jest.fn().mockResolvedValue(null);
  }
  return provider;
}

describe("CloudVaultSource", () => {
  const cloudPath = "/vaults/my-vault";

  it("should return provider://path as sourceUri", () => {
    const provider = createMockProvider();
    const source = new CloudVaultSource(provider, cloudPath);
    expect(source.sourceUri).toBe("testcloud:///vaults/my-vault");
  });

  describe("listFiles", () => {
    it("should delegate to provider", async () => {
      const provider = createMockProvider();
      provider.listFiles.mockResolvedValue(["profile.js", "band_0.js"]);
      const source = new CloudVaultSource(provider, cloudPath);

      const files = await source.listFiles();

      expect(files).toEqual(["profile.js", "band_0.js"]);
      expect(provider.listFiles).toHaveBeenCalledWith(cloudPath);
    });
  });

  describe("getFileContent", () => {
    it("should delegate to provider with correct cloudPath", async () => {
      const provider = createMockProvider();
      provider.downloadFile.mockResolvedValue("var profile = {};");
      const source = new CloudVaultSource(provider, cloudPath);

      const content = await source.getFileContent("profile.js");

      expect(content).toBe("var profile = {};");
      expect(provider.downloadFile).toHaveBeenCalledWith(
        cloudPath,
        "profile.js",
      );
    });

    it("should return null without calling provider when cancelled", async () => {
      const provider = createMockProvider();
      const token = new CancellationToken();
      token.cancel();
      const source = new CloudVaultSource(provider, cloudPath, token);

      const content = await source.getFileContent("profile.js");

      expect(content).toBeNull();
      expect(provider.downloadFile).not.toHaveBeenCalled();
    });
  });

  describe("getBinaryContent", () => {
    it("should delegate to provider with correct cloudPath", async () => {
      const bytes = new Uint8Array([0x01, 0x02]);
      const provider = createMockProvider();
      provider.downloadBinaryFile.mockResolvedValue(bytes);
      const source = new CloudVaultSource(provider, cloudPath);

      const content = await source.getBinaryContent("item.attachment");

      expect(content).toEqual(bytes);
      expect(provider.downloadBinaryFile).toHaveBeenCalledWith(
        cloudPath,
        "item.attachment",
      );
    });

    it("should return null without calling provider when cancelled", async () => {
      const provider = createMockProvider();
      const token = new CancellationToken();
      token.cancel();
      const source = new CloudVaultSource(provider, cloudPath, token);

      const content = await source.getBinaryContent("item.attachment");

      expect(content).toBeNull();
      expect(provider.downloadBinaryFile).not.toHaveBeenCalled();
    });
  });

  describe("getFileChangeTag", () => {
    it("should be exposed when provider supports it", () => {
      const provider = createMockProvider({ withChangeTag: true });
      const source = new CloudVaultSource(provider, cloudPath);

      expect(source.getFileChangeTag).toBeDefined();
    });

    it("should not be exposed when provider does not support it", () => {
      const provider = createMockProvider();
      const source = new CloudVaultSource(provider, cloudPath);

      expect(source.getFileChangeTag).toBeUndefined();
    });

    it("should delegate to provider with correct cloudPath", async () => {
      const provider = createMockProvider({ withChangeTag: true });
      (provider.getFileChangeTag as jest.Mock).mockResolvedValue("etag-123");
      const source = new CloudVaultSource(provider, cloudPath);

      const tag = await source.getFileChangeTag!("profile.js");

      expect(tag).toBe("etag-123");
      expect(provider.getFileChangeTag).toHaveBeenCalledWith(
        cloudPath,
        "profile.js",
      );
    });
  });
});
