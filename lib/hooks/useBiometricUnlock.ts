import {
  authenticateWithBiometric,
  checkBiometricCapability,
  disableBiometric,
  handleBiometricUnavailable,
  isBiometricEnabled,
  type BiometricCapability,
} from "@/lib/vault/biometric-store";
import { WrongPasswordError } from "@/lib/vault/storage-interface";
import { useCallback, useEffect, useRef, useState } from "react";
import { AppState } from "react-native";

export interface AutoTriggerState {
  autoTrigger: boolean;
  biometricEnabled: boolean;
  biometricAvailable: boolean;
  alreadyTriggered: boolean;
  appIsActive: boolean;
}

/**
 * Determine whether biometric auth should auto-trigger.
 * All five conditions must be met.
 */
export function shouldAutoTriggerBiometric(state: AutoTriggerState): boolean {
  return (
    state.autoTrigger &&
    state.biometricEnabled &&
    state.biometricAvailable &&
    !state.alreadyTriggered &&
    state.appIsActive
  );
}

interface UseBiometricUnlockOptions {
  /** Called with the retrieved password on successful biometric auth. */
  onAuthenticated: (password: string) => Promise<void>;
  /** When true, automatically triggers the biometric prompt once on mount. */
  autoTrigger?: boolean;
  /** Setter for the parent component's error state. */
  setError: (msg: string) => void;
  /**
   * The vault URI used to namespace storage keys.
   * null = enabled state not yet known; device capability still checked on mount.
   */
  vaultUri: string | null;
}

interface UseBiometricUnlockReturn {
  biometricEnabled: boolean;
  biometricCapability: BiometricCapability | null;
  biometricLoading: boolean;
  handleBiometricUnlock: () => Promise<void>;
}

export function useBiometricUnlock({
  onAuthenticated,
  autoTrigger = false,
  setError,
  vaultUri,
}: UseBiometricUnlockOptions): UseBiometricUnlockReturn {
  const [biometricEnabled, setBiometricEnabled] = useState(false);
  const [biometricCapability, setBiometricCapability] =
    useState<BiometricCapability | null>(null);
  const [biometricLoading, setBiometricLoading] = useState(false);
  const [appIsActive, setAppIsActive] = useState(
    AppState.currentState === "active",
  );

  const loadingRef = useRef(false);
  const triggeredRef = useRef(false);

  // Stable ref to the latest onAuthenticated so the handler doesn't need it in deps
  const onAuthenticatedRef = useRef(onAuthenticated);
  onAuthenticatedRef.current = onAuthenticated;

  const handleBiometricUnlock = useCallback(async () => {
    if (loadingRef.current || !vaultUri) return;
    loadingRef.current = true;
    setBiometricLoading(true);
    setError("");

    try {
      const result = await authenticateWithBiometric(
        vaultUri,
        "Unlock your vault",
      );

      if (result.success) {
        try {
          await onAuthenticatedRef.current(result.password);
        } catch (err) {
          if (err instanceof WrongPasswordError) {
            // Stored password is stale — auto-disable and surface a clear error
            await disableBiometric(vaultUri);
            setBiometricEnabled(false);
            setError(
              "Biometric data is outdated. Please re-enable biometric unlock in Settings.",
            );
          } else {
            setError("Failed to unlock vault. Please try again.");
          }
        }
      } else if (result.reason === "unavailable") {
        await handleBiometricUnavailable(vaultUri);
        setBiometricEnabled(false);
      } else if (result.reason === "error") {
        setError("Biometric authentication failed. Use your password.");
      }
      // "cancelled" → silent, fall through to password input
    } finally {
      loadingRef.current = false;
      setBiometricLoading(false);
    }
  }, [vaultUri, setError]);

  // Device capability — loads on mount regardless of vault URI
  useEffect(() => {
    let cancelled = false;
    checkBiometricCapability().then((capability) => {
      if (!cancelled) setBiometricCapability(capability);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  // Vault-specific enabled state — only when URI is known
  useEffect(() => {
    if (!vaultUri) return;
    let cancelled = false;
    isBiometricEnabled(vaultUri).then((enabled) => {
      if (!cancelled) setBiometricEnabled(enabled);
    });
    return () => {
      cancelled = true;
    };
  }, [vaultUri]);

  // Track app foreground/background — auto-trigger only fires when app is active
  useEffect(() => {
    const sub = AppState.addEventListener("change", (state) => {
      const active = state === "active";
      setAppIsActive(active);
    });
    return () => sub.remove();
  }, []);

  // Auto-trigger when autoTrigger becomes true, biometrics are ready, AND app is active
  useEffect(() => {
    if (
      shouldAutoTriggerBiometric({
        autoTrigger,
        biometricEnabled,
        biometricAvailable: biometricCapability?.isAvailable ?? false,
        alreadyTriggered: triggeredRef.current,
        appIsActive,
      })
    ) {
      triggeredRef.current = true;
      void handleBiometricUnlock();
    }
  }, [
    autoTrigger,
    biometricEnabled,
    biometricCapability,
    handleBiometricUnlock,
    appIsActive,
  ]);

  return {
    biometricEnabled,
    biometricCapability,
    biometricLoading,
    handleBiometricUnlock,
  };
}
