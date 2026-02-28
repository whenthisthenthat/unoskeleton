import { Category } from "@/lib/vault/categories";
import { anItem } from "@/lib/vault/fixtures/item-builder";
import {
  ItemNotFoundError,
  VaultStorageError,
} from "@/lib/vault/storage-interface";
import type { IVaultStorage } from "@/lib/vault/storage-interface";
import { Item } from "@/lib/vault/types";
import { Vault, SortField, SortOrder } from "@/lib/vault/vault";

describe("Vault", () => {
  // Test data
  const mockItems: Item[] = [
    anItem()
      .withUuid("1")
      .withTitle("Zebra")
      .withSubtitle("Black and white")
      .withIcon("🦓")
      .withFave(1)
      .withCategory(Category.Login)
      .withTags(["wild", "safari"])
      .build(),
    anItem()
      .withUuid("2")
      .withTitle("Apple")
      .withSubtitle("Red fruit")
      .withIcon("🍎")
      .withCategory(Category.CreditCard)
      .withTags(["sweet", "fresh"])
      .build(),
    anItem()
      .withUuid("3")
      .withTitle("Banana")
      .withSubtitle("Yellow fruit")
      .withIcon("🍌")
      .withFave(1)
      .withCategory(Category.CreditCard)
      .withTags(["sweet"])
      .build(),
    anItem()
      .withUuid("4")
      .withTitle("Cherry")
      .withSubtitle("Small red fruit")
      .withIcon("🍒")
      .withCategory(Category.CreditCard)
      .withTags(["tart", "sweet"])
      .build(),
    anItem()
      .withUuid("5")
      .withTitle("Lion")
      .withSubtitle("King of jungle")
      .withIcon("🦁")
      .withFave(1)
      .withCategory(Category.Login)
      .withTags(["wild", "predator"])
      .build(),
    anItem()
      .withUuid("6")
      .withTitle("Deleted Note")
      .withSubtitle("Old note")
      .withIcon("📝")
      .withCategory(Category.SecureNote)
      .withTags(["sweet"])
      .withTrashed(true)
      .build(),
    anItem()
      .withUuid("7")
      .withTitle("Deleted Favorite")
      .withSubtitle("Old fav")
      .withIcon("🔐")
      .withFave(1)
      .withCategory(Category.Login)
      .withTags(["wild"])
      .withTrashed(true)
      .build(),
  ];

  let client: Vault;

  beforeEach(() => {
    client = new Vault([...mockItems]);
  });

  describe("constructor", () => {
    it("should initialize with items sorted by title in ascending order", () => {
      const items = client.getAllItems();
      expect(items[0].title).toBe("Apple");
      expect(items[1].title).toBe("Banana");
      expect(items[2].title).toBe("Cherry");
      expect(items[3].title).toBe("Lion");
      expect(items[4].title).toBe("Zebra");
    });
  });

  describe("getAllItems", () => {
    it("should filter items by query in title field", () => {
      const items = client.getAllItems("Apple");
      expect(items).toHaveLength(1);
      expect(items[0].title).toBe("Apple");
    });

    it("should filter items by query in subtitle field", () => {
      const items = client.getAllItems("fruit");
      expect(items).toHaveLength(3);
      expect(items.map((i) => i.uuid).sort()).toEqual(["2", "3", "4"]);
    });

    it("should filter items by query in category field", () => {
      const items = client.getAllItems(Category.Login);
      expect(items).toHaveLength(2);
      expect(items.map((i) => i.uuid).sort()).toEqual(["1", "5"]);
    });

    it("should filter items by query in tags field", () => {
      const items = client.getAllItems("wild");
      expect(items).toHaveLength(2);
      expect(items.map((i) => i.uuid).sort()).toEqual(["1", "5"]);
    });

    it("should perform case-insensitive search", () => {
      const items = client.getAllItems("APPLE");
      expect(items).toHaveLength(1);
      expect(items[0].title).toBe("Apple");
    });

    it("should trim whitespace from query", () => {
      const items = client.getAllItems("  Apple  ");
      expect(items).toHaveLength(1);
      expect(items[0].title).toBe("Apple");
    });

    it("should return all items when query is whitespace only", () => {
      const items = client.getAllItems("   ");
      expect(items).toHaveLength(5);
    });

    it("should sort by subtitle ascending", () => {
      const items = client.getAllItems(undefined, {
        field: SortField.Subtitle,
        order: SortOrder.Asc,
      });
      expect(items[0].subtitle).toBe("Black and white");
      expect(items[4].subtitle).toBe("Yellow fruit");
    });

    it("should sort by title descending", () => {
      const items = client.getAllItems(undefined, {
        field: SortField.Title,
        order: SortOrder.Desc,
      });
      expect(items[0].title).toBe("Zebra");
      expect(items[4].title).toBe("Apple");
    });

    it("should sort by category ascending", () => {
      const items = client.getAllItems(undefined, {
        field: SortField.Category,
        order: SortOrder.Asc,
      });
      // Alphabetical: CreditCard < Login
      expect(items[0].category).toBe(Category.CreditCard);
      expect(items[1].category).toBe(Category.CreditCard);
      expect(items[2].category).toBe(Category.CreditCard);
      expect(items[3].category).toBe(Category.Login);
      expect(items[4].category).toBe(Category.Login);
    });

    it("should sort by fav ascending (non-favorite before favorite)", () => {
      const items = client.getAllItems(undefined, {
        field: SortField.Fav,
        order: SortOrder.Asc,
      });
      expect(items[0].fave).toBeUndefined();
      expect(items[1].fave).toBeUndefined();
      expect(items[2].fave).toBeDefined();
    });

    it("should sort by fav descending (favorite before non-favorite)", () => {
      const items = client.getAllItems(undefined, {
        field: SortField.Fav,
        order: SortOrder.Desc,
      });
      expect(items[0].fave).toBeDefined();
      expect(items[1].fave).toBeDefined();
      expect(items[2].fave).toBeDefined();
      expect(items[3].fave).toBeUndefined();
    });

    it("should filter and sort together", () => {
      const items = client.getAllItems("fruit", {
        field: SortField.Title,
        order: SortOrder.Desc,
      });
      expect(items).toHaveLength(3);
      expect(items[0].title).toBe("Cherry");
      expect(items[2].title).toBe("Apple");
    });
  });

  describe("getItemByUuid", () => {
    it("should return item with matching uuid", () => {
      const item = client.getItemByUuid("2");
      expect(item.title).toBe("Apple");
      expect(item.uuid).toBe("2");
    });

    it("should throw ItemNotFoundError when uuid not found", () => {
      expect(() => client.getItemByUuid("999")).toThrow(ItemNotFoundError);
    });

    it("should include the item uuid in the error", () => {
      expectToThrowWith(() => client.getItemByUuid("999"), ItemNotFoundError, {
        itemId: "999",
        message: "Item not found: 999",
      });
    });
  });

  describe("getFavoriteItems", () => {
    it("should return only favorite items", () => {
      const items = client.getFavoriteItems();
      expect(items).toHaveLength(3);
      items.forEach((item) => {
        expect(item.fave).toBeDefined();
      });
    });

    it("should filter favorites by query", () => {
      const items = client.getFavoriteItems("wild");
      expect(items).toHaveLength(2);
      expect(items.map((i) => i.uuid).sort()).toEqual(["1", "5"]);
    });

    it("should return empty array when no favorites match query", () => {
      const items = client.getFavoriteItems("nonexistent");
      expect(items).toHaveLength(0);
    });

    it("should sort favorite items", () => {
      const items = client.getFavoriteItems(undefined, {
        field: SortField.Title,
        order: SortOrder.Desc,
      });
      expect(items[0].title).toBe("Zebra");
      expect(items[2].title).toBe("Banana");
    });

    it("should filter and sort favorites together", () => {
      const items = client.getFavoriteItems("a", {
        field: SortField.Title,
        order: SortOrder.Asc,
      });
      // Matches: Banana, Zebra, Lion (contain 'a')
      expect(items).toHaveLength(3);
      expect(items[0].title).toBe("Banana");
      expect(items[2].title).toBe("Zebra");
    });
  });

  describe("getItemsByCategory", () => {
    it('should return all items when category is "all"', () => {
      const items = client.getItemsByCategory(Category.AllItems);
      expect(items).toHaveLength(5);
    });

    it("should filter by exact category match", () => {
      const items = client.getItemsByCategory(Category.CreditCard);
      expect(items).toHaveLength(3);
      items.forEach((item) => {
        expect(item.category).toBe(Category.CreditCard);
      });
    });

    it("should return empty array when category not found", () => {
      const items = client.getItemsByCategory("998" as Category);
      expect(items).toHaveLength(0);
    });

    it("should apply query filter to category results", () => {
      const items = client.getItemsByCategory(Category.CreditCard, "sweet");
      expect(items).toHaveLength(3); // Apple, Banana, Cherry all have 'sweet' in tags
    });

    it("should sort category results", () => {
      const items = client.getItemsByCategory(Category.CreditCard, undefined, {
        field: SortField.Title,
        order: SortOrder.Desc,
      });
      expect(items[0].title).toBe("Cherry");
      expect(items[2].title).toBe("Apple");
    });

    it('should apply query and sort when category is "000" (All Items)', () => {
      const items = client.getItemsByCategory(Category.AllItems, "a", {
        field: SortField.Title,
        order: SortOrder.Asc,
      });
      // Items containing 'a': Apple, Banana, Cherry (in "Small", "tart"), Lion (in "predator"), Zebra
      expect(items).toHaveLength(5);
      expect(items[0].title).toBe("Apple");
      expect(items[4].title).toBe("Zebra");
    });
  });

  describe("getItemsByTag", () => {
    it("should filter by exact tag match", () => {
      const items = client.getItemsByTag("sweet");
      expect(items).toHaveLength(3); // Apple, Banana, Cherry
      items.forEach((item) => {
        expect(item.tags).toContain("sweet");
      });
    });

    it("should filter by exact tag match (case-insensitive)", () => {
      const items = client.getItemsByTag("SWEET");
      expect(items).toHaveLength(3);
    });

    it("should return empty array when tag not found", () => {
      const items = client.getItemsByTag("nonexistent");
      expect(items).toHaveLength(0);
    });

    it("should apply query filter to tag results", () => {
      const items = client.getItemsByTag("sweet", "Banana");
      expect(items).toHaveLength(1);
      expect(items[0].title).toBe("Banana");
    });

    it("should sort tag results", () => {
      const items = client.getItemsByTag("sweet", undefined, {
        field: SortField.Title,
        order: SortOrder.Desc,
      });
      expect(items[0].title).toBe("Cherry");
      expect(items[2].title).toBe("Apple");
    });

    it("should handle items with multiple tags", () => {
      const items = client.getItemsByTag("wild");
      expect(items).toHaveLength(2); // Zebra, Lion
      expect(items.map((i) => i.uuid).sort()).toEqual(["1", "5"]);
    });
  });

  describe("getCountByCategory", () => {
    it("should return count for specific category", () => {
      const count = client.getCountByCategory(Category.CreditCard);
      expect(count).toBe(3);
    });

    it("should return count for another category", () => {
      const count = client.getCountByCategory(Category.Login);
      expect(count).toBe(2);
    });

    it('should return total count when category is "000" (All Items)', () => {
      const count = client.getCountByCategory(Category.AllItems);
      expect(count).toBe(5);
    });

    it("should return 0 for nonexistent category", () => {
      // @ts-expect-error - Testing edge case with invalid category code
      const count = client.getCountByCategory("Vegetables");
      expect(count).toBe(0);
    });
  });

  describe("getAllTagCounts", () => {
    it("should return correct counts for all tags", () => {
      const counts = client.getAllTagCounts();
      expect(counts.get("sweet")).toBe(3); // Apple, Banana, Cherry
      expect(counts.get("wild")).toBe(2); // Zebra, Lion
      expect(counts.get("safari")).toBe(1); // Zebra
      expect(counts.get("fresh")).toBe(1); // Apple
      expect(counts.get("tart")).toBe(1); // Cherry
      expect(counts.get("predator")).toBe(1); // Lion
    });

    it("should return empty map when no items have tags", () => {
      const emptyClient = new Vault([
        anItem()
          .withTitle("Test")
          .withSubtitle("Test")
          .withIcon("🧪")
          .withCategory(Category.SecureNote)
          .build(),
      ]);
      const counts = emptyClient.getAllTagCounts();
      expect(counts.size).toBe(0);
    });

    it("should handle items with empty tags array", () => {
      const clientWithEmptyTags = new Vault([
        anItem()
          .withUuid("1")
          .withTitle("Test")
          .withSubtitle("Test")
          .withIcon("🧪")
          .withCategory(Category.SecureNote)
          .build(),
        anItem()
          .withUuid("2")
          .withTitle("Test2")
          .withSubtitle("Test2")
          .withIcon("🧪")
          .withCategory(Category.SecureNote)
          .withTags(["tag1"])
          .build(),
      ]);
      const counts = clientWithEmptyTags.getAllTagCounts();
      expect(counts.size).toBe(1);
      expect(counts.get("tag1")).toBe(1);
    });
  });

  describe("Archive category (trashed items)", () => {
    it("should return only trashed items for Archive category", () => {
      const items = client.getItemsByCategory(Category.Archive);
      expect(items).toHaveLength(2);
      items.forEach((item) => {
        expect(item.trashed).toBe(true);
      });
    });

    it("should return correct count for Archive category", () => {
      const count = client.getCountByCategory(Category.Archive);
      expect(count).toBe(2);
    });

    it("should filter Archive items by query", () => {
      const items = client.getItemsByCategory(Category.Archive, "Note");
      expect(items).toHaveLength(1);
      expect(items[0].title).toBe("Deleted Note");
    });

    it("should sort Archive items", () => {
      const items = client.getItemsByCategory(Category.Archive, undefined, {
        field: SortField.Title,
        order: SortOrder.Desc,
      });
      expect(items[0].title).toBe("Deleted Note");
      expect(items[1].title).toBe("Deleted Favorite");
    });

    it("should exclude trashed items from All Items", () => {
      const items = client.getItemsByCategory(Category.AllItems);
      expect(items).toHaveLength(5);
      items.forEach((item) => {
        expect(item.trashed).toBeFalsy();
      });
    });

    it("should exclude trashed items from regular categories", () => {
      const items = client.getItemsByCategory(Category.Login);
      expect(items).toHaveLength(2);
      items.forEach((item) => {
        expect(item.trashed).toBeFalsy();
      });
    });

    it("should exclude trashed items from favorites", () => {
      const items = client.getFavoriteItems();
      expect(items).toHaveLength(3);
      items.forEach((item) => {
        expect(item.trashed).toBeFalsy();
      });
    });

    it("should exclude trashed items from getAllItems", () => {
      const items = client.getAllItems();
      expect(items).toHaveLength(5);
      items.forEach((item) => {
        expect(item.trashed).toBeFalsy();
      });
    });

    it("should exclude trashed items from tag counts", () => {
      const counts = client.getAllTagCounts();
      expect(counts.get("sweet")).toBe(3);
      expect(counts.get("wild")).toBe(2);
    });

    it("should exclude trashed items from getItemsByTag", () => {
      const items = client.getItemsByTag("sweet");
      expect(items).toHaveLength(3);
    });

    it("should still find trashed items by UUID", () => {
      const item = client.getItemByUuid("6");
      expect(item.trashed).toBe(true);
      expect(item.title).toBe("Deleted Note");
    });
  });

  describe("Edge cases", () => {
    it("should handle empty items array", () => {
      const emptyClient = new Vault([]);
      expect(emptyClient.getAllItems()).toHaveLength(0);
      expect(emptyClient.getFavoriteItems()).toHaveLength(0);
      // @ts-expect-error - Testing edge case with invalid category code
      expect(emptyClient.getItemsByCategory("any")).toHaveLength(0);
      expect(emptyClient.getItemsByTag("any")).toHaveLength(0);
      // @ts-expect-error - Testing edge case with invalid category code
      expect(emptyClient.getCountByCategory("any")).toBe(0);
      expect(emptyClient.getAllTagCounts().size).toBe(0);
    });

    it("should handle items without tags property", () => {
      const noTagsClient = new Vault([
        anItem()
          .withTitle("Test")
          .withSubtitle("Test")
          .withIcon("🧪")
          .withCategory(Category.SecureNote)
          .build(),
      ]);
      expect(noTagsClient.getItemsByTag("any")).toHaveLength(0);
      expect(noTagsClient.getAllTagCounts().size).toBe(0);
    });

    it("should handle special characters in search query", () => {
      const specialClient = new Vault([
        anItem()
          .withTitle("Test (special)")
          .withSubtitle("Test")
          .withIcon("🧪")
          .withCategory(Category.SecureNote)
          .withTags(["tag-with-dash"])
          .build(),
      ]);
      const items = specialClient.getAllItems("(special)");
      expect(items).toHaveLength(1);
    });

    it("should handle duplicate items correctly", () => {
      const duplicateClient = new Vault([
        anItem()
          .withUuid("1")
          .withTitle("Apple")
          .withSubtitle("Red")
          .withIcon("🍎")
          .withFave(1)
          .withCategory(Category.CreditCard)
          .withTags(["sweet"])
          .build(),
        anItem()
          .withUuid("2")
          .withTitle("Apple")
          .withSubtitle("Green")
          .withIcon("🍏")
          .withCategory(Category.CreditCard)
          .withTags(["tart"])
          .build(),
      ]);
      const items = duplicateClient.getAllItems("Apple");
      expect(items).toHaveLength(2);
    });
  });
});

