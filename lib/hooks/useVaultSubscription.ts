import type { LoadingProgress, SyncResult } from "@/lib/vault/types";
import { getVault } from "@/lib/vault/vault-instance";
import { useEffect, useReducer, useState } from "react";

/**
 * Hook that subscribes to vault events during progressive loading and sync.
 * Forces component re-render when items change, loading completes, or sync completes.
 *
 * @returns loadingProgress - current band loading progress, or null when done
 * @returns revision - increments on each change (use as useMemo dependency)
 * @returns syncResult - result of last sync operation, or null
 */
export function useVaultSubscription(): {
  loadingProgress: LoadingProgress | null;
  revision: number;
  syncResult: SyncResult | null;
} {
  const [revision, bump] = useReducer((x: number) => x + 1, 0);
  const [syncResult, setSyncResult] = useState<SyncResult | null>(null);

  useEffect(() => {
    let vault;
    try {
      vault = getVault();
    } catch {
      return;
    }

    const handler = () => bump();
    const syncHandler = (result: SyncResult) => {
      setSyncResult(result);
      bump();
    };

    vault.on("items-changed", handler);
    vault.on("loading-complete", handler);
    vault.on("sync-complete", syncHandler);

    return () => {
      vault.off("items-changed", handler);
      vault.off("loading-complete", handler);
      vault.off("sync-complete", syncHandler);
    };
  }, []);

  try {
    const vault = getVault();
    return {
      loadingProgress: vault.loadingProgress,
      revision,
      syncResult,
    };
  } catch {
    return { loadingProgress: null, revision, syncResult: null };
  }
}
