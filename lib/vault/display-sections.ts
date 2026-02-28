import { unixToDate } from "@/lib/vault/date-conversion";
import { extractWebsiteUrls } from "@/lib/vault/item-display";
import type {
  DetailField,
  DetailFieldType,
  DisplayField,
  DisplaySection,
  ItemDetails,
  ItemOverview,
  SectionField,
  SectionFieldKind,
} from "@/lib/vault/types";

/** Check if a top-level detail field (always string-typed) has content */
function hasNonEmptyFieldValue(field: DetailField): boolean {
  return field.value.length > 0;
}

/** Check if a section field (loosely typed v: unknown) has a present value */
function hasPresentSectionValue(field: SectionField): boolean {
  return field.v !== undefined && field.v !== null && field.v !== "";
}

/**
 * Transform parsed item details into display-ready sections.
 *
 * Produces:
 * 1. A primary section from designated top-level fields (username, password)
 * 2. A websites section from overview URLs
 * 3. One section per detail section with non-empty fields
 * 4. A "Notes" section if notesPlain is non-empty
 * 5. A "Linked Apps" section from overview appIds
 * 6. A "Saved from form details" section from non-designated top-level fields
 */
export function extractDisplaySections(
  details: ItemDetails,
  overview?: ItemOverview,
): DisplaySection[] {
  return [
    buildPrimaryFieldsSection(details.fields),
    buildWebsiteSection(overview),
    ...buildDetailSections(details.sections),
    buildNotesSection(details.notesPlain),
    buildLinkedAppsSection(overview),
    buildFormFieldsSection(details.fields),
  ].filter((s): s is DisplaySection => s !== null);
}

// --- Section builders ---

function buildPrimaryFieldsSection(
  fields: DetailField[],
): DisplaySection | null {
  const primaryFields = fields
    .filter((f) => hasNonEmptyFieldValue(f) && f.designation !== undefined)
    .map(fieldToDisplayField);
  return primaryFields.length > 0 ? { title: "", fields: primaryFields } : null;
}

function buildWebsiteSection(overview?: ItemOverview): DisplaySection | null {
  if (!overview) return null;
  const urlFields = extractWebsiteUrls(overview).map((entry) => ({
    label: entry.label || "Website",
    value: entry.url,
    sensitive: false,
    kind: "url" as const,
  }));
  return urlFields.length > 0 ? { title: "Websites", fields: urlFields } : null;
}

function buildDetailSections(
  sections: ItemDetails["sections"],
): DisplaySection[] {
  const result: DisplaySection[] = [];
  for (const section of sections) {
    const displayFields = (section.fields ?? [])
      .filter(hasPresentSectionValue)
      .map(sectionFieldToDisplayField);
    if (displayFields.length > 0) {
      result.push({ title: section.title, fields: displayFields });
    }
  }
  return result;
}

function buildNotesSection(notesPlain: string): DisplaySection | null {
  if (notesPlain.length === 0) return null;
  return {
    title: "Notes",
    fields: [
      { label: "Notes", value: notesPlain, sensitive: false, kind: "note" },
    ],
  };
}

function buildLinkedAppsSection(
  overview?: ItemOverview,
): DisplaySection | null {
  if (!overview?.appIds || overview.appIds.length === 0) return null;
  // Defensive filter: overview comes from decrypted JSON which may contain malformed entries
  const appFields = overview.appIds
    .filter((entry) => typeof entry?.name === "string")
    .map((entry) => ({
      label: entry.name,
      value: entry.id,
      sensitive: false,
      kind: "text" as const,
    }));
  return appFields.length > 0
    ? { title: "Linked Apps", fields: appFields }
    : null;
}

function buildFormFieldsSection(fields: DetailField[]): DisplaySection | null {
  const formFields = fields
    .filter((f) => hasNonEmptyFieldValue(f) && f.designation === undefined)
    .map(fieldToDisplayField);
  return formFields.length > 0
    ? { title: "Saved from form details", fields: formFields }
    : null;
}

// --- Private helpers ---

function fieldToDisplayField(field: DetailField): DisplayField {
  const sensitive = field.type === "P" || field.designation === "password";
  const kind = FIELD_TYPE_TO_KIND[field.type] ?? "text";
  const label = fieldLabel(field);
  return { label, value: field.value, sensitive, kind };
}

function sectionFieldToDisplayField(field: SectionField): DisplayField {
  // Detect TOTP fields: concealed + name starts with "TOTP_" + otpauth URI
  if (
    field.k === "concealed" &&
    field.n.startsWith("TOTP_") &&
    typeof field.v === "string" &&
    field.v.startsWith("otpauth://totp/")
  ) {
    return {
      label: field.t || "One-Time Password",
      value: String(field.v),
      sensitive: false,
      kind: "totp",
    };
  }

  const sensitive = field.k === "concealed";
  const kind = SECTION_KIND_TO_DISPLAY_KIND[field.k] ?? "text";
  const value = formatSectionFieldValue(field);
  return { label: field.t || field.n, value, sensitive, kind };
}

const FIELD_TYPE_TO_KIND: Partial<
  Record<DetailFieldType, DisplayField["kind"]>
> = {
  P: "password",
  E: "email",
  U: "url",
  TEL: "phone",
};

const SECTION_KIND_TO_DISPLAY_KIND: Partial<
  Record<SectionFieldKind, DisplayField["kind"]>
> = {
  concealed: "password",
  URL: "url",
  email: "email",
  phone: "phone",
  date: "date",
  monthYear: "date",
};

function fieldLabel(field: DetailField): string {
  if (field.designation === "username") return "Username";
  if (field.designation === "password") return "Password";
  if (field.name) {
    return field.name.charAt(0).toUpperCase() + field.name.slice(1);
  }
  return "Field";
}

const CC_TYPE_NAMES: Record<string, string> = {
  amex: "American Express",
  visa: "Visa",
  mc: "Mastercard",
  discover: "Discover",
  diners: "Diners Club",
  jcb: "JCB",
  unionpay: "UnionPay",
  maestro: "Maestro",
};

function formatSectionFieldValue(field: SectionField): string {
  if (field.k === "date" && typeof field.v === "number") {
    return unixToDate(field.v).toLocaleDateString();
  }
  if (field.k === "monthYear" && typeof field.v === "number") {
    const year = Math.floor(field.v / 100);
    const month = field.v % 100;
    return `${String(month).padStart(2, "0")}/${year}`;
  }
  if (
    field.k === "address" &&
    typeof field.v === "object" &&
    field.v !== null
  ) {
    const addr = field.v as Record<string, string>;
    return [addr.street, addr.city, addr.state, addr.zip, addr.country]
      .filter(Boolean)
      .join(", ");
  }
  if (field.k === "cctype" && typeof field.v === "string") {
    return CC_TYPE_NAMES[field.v] ?? field.v;
  }
  return String(field.v ?? "");
}