// ── initializeProgressive tests ──────────────────────────────────────

describe("Vault.initializeProgressive", () => {
  const makeItem = (overrides: Partial<Item> = {}): Item => ({
    ...anItem().build(),
    ...overrides,
  });

  /**
   * Create a mock IVaultStorage with progressive methods.
   * `batches` defines what loadItemsProgressively delivers per band.
   */
  function createMockStorage(batches: Item[][]): IVaultStorage & {
    unlockKeysOnly: jest.Mock;
    loadItemsProgressively: jest.Mock;
  } {
    return {
      unlock: jest.fn(),
      isUnlocked: true,
      loadItems: jest.fn(),
      getItemDetails: jest.fn(),
      lock: jest.fn(),
      unlockKeysOnly: jest.fn().mockResolvedValue(undefined),
      loadItemsProgressively: jest.fn(
        async (
          onBatch: (items: Item[]) => void,
          onProgress?: (loaded: number, total: number) => void,
        ) => {
          for (let i = 0; i < batches.length; i++) {
            onBatch(batches[i]);
            onProgress?.(i + 1, batches.length);
          }
        },
      ),
    };
  }

  it("should call unlockKeysOnly then loadItemsProgressively", async () => {
    const storage = createMockStorage([[makeItem()]]);
    const vault = new Vault(storage);

    await vault.initializeProgressive("pw");

    expect(storage.unlockKeysOnly).toHaveBeenCalledWith("pw");
    expect(storage.loadItemsProgressively).toHaveBeenCalledTimes(1);
  });

  it("should emit items-changed for each batch", async () => {
    const batch1 = [makeItem({ uuid: "a", title: "A" })];
    const batch2 = [makeItem({ uuid: "b", title: "B" })];
    const storage = createMockStorage([batch1, batch2]);
    const vault = new Vault(storage);

    const received: Item[][] = [];
    vault.on("items-changed", (items) => received.push(items));

    await vault.initializeProgressive("pw");

    expect(received).toHaveLength(2);
    expect(received[0]).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ uuid: "a", title: "A" }),
      ]),
    );
    expect(received[1]).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ uuid: "b", title: "B" }),
      ]),
    );
  });

  it("should emit loading-complete when all bands are done", async () => {
    const storage = createMockStorage([[makeItem()]]);
    const vault = new Vault(storage);

    let completed = false;
    vault.on("loading-complete", () => {
      completed = true;
    });

    await vault.initializeProgressive("pw");

    expect(completed).toBe(true);
  });

  it("should set isLoading=true during loading and false after", async () => {
    const capturedStates: boolean[] = [];

    const storage: IVaultStorage & {
      unlockKeysOnly: jest.Mock;
      loadItemsProgressively: jest.Mock;
    } = {
      unlock: jest.fn(),
      isUnlocked: true,
      loadItems: jest.fn(),
      getItemDetails: jest.fn(),
      lock: jest.fn(),
      unlockKeysOnly: jest.fn().mockResolvedValue(undefined),
      loadItemsProgressively: jest.fn(
        async (onBatch: (items: Item[]) => void) => {
          // Capture isLoading inside the loading callback
          capturedStates.push(vault.isLoading);
          onBatch([makeItem()]);
        },
      ),
    };

    const vault = new Vault(storage);
    expect(vault.isLoading).toBe(false);

    await vault.initializeProgressive("pw");

    expect(capturedStates[0]).toBe(true); // Was true during loading
    expect(vault.isLoading).toBe(false); // False after
  });

  it("should call onReadyToNavigate on first batch with a favourite", async () => {
    const favItem = makeItem({ uuid: "fav", fave: 1 });
    const normalItem = makeItem({ uuid: "normal" });
    const storage = createMockStorage([[normalItem], [favItem]]);
    const vault = new Vault(storage);

    let navReady = false;
    await vault.initializeProgressive("pw", {
      onReadyToNavigate: () => {
        navReady = true;
      },
    });

    expect(navReady).toBe(true);
  });

  it("should call onReadyToNavigate after all bands if no favourites found", async () => {
    const storage = createMockStorage([[makeItem({ uuid: "a" })]]);
    const vault = new Vault(storage);

    let navReady = false;
    await vault.initializeProgressive("pw", {
      onReadyToNavigate: () => {
        navReady = true;
      },
    });

    expect(navReady).toBe(true);
  });

  it("should only call onReadyToNavigate once even with multiple fav batches", async () => {
    const fav1 = makeItem({ uuid: "fav1", fave: 1 });
    const fav2 = makeItem({ uuid: "fav2", fave: 2 });
    const storage = createMockStorage([[fav1], [fav2]]);
    const vault = new Vault(storage);

    let navCount = 0;
    await vault.initializeProgressive("pw", {
      onReadyToNavigate: () => {
        navCount++;
      },
    });

    expect(navCount).toBe(1);
  });

  it("should report progress via onProgress callback", async () => {
    const storage = createMockStorage([
      [makeItem({ uuid: "a", title: "A" })],
      [makeItem({ uuid: "b", title: "B" })],
      [makeItem({ uuid: "c", title: "C" })],
    ]);
    const vault = new Vault(storage);

    const progress: { loaded: number; total: number }[] = [];
    await vault.initializeProgressive("pw", {
      onProgress: (loaded, total) => progress.push({ loaded, total }),
    });

    expect(progress).toEqual([
      { loaded: 1, total: 3 },
      { loaded: 2, total: 3 },
      { loaded: 3, total: 3 },
    ]);
  });

  it("should sort items after all bands are loaded", async () => {
    const storage = createMockStorage([
      [makeItem({ uuid: "z", title: "Zebra" })],
      [makeItem({ uuid: "a", title: "Apple" })],
    ]);
    const vault = new Vault(storage);

    await vault.initializeProgressive("pw");

    const items = vault.getAllItems();
    expect(items[0].title).toBe("Apple");
    expect(items[1].title).toBe("Zebra");
  });

  it("should make items available via getAllItems and getFavoriteItems", async () => {
    const fav = makeItem({ uuid: "fav", title: "Fav", fave: 1 });
    const normal = makeItem({ uuid: "normal", title: "Normal" });
    const storage = createMockStorage([[fav, normal]]);
    const vault = new Vault(storage);

    await vault.initializeProgressive("pw");

    expect(vault.getAllItems()).toHaveLength(2);
    expect(vault.getFavoriteItems()).toHaveLength(1);
    expect(vault.getFavoriteItems()[0].uuid).toBe("fav");
  });

  it("should fall back to initialize() if storage lacks progressive methods", async () => {
    const items = [makeItem({ uuid: "a", title: "A" })];
    const storage: IVaultStorage = {
      unlock: jest.fn().mockResolvedValue(undefined),
      isUnlocked: true,
      loadItems: jest.fn().mockResolvedValue(items),
      getItemDetails: jest.fn(),
      lock: jest.fn(),
      // No unlockKeysOnly or loadItemsProgressively
    };
    const vault = new Vault(storage);

    let navReady = false;
    await vault.initializeProgressive("pw", {
      onReadyToNavigate: () => {
        navReady = true;
      },
    });

    expect(storage.unlock).toHaveBeenCalledWith("pw", undefined);
    expect(storage.loadItems).toHaveBeenCalled();
    expect(navReady).toBe(true);
    expect(vault.getAllItems()).toHaveLength(1);
  });

  it("should throw VaultStorageError if created with direct items array", async () => {
    const vault = new Vault([makeItem()]);

    await expect(vault.initializeProgressive("pw")).rejects.toThrow(
      VaultStorageError,
    );
  });
});

