import { isItemFavorite } from "@/lib/vault/item-display";
import type { Item } from "@/lib/vault/types";

export enum SortField {
  Title = "title",
  Subtitle = "subtitle",
  Category = "category",
  Fav = "fav",
}

export enum SortOrder {
  Asc = 1,
  Desc = -1,
}

export interface SortOptions {
  field: SortField;
  order: SortOrder;
}

enum SearchField {
  Title = "title",
  Subtitle = "subtitle",
  Category = "category",
  Tags = "tags",
}

enum MatchMode {
  Contains,
  Exact,
}

type StringSortField =
  | SortField.Title
  | SortField.Subtitle
  | SortField.Category;

interface SearchOptions {
  fields: readonly SearchField[];
  matchMode: MatchMode;
}

const ALL_SEARCH_FIELDS: readonly SearchField[] = [
  SearchField.Title,
  SearchField.Subtitle,
  SearchField.Category,
  SearchField.Tags,
] as const;

/**
 * Filter and sort items using search matching
 * @param items Items to filter and sort
 * @param query Optional search query string
 * @param sortOptions Optional sorting configuration
 * @returns Filtered and sorted items array
 */
export function searchAndSort(
  items: Item[],
  query: string | undefined,
  sortOptions?: SortOptions,
): Item[] {
  const trimmed = query?.trim();
  if (!trimmed) {
    return sortItems(items, sortOptions);
  }

  const filtered = items.filter((item) =>
    matchesSearch(item, trimmed, {
      fields: ALL_SEARCH_FIELDS,
      matchMode: MatchMode.Contains,
    }),
  );
  return sortItems(filtered, sortOptions);
}

/**
 * Filter items by exact match on a specific field
 * Used for category and tag filtering before general search
 */
export function filterByField(
  items: Item[],
  value: string,
  field: "category" | "tags",
): Item[] {
  const options: SearchOptions =
    field === "category"
      ? { fields: [SearchField.Category], matchMode: MatchMode.Exact }
      : { fields: [SearchField.Tags], matchMode: MatchMode.Exact };

  return items.filter((item) => matchesSearch(item, value, options));
}

/**
 * Sort items by field and order
 * @param items Items to sort
 * @param options Optional sorting configuration - if undefined, returns items as-is
 */
export function sortItems(items: Item[], options?: SortOptions): Item[] {
  if (!options) {
    return items;
  }

  const { field, order } = options;

  return [...items].sort((a, b) => {
    const comparison = compareItems(a, b, field);
    return comparison * order;
  });
}

// --- Private helpers ---

function isStringSortField(field: SortField): field is StringSortField {
  return field !== SortField.Fav;
}

function getFieldValues(item: Item, field: SearchField): string[] {
  if (field === SearchField.Tags) {
    return item.tags ?? [];
  }
  return [item[field]];
}

function matchesSearch(
  item: Item,
  query: string,
  options: SearchOptions,
): boolean {
  const { fields, matchMode } = options;
  const searchText = query.toLowerCase().trim();

  const isMatch =
    matchMode === MatchMode.Exact
      ? (value: string) => value === searchText
      : (value: string) => value.includes(searchText);

  return fields.some((field) =>
    getFieldValues(item, field).some((value) => isMatch(value.toLowerCase())),
  );
}

function compareItems(a: Item, b: Item, field: SortField): number {
  if (!isStringSortField(field)) {
    const aIsFav = isItemFavorite(a);
    const bIsFav = isItemFavorite(b);
    return Number(aIsFav) - Number(bIsFav);
  }

  const aValue = a[field];
  const bValue = b[field];

  return aValue.localeCompare(bValue, undefined, { sensitivity: "base" });
}
