import { parseItemDetails } from "@/lib/vault/detail-parser";
import { extractDisplaySections } from "@/lib/vault/display-sections";
import type { AttachmentInfo, DisplaySection, Item } from "@/lib/vault/types";
import { getVault } from "@/lib/vault/vault-instance";
import { useEffect, useState } from "react";

interface UseItemDetailsResult {
  sections: DisplaySection[] | null;
  attachments: AttachmentInfo[] | null;
  loading: boolean;
  error: string | null;
}

export function useItemDetails(item: Item | undefined): UseItemDetailsResult {
  const [sections, setSections] = useState<DisplaySection[] | null>(null);
  const [attachments, setAttachments] = useState<AttachmentInfo[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!item) return;
    let cancelled = false;

    setLoading(true);
    setError(null);

    const vault = getVault();

    // Load details and attachments in parallel
    const detailsPromise = vault.getItemDetails(item.uuid).then((raw) => {
      if (cancelled) return;
      const parsed = parseItemDetails(raw, item);
      const displaySections = extractDisplaySections(parsed, item.overview);
      setSections(displaySections);
    });

    const attachmentsPromise = vault
      .getAttachments(item.uuid)
      .then((atts) => {
        if (!cancelled) setAttachments(atts);
      })
      .catch((err) => {
        // Attachment failures should not block detail display
      });

    Promise.all([detailsPromise, attachmentsPromise])
      .catch((err) => {
        if (cancelled) return;
        setError(err instanceof Error ? err.message : String(err));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [item]);

  return { sections, attachments, loading, error };
}
