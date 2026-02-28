import BiometricEnableModal from "@/lib/components/BiometricEnableModal";
import DropboxKeySection from "@/lib/components/DropboxKeySection";
import ListViewHeader from "@/lib/components/ListViewHeader";
import SettingsRadioGroup from "@/lib/components/SettingsRadioGroup";
import {
  AUTO_LOCK_OPTIONS,
  getAutoLockTimeout,
  setAutoLockTimeout,
  DEFAULT_AUTO_LOCK_TIMEOUT,
  type AutoLockTimeout,
} from "@/lib/vault/auto-lock-store";
import {
  checkBiometricCapability,
  disableBiometric,
  enableBiometric,
  isBiometricEnabled,
  type BiometricCapability,
} from "@/lib/vault/biometric-store";
import {
  getPreventScreenCapture,
  setPreventScreenCapture,
  DEFAULT_PREVENT_SCREEN_CAPTURE,
} from "@/lib/vault/screen-capture-store";
import { WrongPasswordError } from "@/lib/vault/storage-interface";
import {
  getStoredVaultUri,
  clearStoredVaultUri,
  lockVault,
  parseStoredVaultUri,
  verifyPassword,
} from "@/lib/vault/vault-instance";
import { useRouter } from "expo-router";
import { useState, useEffect } from "react";
import { ScrollView } from "react-native";
import { YStack, Button, Text, H4 } from "tamagui";

const ENABLED_DISABLED_OPTIONS = [
  { label: "Enabled", value: true },
  { label: "Disabled", value: false },
] as const;

