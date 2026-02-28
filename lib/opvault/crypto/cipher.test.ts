import {
  AES_TEST_VECTORS,
  HMAC_TEST_VECTORS,
  SHA512_TEST_VECTORS,
  CRYPTO_SIZES,
  MOCK_FILL,
} from "../fixtures/test-vectors";
import {
  decryptAES256CBC,
  computeHMAC,
  verifyHMAC,
  sha512,
  deriveKeyPairFromMaterial,
} from "./cipher";

describe("cipher", () => {
  describe("decryptAES256CBC", () => {
    it("should decrypt single-block ciphertext", () => {
      const { key, iv, plaintext, ciphertext } = AES_TEST_VECTORS.case1;

      const decrypted = decryptAES256CBC(ciphertext, key, iv);

      expect(decrypted).toEqualBuffer(plaintext);
    });

    it("should decrypt multi-block ciphertext", () => {
      const { key, iv, plaintext, ciphertext } = AES_TEST_VECTORS.case2;

      const decrypted = decryptAES256CBC(ciphertext, key, iv);

      expect(decrypted).toEqualBuffer(plaintext);
    });

    it("should produce wrong output with wrong key", () => {
      const { iv, ciphertext, plaintext } = AES_TEST_VECTORS.case1;
      const wrongKey = Buffer.alloc(CRYPTO_SIZES.KEY, MOCK_FILL.WRONG);

      const decrypted = decryptAES256CBC(ciphertext, wrongKey, iv);

      expect(decrypted.equals(plaintext)).toBe(false);
    });

    it("should produce wrong plaintext with incorrect IV", () => {
      const { key, ciphertext, plaintext } = AES_TEST_VECTORS.case1;
      const wrongIv = Buffer.alloc(CRYPTO_SIZES.IV, MOCK_FILL.WRONG);

      const decrypted = decryptAES256CBC(ciphertext, key, wrongIv);

      expect(decrypted.equals(plaintext)).toBe(false);
    });

    it("should return empty Buffer for empty ciphertext", () => {
      const { key, iv } = AES_TEST_VECTORS.case1;
      const emptyCiphertext = Buffer.alloc(0);

      const decrypted = decryptAES256CBC(emptyCiphertext, key, iv);

      expect(decrypted).toHaveBufferLength(0);
    });

    it("should require 32-byte key", () => {
      const { iv, ciphertext } = AES_TEST_VECTORS.case1;
      const shortKey = Buffer.alloc(CRYPTO_SIZES.IV); // 16 bytes, too short for AES-256

      expect(() => {
        decryptAES256CBC(ciphertext, shortKey, iv);
      }).toThrow();
    });

    it("should require 16-byte IV", () => {
      const { key, ciphertext } = AES_TEST_VECTORS.case1;
      const shortIv = Buffer.alloc(8);

      expect(() => {
        decryptAES256CBC(ciphertext, key, shortIv);
      }).toThrow();
    });
  });

  describe("computeHMAC", () => {
    it.each(Object.entries(HMAC_TEST_VECTORS))(
      "should compute correct HMAC for %s",
      (_name, { key, data, hmac }) => {
        const computed = computeHMAC(data, key);

        expect(computed).toEqualBuffer(hmac);
      },
    );

    it("should compute 32-byte HMAC for empty data", () => {
      const key = Buffer.alloc(CRYPTO_SIZES.KEY, MOCK_FILL.ENC_KEY);
      const data = Buffer.alloc(0);

      const hmac = computeHMAC(data, key);

      expect(hmac).toHaveBufferLength(CRYPTO_SIZES.MAC);
    });

    it("should compute 32-byte HMAC for 10MB data", () => {
      const key = Buffer.alloc(CRYPTO_SIZES.KEY, MOCK_FILL.ENC_KEY);
      const data = Buffer.alloc(10 * 1024 * 1024);

      const hmac = computeHMAC(data, key);

      expect(hmac).toHaveBufferLength(CRYPTO_SIZES.MAC);
    });

    it("should produce different HMACs for different keys", () => {
      const key1 = Buffer.alloc(CRYPTO_SIZES.KEY, MOCK_FILL.ENC_KEY);
      const key2 = Buffer.alloc(CRYPTO_SIZES.KEY, MOCK_FILL.MAC_KEY);
      const data = Buffer.from("test data", "utf8");

      const hmac1 = computeHMAC(data, key1);
      const hmac2 = computeHMAC(data, key2);

      expect(hmac1.equals(hmac2)).toBe(false);
    });

    it("should produce different HMACs for different data", () => {
      const key = Buffer.alloc(CRYPTO_SIZES.KEY, MOCK_FILL.ENC_KEY);
      const data1 = Buffer.from("test data 1", "utf8");
      const data2 = Buffer.from("test data 2", "utf8");

      const hmac1 = computeHMAC(data1, key);
      const hmac2 = computeHMAC(data2, key);

      expect(hmac1.equals(hmac2)).toBe(false);
    });
  });

  describe("verifyHMAC", () => {
    it("should return true for valid HMAC", () => {
      const { key, data, hmac } = HMAC_TEST_VECTORS.case1;

      const result = verifyHMAC(data, hmac, key);

      expect(result).toBe(true);
    });

    it("should return false for invalid HMAC", () => {
      const { key, data } = HMAC_TEST_VECTORS.case1;
      const wrongHmac = Buffer.alloc(CRYPTO_SIZES.MAC, MOCK_FILL.WRONG);

      const result = verifyHMAC(data, wrongHmac, key);

      expect(result).toBe(false);
    });

    it("should return false for tampered data", () => {
      const { key, data, hmac } = HMAC_TEST_VECTORS.case1;
      const tamperedData = Buffer.from(data);
      tamperedData[0] = tamperedData[0] ^ 0xff;

      const result = verifyHMAC(tamperedData, hmac, key);

      expect(result).toBe(false);
    });

    it("should return false for wrong key", () => {
      const { data, hmac } = HMAC_TEST_VECTORS.case1;
      const wrongKey = Buffer.alloc(CRYPTO_SIZES.KEY, MOCK_FILL.WRONG);

      const result = verifyHMAC(data, hmac, wrongKey);

      expect(result).toBe(false);
    });

    it("should detect single bit flip in HMAC", () => {
      const { key, data, hmac } = HMAC_TEST_VECTORS.case1;
      const tamperedHmac = Buffer.from(hmac);
      tamperedHmac[0] = tamperedHmac[0] ^ 0x01;

      const result = verifyHMAC(data, tamperedHmac, key);

      expect(result).toBe(false);
    });
  });

  describe("sha512", () => {
    it.each(Object.entries(SHA512_TEST_VECTORS))(
      "should compute correct SHA-512 for %s",
      (_name, { input, hash }) => {
        const computed = sha512(input);

        expect(computed).toEqualBuffer(hash);
      },
    );

    it("should produce different hashes for different inputs", () => {
      const input1 = Buffer.from("test1", "utf8");
      const input2 = Buffer.from("test2", "utf8");

      const hash1 = sha512(input1);
      const hash2 = sha512(input2);

      expect(hash1.equals(hash2)).toBe(false);
    });

    it("should produce 64-byte hash for 10MB input", () => {
      const input = Buffer.alloc(10 * 1024 * 1024);

      const hash = sha512(input);

      expect(hash).toHaveBufferLength(64);
    });
  });

  describe("deriveKeyPairFromMaterial", () => {
    it("should derive 32-byte encryption and MAC keys", () => {
      const keyMaterial = Buffer.alloc(
        CRYPTO_SIZES.MASTER_KEY_MATERIAL,
        MOCK_FILL.ENC_KEY,
      );

      const keys = deriveKeyPairFromMaterial(keyMaterial);

      expect(keys.encryptionKey).toHaveBufferLength(CRYPTO_SIZES.KEY);
      expect(keys.macKey).toHaveBufferLength(CRYPTO_SIZES.KEY);
    });

    it("should produce different encryption and MAC keys", () => {
      const keyMaterial = Buffer.alloc(
        CRYPTO_SIZES.MASTER_KEY_MATERIAL,
        MOCK_FILL.ENC_KEY,
      );

      const keys = deriveKeyPairFromMaterial(keyMaterial);

      expect(keys.encryptionKey.equals(keys.macKey)).toBe(false);
    });

    it("should produce different keys for different material", () => {
      const keyMaterial1 = Buffer.alloc(
        CRYPTO_SIZES.MASTER_KEY_MATERIAL,
        MOCK_FILL.ENC_KEY,
      );
      const keyMaterial2 = Buffer.alloc(
        CRYPTO_SIZES.MASTER_KEY_MATERIAL,
        MOCK_FILL.MAC_KEY,
      );

      const keys1 = deriveKeyPairFromMaterial(keyMaterial1);
      const keys2 = deriveKeyPairFromMaterial(keyMaterial2);

      expect(keys1.encryptionKey.equals(keys2.encryptionKey)).toBe(false);
      expect(keys1.macKey.equals(keys2.macKey)).toBe(false);
    });

    it("should derive key pair from 64-byte overview key material", () => {
      const keyMaterial = Buffer.alloc(
        CRYPTO_SIZES.OVERVIEW_KEY_MATERIAL,
        MOCK_FILL.ENC_KEY,
      );

      const keys = deriveKeyPairFromMaterial(keyMaterial);

      expect(keys.encryptionKey).toHaveBufferLength(CRYPTO_SIZES.KEY);
      expect(keys.macKey).toHaveBufferLength(CRYPTO_SIZES.KEY);
    });

    it("should derive key pair from arbitrary length key material", () => {
      const keyMaterial = Buffer.from("random key material", "utf8");

      const keys = deriveKeyPairFromMaterial(keyMaterial);

      expect(keys.encryptionKey).toHaveBufferLength(CRYPTO_SIZES.KEY);
      expect(keys.macKey).toHaveBufferLength(CRYPTO_SIZES.KEY);
    });

    it("should split SHA-512 hash correctly", () => {
      const keyMaterial = Buffer.alloc(
        CRYPTO_SIZES.MASTER_KEY_MATERIAL,
        MOCK_FILL.ENC_KEY,
      );

      const keys = deriveKeyPairFromMaterial(keyMaterial);
      const fullHash = sha512(keyMaterial);

      expect(keys.encryptionKey).toEqualBuffer(fullHash.subarray(0, 32));
      expect(keys.macKey).toEqualBuffer(fullHash.subarray(32, 64));
    });
  });
});
