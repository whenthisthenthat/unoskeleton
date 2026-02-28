import VaultUnlockForm from "./VaultUnlockForm";
import { useAutoLockPause } from "@/lib/hooks/useAutoLockPause";
import { useBiometricUnlock } from "@/lib/hooks/useBiometricUnlock";
import { useUnlockForm } from "@/lib/hooks/useUnlockFormReducer";
import { WrongPasswordError } from "@/lib/vault/storage-interface";
import {
  getStoredVaultUri,
  reUnlockVault,
  scheduleSyncAfterNavigation,
} from "@/lib/vault/vault-instance";
import { useEffect, useRef, useState } from "react";
import { StyleSheet } from "react-native";
import { YStack, H2 } from "tamagui";

interface LockOverlayProps {
  onUnlock: () => void;
}

export default function LockOverlay({ onUnlock }: LockOverlayProps) {
  const [form, dispatch] = useUnlockForm();
  const [vaultUri, setVaultUri] = useState<string | null>(null);
  const unlockingRef = useRef(false);

  useAutoLockPause();

  useEffect(() => {}, []);

  useEffect(() => {
    getStoredVaultUri().then(setVaultUri);
  }, []);

  const {
    biometricEnabled,
    biometricCapability,
    biometricLoading,
    handleBiometricUnlock,
  } = useBiometricUnlock({
    autoTrigger: true,
    onAuthenticated: async (pw) => {
      await reUnlockVault(pw);
      onUnlock();
      scheduleSyncAfterNavigation();
    },
    setError: (msg: string) =>
      dispatch({ type: "UNLOCK_FAILED_GENERIC", message: msg }),
    vaultUri,
  });

  const showBiometric = biometricEnabled && biometricCapability?.isAvailable;

  const handleUnlock = async () => {
    if (!form.password || unlockingRef.current) return;
    unlockingRef.current = true;
    dispatch({ type: "START_UNLOCK" });

    let unlocked = false;
    try {
      await reUnlockVault(form.password);
      unlocked = true;
    } catch (err) {
      if (err instanceof WrongPasswordError) {
        dispatch({
          type: "UNLOCK_FAILED_WRONG_PASSWORD",
          passwordHint: err.passwordHint,
        });
      } else {
        dispatch({
          type: "UNLOCK_FAILED_GENERIC",
          message: "Failed to unlock vault. Please try again.",
        });
      }
    } finally {
      unlockingRef.current = false;
      dispatch({ type: "UNLOCK_FINISHED" });
    }

    if (unlocked) {
      onUnlock();
      scheduleSyncAfterNavigation();
    }
  };

  return (
    <YStack style={styles.overlay}>
      <YStack
        flex={1}
        justifyContent="center"
        alignItems="center"
        padding="$4"
        gap="$4"
      >
        <H2>Vault Locked</H2>

        <VaultUnlockForm
          password={form.password}
          onPasswordChange={(text) =>
            dispatch({ type: "SET_PASSWORD", password: text })
          }
          onSubmit={handleUnlock}
          loading={form.loading}
          showBiometric={showBiometric}
          biometricLoading={biometricLoading}
          onBiometricPress={handleBiometricUnlock}
          error={form.error}
          passwordHint={form.passwordHint}
          showHint={form.showHint}
          onShowHint={() => dispatch({ type: "SHOW_HINT" })}
        />
      </YStack>
    </YStack>
  );
}

const styles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "#fff",
    zIndex: 1000,
  },
});
