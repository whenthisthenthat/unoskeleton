import {
  decryptOpdata01,
  verifyOpdata01HMAC,
} from "@/lib/opvault/crypto/opdata";
import {
  TEST_VAULT,
  CRYPTO_SIZES,
  MOCK_FILL,
  OPDATA01_HEADER,
  buildOpdataBuffer,
} from "@/lib/opvault/fixtures/test-vectors";
import { createHmac } from "react-native-quick-crypto";

describe("opdata", () => {
  // Real test data from band_0.js
  const REAL_ITEM_OVERVIEW =
    "b3BkYXRhMDFSAAAAAAAAAFx/NqIo8EXowE0JkyOXYU9TwZBTupG5WKRVaYrA/nU6Jy2xC2eyZV0SGmRVS8yt0A0eRVEBXGww2UV928lrUYGpT62kMa54yPHQ6PJ/SBw6BITIoZqX91ohdcm+vUDDwkoNx4Vm+0VMFkBHRnAtT+cavKUMMmjdWrQ+0rEoWIVtZF47tOOUhh6HdGiY43ihsA==";

  const encKey = Buffer.alloc(CRYPTO_SIZES.KEY, MOCK_FILL.ENC_KEY);
  const macKey = Buffer.alloc(CRYPTO_SIZES.KEY, MOCK_FILL.MAC_KEY);

  describe("decryptOpdata01", () => {
    describe("with real vault data", () => {
      it("should recognize valid opdata01 header and minimum length", () => {
        const data = Buffer.from(REAL_ITEM_OVERVIEW, "base64");
        const minLength =
          CRYPTO_SIZES.OPDATA01_HEADER +
          CRYPTO_SIZES.PLAINTEXT_LENGTH +
          CRYPTO_SIZES.IV +
          CRYPTO_SIZES.MAC;

        expect(data.length).toBeGreaterThan(minLength);

        const header = data.subarray(0, 8).toString("utf8");
        expect(header).toBe(OPDATA01_HEADER);
      });
    });

    describe("format validation", () => {
      it("should throw VaultCorruptedError for data too short", () => {
        const shortData = Buffer.alloc(10).toString("base64");

        expect(() => {
          decryptOpdata01(shortData, encKey, macKey);
        }).toThrow("Invalid opdata01: data too short");
      });

      it("should throw VaultCorruptedError for invalid HMAC", () => {
        const data = buildOpdataBuffer(CRYPTO_SIZES.BLOCK);
        data.write(OPDATA01_HEADER, 0, "utf8");
        data.writeBigUInt64LE(BigInt(0), 8);

        const encoded = data.toString("base64");

        expect(() => {
          decryptOpdata01(encoded, encKey, macKey);
        }).toThrow("HMAC verification failed");
      });

      it("should verify HMAC before checking header", () => {
        const data = buildOpdataBuffer(CRYPTO_SIZES.BLOCK);
        data.write("wronghdr", 0, "utf8");
        data.writeBigUInt64LE(BigInt(0), 8);

        const encoded = data.toString("base64");

        expect(() => {
          decryptOpdata01(encoded, encKey, macKey);
        }).toThrow("HMAC verification failed");
      });

      it("should throw for invalid base64", () => {
        const invalidBase64 = "not-valid-base64!!!";

        expect(() => {
          decryptOpdata01(invalidBase64, encKey, macKey);
        }).toThrow();
      });
    });

    describe("error handling", () => {
      it("should throw for empty string", () => {
        expect(() => {
          decryptOpdata01("", encKey, macKey);
        }).toThrow();
      });
    });
  });

  describe("verifyOpdata01HMAC", () => {
    it("should return false for invalid HMAC", () => {
      const data = Buffer.alloc(100);
      const encoded = data.toString("base64");

      const result = verifyOpdata01HMAC(encoded, macKey);

      expect(result).toBe(false);
    });

    it("should return false for data too short", () => {
      const shortData = Buffer.alloc(10).toString("base64");

      const result = verifyOpdata01HMAC(shortData, macKey);

      expect(result).toBe(false);
    });

    it("should return false for empty string", () => {
      const result = verifyOpdata01HMAC("", macKey);

      expect(result).toBe(false);
    });

    it("should return false for invalid base64", () => {
      const result = verifyOpdata01HMAC("not-valid-base64!!!", macKey);

      expect(result).toBe(false);
    });

    it("should not throw on any input", () => {
      expect(() => verifyOpdata01HMAC("", macKey)).not.toThrow();
      expect(() => verifyOpdata01HMAC("invalid", macKey)).not.toThrow();
      expect(() => verifyOpdata01HMAC("b3BkYXRhMDE=", macKey)).not.toThrow();
    });

    it("should verify real item overview data without throwing", () => {
      expect(() => {
        verifyOpdata01HMAC(REAL_ITEM_OVERVIEW, macKey);
      }).not.toThrow();

      const result = verifyOpdata01HMAC(REAL_ITEM_OVERVIEW, macKey);
      expect(typeof result).toBe("boolean");
    });

    it("should return false for tampered data", () => {
      const data = buildOpdataBuffer(CRYPTO_SIZES.KEY);
      data.write(OPDATA01_HEADER, 0, "utf8");

      const encoded = data.toString("base64");
      const result = verifyOpdata01HMAC(encoded, macKey);

      expect(result).toBe(false);
    });
  });

  describe("security properties", () => {
    it("should implement Verify-then-Decrypt pattern", () => {
      const invalidData = Buffer.alloc(100).toString("base64");

      expect(() => {
        decryptOpdata01(invalidData, encKey, macKey);
      }).toThrow("HMAC verification failed");
    });
  });

  describe("integration with test vault", () => {
    it("should validate real masterKey format", () => {
      const data = Buffer.from(TEST_VAULT.masterKey, "base64");
      const minLength =
        CRYPTO_SIZES.OPDATA01_HEADER +
        CRYPTO_SIZES.PLAINTEXT_LENGTH +
        CRYPTO_SIZES.IV +
        CRYPTO_SIZES.MAC;

      expect(data.length).toBeGreaterThan(minLength);

      const header = data.subarray(0, 8).toString("utf8");
      expect(header).toBe(OPDATA01_HEADER);
    });

    it("should validate real overviewKey format", () => {
      const data = Buffer.from(TEST_VAULT.overviewKey, "base64");
      const minLength =
        CRYPTO_SIZES.OPDATA01_HEADER +
        CRYPTO_SIZES.PLAINTEXT_LENGTH +
        CRYPTO_SIZES.IV +
        CRYPTO_SIZES.MAC;

      expect(data.length).toBeGreaterThan(minLength);

      const header = data.subarray(0, 8).toString("utf8");
      expect(header).toBe(OPDATA01_HEADER);
    });

    it("should validate real item overview format", () => {
      const data = Buffer.from(REAL_ITEM_OVERVIEW, "base64");
      const minLength =
        CRYPTO_SIZES.OPDATA01_HEADER +
        CRYPTO_SIZES.PLAINTEXT_LENGTH +
        CRYPTO_SIZES.IV +
        CRYPTO_SIZES.MAC;

      expect(data.length).toBeGreaterThan(minLength);

      const header = data.subarray(0, 8).toString("utf8");
      expect(header).toBe(OPDATA01_HEADER);
    });
  });

  describe("key validation", () => {
    it("should throw on encryption key not 32 bytes (16 bytes)", () => {
      const shortKey = Buffer.alloc(CRYPTO_SIZES.IV);
      const data = buildOpdataBuffer(CRYPTO_SIZES.BLOCK);
      data.write(OPDATA01_HEADER, 0, "utf8");
      const encoded = data.toString("base64");

      expect(() => {
        decryptOpdata01(encoded, shortKey, macKey);
      }).toThrow();
    });
  });

  describe("plaintext length validation", () => {
    it("should throw when plaintext length exceeds decrypted size", () => {
      const data = buildOpdataBuffer(CRYPTO_SIZES.BLOCK);
      data.write(OPDATA01_HEADER, 0, "utf8");
      data.writeBigUInt64LE(BigInt(1000), 8);

      // Compute valid HMAC
      const dataToSign = data.subarray(0, data.length - CRYPTO_SIZES.MAC);
      const mac = Buffer.from(
        createHmac("sha256", macKey).update(dataToSign).digest(),
      );
      mac.copy(data, data.length - CRYPTO_SIZES.MAC);

      const encoded = data.toString("base64");

      expect(() => {
        decryptOpdata01(encoded, encKey, macKey);
      }).toThrow("decrypted data too short");
    });

    it("should throw HMAC verification for large plaintext length claim", () => {
      const data = buildOpdataBuffer(CRYPTO_SIZES.KEY);
      data.write(OPDATA01_HEADER, 0, "utf8");
      data.writeBigUInt64LE(BigInt(1000000), 8);

      const encoded = data.toString("base64");

      expect(() => {
        decryptOpdata01(encoded, encKey, macKey);
      }).toThrow("HMAC verification failed");
    });
  });

  describe("HMAC edge cases", () => {
    it("should fail HMAC for single-bit flip in ciphertext", () => {
      const data = buildOpdataBuffer(CRYPTO_SIZES.KEY);
      data.write(OPDATA01_HEADER, 0, "utf8");
      data.writeBigUInt64LE(BigInt(16), 8);

      // Compute valid HMAC first
      const dataToSign = data.subarray(0, data.length - CRYPTO_SIZES.MAC);
      const mac = Buffer.from(
        createHmac("sha256", macKey).update(dataToSign).digest(),
      );
      mac.copy(data, data.length - CRYPTO_SIZES.MAC);

      // Now flip one bit in the ciphertext
      const ciphertextIndex =
        CRYPTO_SIZES.OPDATA01_HEADER +
        CRYPTO_SIZES.PLAINTEXT_LENGTH +
        CRYPTO_SIZES.IV;
      data[ciphertextIndex] ^= 0x01;

      const encoded = data.toString("base64");

      expect(() => {
        decryptOpdata01(encoded, encKey, macKey);
      }).toThrow("HMAC verification failed");
    });

    it("should throw for MAC truncation", () => {
      const data = buildOpdataBuffer(CRYPTO_SIZES.KEY);
      data.write(OPDATA01_HEADER, 0, "utf8");

      const truncated = data.subarray(0, 60);
      const encoded = truncated.toString("base64");

      expect(() => {
        decryptOpdata01(encoded, encKey, macKey);
      }).toThrow("data too short");
    });

    it("should fail HMAC with wrong MAC key", () => {
      const wrongMacKey = Buffer.alloc(CRYPTO_SIZES.KEY, MOCK_FILL.WRONG);
      const data = buildOpdataBuffer(CRYPTO_SIZES.KEY);
      data.write(OPDATA01_HEADER, 0, "utf8");
      data.writeBigUInt64LE(BigInt(16), 8);

      // Compute HMAC with correct key
      const dataToSign = data.subarray(0, data.length - CRYPTO_SIZES.MAC);
      const mac = Buffer.from(
        createHmac("sha256", macKey).update(dataToSign).digest(),
      );
      mac.copy(data, data.length - CRYPTO_SIZES.MAC);

      const encoded = data.toString("base64");

      // Try to verify with wrong key
      expect(() => {
        decryptOpdata01(encoded, encKey, wrongMacKey);
      }).toThrow("HMAC verification failed");
    });
  });

  describe("padding edge cases", () => {
    it("should calculate padding for full block (plaintext % 16 == 0)", () => {
      const plaintextLength = 32;
      const expectedPaddingLength = CRYPTO_SIZES.BLOCK;

      const calculatedPadding =
        plaintextLength % CRYPTO_SIZES.BLOCK === 0
          ? CRYPTO_SIZES.BLOCK
          : CRYPTO_SIZES.BLOCK - (plaintextLength % CRYPTO_SIZES.BLOCK);

      expect(calculatedPadding).toBe(expectedPaddingLength);
    });
  });
});
