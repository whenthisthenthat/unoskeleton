import { lockVault } from "@/lib/vault/vault-instance";
import { useRouter } from "expo-router";

/**
 * Hook for locking the vault and navigating to the lock screen
 *
 * Provides a reusable function that can be used across the application
 * to lock the vault and navigate to the lock screen.
 *
 * @returns Object with lockVaultAndNavigate function
 *
 * @example
 * ```tsx
 * const { lockVaultAndNavigate } = useLockVault();
 *
 * // In a button handler
 * <Button onPress={lockVaultAndNavigate}>Lock Vault</Button>
 * ```
 */
export function useLockVault() {
  const router = useRouter();

  const lockVaultAndNavigate = () => {
    lockVault();
    router.replace({ pathname: "/lock", params: { manualLock: "1" } });
  };

  return { lockVaultAndNavigate };
}
