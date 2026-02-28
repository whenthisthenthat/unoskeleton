import type { SyncResult } from "@/lib/vault/types";
import { getVault } from "@/lib/vault/vault-instance";
import { toast } from "burnt";
import { useEffect } from "react";

/**
 * Shows native toast notifications for sync operations.
 *
 * Subscribes to vault sync-started, sync-complete, and sync-error events.
 * Must be rendered in a component that stays mounted (e.g., tab layout).
 */
export function useSyncToast(): void {
  useEffect(() => {
    let vault;
    try {
      vault = getVault();
    } catch {
      return;
    }

    const handleSyncStarted = () => {
      toast({ title: "Syncing...", preset: "none", haptic: "none" });
    };

    const handleSyncComplete = (result: SyncResult) => {
      if (result.changed) {
        const count = result.newItemCount;
        const message =
          count !== undefined
            ? `${count > 0 ? "+" : ""}${count} item${Math.abs(count) === 1 ? "" : "s"}`
            : "Items updated";
        toast({ title: "Sync complete", message, preset: "done" });
      } else {
        toast({ title: "Already up to date", preset: "done", haptic: "none" });
      }
    };

    const handleSyncError = (message: string) => {
      toast({ title: "Sync failed", message, preset: "error" });
    };

    vault.on("sync-started", handleSyncStarted);
    vault.on("sync-complete", handleSyncComplete);
    vault.on("sync-error", handleSyncError);

    return () => {
      vault.off("sync-started", handleSyncStarted);
      vault.off("sync-complete", handleSyncComplete);
      vault.off("sync-error", handleSyncError);
    };
  }, []);
}
