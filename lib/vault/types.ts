import type { Category } from "@/lib/vault/categories";

/** Band loading progress during progressive vault initialization */
export interface LoadingProgress {
  loaded: number;
  total: number;
}

/** Callback for band loading progress reporting */
export type ProgressCallback = (loaded: number, total: number) => void;

/** Result of a sync operation */
export interface SyncResult {
  /** Whether changes were detected and applied */
  changed: boolean;
  /** Number of new items (positive) or removed items (negative), if changed */
  newItemCount?: number;
}

/**
 * Decrypted item overview data.
 *
 * All known category-specific fields are typed as optional properties.
 * Fields present depend on the item's category:
 * - Login: URLs, ainfo (username)
 * - CreditCard: ccnum
 * - Identity: firstName, lastName
 * - BankAccount: bankName, accountNo
 * - Email: pop_username
 * - All categories: ainfo, tags, appIds
 */
export interface ItemOverview {
  title: string;
  // Common fields (any category)
  ainfo?: string;
  tags?: string[] | string | { name: string }[];
  appIds?: { name: string; id: string }[];
  // Login
  URLs?: { u: string; l?: string }[];
  // CreditCard
  ccnum?: string;
  // Identity
  firstName?: string;
  lastName?: string;
  // BankAccount
  bankName?: string;
  accountNo?: string;
  // Email
  pop_username?: string;
}

/** Extracted website URL from overview.URLs entries */
export interface WebsiteUrl {
  url: string;
  label?: string;
}

/**
 * Item as returned by storage backends (no computed display fields).
 *
 * Contains only decrypted, usable data from OPVault items.
 * Encrypted fields (k, o, d, hmac) are NOT included - they remain
 * internal to OPVaultClient implementation.
 */
export interface StorageItem {
  uuid: string;
  category: Category;
  created: Date; // Creation date
  updated: Date; // Last updated date
  tx: number; // Transaction timestamp (for sync)
  folder?: string; // Folder UUID (optional)
  fave?: number; // Favorite sort index (presence = favorite)
  trashed?: boolean; // Trash flag (optional)
  title: string; // Item title (from decrypted overview)
  overview: ItemOverview; // Full decrypted overview object
  attachmentCount: number; // Number of attachments (from filename index)
}

/** Full item with computed display fields (for UI consumption) */
export interface Item extends StorageItem {
  subtitle: string; // Category-specific subtitle
  icon: string; // Category emoji icon
  tags: string[]; // Extracted and normalized tags
}

// --- Item Detail Types (lazy-loaded encrypted data) ---

/**
 * Field type codes from OPVault detail fields array.
 * "T" = text, "P" = password, "E" = email, "U" = URL, "N" = number,
 * "TEL" = telephone, "I" = form input, "B" = button, "C" = checkbox
 */
export const DETAIL_FIELD_TYPES = [
  "T",
  "P",
  "E",
  "U",
  "N",
  "TEL",
  "I",
  "B",
  "C",
] as const;
export type DetailFieldType = (typeof DETAIL_FIELD_TYPES)[number];

/**
 * Section field kind codes from OPVault detail sections.
 * Determines display and interaction behavior.
 */
export const SECTION_FIELD_KINDS = [
  "string",
  "concealed",
  "URL",
  "email",
  "phone",
  "date",
  "monthYear",
  "address",
  "cctype",
  "menu",
  "gender",
] as const;
export type SectionFieldKind = (typeof SECTION_FIELD_KINDS)[number];

/** A top-level field from the details.fields array (e.g., username, password) */
export interface DetailField {
  designation?: string; // Semantic role: "username", "password", etc.
  name: string;
  type: DetailFieldType;
  value: string;
}

/** A field within a detail section */
export interface SectionField {
  k: SectionFieldKind; // Field kind (determines masking, linking, etc.)
  n: string; // Field UUID/identifier
  t: string; // Human-readable label
  v: unknown; // Value (string, number, or address object)
}

/** A section grouping within item details */
export interface DetailSection {
  name: string;
  title: string;
  fields?: SectionField[];
}

/** Parsed and validated item details from decrypted detail JSON */
export interface ItemDetails {
  fields: DetailField[];
  sections: DetailSection[];
  notesPlain: string;
}

/** Raw JSON from decrypted item details (before validation/parsing) */
export type RawItemDetails = Record<string, unknown>;

// --- Display-Ready Types (for UI layer) ---

/** A normalized, display-ready field for the UI */
export interface DisplayField {
  label: string;
  value: string;
  sensitive: boolean; // Whether to mask by default (passwords, concealed)
  kind:
    | "text"
    | "password"
    | "url"
    | "email"
    | "phone"
    | "date"
    | "note"
    | "totp";
}

/** A group of display fields, corresponding to a detail section */
export interface DisplaySection {
  title: string; // Empty string for the primary fields section
  fields: DisplayField[];
}

// --- Attachment Types (lazy-loaded from .attachment files) ---

/** Storage-agnostic attachment info for UI display */
export interface AttachmentInfo {
  uuid: string;
  filename: string; // Decrypted from attachment overview
  size: number; // contentsSize in bytes
  createdAt: Date;
  updatedAt: Date;
}
