import { validateVaultDirectory } from "./opvault-validator";
import {
  createMockDirectory,
  createMockFile,
} from "@/lib/opvault/fixtures/fs-mocks";
import { Directory, File } from "expo-file-system";

describe("validateVaultDirectory", () => {
  describe("with default/ subfolder", () => {
    it("should return valid with default directory when profile.js is in default/ subfolder", async () => {
      // Setup: parent directory with default/ subfolder containing profile.js
      const profileFile = createMockFile({
        uri: "/vault/default/profile.js",
        text: jest.fn().mockResolvedValue('var profile = { "uuid": "test" }'),
      });
      const defaultDir = createMockDirectory("/vault/default", [profileFile]);
      const parentDir = createMockDirectory("/vault", [defaultDir]);

      const result = await validateVaultDirectory(parentDir);

      expect(result.valid).toBe(true);
      if (result.valid) {
        expect(result.vaultDir.uri).toBe("/vault/default");
      }
    });

    it("should return valid with parent directory when default/ exists but profile.js is in parent", async () => {
      // Setup: default/ subfolder with no profile.js, but profile.js in parent
      const defaultDir = createMockDirectory("/vault/default", []);
      const profileFile = createMockFile({
        uri: "/vault/profile.js",
        text: jest.fn().mockResolvedValue('var profile = { "uuid": "test" }'),
      });
      const parentDir = createMockDirectory("/vault", [
        defaultDir,
        profileFile,
      ]);

      const result = await validateVaultDirectory(parentDir);

      expect(result.valid).toBe(true);
      if (result.valid) {
        expect(result.vaultDir.uri).toBe("/vault");
      }
    });

    it("should return invalid when default/ exists but has no profile.js and parent has no profile.js", async () => {
      const defaultDir = createMockDirectory("/vault/default", []);
      const parentDir = createMockDirectory("/vault", [defaultDir]);

      const result = await validateVaultDirectory(parentDir);

      expect(result.valid).toBe(false);
      if (!result.valid) {
        expect(result.error).toContain("doesn't contain a profile.js file");
      }
    });
  });

  describe("without default/ subfolder", () => {
    it("should return valid with selected directory when profile.js is directly in it", async () => {
      const profileFile = createMockFile({
        uri: "/vault/profile.js",
        text: jest.fn().mockResolvedValue('var profile = { "uuid": "test" }'),
      });
      const vaultDir = createMockDirectory("/vault", [profileFile]);

      const result = await validateVaultDirectory(vaultDir);

      expect(result.valid).toBe(true);
      if (result.valid) {
        expect(result.vaultDir.uri).toBe("/vault");
      }
    });

    it("should return invalid when no profile.js exists", async () => {
      const vaultDir = createMockDirectory("/vault", []);

      const result = await validateVaultDirectory(vaultDir);

      expect(result.valid).toBe(false);
      if (!result.valid) {
        expect(result.error).toContain("doesn't contain a profile.js file");
      }
    });
  });

  describe("profile.js content validation", () => {
    it("should return invalid when profile.js is empty", async () => {
      const profileFile = createMockFile({
        uri: "/vault/profile.js",
        text: jest.fn().mockResolvedValue(""),
      });
      const vaultDir = createMockDirectory("/vault", [profileFile]);

      const result = await validateVaultDirectory(vaultDir);

      expect(result.valid).toBe(false);
      if (!result.valid) {
        expect(result.error).toContain("corrupted or invalid");
      }
    });

    it("should return invalid when profile.js does not contain 'profile'", async () => {
      const profileFile = createMockFile({
        uri: "/vault/profile.js",
        text: jest.fn().mockResolvedValue('var data = { "uuid": "test" }'),
      });
      const vaultDir = createMockDirectory("/vault", [profileFile]);

      const result = await validateVaultDirectory(vaultDir);

      expect(result.valid).toBe(false);
      if (!result.valid) {
        expect(result.error).toContain("corrupted or invalid");
      }
    });

    it("should return valid when profile.js contains 'profile' keyword", async () => {
      const profileFile = createMockFile({
        uri: "/vault/profile.js",
        text: jest
          .fn()
          .mockResolvedValue('var profile = { "lastUpdatedBy": "test" }'),
      });
      const vaultDir = createMockDirectory("/vault", [profileFile]);

      const result = await validateVaultDirectory(vaultDir);

      expect(result.valid).toBe(true);
    });
  });

  describe("error handling", () => {
    it("should return invalid when directory.list() throws an error", async () => {
      const vaultDir = { uri: "/vault" } as Directory;
      vaultDir.list = jest.fn().mockImplementation(() => {
        throw new Error("Permission denied");
      });

      const result = await validateVaultDirectory(vaultDir);

      expect(result.valid).toBe(false);
      if (!result.valid) {
        expect(result.error).toContain("doesn't contain a profile.js file");
      }
    });

    it("should return invalid when file.text() throws an error", async () => {
      const profileFile = { uri: "/vault/profile.js" } as File;
      profileFile.text = jest.fn().mockRejectedValue(new Error("Read failed"));
      const vaultDir = createMockDirectory("/vault", [profileFile]);

      const result = await validateVaultDirectory(vaultDir);

      expect(result.valid).toBe(false);
      if (!result.valid) {
        expect(result.error).toContain("doesn't contain a profile.js file");
      }
    });
  });

  describe("priority order", () => {
    it("should prioritize default/ subfolder over parent directory when both have profile.js", async () => {
      // Both default/ and parent have profile.js - default/ should win
      const defaultProfileFile = createMockFile({
        uri: "/vault/default/profile.js",
        text: jest
          .fn()
          .mockResolvedValue('var profile = { "uuid": "default" }'),
      });
      const defaultDir = createMockDirectory("/vault/default", [
        defaultProfileFile,
      ]);

      const parentProfileFile = createMockFile({
        uri: "/vault/profile.js",
        text: jest.fn().mockResolvedValue('var profile = { "uuid": "parent" }'),
      });
      const parentDir = createMockDirectory("/vault", [
        defaultDir,
        parentProfileFile,
      ]);

      const result = await validateVaultDirectory(parentDir);

      expect(result.valid).toBe(true);
      if (result.valid) {
        // Should return the default directory, not the parent
        expect(result.vaultDir.uri).toBe("/vault/default");
      }
    });
  });

  describe("duck-typing compatibility", () => {
    it("should work with objects that have text() method but not File prototype", async () => {
      // Create plain object with text() method (simulates real Expo objects)
      const plainObjectFile = {
        uri: "/vault/profile.js",
        text: jest.fn().mockResolvedValue('var profile = {"uuid":"test"}'),
      };

      const vaultDir = createMockDirectory("/vault", [plainObjectFile as any]);

      const result = await validateVaultDirectory(vaultDir);

      expect(result.valid).toBe(true);
      if (result.valid) {
        expect(result.vaultDir.uri).toBe("/vault");
      }
    });

    it("should work with objects that have list() method but not Directory prototype", async () => {
      // Create plain object with list() method
      const profileFile = createMockFile({
        uri: "/vault/default/profile.js",
        text: jest.fn().mockResolvedValue('var profile = {"uuid":"test"}'),
      });

      const plainObjectDir = {
        uri: "/vault/default",
        list: jest.fn().mockReturnValue([profileFile]),
      };

      const parentDir = createMockDirectory("/vault", [plainObjectDir as any]);

      const result = await validateVaultDirectory(parentDir);

      expect(result.valid).toBe(true);
      if (result.valid) {
        expect(result.vaultDir.uri).toBe("/vault/default");
      }
    });

    it("should reject objects without required methods even if they have correct URIs", async () => {
      // Create plain object without text() method
      const invalidFile = {
        uri: "/vault/profile.js",
        // Missing text() method
      };

      const vaultDir = createMockDirectory("/vault", [invalidFile as any]);

      const result = await validateVaultDirectory(vaultDir);

      expect(result.valid).toBe(false);
      if (!result.valid) {
        expect(result.error).toContain("doesn't contain a profile.js file");
      }
    });
  });
});
