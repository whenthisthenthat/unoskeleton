import {
  decryptOpdata01,
  decryptOpdata01Raw,
} from "@/lib/opvault/crypto/opdata";
import { createMockVaultSource } from "@/lib/opvault/fixtures/fs-mocks";
import {
  createTestClient,
  createUnlockedClient,
  createClientWithItems,
  mockVaultWithItems,
  mockEmptyVault,
  mockToThrowError,
  mockToRejectWith,
  expectClientLocked,
} from "@/lib/opvault/fixtures/opvault-client-test-helpers";
import {
  parseAttachmentMetadata,
  parseAttachmentHeader,
  extractAttachmentContent,
} from "@/lib/opvault/internal/attachment-reader";
import {
  decryptItemKeys,
  decryptOverview,
  decryptDetails,
} from "@/lib/opvault/internal/item-decryptor";
import { deriveVaultKeys } from "@/lib/opvault/internal/key-derivation";
import {
  readAndParseProfile,
  readAndParseBands,
  readAndParseBandsProgressively,
} from "@/lib/opvault/internal/reader";
import { OPVaultClient } from "@/lib/opvault/opvault-client";
import type {
  Profile,
  OPVaultItem,
  MasterKeys,
  OverviewKeys,
  ItemKeys,
} from "@/lib/opvault/types";
import { Category } from "@/lib/vault/categories";
import {
  WrongPasswordError,
  VaultCorruptedError,
  ItemNotFoundError,
  VaultNotUnlockedError,
  NotImplementedError,
} from "@/lib/vault/storage-interface";
import type { ItemOverview } from "@/lib/vault/types";

// Mock dependencies
jest.mock("./internal/reader");
jest.mock("./internal/key-derivation");
jest.mock("./internal/item-decryptor");
jest.mock("./internal/attachment-reader");
jest.mock("./crypto/opdata");

// Typed mock references (eliminates need for "as jest.Mock" throughout tests)
const mockedReadAndParseProfile = jest.mocked(readAndParseProfile);
const mockedReadAndParseBands = jest.mocked(readAndParseBands);
const mockedReadAndParseBandsProgressively = jest.mocked(
  readAndParseBandsProgressively,
);
const mockedUnlockVault = jest.mocked(deriveVaultKeys);
const mockedDecryptOverview = jest.mocked(decryptOverview);
const mockedDecryptItemKeys = jest.mocked(decryptItemKeys);
const mockedDecryptDetails = jest.mocked(decryptDetails);
// attachment-reader is mocked — need to import for jest.mocked references
const { indexAttachmentFilenames } = jest.requireMock<
  typeof import("@/lib/opvault/internal/attachment-reader")
>("@/lib/opvault/internal/attachment-reader");
const mockedIndexAttachmentFilenames = indexAttachmentFilenames as jest.Mock;

