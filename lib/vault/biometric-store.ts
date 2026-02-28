import { hashVaultUri } from "@/lib/opvault/cache/cache-manager";
import * as LocalAuthentication from "expo-local-authentication";
import * as SecureStore from "expo-secure-store";

// --- Key builders (per-vault namespacing) ---
// Uses SHA-256 hash of the vault URI so keys contain only valid characters.

function biometricEnabledKey(vaultUri: string): string {
  return `biometricEnabled-${hashVaultUri(vaultUri)}`;
}

function biometricPasswordKey(vaultUri: string): string {
  return `biometricPassword-${hashVaultUri(vaultUri)}`;
}

// --- Types ---

export interface BiometricCapability {
  hasHardware: boolean;
  isEnrolled: boolean;
  isAvailable: boolean;
  types: LocalAuthentication.AuthenticationType[];
}

export type BiometricAuthResult =
  | { success: true; password: string }
  | {
      success: false;
      reason: "cancelled" | "unavailable" | "error";
      error?: Error;
    };

// --- Capability ---

export async function checkBiometricCapability(): Promise<BiometricCapability> {
  const [hasHardware, isEnrolled, types] = await Promise.all([
    LocalAuthentication.hasHardwareAsync(),
    LocalAuthentication.isEnrolledAsync(),
    LocalAuthentication.supportedAuthenticationTypesAsync(),
  ]);
  return {
    hasHardware,
    isEnrolled,
    isAvailable: hasHardware && isEnrolled,
    types,
  };
}

// --- Persistence ---

export async function isBiometricEnabled(vaultUri: string): Promise<boolean> {
  try {
    const raw = await SecureStore.getItemAsync(biometricEnabledKey(vaultUri));
    if (raw === null) return false;
    return JSON.parse(raw) as boolean;
  } catch {
    return false;
  }
}

/**
 * Enable biometric unlock.
 *
 * Uses an explicit LocalAuthentication.authenticateAsync() call to verify
 * biometrics before storing. This is more reliable than requireAuthentication
 * on setItemAsync, which fails silently on some Android devices.
 *
 * Throws with message "UserCancel" if the biometric prompt is dismissed.
 */
export async function enableBiometric(
  vaultUri: string,
  password: string,
): Promise<void> {
  const result = await LocalAuthentication.authenticateAsync({
    promptMessage: "Confirm your identity to enable biometric unlock",
    cancelLabel: "Cancel",
  });
  if (!result.success) {
    throw new Error("UserCancel");
  }

  // Biometric verified — store password without requireAuthentication.
  // Access is gated by authenticateAsync in authenticateWithBiometric.
  await SecureStore.setItemAsync(biometricPasswordKey(vaultUri), password);
  await SecureStore.setItemAsync(
    biometricEnabledKey(vaultUri),
    JSON.stringify(true),
  );
}

export async function disableBiometric(vaultUri: string): Promise<void> {
  await SecureStore.deleteItemAsync(biometricPasswordKey(vaultUri));
  await SecureStore.setItemAsync(
    biometricEnabledKey(vaultUri),
    JSON.stringify(false),
  );
}

/**
 * Called when biometrics are no longer enrolled on the device.
 * Auto-disables the feature and logs a warning.
 */
export async function handleBiometricUnavailable(
  vaultUri: string,
): Promise<void> {
  await disableBiometric(vaultUri);
}

/**
 * Attempt to retrieve the stored master password using biometric authentication.
 * Uses an explicit LocalAuthentication.authenticateAsync() call for the
 * biometric gate — more reliable than requireAuthentication on getItemAsync.
 */
export async function authenticateWithBiometric(
  vaultUri: string,
  promptMessage: string,
): Promise<BiometricAuthResult> {
  const capability = await checkBiometricCapability();
  if (!capability.isAvailable) {
    return { success: false, reason: "unavailable" };
  }

  const authResult = await LocalAuthentication.authenticateAsync({
    promptMessage,
    cancelLabel: "Cancel",
  });

  if (!authResult.success) {
    const reason =
      authResult.error === "user_cancel" || authResult.error === "system_cancel"
        ? "cancelled"
        : "error";
    return { success: false, reason };
  }

  // Biometric confirmed — read the stored password
  try {
    const password = await SecureStore.getItemAsync(
      biometricPasswordKey(vaultUri),
    );

    if (password === null) {
      return { success: false, reason: "unavailable" };
    }

    return { success: true, password };
  } catch (err) {
    return {
      success: false,
      reason: "error",
      error: err instanceof Error ? err : new Error(String(err)),
    };
  }
}
