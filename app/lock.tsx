import BiometricOfferScreen from "@/lib/components/BiometricOfferScreen";
import CloudFolderBrowser from "@/lib/components/CloudFolderBrowser";
import VaultSourcePicker from "@/lib/components/VaultSourcePicker";
import VaultUnlockForm from "@/lib/components/VaultUnlockForm";
import { useBiometricOffer } from "@/lib/hooks/useBiometricOffer";
import { useBiometricUnlock } from "@/lib/hooks/useBiometricUnlock";
import { useCloudVaultPicker } from "@/lib/hooks/useCloudVaultPicker";
import { useUnlockForm } from "@/lib/hooks/useUnlockFormReducer";
import { useVaultSource } from "@/lib/hooks/useVaultSource";
import {
  isBiometricEnabled,
  type BiometricCapability,
} from "@/lib/vault/biometric-store";
import { WrongPasswordError } from "@/lib/vault/storage-interface";
import {
  loadVaultProgressive,
  loadVaultFromCloud,
  getStoredVaultUri,
  scheduleSyncAfterNavigation,
} from "@/lib/vault/vault-instance";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useState, useCallback, useRef } from "react";
import { YStack, XStack, Button, Text, H2, Spinner, Input } from "tamagui";

export default function LockScreen() {
  const router = useRouter();
  const { manualLock } = useLocalSearchParams<{ manualLock?: string }>();
  const cloud = useCloudVaultPicker();
  const {
    vaultSource,
    storedVaultUri,
    setStoredVaultUri,
    pickerLoading,
    pickerError,
    handlePickLocalVault,
    handleConnectDropbox,
    handleSelectCloudVault,
    handleChangeVault: handleChangeVaultBase,
  } = useVaultSource(cloud);
  const {
    showBiometricOffer,
    offerLoading,
    activateOffer,
    handleOfferEnable,
    handleOfferSkip,
  } = useBiometricOffer();

  const [form, dispatch] = useUnlockForm();
  const unlockingRef = useRef(false);

  // Reset password form state when changing vault
  const handleChangeVault = async () => {
    dispatch({ type: "RESET" });
    await handleChangeVaultBase();
  };

  const handleProgress = useCallback(
    (loaded: number, total: number) => {
      requestAnimationFrame(() => {
        dispatch({ type: "SET_LOADING_PROGRESS", progress: { loaded, total } });
      });
    },
    [dispatch],
  );

  // Stable ref so doUnlock can read the latest capability without needing it
  // in its deps (biometricCapability is declared after doUnlock via the hook).
  const biometricCapabilityRef = useRef<BiometricCapability | null>(null);

  const doUnlock = useCallback(
    async (pw: string) => {
      if (!vaultSource) return;

      dispatch({ type: "START_UNLOCK" });

      let resolveNavReady: () => void;
      const navReadyPromise = new Promise<void>((resolve) => {
        resolveNavReady = resolve;
      });

      const callbacks = {
        onProgress: handleProgress,
        onReadyToNavigate: () => resolveNavReady(),
      };

      const loadPromise =
        vaultSource.type === "local"
          ? loadVaultProgressive(pw, vaultSource.dir, callbacks)
          : loadVaultFromCloud(
              pw,
              vaultSource.provider,
              vaultSource.cloudPath,
              callbacks,
            );

      try {
        await Promise.race([navReadyPromise, loadPromise]);

        // After vault is ready, check if we should offer biometric setup.
        // Compute URI from the source directly because SecureStore writes
        // the URI after initializeProgressive completes, but navReady fires
        // during progressive loading (race condition on first-ever unlock).
        const computedUri =
          vaultSource.type === "local"
            ? vaultSource.dir.uri
            : `${vaultSource.provider.name}://${vaultSource.cloudPath}`;
        const freshUri = (await getStoredVaultUri()) ?? computedUri;
        if (freshUri && freshUri !== storedVaultUri)
          setStoredVaultUri(freshUri);

        // biometricCapability is already loaded by the useBiometricUnlock hook
        // (device-level, not vault-specific). Only re-check isBiometricEnabled
        // with the fresh vault URI since the hook may not have known it yet.
        const alreadyEnabled = freshUri
          ? await isBiometricEnabled(freshUri)
          : true;

        const currentCapability = biometricCapabilityRef.current;

        if (currentCapability?.isAvailable && !alreadyEnabled && freshUri) {
          activateOffer(freshUri, pw);
          // Detach background loading so doUnlock returns immediately.
          // Sync is triggered by the offer handlers after navigation.
          void loadPromise;
        } else {
          router.replace("/(tabs)/favourites");
          scheduleSyncAfterNavigation();
          await loadPromise;
        }
      } finally {
        dispatch({ type: "UNLOCK_FINISHED" });
      }
    },
    [
      vaultSource,
      handleProgress,
      dispatch,
      router,
      storedVaultUri,
      activateOffer,
      setStoredVaultUri,
    ],
  );

  const {
    biometricEnabled,
    biometricCapability,
    biometricLoading,
    handleBiometricUnlock,
  } = useBiometricUnlock({
    autoTrigger: vaultSource !== null && !manualLock,
    onAuthenticated: doUnlock,
    setError: (msg: string) =>
      dispatch({ type: "UNLOCK_FAILED_GENERIC", message: msg }),
    vaultUri: storedVaultUri,
  });

  // Keep ref in sync so doUnlock always reads the latest capability value
  biometricCapabilityRef.current = biometricCapability;

  const showBiometric = biometricEnabled && biometricCapability?.isAvailable;

  const handleUnlock = async () => {
    if (!vaultSource || !form.password || unlockingRef.current) return;
    unlockingRef.current = true;

    try {
      await doUnlock(form.password);
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
  };

  // State: Cloud folder browser open
  if (cloud.browsing) {
    return (
      <CloudFolderBrowser
        currentPath={cloud.currentPath}
        entries={cloud.entries}
        loading={cloud.loading}
        error={cloud.error}
        hasProfile={cloud.entries.some(
          (e) => !e.isFolder && e.name === "profile.js",
        )}
        onNavigate={cloud.browse}
        onNavigateUp={cloud.navigateUp}
        onSelect={() => {
          const result = cloud.selectVault(cloud.currentPath);
          if (result) handleSelectCloudVault(result);
        }}
        onCancel={cloud.cancelBrowsing}
      />
    );
  }

  // State: App Key required before Dropbox OAuth
  if (cloud.appKeyMissing) {
    return (
      <AppKeyInputScreen
        onSave={cloud.saveAppKeyAndAuthenticate}
        onCancel={cloud.cancelAppKeyEntry}
        error={cloud.error}
        loading={cloud.loading}
        initialValue={cloud.currentAppKey ?? ""}
      />
    );
  }

  // State A: No vault selected — source picker
  if (!vaultSource) {
    return (
      <VaultSourcePicker
        onPickLocal={handlePickLocalVault}
        onConnectDropbox={handleConnectDropbox}
        pickerLoading={pickerLoading}
        cloudLoading={cloud.loading}
        error={pickerError || cloud.error}
      />
    );
  }

  // State: Biometric offer after successful initial unlock
  if (showBiometricOffer) {
    return (
      <BiometricOfferScreen
        onEnable={handleOfferEnable}
        onSkip={handleOfferSkip}
        loading={offerLoading}
      />
    );
  }

  // State B: Vault selected, awaiting password
  const vaultLabel =
    vaultSource.type === "local"
      ? vaultSource.dir.name
      : `Dropbox: ${vaultSource.displayName}`;

  return (
    <YStack
      flex={1}
      justifyContent="center"
      alignItems="center"
      padding="$4"
      backgroundColor="$background"
      gap="$4"
    >
      <H2>Enter Password</H2>

      <YStack width="100%" maxWidth={400} gap="$3">
        <Text fontSize="$2" color="$gray10" textAlign="center">
          Vault: {vaultLabel}
        </Text>

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

        {form.loading && (
          <Text color="$gray11" fontSize="$3" textAlign="center">
            {form.loadingProgress
              ? `Loading vault... ${form.loadingProgress.loaded}/${form.loadingProgress.total} bands`
              : vaultSource.type === "cloud"
                ? "Downloading from Dropbox..."
                : "Preparing to unlock..."}
          </Text>
        )}

        <Button
          size="$4"
          variant="outlined"
          onPress={handleChangeVault}
          disabled={form.loading}
        >
          Change Vault
        </Button>
      </YStack>
    </YStack>
  );
}

interface AppKeyInputScreenProps {
  onSave: (key: string) => Promise<void>;
  onCancel: () => void;
  error: string | null;
  loading: boolean;
  initialValue?: string;
}

function AppKeyInputScreen({
  onSave,
  onCancel,
  error,
  loading,
  initialValue = "",
}: AppKeyInputScreenProps) {
  const [appKey, setAppKey] = useState(initialValue);

  return (
    <YStack
      flex={1}
      justifyContent="center"
      alignItems="center"
      padding="$4"
      backgroundColor="$background"
      gap="$4"
    >
      <H2>Dropbox App Key</H2>

      <YStack width="100%" maxWidth={400} gap="$3">
        <Text textAlign="center" color="$gray10">
          Enter your Dropbox App Key to connect. You can create one at
          dropbox.com/developers/apps.
        </Text>

        <Input
          size="$5"
          placeholder="App Key"
          value={appKey}
          onChangeText={setAppKey}
          autoCapitalize="none"
          autoCorrect={false}
          disabled={loading}
          autoFocus
        />

        {error && (
          <Text color="$red10" textAlign="center">
            {error}
          </Text>
        )}

        <XStack gap="$3">
          <Button
            flex={1}
            size="$5"
            variant="outlined"
            onPress={onCancel}
            disabled={loading}
          >
            Cancel
          </Button>
          <Button
            flex={1}
            size="$5"
            theme="active"
            onPress={() => onSave(appKey)}
            disabled={loading || !appKey.trim()}
            icon={loading ? <Spinner /> : undefined}
          >
            {loading ? "Connecting..." : "Connect"}
          </Button>
        </XStack>
      </YStack>
    </YStack>
  );
}