describe("OPVaultClient", () => {
  // Mock data
  const mockProfile: Profile = {
    uuid: "test-profile",
    salt: "test-salt",
    masterKey: "test-master-key",
    overviewKey: "test-overview-key",
    iterations: 50000,
    profileName: "default",
    createdAt: Date.now(),
    updatedAt: Date.now(),
    lastUpdatedBy: "test",
  };

  const mockMasterKeys: MasterKeys = {
    encryptionKey: Buffer.alloc(32, 0x42),
    macKey: Buffer.alloc(32, 0x43),
  };

  const mockOverviewKeys: OverviewKeys = {
    encryptionKey: Buffer.alloc(32, 0x44),
    macKey: Buffer.alloc(32, 0x45),
  };

  const mockItemKeys: ItemKeys = {
    encryptionKey: Buffer.alloc(32, 0x46),
    macKey: Buffer.alloc(32, 0x47),
  };

  const mockOPVaultItem: OPVaultItem = {
    uuid: "item-uuid-1",
    category: "001",
    created: Date.now(),
    updated: Date.now(),
    tx: Date.now(),
    k: "encrypted-item-keys",
    o: "encrypted-overview",
    d: "encrypted-details",
    hmac: "item-hmac",
  };

  const mockOverview: ItemOverview = {
    title: "Test Item",
    URLs: [{ u: "https://example.com" }],
    tags: ["tag1", "tag2"],
  };

  const mockDetails = {
    fields: [
      { name: "username", type: "T", value: "testuser" },
      { name: "password", type: "P", value: "testpass" },
    ],
  };

  beforeEach(() => {
    jest.clearAllMocks();

    // Setup default successful mocks
    mockedReadAndParseProfile.mockResolvedValue(mockProfile);
    mockedReadAndParseBands.mockResolvedValue(
      new Map([[mockOPVaultItem.uuid, mockOPVaultItem]]),
    );

    mockedUnlockVault.mockReturnValue({
      masterKeys: mockMasterKeys,
      overviewKeys: mockOverviewKeys,
    });

    mockedDecryptOverview.mockReturnValue(mockOverview);
    mockedDecryptItemKeys.mockReturnValue(mockItemKeys);
    mockedDecryptDetails.mockReturnValue(mockDetails);
    mockedIndexAttachmentFilenames.mockReturnValue(new Map());
  });

  describe("constructor", () => {
    it("should accept vaultPath and initialize state", () => {
      const client = createTestClient();

      expect(client).toBeInstanceOf(OPVaultClient);
      expect(client.isUnlocked).toBe(false);
    });
  });

  describe("unlock() - success cases", () => {
    it("should read vault data and derive keys", async () => {
      const client = await createUnlockedClient();

      expect(readAndParseProfile).toHaveBeenCalledWith(
        expect.objectContaining({ sourceUri: "/path/to/vault" }),
      );
      expect(deriveVaultKeys).toHaveBeenCalledWith(
        "test-password",
        mockProfile,
      );
      expect(client.isUnlocked).toBe(true);
    });

    it("should store profile, items, and keys in memory", async () => {
      const client = await createUnlockedClient();

      // Verify data stored by calling loadItems (which requires internal state)
      const items = await client.loadItems();
      expect(items).toHaveLength(1);
    });

    it("should clear caches on unlock", async () => {
      const client = await createUnlockedClient();
      await client.loadItems(); // Cache overview
      await client.getItemDetails(mockOPVaultItem.uuid); // Cache item keys

      // Unlock again should clear caches
      await client.unlock("test-password");

      // Verify caches cleared by checking decrypt functions called again
      await client.loadItems();
      expect(decryptOverview).toHaveBeenCalledTimes(2); // Once before, once after re-unlock
    });

    it("should handle empty vault (no items)", async () => {
      mockEmptyVault(mockProfile);

      const client = await createUnlockedClient();

      const items = await client.loadItems();
      expect(items).toEqual([]);
    });

    it("should handle large vaults with many items", async () => {
      const largeItemsMap = new Map<string, OPVaultItem>();
      for (let i = 0; i < 1000; i++) {
        largeItemsMap.set(`item-${i}`, {
          ...mockOPVaultItem,
          uuid: `item-${i}`,
        });
      }

      mockVaultWithItems(mockProfile, largeItemsMap);

      const { items } = await createClientWithItems();
      expect(items).toHaveLength(1000);
    });
  });

  describe("unlock() - error handling", () => {
    it("should throw WrongPasswordError and cleanup on wrong password", async () => {
      mockToThrowError(mockedUnlockVault, new WrongPasswordError());

      const client = createTestClient();

      await expect(client.unlock("wrong-password")).rejects.toThrow(
        WrongPasswordError,
      );
      expect(client.isUnlocked).toBe(false);
    });

    it("should attach passwordHint to WrongPasswordError", async () => {
      const profileWithHint = { ...mockProfile, passwordHint: "fred" };
      mockedReadAndParseProfile.mockResolvedValue(profileWithHint);
      mockToThrowError(mockedUnlockVault, new WrongPasswordError());

      const client = createTestClient();

      await expectToRejectWith(
        () => client.unlock("wrong"),
        WrongPasswordError,
        { passwordHint: "fred" },
      );
    });

    it("should have undefined passwordHint when profile has no hint", async () => {
      mockToThrowError(mockedUnlockVault, new WrongPasswordError());

      const client = createTestClient();

      await expectToRejectWith(
        () => client.unlock("wrong"),
        WrongPasswordError,
        { passwordHint: undefined },
      );
    });

    it("should throw VaultCorruptedError on corrupted vault data", async () => {
      mockToThrowError(
        mockedUnlockVault,
        new VaultCorruptedError("Corrupted master key"),
      );

      const client = createTestClient();

      await expect(client.unlock("test-password")).rejects.toThrow(
        VaultCorruptedError,
      );
      expect(client.isUnlocked).toBe(false);
    });

    it("should wrap generic errors in VaultCorruptedError with context", async () => {
      mockedReadAndParseProfile.mockRejectedValue(new Error("Network timeout"));

      const client = createTestClient();

      await expect(client.unlock("test-password")).rejects.toThrow(
        VaultCorruptedError,
      );
      await expect(client.unlock("test-password")).rejects.toThrow(
        "Network timeout",
      );
    });

    it("should clean up partial state on unlock failure", async () => {
      mockToThrowError(mockedUnlockVault, new Error("Unlock failed"));

      const client = createTestClient();

      await expect(client.unlock("test-password")).rejects.toThrow();

      // Should be in clean locked state
      await expectClientLocked(client);
    });

    it("should allow retry after failed unlock", async () => {
      mockedUnlockVault
        .mockImplementationOnce(() => {
          throw new WrongPasswordError();
        })
        .mockReturnValueOnce({
          masterKeys: mockMasterKeys,
          overviewKeys: mockOverviewKeys,
        });

      const client = createTestClient();

      // First attempt fails
      await expect(client.unlock("wrong-password")).rejects.toThrow(
        WrongPasswordError,
      );
      expect(client.isUnlocked).toBe(false);

      // Second attempt succeeds
      await client.unlock("correct-password");
      expect(client.isUnlocked).toBe(true);
    });

    it("should wrap errors and include original context", async () => {
      mockToRejectWith(
        mockedReadAndParseProfile,
        new Error("profile.js not found"),
      );

      const client = createTestClient();

      await expect(client.unlock("test-password")).rejects.toThrow(
        VaultCorruptedError,
      );
      await expect(client.unlock("test-password")).rejects.toThrow(
        "profile.js not found",
      );
    });

    it("should include original error message in wrapped errors", async () => {
      const originalError = new Error("Specific error details");
      mockedReadAndParseProfile.mockRejectedValue(originalError);

      const client = createTestClient();

      await expect(client.unlock("test-password")).rejects.toThrow(
        VaultCorruptedError,
      );
      await expect(client.unlock("test-password")).rejects.toThrow(
        "Specific error details",
      );
    });

    it("should handle concurrent unlock calls gracefully", async () => {
      const client = createTestClient();

      // Call unlock twice simultaneously
      const promise1 = client.unlock("test-password");
      const promise2 = client.unlock("test-password");

      await Promise.all([promise1, promise2]);

      expect(client.isUnlocked).toBe(true);
    });
  });

  describe("loadItems()", () => {
    it("should throw VaultNotUnlockedError when locked", async () => {
      const client = createTestClient();

      await expect(client.loadItems()).rejects.toThrow(VaultNotUnlockedError);
    });

    it("should throw VaultNotUnlockedError after lock()", async () => {
      const client = await createUnlockedClient();
      client.lock();

      await expect(client.loadItems()).rejects.toThrow(VaultNotUnlockedError);
    });

    it("should decrypt all item overviews using decryptOverview()", async () => {
      const client = await createUnlockedClient();

      await client.loadItems();

      expect(decryptOverview).toHaveBeenCalledWith(
        mockOPVaultItem,
        mockOverviewKeys,
      );
      expect(decryptOverview).toHaveBeenCalledTimes(1);
    });

    it("should include trashed items with trashed flag", async () => {
      const trashedItem = {
        ...mockOPVaultItem,
        uuid: "trashed-item",
        trashed: true,
      };

      mockVaultWithItems(
        mockProfile,
        new Map([
          [mockOPVaultItem.uuid, mockOPVaultItem],
          [trashedItem.uuid, trashedItem],
        ]),
      );

      const { items } = await createClientWithItems();

      expect(items).toHaveLength(2);
      expect(items.find((i) => i.uuid === "trashed-item")?.trashed).toBe(true);
      expect(decryptOverview).toHaveBeenCalledTimes(2);
    });

    it("should cache decrypted overviews", async () => {
      const client = await createUnlockedClient();

      await client.loadItems();
      await client.loadItems(); // Load again

      // decryptOverview should only be called once due to caching
      expect(decryptOverview).toHaveBeenCalledTimes(1);
    });

    it("should construct Item objects with all fields", async () => {
      const itemWithAllFields = {
        ...mockOPVaultItem,
        folder: "folder-uuid",
        fave: 5,
      };

      mockVaultWithItems(
        mockProfile,
        new Map([[itemWithAllFields.uuid, itemWithAllFields]]),
      );

      const { items } = await createClientWithItems();

      expect(items).toHaveLength(1);
      const item = items[0];
      expect(item.uuid).toBe(itemWithAllFields.uuid);
      expect(item.category).toBe(Category.Login);
      expect(item.created).toBeInstanceOf(Date);
      expect(item.updated).toBeInstanceOf(Date);
      expect(item.tx).toBe(itemWithAllFields.tx);
      expect(item.folder).toBe(itemWithAllFields.folder);
      expect(item.fave).toBe(itemWithAllFields.fave);
      expect(item.title).toBe(mockOverview.title);
      expect(item.overview).toEqual(mockOverview);
    });

    it("should handle items without optional fields", async () => {
      const itemWithoutOptionals = {
        uuid: "item-uuid",
        category: "001",
        created: Date.now(),
        updated: Date.now(),
        tx: Date.now(),
        k: "encrypted-keys",
        o: "encrypted-overview",
        d: "encrypted-details",
        hmac: "hmac",
        // No folder, no fave, no trashed
      };

      mockVaultWithItems(
        mockProfile,
        new Map([[itemWithoutOptionals.uuid, itemWithoutOptionals]]),
      );

      const { items } = await createClientWithItems();

      expect(items).toHaveLength(1);
      expect(items[0].folder).toBeUndefined();
      expect(items[0].fave).toBeUndefined();
    });

    it("should preserve Map insertion order in result array", async () => {
      const item1 = { ...mockOPVaultItem, uuid: "item-1" };
      const item2 = { ...mockOPVaultItem, uuid: "item-2" };
      const item3 = { ...mockOPVaultItem, uuid: "item-3" };

      mockedReadAndParseProfile.mockResolvedValue(mockProfile);
      mockedReadAndParseBands.mockResolvedValue(
        new Map([
          [item1.uuid, item1],
          [item2.uuid, item2],
          [item3.uuid, item3],
        ]),
      );

      const client = await createUnlockedClient();

      const items = await client.loadItems();

      expect(items.map((i) => i.uuid)).toEqual(["item-1", "item-2", "item-3"]);
    });

    it("should throw VaultCorruptedError on overview decryption failure", async () => {
      mockedDecryptOverview.mockImplementation(() => {
        throw new Error("Decryption failed");
      });

      const client = await createUnlockedClient();

      await expect(client.loadItems()).rejects.toThrow(VaultCorruptedError);
      await expect(client.loadItems()).rejects.toThrow("Failed to load items");
    });

    it("should include error context in decryption errors", async () => {
      mockedDecryptOverview.mockImplementation(() => {
        throw new Error("HMAC verification failed");
      });

      const client = await createUnlockedClient();

      await expect(client.loadItems()).rejects.toThrow(VaultCorruptedError);
      await expect(client.loadItems()).rejects.toThrow(
        "HMAC verification failed",
      );
    });

    it("should validate that overviewKeys exist before decrypting", async () => {
      const client = await createUnlockedClient();

      // Force lock to clear keys
      client.lock();

      await expect(client.loadItems()).rejects.toThrow(VaultNotUnlockedError);
    });
  });

  describe("getItemDetails()", () => {
    it("should throw VaultNotUnlockedError when locked", async () => {
      const client = createTestClient();

      await expect(client.getItemDetails("item-uuid")).rejects.toThrow(
        VaultNotUnlockedError,
      );
    });

    it("should throw ItemNotFoundError for non-existent UUID", async () => {
      const client = await createUnlockedClient();

      await expect(client.getItemDetails("non-existent-uuid")).rejects.toThrow(
        ItemNotFoundError,
      );
      await expect(client.getItemDetails("non-existent-uuid")).rejects.toThrow(
        "non-existent-uuid",
      );
    });

    it("should decrypt item keys if not cached", async () => {
      const client = await createUnlockedClient();

      await client.getItemDetails(mockOPVaultItem.uuid);

      expect(decryptItemKeys).toHaveBeenCalledWith(
        mockOPVaultItem,
        mockMasterKeys,
      );
      expect(decryptItemKeys).toHaveBeenCalledTimes(1);
    });

    it("should decrypt item details with item keys", async () => {
      const client = await createUnlockedClient();

      await client.getItemDetails(mockOPVaultItem.uuid);

      expect(decryptDetails).toHaveBeenCalledWith(
        mockOPVaultItem,
        mockItemKeys,
      );
    });

    it("should return decrypted details as unknown type", async () => {
      const client = await createUnlockedClient();

      const details = await client.getItemDetails(mockOPVaultItem.uuid);

      expect(details).toEqual(mockDetails);
    });

    it("should throw VaultCorruptedError on key decryption failure", async () => {
      mockedDecryptItemKeys.mockImplementation(() => {
        throw new Error("Invalid key format");
      });

      const client = await createUnlockedClient();

      await expect(client.getItemDetails(mockOPVaultItem.uuid)).rejects.toThrow(
        VaultCorruptedError,
      );
      await expect(client.getItemDetails(mockOPVaultItem.uuid)).rejects.toThrow(
        mockOPVaultItem.uuid,
      );
    });

    it("should throw VaultCorruptedError on details decryption failure", async () => {
      mockedDecryptDetails.mockImplementation(() => {
        throw new Error("HMAC verification failed");
      });

      const client = await createUnlockedClient();

      await expect(client.getItemDetails(mockOPVaultItem.uuid)).rejects.toThrow(
        VaultCorruptedError,
      );
      await expect(client.getItemDetails(mockOPVaultItem.uuid)).rejects.toThrow(
        mockOPVaultItem.uuid,
      );
    });

    it("should handle multiple items with independent caches", async () => {
      const item1 = { ...mockOPVaultItem, uuid: "item-1" };
      const item2 = { ...mockOPVaultItem, uuid: "item-2" };

      mockedReadAndParseProfile.mockResolvedValue(mockProfile);
      mockedReadAndParseBands.mockResolvedValue(
        new Map([
          [item1.uuid, item1],
          [item2.uuid, item2],
        ]),
      );

      const client = await createUnlockedClient();

      await client.getItemDetails(item1.uuid);
      await client.getItemDetails(item2.uuid);

      // Each item should decrypt its own keys
      expect(decryptItemKeys).toHaveBeenCalledTimes(2);
      expect(decryptItemKeys).toHaveBeenCalledWith(item1, mockMasterKeys);
      expect(decryptItemKeys).toHaveBeenCalledWith(item2, mockMasterKeys);
    });

    it("should validate masterKeys exist before decrypting", async () => {
      const client = await createUnlockedClient();
      client.lock(); // Clear keys

      await expect(client.getItemDetails(mockOPVaultItem.uuid)).rejects.toThrow(
        VaultNotUnlockedError,
      );
    });

    it("should cache item keys for performance", async () => {
      const client = await createUnlockedClient();

      // Call getItemDetails multiple times
      await client.getItemDetails(mockOPVaultItem.uuid);
      await client.getItemDetails(mockOPVaultItem.uuid);
      await client.getItemDetails(mockOPVaultItem.uuid);

      // Item keys decrypted only once
      expect(decryptItemKeys).toHaveBeenCalledTimes(1);
      // But details decrypted each time (not cached)
      expect(decryptDetails).toHaveBeenCalledTimes(3);
    });

    it("should decrypt different items independently", async () => {
      const item1 = { ...mockOPVaultItem, uuid: "item-1" };
      const item2 = { ...mockOPVaultItem, uuid: "item-2" };

      mockedReadAndParseProfile.mockResolvedValue(mockProfile);
      mockedReadAndParseBands.mockResolvedValue(
        new Map([
          [item1.uuid, item1],
          [item2.uuid, item2],
        ]),
      );

      const mockItemKeys1 = {
        encryptionKey: Buffer.alloc(32, 0x01),
        macKey: Buffer.alloc(32, 0x02),
      };
      const mockItemKeys2 = {
        encryptionKey: Buffer.alloc(32, 0x03),
        macKey: Buffer.alloc(32, 0x04),
      };

      mockedDecryptItemKeys
        .mockReturnValueOnce(mockItemKeys1)
        .mockReturnValueOnce(mockItemKeys2);

      const client = await createUnlockedClient();

      await client.getItemDetails(item1.uuid);
      await client.getItemDetails(item2.uuid);

      expect(decryptDetails).toHaveBeenCalledWith(item1, mockItemKeys1);
      expect(decryptDetails).toHaveBeenCalledWith(item2, mockItemKeys2);
    });
  });

  describe("lock()", () => {
    it("should zero out master keys", async () => {
      const encKey = Buffer.alloc(32, 0xff);
      const macKey = Buffer.alloc(32, 0xaa);
      const testMasterKeys = {
        encryptionKey: encKey,
        macKey: macKey,
      };

      mockedUnlockVault.mockReturnValue({
        masterKeys: testMasterKeys,
        overviewKeys: mockOverviewKeys,
      });

      const client = await createUnlockedClient();
      client.lock();

      expect(encKey).toBeZeroedBuffer();
      expect(macKey).toBeZeroedBuffer();
    });

    it("should zero out all cached item keys", async () => {
      const itemKey1Enc = Buffer.alloc(32, 0x11);
      const itemKey1Mac = Buffer.alloc(32, 0x22);
      const itemKey2Enc = Buffer.alloc(32, 0x33);
      const itemKey2Mac = Buffer.alloc(32, 0x44);

      const item1 = { ...mockOPVaultItem, uuid: "item-1" };
      const item2 = { ...mockOPVaultItem, uuid: "item-2" };

      mockVaultWithItems(
        mockProfile,
        new Map([
          [item1.uuid, item1],
          [item2.uuid, item2],
        ]),
      );

      mockedDecryptItemKeys
        .mockReturnValueOnce({
          encryptionKey: itemKey1Enc,
          macKey: itemKey1Mac,
        })
        .mockReturnValueOnce({
          encryptionKey: itemKey2Enc,
          macKey: itemKey2Mac,
        });

      const client = await createUnlockedClient();

      // Cache both item keys
      await client.getItemDetails(item1.uuid);
      await client.getItemDetails(item2.uuid);

      client.lock();

      // Verify all item keys zeroed
      expect(itemKey1Enc).toBeZeroedBuffer();
      expect(itemKey1Mac).toBeZeroedBuffer();
      expect(itemKey2Enc).toBeZeroedBuffer();
      expect(itemKey2Mac).toBeZeroedBuffer();
    });

    it("should clear profile", async () => {
      const client = await createUnlockedClient();

      client.lock();

      // Verify profile cleared by checking unlock state
      expect(client.isUnlocked).toBe(false);
      await expect(client.loadItems()).rejects.toThrow(VaultNotUnlockedError);
    });

    it("should clear items Map", async () => {
      const client = await createUnlockedClient();

      client.lock();

      // After unlock again, items should be reloaded
      await client.unlock("test-password");
      expect(readAndParseProfile).toHaveBeenCalledTimes(2); // Once before, once after lock
      expect(readAndParseBands).toHaveBeenCalledTimes(2); // Once before, once after lock
    });

    it("should clear overview cache", async () => {
      const client = await createUnlockedClient();
      await client.loadItems(); // Cache overviews

      expect(decryptOverview).toHaveBeenCalledTimes(1);

      client.lock();

      // Re-mock functions to return items again after lock
      mockedReadAndParseProfile.mockResolvedValue(mockProfile);
      mockedReadAndParseBands.mockResolvedValue(
        new Map([[mockOPVaultItem.uuid, mockOPVaultItem]]),
      );

      await client.unlock("test-password");
      await client.loadItems();

      // decryptOverview called twice (once before lock, once after)
      expect(decryptOverview).toHaveBeenCalledTimes(2);
    });

    it("should set isUnlocked to false", async () => {
      const client = await createUnlockedClient();

      expect(client.isUnlocked).toBe(true);

      client.lock();

      expect(client.isUnlocked).toBe(false);
    });

    it("should be idempotent (safe to call multiple times or before unlock)", () => {
      const client = createTestClient();

      expect(() => client.lock()).not.toThrow();
      expect(() => client.lock()).not.toThrow();

      expect(client.isUnlocked).toBe(false);
    });
  });

  describe("state transitions and caching", () => {
    it("should handle full lifecycle: construct → unlock → load → details → lock", async () => {
      const client = createTestClient();

      // Initial state
      expect(client.isUnlocked).toBe(false);

      // Unlock
      await client.unlock("test-password");
      expect(client.isUnlocked).toBe(true);

      // Load items
      const items = await client.loadItems();
      expect(items).toHaveLength(1);

      // Get details
      const details = await client.getItemDetails(mockOPVaultItem.uuid);
      expect(details).toEqual(mockDetails);

      // Lock
      client.lock();
      expect(client.isUnlocked).toBe(false);

      // Verify locked
      await expect(client.loadItems()).rejects.toThrow(VaultNotUnlockedError);
      await expect(client.getItemDetails(mockOPVaultItem.uuid)).rejects.toThrow(
        VaultNotUnlockedError,
      );
    });

    it("should handle multiple unlock/lock cycles", async () => {
      const client = createTestClient();

      // Cycle 1
      await client.unlock("test-password");
      expect(client.isUnlocked).toBe(true);
      client.lock();
      expect(client.isUnlocked).toBe(false);

      // Cycle 2
      await client.unlock("test-password");
      expect(client.isUnlocked).toBe(true);
      client.lock();
      expect(client.isUnlocked).toBe(false);

      // Cycle 3
      await client.unlock("test-password");
      expect(client.isUnlocked).toBe(true);
    });

    it("should clear caches on new unlock after lock", async () => {
      const client = createTestClient();

      // First session
      await client.unlock("test-password");
      await client.loadItems(); // Cache overview
      await client.getItemDetails(mockOPVaultItem.uuid); // Cache item keys

      expect(decryptOverview).toHaveBeenCalledTimes(1);
      expect(decryptItemKeys).toHaveBeenCalledTimes(1);

      client.lock();

      // Re-mock functions to return items again after lock
      mockedReadAndParseProfile.mockResolvedValue(mockProfile);
      mockedReadAndParseBands.mockResolvedValue(
        new Map([[mockOPVaultItem.uuid, mockOPVaultItem]]),
      );

      // Second session
      await client.unlock("test-password");
      await client.loadItems();
      await client.getItemDetails(mockOPVaultItem.uuid);

      // Each decrypt function called twice (once per session)
      expect(decryptOverview).toHaveBeenCalledTimes(2);
      expect(decryptItemKeys).toHaveBeenCalledTimes(2);
    });

    it("should not leak keys between sessions", async () => {
      const session1Keys = {
        encryptionKey: Buffer.alloc(32, 0x01),
        macKey: Buffer.alloc(32, 0x02),
      };
      const session2Keys = {
        encryptionKey: Buffer.alloc(32, 0xff),
        macKey: Buffer.alloc(32, 0xee),
      };

      mockedUnlockVault
        .mockReturnValueOnce({
          masterKeys: session1Keys,
          overviewKeys: mockOverviewKeys,
        })
        .mockReturnValueOnce({
          masterKeys: session2Keys,
          overviewKeys: mockOverviewKeys,
        });

      const client = createTestClient();

      // Session 1
      await client.unlock("password1");
      client.lock();

      // Verify session 1 keys zeroed
      expect(session1Keys.encryptionKey.every((byte) => byte === 0)).toBe(true);
      expect(session1Keys.macKey.every((byte) => byte === 0)).toBe(true);

      // Session 2
      await client.unlock("password2");

      // Session 2 keys should be intact
      expect(session2Keys.encryptionKey.every((byte) => byte === 0xff)).toBe(
        true,
      );
      expect(session2Keys.macKey.every((byte) => byte === 0xee)).toBe(true);
    });

    it("should cache overview for performance across loadItems() calls", async () => {
      const client = await createUnlockedClient();

      // Load items multiple times
      await client.loadItems();
      await client.loadItems();
      await client.loadItems();

      // Overview decrypted only once
      expect(decryptOverview).toHaveBeenCalledTimes(1);
    });

    it("should cache item keys for performance across getItemDetails() calls", async () => {
      const client = await createUnlockedClient();

      // Get details multiple times
      await client.getItemDetails(mockOPVaultItem.uuid);
      await client.getItemDetails(mockOPVaultItem.uuid);
      await client.getItemDetails(mockOPVaultItem.uuid);

      // Item keys decrypted only once
      expect(decryptItemKeys).toHaveBeenCalledTimes(1);
    });

    it("should invalidate all caches on unlock (fresh start)", async () => {
      const client = createTestClient();

      // First unlock and cache
      await client.unlock("test-password");
      await client.loadItems();
      await client.getItemDetails(mockOPVaultItem.uuid);

      // Second unlock (without lock) should clear caches
      await client.unlock("test-password");
      await client.loadItems();
      await client.getItemDetails(mockOPVaultItem.uuid);

      // Each decrypt called twice
      expect(decryptOverview).toHaveBeenCalledTimes(2);
      expect(decryptItemKeys).toHaveBeenCalledTimes(2);
    });

    it("should handle concurrent loadItems() + getItemDetails() safely", async () => {
      const client = await createUnlockedClient();

      // Call both simultaneously
      const promise1 = client.loadItems();
      const promise2 = client.getItemDetails(mockOPVaultItem.uuid);

      const [items, details] = await Promise.all([promise1, promise2]);

      expect(items).toHaveLength(1);
      expect(details).toEqual(mockDetails);
    });
  });

  describe("unlockKeysOnly()", () => {
    it("should read profile and derive keys without reading bands", async () => {
      const client = createTestClient();

      await client.unlockKeysOnly("test-password");

      expect(readAndParseProfile).toHaveBeenCalledWith(
        expect.objectContaining({ sourceUri: "/path/to/vault" }),
      );
      expect(deriveVaultKeys).toHaveBeenCalledWith(
        "test-password",
        mockProfile,
      );
      expect(client.isUnlocked).toBe(true);
      // Should NOT read bands
      expect(readAndParseBands).not.toHaveBeenCalled();
    });

    it("should throw WrongPasswordError and cleanup on wrong password", async () => {
      mockToThrowError(mockedUnlockVault, new WrongPasswordError());

      const client = createTestClient();

      await expect(client.unlockKeysOnly("wrong")).rejects.toThrow(
        WrongPasswordError,
      );
      expect(client.isUnlocked).toBe(false);
    });

    it("should attach passwordHint to WrongPasswordError", async () => {
      const profileWithHint = { ...mockProfile, passwordHint: "fred" };
      mockedReadAndParseProfile.mockResolvedValue(profileWithHint);
      mockToThrowError(mockedUnlockVault, new WrongPasswordError());

      const client = createTestClient();

      await expectToRejectWith(
        () => client.unlockKeysOnly("wrong"),
        WrongPasswordError,
        { passwordHint: "fred" },
      );
    });

    it("should have undefined passwordHint when profile has no hint", async () => {
      mockToThrowError(mockedUnlockVault, new WrongPasswordError());

      const client = createTestClient();

      await expectToRejectWith(
        () => client.unlockKeysOnly("wrong"),
        WrongPasswordError,
        { passwordHint: undefined },
      );
    });

    it("should throw VaultCorruptedError on corrupted profile", async () => {
      mockToThrowError(mockedUnlockVault, new VaultCorruptedError("Corrupted"));

      const client = createTestClient();

      await expect(client.unlockKeysOnly("test-password")).rejects.toThrow(
        VaultCorruptedError,
      );
      expect(client.isUnlocked).toBe(false);
    });

    it("should wrap generic errors in VaultCorruptedError", async () => {
      mockedReadAndParseProfile.mockRejectedValue(new Error("Network error"));

      const client = createTestClient();

      await expect(client.unlockKeysOnly("test-password")).rejects.toThrow(
        VaultCorruptedError,
      );
      await expect(client.unlockKeysOnly("test-password")).rejects.toThrow(
        "Network error",
      );
    });

    it("should clear caches on unlock", async () => {
      const client = createTestClient();

      // First full unlock + cache some overviews
      await client.unlock("test-password");
      await client.loadItems();
      expect(decryptOverview).toHaveBeenCalledTimes(1);

      // unlockKeysOnly should clear caches
      await client.unlockKeysOnly("test-password");

      // Setup progressive loading to verify cache was cleared
      mockedReadAndParseBandsProgressively.mockImplementation(
        async (_dir, onBand) => {
          onBand({ [mockOPVaultItem.uuid]: mockOPVaultItem });
        },
      );

      await client.loadItemsProgressively(() => {});

      // decryptOverview called again because cache was cleared
      expect(decryptOverview).toHaveBeenCalledTimes(2);
    });

    it("should preserve items on failure so getItemDetails works after correct password retry", async () => {
      // Regression test for: ItemNotFoundError after wrong password during re-unlock.
      // Scenario: initial unlock → soft-lock → wrong pw → correct pw → view item details.

      // Step 1: Load items progressively (as the app does on initial unlock)
      mockedReadAndParseBandsProgressively.mockImplementation(
        async (_dir, onBand) => {
          onBand({ [mockOPVaultItem.uuid]: mockOPVaultItem });
        },
      );
      const client = createTestClient();
      await client.unlockKeysOnly("test-password");
      await client.loadItemsProgressively(() => {});

      // Step 2: Soft-lock (auto-lock clears keys but preserves items in memory)
      client.clearKeysOnly();
      expect(client.isUnlocked).toBe(false);

      // Step 3: User enters wrong password — must NOT clear items
      mockedUnlockVault
        .mockImplementationOnce(() => {
          throw new WrongPasswordError();
        })
        .mockReturnValueOnce({
          masterKeys: mockMasterKeys,
          overviewKeys: mockOverviewKeys,
        });

      await expect(client.unlockKeysOnly("wrong-password")).rejects.toThrow(
        WrongPasswordError,
      );
      expect(client.isUnlocked).toBe(false);

      // Step 4: User enters correct password — keys restored
      await client.unlockKeysOnly("correct-password");
      expect(client.isUnlocked).toBe(true);

      // Step 5: Detail view loads — must NOT throw ItemNotFoundError
      await expect(
        client.getItemDetails(mockOPVaultItem.uuid),
      ).resolves.toEqual(mockDetails);

      // Bands were never re-read (items survived entirely in memory)
      expect(readAndParseBands).not.toHaveBeenCalled();
    });

    it("should clear itemKeysCache on failure even though items are preserved", async () => {
      // After a failed unlock attempt, cached item keys must be cleared
      // (they belong to the previous session and must not carry over).
      mockedReadAndParseBandsProgressively.mockImplementation(
        async (_dir, onBand) => {
          onBand({ [mockOPVaultItem.uuid]: mockOPVaultItem });
        },
      );
      const client = createTestClient();
      await client.unlockKeysOnly("test-password");
      await client.loadItemsProgressively(() => {});
      await client.getItemDetails(mockOPVaultItem.uuid); // Populate itemKeysCache
      expect(decryptItemKeys).toHaveBeenCalledTimes(1);

      client.clearKeysOnly(); // Soft-lock (also clears cache)

      // Wrong password attempt
      mockToThrowError(mockedUnlockVault, new WrongPasswordError());
      await expect(client.unlockKeysOnly("wrong-password")).rejects.toThrow(
        WrongPasswordError,
      );

      // Restore mock for correct password
      mockedUnlockVault.mockReturnValue({
        masterKeys: mockMasterKeys,
        overviewKeys: mockOverviewKeys,
      });

      // Correct password
      await client.unlockKeysOnly("correct-password");

      // getItemDetails should re-decrypt item keys (cache was cleared on failure)
      await client.getItemDetails(mockOPVaultItem.uuid);
      expect(decryptItemKeys).toHaveBeenCalledTimes(2);
    });
  });

  describe("loadItemsProgressively()", () => {
    it("should throw VaultNotUnlockedError when locked", async () => {
      const client = createTestClient();

      await expect(client.loadItemsProgressively(() => {})).rejects.toThrow(
        VaultNotUnlockedError,
      );
    });

    it("should call readAndParseBandsProgressively with vault directory", async () => {
      mockedReadAndParseBandsProgressively.mockResolvedValue(undefined);

      const client = createTestClient();
      await client.unlockKeysOnly("test-password");
      await client.loadItemsProgressively(() => {});

      expect(readAndParseBandsProgressively).toHaveBeenCalledWith(
        expect.objectContaining({ sourceUri: "/path/to/vault" }),
        expect.any(Function),
        undefined,
      );
    });

    it("should call onBatch with constructed Items from each band", async () => {
      const item1: OPVaultItem = {
        ...mockOPVaultItem,
        uuid: "item-1",
      };
      const item2: OPVaultItem = {
        ...mockOPVaultItem,
        uuid: "item-2",
      };

      mockedReadAndParseBandsProgressively.mockImplementation(
        async (_dir, onBand) => {
          onBand({ [item1.uuid]: item1 });
          onBand({ [item2.uuid]: item2 });
        },
      );

      const client = createTestClient();
      await client.unlockKeysOnly("test-password");

      const batches: unknown[][] = [];
      await client.loadItemsProgressively((items) => batches.push(items));

      expect(batches).toHaveLength(2);
      expect(batches[0]).toHaveLength(1);
      expect(batches[0][0]).toMatchObject({ uuid: "item-1" });
      expect(batches[1]).toHaveLength(1);
      expect(batches[1][0]).toMatchObject({ uuid: "item-2" });
    });

    it("should include trashed items in batches", async () => {
      const trashedItem: OPVaultItem = {
        ...mockOPVaultItem,
        uuid: "trashed",
        trashed: true,
      };

      mockedReadAndParseBandsProgressively.mockImplementation(
        async (_dir, onBand) => {
          onBand({
            [mockOPVaultItem.uuid]: mockOPVaultItem,
            [trashedItem.uuid]: trashedItem,
          });
        },
      );

      const client = createTestClient();
      await client.unlockKeysOnly("test-password");

      const batches: unknown[][] = [];
      await client.loadItemsProgressively((items) => batches.push(items));

      expect(batches).toHaveLength(1);
      expect(batches[0]).toHaveLength(2);
    });

    it("should pass onProgress to readAndParseBandsProgressively", async () => {
      mockedReadAndParseBandsProgressively.mockImplementation(
        async (_dir, _onBand, onProgress) => {
          onProgress?.(1, 3);
          onProgress?.(2, 3);
          onProgress?.(3, 3);
        },
      );

      const client = createTestClient();
      await client.unlockKeysOnly("test-password");

      const progress: { loaded: number; total: number }[] = [];
      await client.loadItemsProgressively(
        () => {},
        (loaded, total) => progress.push({ loaded, total }),
      );

      expect(progress).toEqual([
        { loaded: 1, total: 3 },
        { loaded: 2, total: 3 },
        { loaded: 3, total: 3 },
      ]);
    });

    it("should store raw items so getItemDetails works for loaded items", async () => {
      mockedReadAndParseBandsProgressively.mockImplementation(
        async (_dir, onBand) => {
          onBand({ [mockOPVaultItem.uuid]: mockOPVaultItem });
        },
      );

      const client = createTestClient();
      await client.unlockKeysOnly("test-password");
      await client.loadItemsProgressively(() => {});

      // getItemDetails should work for progressively loaded items
      const details = await client.getItemDetails(mockOPVaultItem.uuid);
      expect(details).toEqual(mockDetails);
      expect(decryptItemKeys).toHaveBeenCalledWith(
        mockOPVaultItem,
        mockMasterKeys,
      );
    });

    it("should warn but continue when individual item decryption fails", async () => {
      const goodItem: OPVaultItem = { ...mockOPVaultItem, uuid: "good" };
      const badItem: OPVaultItem = { ...mockOPVaultItem, uuid: "bad" };

      mockedDecryptOverview
        .mockReturnValueOnce(mockOverview) // good item
        .mockImplementationOnce(() => {
          throw new Error("Decryption failed");
        }); // bad item

      mockedReadAndParseBandsProgressively.mockImplementation(
        async (_dir, onBand) => {
          onBand({
            [goodItem.uuid]: goodItem,
            [badItem.uuid]: badItem,
          });
        },
      );

      const client = createTestClient();
      await client.unlockKeysOnly("test-password");

      const batches: unknown[][] = [];
      await client.loadItemsProgressively((items) => batches.push(items));

      // Should still deliver the good item
      expect(batches).toHaveLength(1);
      expect(batches[0]).toHaveLength(1);
      expect(batches[0][0]).toMatchObject({ uuid: "good" });

      // Should have warned about the bad item
    });

    it("should not call onBatch if band produces no valid items", async () => {
      const badItem: OPVaultItem = { ...mockOPVaultItem, uuid: "bad" };

      mockedDecryptOverview.mockImplementationOnce(() => {
        throw new Error("Decryption failed");
      });

      mockedReadAndParseBandsProgressively.mockImplementation(
        async (_dir, onBand) => {
          onBand({ [badItem.uuid]: badItem });
        },
      );

      const client = createTestClient();
      await client.unlockKeysOnly("test-password");

      const batches: unknown[][] = [];
      await client.loadItemsProgressively((items) => batches.push(items));

      // No valid items, so onBatch should not have been called
      expect(batches).toHaveLength(0);
    });
  });

  describe("reloadFromSource()", () => {
    it("should throw VaultNotUnlockedError when locked", async () => {
      const client = createTestClient();

      await expect(client.reloadFromSource()).rejects.toThrow(
        VaultNotUnlockedError,
      );
    });

    it("should re-read bands from source", async () => {
      const client = await createUnlockedClient();

      expect(readAndParseBands).toHaveBeenCalledTimes(1);

      await client.reloadFromSource();

      expect(readAndParseBands).toHaveBeenCalledTimes(2);
    });

    it("should reflect new items after reload", async () => {
      const client = await createUnlockedClient();

      const items1 = await client.loadItems();
      expect(items1).toHaveLength(1);

      // After reload, source now returns 2 items
      const newItem: OPVaultItem = { ...mockOPVaultItem, uuid: "new-item" };
      mockedReadAndParseBands.mockResolvedValue(
        new Map([
          [mockOPVaultItem.uuid, mockOPVaultItem],
          [newItem.uuid, newItem],
        ]),
      );

      await client.reloadFromSource();

      const items2 = await client.loadItems();
      expect(items2).toHaveLength(2);
    });

    it("should clear overview cache so overviews are re-decrypted", async () => {
      const client = await createUnlockedClient();

      await client.loadItems(); // Caches overview
      expect(decryptOverview).toHaveBeenCalledTimes(1);

      await client.reloadFromSource();

      await client.loadItems(); // Should re-decrypt, not use cache
      expect(decryptOverview).toHaveBeenCalledTimes(2);
    });

    it("should clear item keys cache", async () => {
      const client = await createUnlockedClient();

      await client.getItemDetails(mockOPVaultItem.uuid); // Caches item keys
      expect(decryptItemKeys).toHaveBeenCalledTimes(1);

      await client.reloadFromSource();

      await client.getItemDetails(mockOPVaultItem.uuid); // Should re-decrypt
      expect(decryptItemKeys).toHaveBeenCalledTimes(2);
    });

    it("should rebuild attachment index", async () => {
      const client = await createUnlockedClient();

      // indexAttachmentFilenames called once during unlock
      expect(mockedIndexAttachmentFilenames).toHaveBeenCalledTimes(1);

      await client.reloadFromSource();

      // Called again during reload
      expect(mockedIndexAttachmentFilenames).toHaveBeenCalledTimes(2);
    });
  });

  describe("getAttachments()", () => {
    const mockedParseAttachmentMetadata = jest.mocked(parseAttachmentMetadata);
    const mockedDecodeOpdata01 = jest.mocked(decryptOpdata01);

    it("should throw VaultNotUnlockedError when locked", async () => {
      const client = createTestClient();
      await expect(client.getAttachments("item-uuid-1")).rejects.toThrow(
        VaultNotUnlockedError,
      );
    });

    it("should return empty array when item has no attachments", async () => {
      const client = await createUnlockedClient();
      await client.loadItems();

      const result = await client.getAttachments("item-uuid-1");
      expect(result).toEqual([]);
    });

    it("should return attachment info with decrypted overview", async () => {
      // Setup: source that lists an attachment file
      const attachmentFilename =
        "AAAA0000BBBB1111CCCC2222DDDD3333_1111000022223333444455556666AAAA.attachment";
      const itemUuid = "AAAA0000BBBB1111CCCC2222DDDD3333";

      const attachmentSource = createMockVaultSource("/vault");
      attachmentSource.listFiles.mockResolvedValue([
        "profile.js",
        "band_A.js",
        attachmentFilename,
      ]);
      attachmentSource.getBinaryContent.mockResolvedValue(
        new Uint8Array([1, 2, 3]),
      );

      // Mock the OPVaultItem for this UUID
      const itemWithAttachment: OPVaultItem = {
        ...mockOPVaultItem,
        uuid: itemUuid,
      };
      mockedReadAndParseBands.mockResolvedValue(
        new Map([[itemUuid, itemWithAttachment]]),
      );

      mockedParseAttachmentMetadata.mockReturnValue({
        header: { metadataSize: 100, iconSize: 0 },
        metadata: {
          itemUUID: itemUuid,
          uuid: "1111000022223333444455556666AAAA",
          contentsSize: 500,
          external: false,
          createdAt: 1700000000,
          updatedAt: 1700000001,
          txTimestamp: 1700000002,
          overview: "encrypted-overview-base64",
        },
      });

      mockedDecodeOpdata01.mockReturnValue(
        Buffer.from(JSON.stringify({ filename: "document.pdf" })),
      );

      // Configure attachment index to include this item's attachment
      mockedIndexAttachmentFilenames.mockReturnValue(
        new Map([[itemUuid, [attachmentFilename]]]),
      );

      const client = new OPVaultClient(
        createMockVaultSource("/vault"),
        attachmentSource,
      );
      await client.unlock("test-password");
      await client.loadItems();

      const result = await client.getAttachments(itemUuid);

      expect(result).toHaveLength(1);
      expect(result[0].uuid).toBe("1111000022223333444455556666AAAA");
      expect(result[0].filename).toBe("document.pdf");
      expect(result[0].size).toBe(500);
    });

    it("should skip attachment when file not found", async () => {
      const attachmentFilename =
        "AAAA0000BBBB1111CCCC2222DDDD3333_1111000022223333444455556666AAAA.attachment";
      const itemUuid = "AAAA0000BBBB1111CCCC2222DDDD3333";

      const attachmentSource = createMockVaultSource("/vault");
      attachmentSource.listFiles.mockResolvedValue([
        "profile.js",
        attachmentFilename,
      ]);
      attachmentSource.getBinaryContent.mockResolvedValue(null); // File not found

      const itemWithAttachment: OPVaultItem = {
        ...mockOPVaultItem,
        uuid: itemUuid,
      };
      mockedReadAndParseBands.mockResolvedValue(
        new Map([[itemUuid, itemWithAttachment]]),
      );

      // Configure attachment index to include this item's attachment
      mockedIndexAttachmentFilenames.mockReturnValue(
        new Map([[itemUuid, [attachmentFilename]]]),
      );

      const client = new OPVaultClient(
        createMockVaultSource("/vault"),
        attachmentSource,
      );
      await client.unlock("test-password");
      await client.loadItems();

      const result = await client.getAttachments(itemUuid);
      expect(result).toEqual([]);
    });
  });

  describe("getAttachmentContent()", () => {
    const mockedParseAttachmentHeader = jest.mocked(parseAttachmentHeader);
    const mockedExtractAttachmentContent = jest.mocked(
      extractAttachmentContent,
    );
    const mockedDecodeOpdata01Raw = jest.mocked(decryptOpdata01Raw);

    it("should throw VaultNotUnlockedError when locked", async () => {
      const client = createTestClient();
      await expect(
        client.getAttachmentContent("item-uuid-1", "att-uuid"),
      ).rejects.toThrow(VaultNotUnlockedError);
    });

    it("should throw ItemNotFoundError for unknown item", async () => {
      const client = await createUnlockedClient();
      await client.loadItems();

      await expect(
        client.getAttachmentContent("nonexistent", "att-uuid"),
      ).rejects.toThrow(ItemNotFoundError);
    });

    it("should throw when attachment file not found", async () => {
      const attachmentSource = createMockVaultSource("/vault");
      attachmentSource.listFiles.mockResolvedValue(["profile.js"]);
      attachmentSource.getBinaryContent.mockResolvedValue(null);

      const client = new OPVaultClient(
        createMockVaultSource("/vault"),
        attachmentSource,
      );
      await client.unlock("test-password");
      await client.loadItems();

      await expect(
        client.getAttachmentContent(mockOPVaultItem.uuid, "att-uuid"),
      ).rejects.toThrow("Attachment file not found");
    });

    it("should decrypt attachment content with item keys", async () => {
      const attachmentSource = createMockVaultSource("/vault");
      attachmentSource.listFiles.mockResolvedValue(["profile.js"]);
      attachmentSource.getBinaryContent.mockResolvedValue(
        new Uint8Array([1, 2, 3, 4, 5]),
      );

      mockedParseAttachmentHeader.mockReturnValue({
        metadataSize: 10,
        iconSize: 0,
      });
      mockedExtractAttachmentContent.mockReturnValue(
        Buffer.from("encrypted-content"),
      );
      mockedDecodeOpdata01Raw.mockReturnValue(Buffer.from("decrypted-content"));

      const client = new OPVaultClient(
        createMockVaultSource("/vault"),
        attachmentSource,
      );
      await client.unlock("test-password");
      await client.loadItems();

      const result = await client.getAttachmentContent(
        mockOPVaultItem.uuid,
        "att-uuid",
      );

      expect(result).toBeInstanceOf(Uint8Array);
      expect(mockedDecryptItemKeys).toHaveBeenCalled();
      expect(mockedDecodeOpdata01Raw).toHaveBeenCalled();
    });
  });

  describe("writeBack()", () => {
    it("should throw NotImplementedError", async () => {
      const client = createTestClient();
      await expect(client.writeBack()).rejects.toThrow(NotImplementedError);
    });
  });
});
