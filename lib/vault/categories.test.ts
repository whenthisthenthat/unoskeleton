import {
  Category,
  categories,
  getCategoryIcon,
  getCategoryName,
} from "@/lib/vault/categories";

describe("categories", () => {
  describe("Category enum", () => {
    it("should have AllItems member", () => {
      expect(Category.AllItems).toBe("AllItems");
    });

    it("should have standard category members", () => {
      expect(Category.Login).toBe("Login");
      expect(Category.CreditCard).toBe("CreditCard");
      expect(Category.SecureNote).toBe("SecureNote");
      expect(Category.Identity).toBe("Identity");
    });

    it("should have Archive member", () => {
      expect(Category.Archive).toBe("Archive");
    });
  });

  describe("categories array", () => {
    it("should have code, name, and icon for each category", () => {
      categories.forEach((category) => {
        expect(category).toHaveProperty("code");
        expect(category).toHaveProperty("name");
        expect(category).toHaveProperty("icon");
      });
    });

    it("should have AllItems as first category", () => {
      expect(categories[0].code).toBe(Category.AllItems);
    });

    it("should have no duplicate codes", () => {
      const codes = categories.map((c) => c.code);
      const uniqueCodes = new Set(codes);
      expect(uniqueCodes.size).toBe(codes.length);
    });
  });

  describe("getCategoryIcon", () => {
    it("should return 📦 for unknown category", () => {
      expect(getCategoryIcon("unknown" as Category)).toBe("📦");
    });

    it("should handle all standard categories", () => {
      const standardCategories = [
        Category.Login,
        Category.CreditCard,
        Category.SecureNote,
        Category.Identity,
        Category.Password,
        Category.SoftwareLicense,
        Category.BankAccount,
        Category.Database,
        Category.DriverLicense,
        Category.OutdoorLicense,
        Category.Membership,
        Category.Passport,
        Category.Rewards,
        Category.SSN,
        Category.Router,
        Category.Server,
        Category.Email,
      ];

      standardCategories.forEach((cat) => {
        const icon = getCategoryIcon(cat);
        expect(icon).toBeTruthy();
        expect(typeof icon).toBe("string");
      });
    });
  });

  describe("getCategoryName", () => {
    it("should return Login for Category.Login", () => {
      expect(getCategoryName(Category.Login)).toBe("Login");
    });

    it("should return Credit Card for Category.CreditCard", () => {
      expect(getCategoryName(Category.CreditCard)).toBe("Credit Card");
    });

    it("should return Unknown for unrecognized category", () => {
      expect(getCategoryName("unknown" as Category)).toBe("Unknown");
    });
  });
});
