import {
  VaultStorageError,
  WrongPasswordError,
  VaultCorruptedError,
  ItemNotFoundError,
  VaultNotUnlockedError,
  NotImplementedError,
} from "./storage-interface";

describe("storage-interface errors", () => {
  describe("VaultStorageError", () => {
    it("should have correct message", () => {
      const error = new VaultStorageError("test message");
      expect(error.message).toBe("test message");
    });

    it("should have correct name", () => {
      const error = new VaultStorageError("test");
      expect(error.name).toBe("VaultStorageError");
    });
  });

  describe("WrongPasswordError", () => {
    it("should have fixed message", () => {
      const error = new WrongPasswordError();
      expect(error.message).toBe("Incorrect password");
    });

    it("should have correct name", () => {
      const error = new WrongPasswordError();
      expect(error.name).toBe("WrongPasswordError");
    });

    it("should have undefined passwordHint by default", () => {
      const error = new WrongPasswordError();
      expect(error.passwordHint).toBeUndefined();
    });

    it("should store passwordHint when provided", () => {
      const error = new WrongPasswordError("fred");
      expect(error.passwordHint).toBe("fred");
      expect(error.message).toBe("Incorrect password");
    });
  });

  describe("VaultCorruptedError", () => {
    it("should accept custom message", () => {
      const error = new VaultCorruptedError("custom message");
      expect(error.message).toBe("custom message");
    });

    it("should have default message", () => {
      const error = new VaultCorruptedError();
      expect(error.message).toBe("Vault data is corrupted");
    });

    it("should have correct name", () => {
      const error = new VaultCorruptedError();
      expect(error.name).toBe("VaultCorruptedError");
    });
  });

  describe("ItemNotFoundError", () => {
    it("should include item ID in message", () => {
      const error = new ItemNotFoundError("test-id-123");
      expect(error.message).toContain("test-id-123");
    });

    it("should have correct name", () => {
      const error = new ItemNotFoundError("test");
      expect(error.name).toBe("ItemNotFoundError");
    });
  });

  describe("VaultNotUnlockedError", () => {
    it("should have fixed message", () => {
      const error = new VaultNotUnlockedError();
      expect(error.message).toBe("Vault is locked. Call unlock() first.");
    });

    it("should have correct name", () => {
      const error = new VaultNotUnlockedError();
      expect(error.name).toBe("VaultNotUnlockedError");
    });
  });

  describe("NotImplementedError", () => {
    it("should include operation name in message", () => {
      const error = new NotImplementedError("OPVaultClient.writeBack");
      expect(error.message).toContain("OPVaultClient.writeBack");
      expect(error.message).toContain("not yet implemented");
    });

    it("should have correct name", () => {
      const error = new NotImplementedError("writeBack");
      expect(error.name).toBe("NotImplementedError");
    });
  });

  describe("error instanceof checks", () => {
    it("should work with instanceof operator", () => {
      const wrongPassword = new WrongPasswordError();
      const corrupted = new VaultCorruptedError();
      const notFound = new ItemNotFoundError("test");
      const notUnlocked = new VaultNotUnlockedError();

      // All should be VaultStorageError
      expect(wrongPassword instanceof VaultStorageError).toBe(true);
      expect(corrupted instanceof VaultStorageError).toBe(true);
      expect(notFound instanceof VaultStorageError).toBe(true);
      expect(notUnlocked instanceof VaultStorageError).toBe(true);

      // Should be distinguishable
      expect(wrongPassword instanceof WrongPasswordError).toBe(true);
      expect(wrongPassword instanceof VaultCorruptedError).toBe(false);
      expect(corrupted instanceof VaultCorruptedError).toBe(true);
      expect(corrupted instanceof ItemNotFoundError).toBe(false);
    });
  });
});
