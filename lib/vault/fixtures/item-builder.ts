import { Category } from "@/lib/vault/categories";
import type { Item, ItemOverview } from "@/lib/vault/types";

const DEFAULT_DATE = new Date(1609459200000); // 2021-01-01

export class ItemBuilder {
  private item: Item = {
    uuid: "1",
    title: "Test Item",
    subtitle: "",
    icon: "🔑",
    category: Category.Login,
    tags: [],
    created: DEFAULT_DATE,
    updated: DEFAULT_DATE,
    tx: DEFAULT_DATE.getTime(),
    overview: { title: "Test Item" },
    attachmentCount: 0,
  };

  withUuid(uuid: string) {
    this.item.uuid = uuid;
    return this;
  }

  withTitle(title: string) {
    this.item.title = title;
    this.item.overview = { title };
    return this;
  }

  withSubtitle(subtitle: string) {
    this.item.subtitle = subtitle;
    return this;
  }

  withIcon(icon: string) {
    this.item.icon = icon;
    return this;
  }

  withCategory(category: Category) {
    this.item.category = category;
    return this;
  }

  withTags(tags: string[]) {
    this.item.tags = tags;
    return this;
  }

  withFave(fave: number) {
    this.item.fave = fave;
    return this;
  }

  withTrashed(trashed: boolean) {
    this.item.trashed = trashed;
    return this;
  }

  withFolder(folder: string) {
    this.item.folder = folder;
    return this;
  }

  withDates(created: Date, updated?: Date) {
    this.item.created = created;
    this.item.updated = updated ?? created;
    this.item.tx = (updated ?? created).getTime();
    return this;
  }

  withAttachmentCount(count: number) {
    this.item.attachmentCount = count;
    return this;
  }

  withOverview(overview: ItemOverview) {
    this.item.overview = overview;
    this.item.title = overview.title;
    return this;
  }

  build(): Item {
    return { ...this.item };
  }
}

export function anItem(): ItemBuilder {
  return new ItemBuilder();
}
