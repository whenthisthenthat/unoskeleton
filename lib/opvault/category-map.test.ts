import { opvaultCodeToCategory } from "@/lib/opvault/category-map";
import { Category } from "@/lib/vault/categories";

describe("opvaultCodeToCategory", () => {
  it("should map OPVault three-digit codes to Category enum", () => {
    expect(opvaultCodeToCategory("001")).toBe(Category.Login);
    expect(opvaultCodeToCategory("002")).toBe(Category.CreditCard);
    expect(opvaultCodeToCategory("003")).toBe(Category.SecureNote);
    expect(opvaultCodeToCategory("004")).toBe(Category.Identity);
    expect(opvaultCodeToCategory("005")).toBe(Category.Password);
    expect(opvaultCodeToCategory("100")).toBe(Category.SoftwareLicense);
    expect(opvaultCodeToCategory("101")).toBe(Category.BankAccount);
    expect(opvaultCodeToCategory("111")).toBe(Category.Email);
  });

  it("should return null for tombstone items (099)", () => {
    expect(opvaultCodeToCategory("099")).toBeNull();
  });

  it("should throw for unknown OPVault codes", () => {
    expect(() => opvaultCodeToCategory("000")).toThrow(
      "Unknown OPVault category code: 000",
    );
    expect(() => opvaultCodeToCategory("999")).toThrow(
      "Unknown OPVault category code: 999",
    );
  });
});
