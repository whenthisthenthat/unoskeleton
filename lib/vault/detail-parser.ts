import { getCategoryName } from "@/lib/vault/categories";
import {
  DETAIL_FIELD_TYPES,
  SECTION_FIELD_KINDS,
  type DetailField,
  type DetailFieldType,
  type DetailSection,
  type Item,
  type ItemDetails,
  type SectionField,
  type SectionFieldKind,
} from "@/lib/vault/types";

/** Known top-level keys in the detail JSON (don't warn about these) */
const KNOWN_DETAIL_KEYS = new Set([
  "fields",
  "sections",
  "notesPlain",
  "htmlForm",
  "passwordHistory",
]);

function isOneOf<T extends string>(
  value: unknown,
  valid: readonly string[],
): value is T {
  return typeof value === "string" && valid.includes(value);
}

const isDetailFieldType = (v: unknown): v is DetailFieldType =>
  isOneOf<DetailFieldType>(v, DETAIL_FIELD_TYPES);

const isSectionFieldKind = (v: unknown): v is SectionFieldKind =>
  isOneOf<SectionFieldKind>(v, SECTION_FIELD_KINDS);

/**
 * Parse and validate raw detail JSON into a typed ItemDetails structure.
 * Logs the raw JSON and each parsed field/section for discovery.
 * Warns on unknown field types and unexpected top-level keys.
 */
export function parseItemDetails(raw: unknown, item?: Item): ItemDetails {
  if (typeof raw !== "object" || raw === null) {
    return { fields: [], sections: [], notesPlain: "" };
  }

  const obj = raw as Record<string, unknown>;

  // Log full item metadata including overview (contains URLs, app IDs, etc.)
  if (item) {
  }

  // Log raw JSON dump

  // Warn about unexpected top-level keys
  for (const key of Object.keys(obj)) {
    if (!KNOWN_DETAIL_KEYS.has(key)) {
    }
  }

  // Parse top-level fields array
  const fields: DetailField[] = [];
  if (Array.isArray(obj.fields)) {
    for (const f of obj.fields) {
      if (typeof f !== "object" || f === null || !("name" in f)) {
        continue;
      }
      const rec = f as Record<string, unknown>;

      if (!isDetailFieldType(rec.type)) {
      }

      const field: DetailField = {
        designation:
          typeof rec.designation === "string" ? rec.designation : undefined,
        name: String(rec.name),
        type: isDetailFieldType(rec.type) ? rec.type : "T",
        value: typeof rec.value === "string" ? rec.value : "",
      };

      fields.push(field);
    }
  }

  // Parse sections array
  const sections: DetailSection[] = [];
  if (Array.isArray(obj.sections)) {
    for (const s of obj.sections) {
      if (typeof s !== "object" || s === null) {
        continue;
      }
      const sRec = s as Record<string, unknown>;

      const section: DetailSection = {
        name: typeof sRec.name === "string" ? sRec.name : "",
        title: typeof sRec.title === "string" ? sRec.title : "",
        fields: [],
      };

      if (Array.isArray(sRec.fields)) {
        for (const sf of sRec.fields) {
          if (typeof sf !== "object" || sf === null || !("n" in sf)) {
            continue;
          }
          const sfRec = sf as Record<string, unknown>;

          if (!isSectionFieldKind(sfRec.k)) {
          }

          const sectionField: SectionField = {
            k: isSectionFieldKind(sfRec.k) ? sfRec.k : "string",
            n: String(sfRec.n),
            t: typeof sfRec.t === "string" ? sfRec.t : "",
            v: sfRec.v,
          };

          section.fields!.push(sectionField);
        }
      }

      sections.push(section);
    }
  }

  const notesPlain = typeof obj.notesPlain === "string" ? obj.notesPlain : "";

  return { fields, sections, notesPlain };
}
