import * as opdataModule from "@/lib/opvault/crypto/opdata";
import { TEST_VAULT } from "@/lib/opvault/fixtures/test-vectors";
import {
  deriveKeys,
  decryptMasterKeys,
  decryptOverviewKeys,
  deriveVaultKeys,
} from "@/lib/opvault/internal/key-derivation";
import type { Profile } from "@/lib/opvault/types";
import {
  WrongPasswordError,
  VaultCorruptedError,
} from "@/lib/vault/storage-interface";

describe("key-chain", () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  const testProfile: Profile = {
    uuid: "test-uuid",
    salt: TEST_VAULT.salt,
    masterKey: TEST_VAULT.masterKey,
    overviewKey: TEST_VAULT.overviewKey,
    iterations: TEST_VAULT.iterations,
    profileName: "default",
    createdAt: 0,
    updatedAt: 0,
    lastUpdatedBy: "test",
  };

  describe("decryptMasterKeys", () => {
    it("should throw WrongPasswordError on HMAC failure", () => {
      const wrongProfile = {
        ...testProfile,
        masterKey: TEST_VAULT.masterKey,
      };

      // Derive keys with wrong password
      const wrongKeys = deriveKeys("wrong-password", wrongProfile);

      expect(() => {
        decryptMasterKeys(wrongProfile, wrongKeys);
      }).toThrow(WrongPasswordError);
    });

    it("should throw VaultCorruptedError on other failures", () => {
      const corruptedProfile = {
        ...testProfile,
        masterKey: "corrupted-data",
      };

      const keys = deriveKeys(TEST_VAULT.password, testProfile);

      expect(() => {
        decryptMasterKeys(corruptedProfile, keys);
      }).toThrow(VaultCorruptedError);
    });
  });

  describe("decryptOverviewKeys", () => {
    it("should throw VaultCorruptedError on HMAC failure", () => {
      const wrongProfile = {
        ...testProfile,
        overviewKey: TEST_VAULT.overviewKey,
      };

      const wrongKeys = deriveKeys("wrong-password", wrongProfile);

      expect(() => {
        decryptOverviewKeys(wrongProfile, wrongKeys);
      }).toThrow();
    });

    it("should throw VaultCorruptedError on decryption failure", () => {
      const corruptedProfile = {
        ...testProfile,
        overviewKey: "corrupted",
      };

      const keys = deriveKeys(TEST_VAULT.password, testProfile);

      expect(() => {
        decryptOverviewKeys(corruptedProfile, keys);
      }).toThrow(VaultCorruptedError);
    });
  });

  describe("deriveVaultKeys", () => {
    it("should throw WrongPasswordError on incorrect password", () => {
      // Wrong password should fail at masterKey decryption (HMAC)
      expect(() => {
        deriveVaultKeys("wrong-password", testProfile);
      }).toThrow(WrongPasswordError);
    });

    it("should throw VaultCorruptedError on corrupted profile", () => {
      const corruptedProfile = {
        ...testProfile,
        masterKey: "corrupted",
        overviewKey: "corrupted",
      };

      expect(() => {
        deriveVaultKeys(TEST_VAULT.password, corruptedProfile);
      }).toThrow(VaultCorruptedError);
    });
  });

  describe("decryptMasterKeys - key length validation", () => {
    it("should throw VaultCorruptedError with actual and expected length on invalid master key size", () => {
      const keys = deriveKeys(TEST_VAULT.password, testProfile);

      const spy = jest
        .spyOn(opdataModule, "decryptOpdata01")
        .mockReturnValue(Buffer.alloc(128));

      expect(() => {
        decryptMasterKeys(testProfile, keys);
      }).toThrow(VaultCorruptedError);

      expect(() => {
        decryptMasterKeys(testProfile, keys);
      }).toThrow("Expected 256 bytes for master key material, got 128");

      spy.mockRestore();
    });
  });

  describe("decryptOverviewKeys - key length validation", () => {
    it("should throw VaultCorruptedError on invalid overview key length (32 bytes)", () => {
      const keys = deriveKeys(TEST_VAULT.password, testProfile);

      // Mock decryptOpdata01 to return wrong size
      const spy = jest
        .spyOn(opdataModule, "decryptOpdata01")
        .mockReturnValue(Buffer.alloc(32));

      expect(() => {
        decryptOverviewKeys(testProfile, keys);
      }).toThrow(VaultCorruptedError);

      expect(() => {
        decryptOverviewKeys(testProfile, keys);
      }).toThrow("Expected 64 bytes for overview key material, got 32");

      spy.mockRestore();
    });
  });

  describe("deriveVaultKeys - combined error scenarios", () => {
    it("should throw WrongPasswordError before overview key errors (master HMAC fails first)", () => {
      // Mock decryptOpdata01 to throw HMAC error on first call (master key)
      const spy = jest
        .spyOn(opdataModule, "decryptOpdata01")
        .mockImplementation(() => {
          throw new Error("HMAC verification failed");
        });

      expect(() => {
        deriveVaultKeys("wrong-password", testProfile);
      }).toThrow(WrongPasswordError);

      // Should not get to overview key decryption
      expect(spy).toHaveBeenCalledTimes(1);

      spy.mockRestore();
    });

    it("should throw VaultCorruptedError if master succeeds but overview fails", () => {
      // Mock: master key succeeds (256 bytes), overview key fails (wrong size)
      const spy = jest
        .spyOn(opdataModule, "decryptOpdata01")
        .mockReturnValueOnce(Buffer.alloc(256)) // Master key OK
        .mockReturnValueOnce(Buffer.alloc(32)); // Overview key wrong size

      expect(() => deriveVaultKeys(TEST_VAULT.password, testProfile)).toThrow(
        VaultCorruptedError,
      );

      // Both should be called (master succeeds, overview fails)
      expect(spy).toHaveBeenCalledTimes(2);

      spy.mockRestore();
    });
  });
});