// ── Storage-mode state management tests ──────────────────────────────

describe("Vault storage-mode operations", () => {
  const makeItem = (overrides: Partial<Item> = {}): Item => ({
    ...anItem().build(),
    ...overrides,
  });

  function createMockStorage(items: Item[] = [makeItem()]): IVaultStorage & {
    unlockKeysOnly: jest.Mock;
    loadItemsProgressively: jest.Mock;
    getAttachments: jest.Mock;
    getAttachmentContent: jest.Mock;
  } {
    return {
      unlock: jest.fn().mockResolvedValue(undefined),
      isUnlocked: true,
      loadItems: jest.fn().mockResolvedValue(items),
      getItemDetails: jest.fn().mockResolvedValue({ fields: [] }),
      lock: jest.fn(),
      unlockKeysOnly: jest.fn().mockResolvedValue(undefined),
      loadItemsProgressively: jest.fn(
        async (
          onBatch: (items: Item[]) => void,
          onProgress?: (loaded: number, total: number) => void,
        ) => {
          onBatch(items);
          onProgress?.(1, 1);
        },
      ),
      getAttachments: jest.fn().mockResolvedValue([]),
      getAttachmentContent: jest
        .fn()
        .mockResolvedValue(new Uint8Array([1, 2, 3])),
    };
  }

  describe("loadingProgress getter", () => {
    it("should return progress during progressive loading", async () => {
      const captured: (import("@/lib/vault/types").LoadingProgress | null)[] =
        [];
      const storage = createMockStorage();
      storage.loadItemsProgressively.mockImplementation(
        async (
          onBatch: (items: Item[]) => void,
          onProgress?: (loaded: number, total: number) => void,
        ) => {
          onBatch([makeItem()]);
          onProgress?.(1, 3);
          captured.push(vault.loadingProgress);
        },
      );
      const vault = new Vault(storage);

      await vault.initializeProgressive("pw");

      expect(captured[0]).toEqual({ loaded: 1, total: 3 });
      expect(vault.loadingProgress).toBeNull(); // Cleared after loading
    });
  });

  describe("off() event unsubscription", () => {
    it("should remove handler so it is not called on emit", async () => {
      const storage = createMockStorage();
      const vault = new Vault(storage);
      await vault.initializeProgressive("pw");

      let callCount = 0;
      const handler = () => {
        callCount++;
      };

      vault.on("items-changed", handler);
      vault.off("items-changed", handler);

      // Trigger another progressive load to emit items-changed
      storage.loadItemsProgressively.mockImplementation(
        async (onBatch: (items: Item[]) => void) => {
          onBatch([makeItem({ uuid: "new" })]);
        },
      );
      await vault.initializeProgressive("pw");

      // handler should not have been called after off()
      // (it may have been called during first init, but not after off)
      expect(callCount).toBe(0);
    });
  });

  describe("lock()", () => {
    it("should call storage.lock() and clear items", async () => {
      const storage = createMockStorage();
      const vault = new Vault(storage);
      await vault.initialize("pw");

      vault.lock();

      expect(storage.lock).toHaveBeenCalled();
      expect(() => vault.getAllItems()).toThrow(VaultStorageError);
    });

    it("should reset syncManager", async () => {
      const storage = createMockStorage();
      const vault = new Vault(storage);
      await vault.initialize("pw");

      const mockSyncManager = { sync: jest.fn(), reset: jest.fn() };
      vault.setSyncManager(mockSyncManager as any);

      vault.lock();

      expect(mockSyncManager.reset).toHaveBeenCalled();
    });

    it("should clear all event listeners", async () => {
      const storage = createMockStorage();
      const vault = new Vault(storage);
      await vault.initializeProgressive("pw");

      let called = false;
      vault.on("loading-complete", () => {
        called = true;
      });

      vault.lock();

      // Re-initialize — the old handler should not fire
      await vault.initializeProgressive("pw");
      expect(called).toBe(false);
    });

    it("should reset isLoading and loadingProgress", async () => {
      const storage = createMockStorage();
      const vault = new Vault(storage);
      await vault.initializeProgressive("pw");

      vault.lock();

      expect(vault.isLoading).toBe(false);
      expect(vault.loadingProgress).toBeNull();
    });
  });

  describe("ensureItemsLoaded (via getAllItems)", () => {
    it("should throw VaultStorageError when vault not initialized", () => {
      const storage = createMockStorage();
      const vault = new Vault(storage);
      // Don't call initialize

      expect(() => vault.getAllItems()).toThrow(VaultStorageError);
      expect(() => vault.getAllItems()).toThrow("Vault not initialized");
    });
  });

  describe("initialize() on legacy mode", () => {
    it("should throw VaultStorageError when created with items array", async () => {
      const vault = new Vault([makeItem()]);

      await expect(vault.initialize("pw")).rejects.toThrow(VaultStorageError);
      await expect(vault.initialize("pw")).rejects.toThrow("Cannot initialize");
    });
  });

  describe("getAttachments delegation", () => {
    it("should delegate to storage.getAttachments", async () => {
      const storage = createMockStorage();
      const vault = new Vault(storage);
      await vault.initialize("pw");

      const mockAttachments = [
        { uuid: "att1", filename: "file.pdf", size: 100 },
      ];
      storage.getAttachments.mockResolvedValue(mockAttachments);

      const result = await vault.getAttachments("item-1");
      expect(result).toBe(mockAttachments);
      expect(storage.getAttachments).toHaveBeenCalledWith("item-1");
    });

    it("should return empty array when storage has no getAttachments", async () => {
      const storage: IVaultStorage = {
        unlock: jest.fn().mockResolvedValue(undefined),
        isUnlocked: true,
        loadItems: jest.fn().mockResolvedValue([makeItem()]),
        getItemDetails: jest.fn(),
        lock: jest.fn(),
      };
      const vault = new Vault(storage);
      await vault.initialize("pw");

      const result = await vault.getAttachments("item-1");
      expect(result).toEqual([]);
    });
  });

  describe("getAttachmentContent delegation", () => {
    it("should delegate to storage.getAttachmentContent", async () => {
      const storage = createMockStorage();
      const vault = new Vault(storage);
      await vault.initialize("pw");

      await vault.getAttachmentContent("item-1", "att-1");
      expect(storage.getAttachmentContent).toHaveBeenCalledWith(
        "item-1",
        "att-1",
      );
    });

    it("should throw when storage has no getAttachmentContent", async () => {
      const storage: IVaultStorage = {
        unlock: jest.fn().mockResolvedValue(undefined),
        isUnlocked: true,
        loadItems: jest.fn().mockResolvedValue([makeItem()]),
        getItemDetails: jest.fn(),
        lock: jest.fn(),
      };
      const vault = new Vault(storage);
      await vault.initialize("pw");

      await expect(
        vault.getAttachmentContent("item-1", "att-1"),
      ).rejects.toThrow("not supported");
    });
  });

  describe("clearKeys()", () => {
    it("should call storage.clearKeysOnly() when available", async () => {
      const storage = createMockStorage();
      const clearKeysOnly = jest.fn();
      (storage as any).clearKeysOnly = clearKeysOnly;
      const vault = new Vault(storage);
      await vault.initialize("pw");

      vault.clearKeys();

      expect(clearKeysOnly).toHaveBeenCalled();
      expect(storage.lock).not.toHaveBeenCalled();
    });

    it("should fall back to storage.lock() when clearKeysOnly is not available", async () => {
      const storage: IVaultStorage = {
        unlock: jest.fn().mockResolvedValue(undefined),
        isUnlocked: true,
        loadItems: jest.fn().mockResolvedValue([makeItem()]),
        getItemDetails: jest.fn(),
        lock: jest.fn(),
      };
      const vault = new Vault(storage);
      await vault.initialize("pw");

      vault.clearKeys();

      expect(storage.lock).toHaveBeenCalled();
    });

    it("should preserve items in memory", async () => {
      const items = [makeItem({ uuid: "a", title: "A" })];
      const storage = createMockStorage(items);
      (storage as any).clearKeysOnly = jest.fn();
      const vault = new Vault(storage);
      await vault.initialize("pw");

      vault.clearKeys();

      expect(vault.getAllItems()).toHaveLength(1);
      expect(vault.getAllItems()[0].uuid).toBe("a");
    });

    it("should preserve event listeners", async () => {
      const storage = createMockStorage();
      (storage as any).clearKeysOnly = jest.fn();
      const vault = new Vault(storage);
      await vault.initializeProgressive("pw");

      let called = false;
      vault.on("loading-complete", () => {
        called = true;
      });

      vault.clearKeys();

      // Re-initialize — the listener should still fire
      await vault.initializeProgressive("pw");
      expect(called).toBe(true);
    });

    it("should reset syncManager", async () => {
      const storage = createMockStorage();
      (storage as any).clearKeysOnly = jest.fn();
      const vault = new Vault(storage);
      await vault.initialize("pw");

      const mockSyncManager = { sync: jest.fn(), reset: jest.fn() };
      vault.setSyncManager(mockSyncManager as any);

      vault.clearKeys();

      expect(mockSyncManager.reset).toHaveBeenCalled();
    });
  });

  describe("reUnlock()", () => {
    it("should call storage.unlockKeysOnly() with password", async () => {
      const storage = createMockStorage();
      const vault = new Vault(storage);
      await vault.initialize("pw");

      await vault.reUnlock("new-pw");

      expect(storage.unlockKeysOnly).toHaveBeenCalledWith("new-pw");
    });

    it("should fall back to storage.unlock() when unlockKeysOnly is not available", async () => {
      const storage: IVaultStorage = {
        unlock: jest.fn().mockResolvedValue(undefined),
        isUnlocked: true,
        loadItems: jest.fn().mockResolvedValue([makeItem()]),
        getItemDetails: jest.fn(),
        lock: jest.fn(),
      };
      const vault = new Vault(storage);
      await vault.initialize("pw");

      await vault.reUnlock("new-pw");

      expect(storage.unlock).toHaveBeenCalledWith("new-pw");
    });

    it("should throw VaultStorageError in legacy mode", async () => {
      const vault = new Vault([makeItem()]);

      await expect(vault.reUnlock("pw")).rejects.toThrow(VaultStorageError);
      await expect(vault.reUnlock("pw")).rejects.toThrow("Cannot re-unlock");
    });

    it("should keep items accessible after clearKeys + reUnlock cycle", async () => {
      const items = [
        makeItem({ uuid: "x", title: "X" }),
        makeItem({ uuid: "y", title: "Y" }),
      ];
      const storage = createMockStorage(items);
      (storage as any).clearKeysOnly = jest.fn();
      const vault = new Vault(storage);
      await vault.initialize("pw");

      vault.clearKeys();
      await vault.reUnlock("pw");

      expect(vault.getAllItems()).toHaveLength(2);
      expect(vault.getAllItems()[0].title).toBe("X");
    });
  });

  describe("initialize() success path", () => {
    it("should call storage.unlock() and storage.loadItems()", async () => {
      const storage = createMockStorage();
      const vault = new Vault(storage);

      await vault.initialize("pw");

      expect(storage.unlock).toHaveBeenCalledWith("pw", undefined);
      expect(storage.loadItems).toHaveBeenCalled();
    });

    it("should forward onProgress to storage.unlock()", async () => {
      const storage = createMockStorage();
      const vault = new Vault(storage);
      const onProgress = jest.fn();

      await vault.initialize("pw", onProgress);

      expect(storage.unlock).toHaveBeenCalledWith("pw", onProgress);
    });

    it("should make items available sorted by title", async () => {
      const items = [
        makeItem({ uuid: "z", title: "Zebra" }),
        makeItem({ uuid: "a", title: "Apple" }),
      ];
      const storage = createMockStorage(items);
      const vault = new Vault(storage);

      await vault.initialize("pw");

      const result = vault.getAllItems();
      expect(result).toHaveLength(2);
      expect(result[0].title).toBe("Apple");
      expect(result[1].title).toBe("Zebra");
    });
  });

  describe("getItemDetails() delegation", () => {
    it("should delegate to storage.getItemDetails() with correct itemId", async () => {
      const storage = createMockStorage();
      const mockDetails = { fields: [{ name: "password", value: "secret" }] };
      (storage.getItemDetails as jest.Mock).mockResolvedValue(mockDetails);
      const vault = new Vault(storage);
      await vault.initialize("pw");

      const result = await vault.getItemDetails("item-42");

      expect(storage.getItemDetails).toHaveBeenCalledWith("item-42");
      expect(result).toBe(mockDetails);
    });

    it("should throw VaultStorageError in legacy mode", async () => {
      const vault = new Vault([makeItem()]);

      await expect(vault.getItemDetails("any")).rejects.toThrow(
        VaultStorageError,
      );
    });
  });

  describe("isUnlocked getter", () => {
    it("should return storage.isUnlocked in storage mode", () => {
      const storage = createMockStorage();
      const vault = new Vault(storage);

      expect(vault.isUnlocked).toBe(true);

      // Mutate the mock to return false
      (storage as any).isUnlocked = false;
      expect(vault.isUnlocked).toBe(false);
    });

    it("should return true in legacy mode with items", () => {
      const vault = new Vault([makeItem()]);

      expect(vault.isUnlocked).toBe(true);
    });

    it("should return false for uninitialized storage-mode vault", () => {
      const storage = createMockStorage();
      (storage as any).isUnlocked = false;
      const vault = new Vault(storage);

      expect(vault.isUnlocked).toBe(false);
    });
  });

  describe("requestSync()", () => {
    it("should return { changed: false } when vault is still loading", async () => {
      let syncResult: import("@/lib/vault/types").SyncResult | undefined;

      const storage = createMockStorage();
      // During loadItemsProgressively, call requestSync while _isLoading is true
      storage.loadItemsProgressively.mockImplementation(
        async (onBatch: (items: Item[]) => void) => {
          // At this point _isLoading is true (set before this call)
          syncResult = await vault.requestSync({} as any, "uri");
          onBatch([makeItem()]);
        },
      );
      const vault = new Vault(storage);

      const mockSyncManager = { sync: jest.fn(), reset: jest.fn() };
      vault.setSyncManager(mockSyncManager as any);

      await vault.initializeProgressive("pw");

      expect(syncResult).toEqual({ changed: false });
      expect(mockSyncManager.sync).not.toHaveBeenCalled();
    });

    it("should throw VaultStorageError when no syncManager is set", async () => {
      const storage = createMockStorage();
      const vault = new Vault(storage);
      await vault.initialize("pw");

      await expect(vault.requestSync({} as any, "uri")).rejects.toThrow(
        VaultStorageError,
      );
      await expect(vault.requestSync({} as any, "uri")).rejects.toThrow(
        "Sync not available",
      );
    });

    it("should throw VaultStorageError in legacy mode", async () => {
      const vault = new Vault([makeItem()]);

      await expect(vault.requestSync({} as any, "uri")).rejects.toThrow(
        VaultStorageError,
      );
    });

    it("should emit sync-started and sync-complete events", async () => {
      const storage = createMockStorage();
      const vault = new Vault(storage);
      await vault.initialize("pw");

      const syncResult: import("@/lib/vault/types").SyncResult = {
        changed: true,
        newItemCount: 2,
      };
      const mockSyncManager = {
        sync: jest.fn().mockResolvedValue(syncResult),
        reset: jest.fn(),
      };
      vault.setSyncManager(mockSyncManager as any);

      const events: string[] = [];
      vault.on("sync-started", () => events.push("started"));
      vault.on("sync-complete", () => events.push("complete"));

      await vault.requestSync({} as any, "uri");

      expect(events).toEqual(["started", "complete"]);
    });

    it("should pass sync-complete event with SyncResult", async () => {
      const storage = createMockStorage();
      const vault = new Vault(storage);
      await vault.initialize("pw");

      const syncResult: import("@/lib/vault/types").SyncResult = {
        changed: true,
        newItemCount: 3,
      };
      const mockSyncManager = {
        sync: jest.fn().mockResolvedValue(syncResult),
        reset: jest.fn(),
      };
      vault.setSyncManager(mockSyncManager as any);

      let receivedResult: import("@/lib/vault/types").SyncResult | undefined;
      vault.on("sync-complete", (result) => {
        receivedResult = result;
      });

      await vault.requestSync({} as any, "uri");

      expect(receivedResult).toEqual(syncResult);
    });

    it("should delegate to syncManager.sync with correct arguments", async () => {
      const items = [makeItem({ uuid: "a" }), makeItem({ uuid: "b" })];
      const storage = createMockStorage(items);
      const vault = new Vault(storage);
      await vault.initialize("pw");

      const mockSyncManager = {
        sync: jest.fn().mockResolvedValue({ changed: false }),
        reset: jest.fn(),
      };
      vault.setSyncManager(mockSyncManager as any);

      const mockSource = {} as any;
      await vault.requestSync(mockSource, "/vault/path");

      expect(mockSyncManager.sync).toHaveBeenCalledWith(
        mockSource,
        "/vault/path",
        expect.any(Function),
        2, // currentItemCount
      );
    });

    it("should return the SyncResult from syncManager", async () => {
      const storage = createMockStorage();
      const vault = new Vault(storage);
      await vault.initialize("pw");

      const expected: import("@/lib/vault/types").SyncResult = {
        changed: true,
        newItemCount: 5,
      };
      const mockSyncManager = {
        sync: jest.fn().mockResolvedValue(expected),
        reset: jest.fn(),
      };
      vault.setSyncManager(mockSyncManager as any);

      const result = await vault.requestSync({} as any, "uri");

      expect(result).toEqual(expected);
    });

    it("should call reloadFromSource when available during sync callback", async () => {
      const storage = createMockStorage();
      const reloadFromSource = jest.fn().mockResolvedValue(undefined);
      (storage as any).reloadFromSource = reloadFromSource;
      const vault = new Vault(storage);
      await vault.initialize("pw");

      const mockSyncManager = {
        sync: jest.fn(async (_source, _uri, reloadItems) => {
          await reloadItems();
          return { changed: true };
        }),
        reset: jest.fn(),
      };
      vault.setSyncManager(mockSyncManager as any);

      await vault.requestSync({} as any, "uri");

      expect(reloadFromSource).toHaveBeenCalled();
      expect(storage.loadItems).toHaveBeenCalledTimes(2); // once in initialize, once in sync
    });

    it("should skip reloadFromSource when not available", async () => {
      const storage = createMockStorage();
      const vault = new Vault(storage);
      await vault.initialize("pw");

      const mockSyncManager = {
        sync: jest.fn(async (_source, _uri, reloadItems) => {
          await reloadItems();
          return { changed: true };
        }),
        reset: jest.fn(),
      };
      vault.setSyncManager(mockSyncManager as any);

      // Should not throw
      await vault.requestSync({} as any, "uri");

      expect(storage.loadItems).toHaveBeenCalledTimes(2);
    });

    it("should reload and sort items during sync callback", async () => {
      const initialItems = [makeItem({ uuid: "a", title: "Alpha" })];
      const storage = createMockStorage(initialItems);
      const vault = new Vault(storage);
      await vault.initialize("pw");

      const newItems = [
        makeItem({ uuid: "z", title: "Zebra" }),
        makeItem({ uuid: "b", title: "Beta" }),
      ];
      (storage.loadItems as jest.Mock).mockResolvedValue(newItems);

      const mockSyncManager = {
        sync: jest.fn(async (_source, _uri, reloadItems) => {
          await reloadItems();
          return { changed: true };
        }),
        reset: jest.fn(),
      };
      vault.setSyncManager(mockSyncManager as any);

      await vault.requestSync({} as any, "uri");

      const items = vault.getAllItems();
      expect(items).toHaveLength(2);
      expect(items[0].title).toBe("Beta");
      expect(items[1].title).toBe("Zebra");
    });

    it("should emit items-changed during sync callback", async () => {
      const storage = createMockStorage();
      const vault = new Vault(storage);
      await vault.initialize("pw");

      const mockSyncManager = {
        sync: jest.fn(async (_source, _uri, reloadItems) => {
          await reloadItems();
          return { changed: true };
        }),
        reset: jest.fn(),
      };
      vault.setSyncManager(mockSyncManager as any);

      let itemsChangedFired = false;
      vault.on("items-changed", () => {
        itemsChangedFired = true;
      });

      await vault.requestSync({} as any, "uri");

      expect(itemsChangedFired).toBe(true);
    });
  });
});
