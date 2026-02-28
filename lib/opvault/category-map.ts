import { Category } from "@/lib/vault/categories";

/** Map OPVault three-digit codes → Category enum values */
const OPVAULT_CODE_MAP: Record<string, Category> = {
  "001": Category.Login,
  "002": Category.CreditCard,
  "003": Category.SecureNote,
  "004": Category.Identity,
  "005": Category.Password,
  "100": Category.SoftwareLicense,
  "101": Category.BankAccount,
  "102": Category.Database,
  "103": Category.DriverLicense,
  "104": Category.OutdoorLicense,
  "105": Category.Membership,
  "106": Category.Passport,
  "107": Category.Rewards,
  "108": Category.SSN,
  "109": Category.Router,
  "110": Category.Server,
  "111": Category.Email,
};

/** Codes that represent non-displayable items (silently skipped during loading) */
const SKIP_CODES = new Set(["099"]); // 099 = Tombstone (deleted item)

/**
 * Convert an OPVault three-digit category code to the Category enum.
 * Returns null for tombstone/deleted items (code 099) — callers should skip these.
 * @throws Error if the code is not a recognized OPVault category
 */
export function opvaultCodeToCategory(code: string): Category | null {
  if (SKIP_CODES.has(code)) return null;
  const cat = OPVAULT_CODE_MAP[code];
  if (cat === undefined) {
    throw new Error(`Unknown OPVault category code: ${code}`);
  }
  return cat;
}
