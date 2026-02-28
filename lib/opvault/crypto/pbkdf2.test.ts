import { deriveKeysFromPassword } from "@/lib/opvault/crypto/pbkdf2";
import { TEST_VAULT, CRYPTO_SIZES } from "@/lib/opvault/fixtures/test-vectors";

describe("pbkdf2", () => {
  describe("deriveKeysFromPassword", () => {
    it("should derive 64 bytes (32 enc + 32 mac)", () => {
      const keys = deriveKeysFromPassword(
        TEST_VAULT.password,
        TEST_VAULT.salt,
        TEST_VAULT.iterations,
      );

      expect(keys.encryptionKey).toBeInstanceOf(Buffer);
      expect(keys.macKey).toBeInstanceOf(Buffer);
      expect(keys.encryptionKey).toHaveBufferLength(CRYPTO_SIZES.KEY);
      expect(keys.macKey).toHaveBufferLength(CRYPTO_SIZES.KEY);
    });

    it("should produce different encryption and MAC keys", () => {
      const keys = deriveKeysFromPassword(
        TEST_VAULT.password,
        TEST_VAULT.salt,
        TEST_VAULT.iterations,
      );

      expect(keys.encryptionKey.equals(keys.macKey)).toBe(false);
    });

    it("should produce different keys for different passwords", () => {
      const keys1 = deriveKeysFromPassword(
        "password1",
        TEST_VAULT.salt,
        TEST_VAULT.iterations,
      );
      const keys2 = deriveKeysFromPassword(
        "password2",
        TEST_VAULT.salt,
        TEST_VAULT.iterations,
      );

      expect(keys1.encryptionKey.equals(keys2.encryptionKey)).toBe(false);
      expect(keys1.macKey.equals(keys2.macKey)).toBe(false);
    });

    it("should produce different keys for different salts", () => {
      const salt1 = "AAAAAAAAAAAAAAAAAAA=";
      const salt2 = "BBBBBBBBBBBBBBBBBBB=";

      const keys1 = deriveKeysFromPassword(TEST_VAULT.password, salt1, 1000);
      const keys2 = deriveKeysFromPassword(TEST_VAULT.password, salt2, 1000);

      expect(keys1.encryptionKey.equals(keys2.encryptionKey)).toBe(false);
      expect(keys1.macKey.equals(keys2.macKey)).toBe(false);
    });

    it("should handle empty password", () => {
      const keys = deriveKeysFromPassword("", TEST_VAULT.salt, 1000);

      expect(keys.encryptionKey).toBeInstanceOf(Buffer);
      expect(keys.macKey).toBeInstanceOf(Buffer);
      expect(keys.encryptionKey).toHaveBufferLength(CRYPTO_SIZES.KEY);
      expect(keys.macKey).toHaveBufferLength(CRYPTO_SIZES.KEY);
    });

    it("should handle low iteration count", () => {
      const keys = deriveKeysFromPassword(
        TEST_VAULT.password,
        TEST_VAULT.salt,
        1,
      );

      expect(keys.encryptionKey).toHaveBufferLength(CRYPTO_SIZES.KEY);
      expect(keys.macKey).toHaveBufferLength(CRYPTO_SIZES.KEY);
    });

    it("should handle high iteration count", () => {
      const keys = deriveKeysFromPassword(
        TEST_VAULT.password,
        TEST_VAULT.salt,
        100000,
      );

      expect(keys.encryptionKey).toHaveBufferLength(CRYPTO_SIZES.KEY);
      expect(keys.macKey).toHaveBufferLength(CRYPTO_SIZES.KEY);
    });

    it("should produce different keys for different iteration counts", () => {
      const keys1 = deriveKeysFromPassword(
        TEST_VAULT.password,
        TEST_VAULT.salt,
        1000,
      );
      const keys2 = deriveKeysFromPassword(
        TEST_VAULT.password,
        TEST_VAULT.salt,
        2000,
      );

      expect(keys1.encryptionKey.equals(keys2.encryptionKey)).toBe(false);
      expect(keys1.macKey.equals(keys2.macKey)).toBe(false);
    });
  });
});
