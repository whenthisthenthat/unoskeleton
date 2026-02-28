import { Category, getCategoryIcon } from "@/lib/vault/categories";
import type {
  Item,
  ItemOverview,
  StorageItem,
  WebsiteUrl,
} from "@/lib/vault/types";

/**
 * Item Utility Functions
 *
 * Pure functions for extracting and computing display data from items.
 * These utilities can be used to recompute display fields when needed.
 */

/**
 * Extract website URLs from overview.URLs entries.
 *
 * OPVault stores URLs as an array of `{u: string, l?: string}` objects
 * under `overview.URLs`. This function validates and normalizes them.
 */
export function extractWebsiteUrls(overview: ItemOverview): WebsiteUrl[] {
  if (!overview.URLs) return [];
  return overview.URLs.filter((entry) => entry.u.length > 0).map((entry) => ({
    url: entry.u,
    label: entry.l,
  }));
}

// --- Subtitle strategy pattern ---

type SubtitleExtractor = (overview: ItemOverview) => string;

const subtitleExtractors: Partial<Record<Category, SubtitleExtractor>> = {
  [Category.Login]: (overview) => {
    const urls = extractWebsiteUrls(overview);
    return urls.length > 0 ? urls[0].url : "";
  },
  [Category.CreditCard]: (overview) => overview.ccnum ?? "",
  [Category.SecureNote]: () => "",
  [Category.Identity]: (overview) =>
    [overview.firstName, overview.lastName].filter(Boolean).join(" "),
  [Category.BankAccount]: (overview) =>
    overview.bankName ?? overview.accountNo ?? "",
  [Category.Email]: (overview) => overview.pop_username ?? "",
};

/**
 * Extract subtitle from overview based on category.
 *
 * Checks the common `ainfo` field first, then delegates to
 * category-specific extractors via the strategy map.
 */
export function extractSubtitle(
  overview: ItemOverview,
  category: Category,
): string {
  if (overview.ainfo) return overview.ainfo;
  return subtitleExtractors[category]?.(overview) ?? "";
}

/**
 * Extract tags from overview
 *
 * Tags can be stored in different formats:
 * - Array of strings: ["work", "personal"]
 * - Comma-separated string: "work,personal"
 * - Array of objects with 'name' field: [{name: "work"}, {name: "personal"}]
 *
 * @param overview Decrypted item overview
 * @returns Array of tag strings (empty array if no tags)
 */
export function extractTags(overview: ItemOverview): string[] {
  if (!overview.tags) {
    return [];
  }

  if (Array.isArray(overview.tags)) {
    return overview.tags
      .map((tag) => {
        if (typeof tag === "string") {
          return tag;
        }
        if (typeof tag === "object" && tag !== null && "name" in tag) {
          return String(tag.name);
        }
        return "";
      })
      .filter((tag) => tag.length > 0);
  }

  if (typeof overview.tags === "string") {
    return overview.tags
      .split(",")
      .map((tag) => tag.trim())
      .filter((tag) => tag.length > 0);
  }

  return [];
}

/**
 * Enrich a storage item with computed display fields (subtitle, icon, tags).
 * This is the single place where display fields are computed from raw data.
 */
export function enrichItem(storageItem: StorageItem): Item {
  return {
    ...storageItem,
    subtitle: extractSubtitle(storageItem.overview, storageItem.category),
    icon: getCategoryIcon(storageItem.category),
    tags: extractTags(storageItem.overview),
  };
}

/**
 * Check if an item is marked as favorite
 *
 * @param item Item to check
 * @returns true if item is favorite, false otherwise
 */
export function isItemFavorite(item: Item): boolean {
  return item.fave !== undefined && item.fave > 0;
}
