/**
 * Category enum and metadata
 *
 * Defines vault-layer categories as a string enum, decoupled from OPVault's
 * three-digit codes.
 */

export enum Category {
  AllItems = "AllItems",
  Login = "Login",
  CreditCard = "CreditCard",
  SecureNote = "SecureNote",
  Identity = "Identity",
  Password = "Password",
  SoftwareLicense = "SoftwareLicense",
  BankAccount = "BankAccount",
  Database = "Database",
  DriverLicense = "DriverLicense",
  OutdoorLicense = "OutdoorLicense",
  Membership = "Membership",
  Passport = "Passport",
  Rewards = "Rewards",
  SSN = "SSN",
  Router = "Router",
  Server = "Server",
  Email = "Email",
  Archive = "Archive",
}

export interface CategoryInfo {
  code: Category;
  name: string;
  icon: string;
}

export const categories: CategoryInfo[] = [
  { code: Category.AllItems, name: "All Items", icon: "📦" },
  { code: Category.Login, name: "Login", icon: "🔐" },
  { code: Category.CreditCard, name: "Credit Card", icon: "💳" },
  { code: Category.SecureNote, name: "Secure Note", icon: "📝" },
  { code: Category.Identity, name: "Identity", icon: "👤" },
  { code: Category.Password, name: "Password", icon: "🔑" },
  { code: Category.SoftwareLicense, name: "Software License", icon: "💿" },
  { code: Category.BankAccount, name: "Bank Account", icon: "🏦" },
  { code: Category.Database, name: "Database", icon: "🗄️" },
  { code: Category.DriverLicense, name: "Driver License", icon: "🪪" },
  { code: Category.OutdoorLicense, name: "Outdoor License", icon: "🎣" },
  { code: Category.Membership, name: "Membership", icon: "🎫" },
  { code: Category.Passport, name: "Passport", icon: "🛂" },
  { code: Category.Rewards, name: "Rewards", icon: "🎁" },
  { code: Category.SSN, name: "SSN", icon: "🔢" },
  { code: Category.Router, name: "Router", icon: "📡" },
  { code: Category.Server, name: "Server", icon: "🖥️" },
  { code: Category.Email, name: "Email", icon: "📧" },
  { code: Category.Archive, name: "Archive", icon: "🗃️" },
];

/** Precomputed lookup for O(1) category access */
const categoryMap = new Map<Category, CategoryInfo>(
  categories.map((cat) => [cat.code, cat]),
);

/**
 * Get category icon from category.
 * Falls back to a default icon if category is unknown.
 */
export function getCategoryIcon(category: Category): string {
  return categoryMap.get(category)?.icon ?? "📦";
}

/**
 * Get category display name from category.
 * Falls back to "Unknown" if category is not found.
 */
export function getCategoryName(category: Category): string {
  return categoryMap.get(category)?.name ?? "Unknown";
}
