import { Category } from "@/lib/vault/categories";
import {
  extractSubtitle,
  extractTags,
  isItemFavorite,
} from "@/lib/vault/item-display";

describe("item-display", () => {
  describe("extractSubtitle", () => {
    it("should extract URL for LOGIN when no ainfo (001)", () => {
      const overview = {
        title: "Test Login",
        URLs: [{ u: "https://example.com" }],
      };

      expect(extractSubtitle(overview, Category.Login)).toBe(
        "https://example.com",
      );
    });

    it("should extract ainfo for LOGIN first (before URL)", () => {
      const overview = {
        title: "Test Login",
        ainfo: "username@example.com",
        URLs: [{ u: "https://example.com" }],
      };

      expect(extractSubtitle(overview, Category.Login)).toBe(
        "username@example.com",
      );
    });

    it("should extract credit card number for CREDIT_CARD (002)", () => {
      const overview = {
        title: "My Card",
        ccnum: "4111111111111111",
      };

      expect(extractSubtitle(overview, Category.CreditCard)).toBe(
        "4111111111111111",
      );
    });

    it("should return ainfo even for SECURE_NOTE if present (003)", () => {
      const overview = {
        title: "My Note",
        ainfo: "Some info",
      };

      expect(extractSubtitle(overview, Category.SecureNote)).toBe("Some info");
    });

    it("should return empty for SECURE_NOTE when no ainfo (003)", () => {
      const overview = {
        title: "My Note",
      };

      expect(extractSubtitle(overview, Category.SecureNote)).toBe("");
    });

    it("should extract full name for IDENTITY (004)", () => {
      const overview = {
        title: "Identity",
        firstName: "John",
        lastName: "Doe",
      };

      expect(extractSubtitle(overview, Category.Identity)).toBe("John Doe");
    });

    it("should handle firstName only for IDENTITY", () => {
      const overview = {
        title: "Identity",
        firstName: "John",
      };

      expect(extractSubtitle(overview, Category.Identity)).toBe("John");
    });

    it("should extract bank name for BANK_ACCOUNT (101)", () => {
      const overview = {
        title: "Bank",
        bankName: "Test Bank",
        accountNo: "12345",
      };

      expect(extractSubtitle(overview, Category.BankAccount)).toBe("Test Bank");
    });

    it("should extract account number when no bank name (101)", () => {
      const overview = {
        title: "Bank",
        accountNo: "12345",
      };

      expect(extractSubtitle(overview, Category.BankAccount)).toBe("12345");
    });

    it("should extract email username for EMAIL_ACCOUNT (111)", () => {
      const overview = {
        title: "Email",
        pop_username: "user@example.com",
      };

      expect(extractSubtitle(overview, Category.Email)).toBe(
        "user@example.com",
      );
    });

    it("should fall back to ainfo for unknown categories", () => {
      const overview = {
        title: "Unknown",
        ainfo: "Additional info",
      };

      expect(extractSubtitle(overview, Category.Archive)).toBe(
        "Additional info",
      );
    });

    it("should return empty string when no subtitle fields present", () => {
      const overview = {
        title: "Empty",
      };

      expect(extractSubtitle(overview, Category.Login)).toBe("");
    });
  });

  describe("extractTags", () => {
    it("should extract tags from array of strings", () => {
      const overview = {
        title: "Test",
        tags: ["work", "important"],
      };

      const tags = extractTags(overview);
      expect(tags).toEqual(["work", "important"]);
    });

    it("should extract tags from comma-separated string", () => {
      const overview = {
        title: "Test",
        tags: "work,important,personal",
      };

      const tags = extractTags(overview);
      expect(tags).toEqual(["work", "important", "personal"]);
    });

    it("should extract tags from array of objects", () => {
      const overview = {
        title: "Test",
        tags: [{ name: "work" }, { name: "important" }],
      };

      const tags = extractTags(overview);
      expect(tags).toEqual(["work", "important"]);
    });

    it("should preserve case (no normalization for arrays)", () => {
      const overview = {
        title: "Test",
        tags: ["Work", "IMPORTANT"],
      };

      const tags = extractTags(overview);
      expect(tags).toEqual(["Work", "IMPORTANT"]);
    });

    it("should trim whitespace from comma-separated string", () => {
      const overview = {
        title: "Test",
        tags: " work , important ",
      };

      const tags = extractTags(overview);
      expect(tags).toEqual(["work", "important"]);
    });

    it("should return empty array when no tags", () => {
      const overview = {
        title: "Test",
      };

      const tags = extractTags(overview);
      expect(tags).toEqual([]);
    });

    it("should handle empty tags array", () => {
      const overview = {
        title: "Test",
        tags: [],
      };

      const tags = extractTags(overview);
      expect(tags).toEqual([]);
    });

    it("should filter out empty string tags", () => {
      const overview = {
        title: "Test",
        tags: ["work", "", "important"],
      };

      const tags = extractTags(overview);
      expect(tags).toEqual(["work", "important"]);
    });
  });

  describe("isItemFavorite", () => {
    it("should return true when fave is set", () => {
      const item = {
        uuid: "1",
        title: "Test",
        subtitle: "",
        icon: "🔑",
        category: Category.Login,
        tags: [],
        fave: 1,
        created: new Date(),
        updated: new Date(),
        tx: 123,
        overview: { title: "Test" },
        attachmentCount: 0,
      };

      expect(isItemFavorite(item)).toBe(true);
    });

    it("should return false when fave is undefined", () => {
      const item = {
        uuid: "1",
        title: "Test",
        subtitle: "",
        icon: "🔑",
        category: Category.Login,
        tags: [],
        created: new Date(),
        updated: new Date(),
        tx: 123,
        overview: { title: "Test" },
        attachmentCount: 0,
      };

      expect(isItemFavorite(item)).toBe(false);
    });

    it("should return false when fave is 0", () => {
      const item = {
        uuid: "1",
        title: "Test",
        subtitle: "",
        icon: "🔑",
        category: Category.Login,
        tags: [],
        fave: 0,
        created: new Date(),
        updated: new Date(),
        tx: 123,
        overview: { title: "Test" },
        attachmentCount: 0,
      };

      expect(isItemFavorite(item)).toBe(false);
    });
  });
});