export default function SettingsView() {
  const [vaultUri, setVaultUri] = useState<string | null>(null);
  const [autoLockTimeout, setAutoLockTimeoutState] = useState<AutoLockTimeout>(
    DEFAULT_AUTO_LOCK_TIMEOUT,
  );
  const [preventScreenCapture, setPreventScreenCaptureState] = useState(
    DEFAULT_PREVENT_SCREEN_CAPTURE,
  );
  const [biometricEnabled, setBiometricEnabledState] = useState(false);
  const [biometricCapability, setBiometricCapability] =
    useState<BiometricCapability | null>(null);
  const [showBiometricModal, setShowBiometricModal] = useState(false);
  const [modalPassword, setModalPassword] = useState("");
  const [modalError, setModalError] = useState("");
  const [modalLoading, setModalLoading] = useState(false);
  const router = useRouter();

  useEffect(() => {
    const loadSettings = async () => {
      const uri = await getStoredVaultUri();
      const [timeout, screenCapture, biometricOn, capability] =
        await Promise.all([
          getAutoLockTimeout(),
          getPreventScreenCapture(),
          uri ? isBiometricEnabled(uri) : Promise.resolve(false),
          checkBiometricCapability(),
        ]);
      setVaultUri(uri);
      setAutoLockTimeoutState(timeout);
      setPreventScreenCaptureState(screenCapture);
      setBiometricEnabledState(biometricOn);
      setBiometricCapability(capability);
    };
    loadSettings();
  }, []);

  const handleChangeVault = async () => {
    lockVault();
    if (vaultUri) await disableBiometric(vaultUri);
    await clearStoredVaultUri();
    router.replace("/lock");
  };

  const handleSelectTimeout = (value: AutoLockTimeout) => {
    setAutoLockTimeoutState(value);
    void setAutoLockTimeout(value);
  };

  const handleToggleScreenCapture = (enabled: boolean) => {
    setPreventScreenCaptureState(enabled);
    void setPreventScreenCapture(enabled);
  };

  const handleToggleBiometric = async (value: boolean) => {
    if (value) {
      setModalPassword("");
      setModalError("");
      setShowBiometricModal(true);
    } else {
      if (vaultUri) await disableBiometric(vaultUri);
      setBiometricEnabledState(false);
    }
  };

  const handleConfirmEnableBiometric = async () => {
    if (!modalPassword || modalLoading || !vaultUri) return;
    setModalLoading(true);
    setModalError("");

    try {
      await verifyPassword(modalPassword);
      await enableBiometric(vaultUri, modalPassword);
      setBiometricEnabledState(true);
      setShowBiometricModal(false);
    } catch (err) {
      if (err instanceof WrongPasswordError) {
        setModalError("Incorrect password");
      } else {
        setModalError("Could not enable biometric. Try again.");
      }
    } finally {
      setModalLoading(false);
      setModalPassword("");
    }
  };

  const formatVaultLabel = (uri: string): string => {
    const parsed = parseStoredVaultUri(uri);
    if (parsed.type === "cloud") {
      const label =
        parsed.provider.charAt(0).toUpperCase() + parsed.provider.slice(1);
      const displayPath = parsed.path.replace(/^\/+/, "/");
      return `${label}: ${displayPath}`;
    }
    const parts = uri.split("/");
    if (parts.length <= 3) return uri;
    return "…/" + parts.slice(-3).join("/");
  };

  const parsedUri = vaultUri ? parseStoredVaultUri(vaultUri) : null;
  const isDropboxVault =
    parsedUri?.type === "cloud" && parsedUri.provider === "dropbox";

  return (
    <YStack flex={1} backgroundColor="$background">
      <ListViewHeader title="Settings" />
      <ScrollView>
        <YStack padding="$4" gap="$4">
          <YStack gap="$2">
            <H4>Vault</H4>
            {vaultUri ? (
              <>
                <Text fontSize="$2" color="$gray10">
                  {formatVaultLabel(vaultUri)}
                </Text>
                <Button onPress={handleChangeVault}>Change Vault</Button>
              </>
            ) : (
              <Text color="$gray10">No vault selected</Text>
            )}
          </YStack>

          {isDropboxVault && <DropboxKeySection />}

          <YStack gap="$2">
            <H4>Auto-Lock</H4>
            <Text fontSize="$2" color="$gray10">
              Lock vault after inactivity
            </Text>
            <SettingsRadioGroup
              options={AUTO_LOCK_OPTIONS}
              selected={autoLockTimeout}
              onSelect={(v) => handleSelectTimeout(v as AutoLockTimeout)}
            />
          </YStack>

          <YStack gap="$2">
            <H4>Screenshot Protection</H4>
            <Text fontSize="$2" color="$gray10">
              Block screenshots and hide content in app switcher
            </Text>
            <SettingsRadioGroup
              options={ENABLED_DISABLED_OPTIONS}
              selected={preventScreenCapture}
              onSelect={(v) => handleToggleScreenCapture(v as boolean)}
            />
          </YStack>

          <YStack gap="$2">
            <H4>Biometric Unlock</H4>
            {biometricCapability?.isAvailable ? (
              <>
                <Text fontSize="$2" color="$gray10">
                  Use Face ID, Touch ID, or fingerprint to unlock your vault
                </Text>
                <SettingsRadioGroup
                  options={ENABLED_DISABLED_OPTIONS}
                  selected={biometricEnabled}
                  onSelect={(v) => void handleToggleBiometric(v as boolean)}
                />
              </>
            ) : (
              <Text fontSize="$2" color="$gray10">
                {biometricCapability?.hasHardware
                  ? "No biometrics enrolled. Set up Face ID or Touch ID in device Settings."
                  : "Biometric hardware not available on this device."}
              </Text>
            )}
          </YStack>
        </YStack>
      </ScrollView>

      <BiometricEnableModal
        visible={showBiometricModal}
        password={modalPassword}
        onPasswordChange={(text) => {
          setModalPassword(text);
          setModalError("");
        }}
        error={modalError}
        loading={modalLoading}
        onConfirm={handleConfirmEnableBiometric}
        onClose={() => setShowBiometricModal(false)}
      />
    </YStack>
  );
}
