import { TEST_VAULT } from "@/lib/opvault/fixtures/test-vectors";
import {
  parseProfile,
  parseBandFile,
  parseFolders,
} from "@/lib/opvault/internal/parser";

describe("parser", () => {
  describe("parseProfile", () => {
    it("should parse valid profile.js", () => {
      const fileContent = `var profile=${JSON.stringify({
        salt: TEST_VAULT.salt,
        masterKey: TEST_VAULT.masterKey,
        overviewKey: TEST_VAULT.overviewKey,
        iterations: TEST_VAULT.iterations,
        uuid: "test-uuid",
        profileName: "default",
        lastUpdatedBy: "test",
        updatedAt: 1234567890,
        createdAt: 1234567890,
      })};`;

      const profile = parseProfile(fileContent);

      expect(profile.salt).toBe(TEST_VAULT.salt);
      expect(profile.masterKey).toBe(TEST_VAULT.masterKey);
      expect(profile.overviewKey).toBe(TEST_VAULT.overviewKey);
      expect(profile.iterations).toBe(TEST_VAULT.iterations);
    });

    it("should throw on missing required fields", () => {
      const fileContent = `var profile=${JSON.stringify({
        salt: "test",
        // missing masterKey
      })};`;

      expect(() => parseProfile(fileContent)).toThrow("missing required field");
    });

    it("should throw on invalid format", () => {
      const fileContent = "not a valid profile";

      expect(() => parseProfile(fileContent)).toThrow();
    });

    it("should throw on invalid JSON", () => {
      const fileContent = "var profile={invalid json};";

      expect(() => parseProfile(fileContent)).toThrow();
    });
  });

  describe("parseBandFile", () => {
    it("should parse valid band file", () => {
      const fileContent = `ld(${JSON.stringify({
        "uuid-1": {
          uuid: "uuid-1",
          category: "001",
          o: "b3BkYXRh...",
          k: "encrypted...",
          d: "details...",
        },
        "uuid-2": {
          uuid: "uuid-2",
          category: "002",
          o: "b3BkYXRh...",
          k: "encrypted...",
          d: "details...",
        },
      })});`;

      const bandFile = parseBandFile(fileContent);

      expect(Object.keys(bandFile)).toHaveLength(2);
      expect(bandFile["uuid-1"].uuid).toBe("uuid-1");
      expect(bandFile["uuid-2"].category).toBe("002");
    });

    it("should handle empty band file", () => {
      // Regex requires at least one character in braces, use space
      const fileContent = "ld({ });";

      const bandFile = parseBandFile(fileContent);

      expect(Object.keys(bandFile)).toHaveLength(0);
    });

    it("should throw on invalid format", () => {
      const fileContent = "not a valid band file";

      expect(() => parseBandFile(fileContent)).toThrow();
    });

    it("should throw on invalid JSON", () => {
      const fileContent = "ld({invalid json});";

      expect(() => parseBandFile(fileContent)).toThrow();
    });
  });

  describe("parseFolders", () => {
    it("should parse valid folders.js", () => {
      // Uses ld() format (same as band files)
      const fileContent = `ld(${JSON.stringify({
        "folder-1": {
          uuid: "folder-1",
          overview: "encrypted...",
        },
        "folder-2": {
          uuid: "folder-2",
          overview: "encrypted...",
        },
      })});`;

      const folders = parseFolders(fileContent);

      expect(folders.size).toBe(2);
      expect(folders.has("folder-1")).toBe(true);
      expect(folders.get("folder-2")?.uuid).toBe("folder-2");
    });

    it("should handle empty folders", () => {
      // Uses ld() format (same as band files), regex requires at least one char
      const fileContent = "ld({ });";

      const folders = parseFolders(fileContent);

      expect(folders.size).toBe(0);
    });

    it("should throw on invalid format", () => {
      const fileContent = "not valid";

      expect(() => parseFolders(fileContent)).toThrow();
    });
  });
});
