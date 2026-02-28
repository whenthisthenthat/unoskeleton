import * as cipherModule from "@/lib/opvault/crypto/cipher";
import * as opdataModule from "@/lib/opvault/crypto/opdata";
import {
  TEST_VAULT,
  REAL_TEST_ITEM,
  createMockOPVaultItem,
  createMockMasterKeys,
  createMockOverviewKeys,
  createMockItemKeys,
} from "@/lib/opvault/fixtures/test-vectors";
import {
  decryptItemKeys,
  decryptOverview,
  decryptDetails,
} from "@/lib/opvault/internal/item-decryptor";
import { deriveVaultKeys } from "@/lib/opvault/internal/key-derivation";
import type { MasterKeys, OverviewKeys, Profile } from "@/lib/opvault/types";
import { VaultCorruptedError } from "@/lib/vault/storage-interface";

describe("item-decryptor", () => {
  const mockMasterKeys = createMockMasterKeys();
  const mockOverviewKeys = createMockOverviewKeys();

  describe("decryptItemKeys", () => {
    it("should require minimum length (IV + MAC)", () => {
      const item = createMockOPVaultItem({
        k: Buffer.alloc(40).toString("base64"), // Too short
      });

      expect(() => decryptItemKeys(item, mockMasterKeys)).toThrow(
        VaultCorruptedError,
      );
      expect(() => decryptItemKeys(item, mockMasterKeys)).toThrow(
        "data too short",
      );
    });

    it("should throw on invalid HMAC", () => {
      // Create minimal valid structure but with wrong HMAC
      const data = Buffer.alloc(16 + 80 + 32); // IV + ciphertext + MAC
      const item = createMockOPVaultItem({ k: data.toString("base64") });

      expect(() => decryptItemKeys(item, mockMasterKeys)).toThrow(
        VaultCorruptedError,
      );
      expect(() => decryptItemKeys(item, mockMasterKeys)).toThrow(
        "HMAC verification failed",
      );
    });

    it("should use simpler format (NOT opdata01) per spec", () => {
      // Per OPVault spec lines 305-324, item.k format is:
      // [16-byte IV][ciphertext][32-byte HMAC]
      // NOT opdata01 (no "opdata01" header, no length field)
      const data = Buffer.from("test", "base64");
      const item = createMockOPVaultItem({ k: data.toString("base64") });

      // Should fail gracefully (not try to parse as opdata01)
      expect(() => decryptItemKeys(item, mockMasterKeys)).toThrow(
        VaultCorruptedError,
      );
    });

    it("should throw VaultCorruptedError on invalid base64", () => {
      const item = createMockOPVaultItem({ k: "not-valid-base64!!!" });

      expect(() => decryptItemKeys(item, mockMasterKeys)).toThrow();
    });

    it("should include item UUID in error message", () => {
      const item = createMockOPVaultItem({
        uuid: "test-uuid-123",
        k: "AA==",
      });

      expect(() => decryptItemKeys(item, mockMasterKeys)).toThrow(
        VaultCorruptedError,
      );
      expect(() => decryptItemKeys(item, mockMasterKeys)).toThrow(
        "test-uuid-123",
      );
    });
  });

  describe("decryptOverview", () => {
    it("should throw on invalid opdata01 format", () => {
      const item = createMockOPVaultItem({ o: "invalid" });

      expect(() => decryptOverview(item, mockOverviewKeys)).toThrow(
        VaultCorruptedError,
      );
    });

    it("should throw VaultCorruptedError on decryption failure", () => {
      const item = createMockOPVaultItem({
        o: Buffer.alloc(100).toString("base64"),
      });

      expect(() => decryptOverview(item, mockOverviewKeys)).toThrow(
        VaultCorruptedError,
      );
    });

    it("should include item UUID in error message", () => {
      const item = createMockOPVaultItem({
        uuid: "overview-test-uuid",
        o: "AA==",
      });

      expect(() => decryptOverview(item, mockOverviewKeys)).toThrow(
        VaultCorruptedError,
      );
      expect(() => decryptOverview(item, mockOverviewKeys)).toThrow(
        "overview-test-uuid",
      );
    });
  });

  describe("decryptDetails", () => {
    it("should throw on invalid opdata01 format", () => {
      const mockItemKeys = createMockItemKeys({
        encryptionKey: Buffer.alloc(32, 0),
        macKey: Buffer.alloc(32, 0),
      });
      const item = createMockOPVaultItem({ d: "invalid" });

      expect(() => decryptDetails(item, mockItemKeys)).toThrow(
        VaultCorruptedError,
      );
    });

    it("should throw VaultCorruptedError on decryption failure", () => {
      const mockItemKeys = createMockItemKeys({
        encryptionKey: Buffer.alloc(32, 0),
        macKey: Buffer.alloc(32, 0),
      });
      const item = createMockOPVaultItem({
        d: Buffer.alloc(100).toString("base64"),
      });

      expect(() => decryptDetails(item, mockItemKeys)).toThrow(
        VaultCorruptedError,
      );
    });

    it("should include item UUID in error message", () => {
      const mockItemKeys = createMockItemKeys({
        encryptionKey: Buffer.alloc(32, 0),
        macKey: Buffer.alloc(32, 0),
      });
      const item = createMockOPVaultItem({
        uuid: "details-test-uuid",
        d: "AA==",
      });

      expect(() => decryptDetails(item, mockItemKeys)).toThrow(
        VaultCorruptedError,
      );
      expect(() => decryptDetails(item, mockItemKeys)).toThrow(
        "details-test-uuid",
      );
    });
  });

  describe("happy path (real crypto)", () => {
    let realMasterKeys: MasterKeys;
    let realOverviewKeys: OverviewKeys;

    beforeAll(() => {
      const profile: Profile = {
        uuid: "test",
        salt: TEST_VAULT.salt,
        masterKey: TEST_VAULT.masterKey,
        overviewKey: TEST_VAULT.overviewKey,
        iterations: TEST_VAULT.iterations,
        profileName: "default",
        createdAt: 0,
        updatedAt: 0,
        lastUpdatedBy: "test",
      };

      const result = deriveVaultKeys(TEST_VAULT.password, profile);
      realMasterKeys = result.masterKeys;
      realOverviewKeys = result.overviewKeys;
    });

    describe("decryptItemKeys", () => {
      it("should decrypt real item keys and return 32-byte key pairs", () => {
        const itemKeys = decryptItemKeys(REAL_TEST_ITEM, realMasterKeys);

        expect(itemKeys.encryptionKey).toBeInstanceOf(Buffer);
        expect(itemKeys.encryptionKey.length).toBe(32);
        expect(itemKeys.macKey).toBeInstanceOf(Buffer);
        expect(itemKeys.macKey.length).toBe(32);
      });

      it("should derive distinct encryption and MAC keys", () => {
        const itemKeys = decryptItemKeys(REAL_TEST_ITEM, realMasterKeys);

        expect(itemKeys.encryptionKey.equals(itemKeys.macKey)).toBe(false);
      });
    });

    describe("decryptOverview", () => {
      it("should decrypt real overview containing a title string", () => {
        const overview = decryptOverview(REAL_TEST_ITEM, realOverviewKeys);

        expect(typeof overview).toBe("object");
        expect(overview).not.toBeNull();
        expect(typeof overview.title).toBe("string");
      });
    });

    describe("decryptDetails", () => {
      it("should decrypt real details as a non-null object", () => {
        const itemKeys = decryptItemKeys(REAL_TEST_ITEM, realMasterKeys);
        const details = decryptDetails(REAL_TEST_ITEM, itemKeys);

        expect(typeof details).toBe("object");
        expect(details).not.toBeNull();
      });
    });
  });

  describe("validation edge cases", () => {
    afterEach(() => {
      jest.restoreAllMocks();
    });

    describe("decryptItemKeys", () => {
      it("should throw VaultCorruptedError when decrypted length is not 64 bytes", () => {
        jest.spyOn(cipherModule, "verifyHMAC").mockReturnValue(true);
        jest
          .spyOn(cipherModule, "decryptAES256CBC")
          .mockReturnValue(Buffer.alloc(48));

        const item = createMockOPVaultItem({
          uuid: "length-test",
          k: Buffer.alloc(80).toString("base64"),
        });

        expect(() => decryptItemKeys(item, mockMasterKeys)).toThrow(
          VaultCorruptedError,
        );
        expect(() => decryptItemKeys(item, mockMasterKeys)).toThrow(
          "Expected 64 bytes",
        );
      });
    });

    describe("decryptOverview", () => {
      it("should throw VaultCorruptedError when result is not an object", () => {
        jest
          .spyOn(opdataModule, "decryptOpdata01")
          .mockReturnValue(Buffer.from('"just a string"'));

        const item = createMockOPVaultItem({
          uuid: "non-object-test",
          o: "dummy",
        });

        expect(() => decryptOverview(item, mockOverviewKeys)).toThrow(
          VaultCorruptedError,
        );
        expect(() => decryptOverview(item, mockOverviewKeys)).toThrow(
          "not a valid object",
        );
      });

      it("should throw VaultCorruptedError when result is null", () => {
        jest
          .spyOn(opdataModule, "decryptOpdata01")
          .mockReturnValue(Buffer.from("null"));

        const item = createMockOPVaultItem({
          uuid: "null-test",
          o: "dummy",
        });

        expect(() => decryptOverview(item, mockOverviewKeys)).toThrow(
          VaultCorruptedError,
        );
        expect(() => decryptOverview(item, mockOverviewKeys)).toThrow(
          "not a valid object",
        );
      });

      it("should default title to empty string when title is missing", () => {
        jest
          .spyOn(opdataModule, "decryptOpdata01")
          .mockReturnValue(Buffer.from('{"ainfo":"http://example.com"}'));

        const item = createMockOPVaultItem({
          uuid: "no-title-test",
          o: "dummy",
        });

        const overview = decryptOverview(item, mockOverviewKeys);
        expect(overview.title).toBe("");
        expect(overview.ainfo).toBe("http://example.com");
      });

      it("should default title to empty string when title is not a string", () => {
        jest
          .spyOn(opdataModule, "decryptOpdata01")
          .mockReturnValue(Buffer.from('{"title":42}'));

        const item = createMockOPVaultItem({
          uuid: "bad-title-test",
          o: "dummy",
        });

        const overview = decryptOverview(item, mockOverviewKeys);
        expect(overview.title).toBe("");
      });
    });

    describe("decryptDetails", () => {
      it("should throw VaultCorruptedError when result is not an object", () => {
        jest
          .spyOn(opdataModule, "decryptOpdata01")
          .mockReturnValue(Buffer.from("42"));

        const item = createMockOPVaultItem({
          uuid: "non-object-details",
          d: "dummy",
        });
        const mockItemKeys = createMockItemKeys({
          encryptionKey: Buffer.alloc(32, 0),
          macKey: Buffer.alloc(32, 0),
        });

        expect(() => decryptDetails(item, mockItemKeys)).toThrow(
          VaultCorruptedError,
        );
        expect(() => decryptDetails(item, mockItemKeys)).toThrow(
          "not a valid object",
        );
      });
    });
  });
});
