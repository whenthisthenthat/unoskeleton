import type { ICloudProvider } from "@/lib/cloud/cloud-provider";
import { isDropboxAuthenticated } from "@/lib/cloud/dropbox/dropbox-auth";
import { DropboxProvider } from "@/lib/cloud/dropbox/dropbox-provider";
import {
  useCloudVaultPicker,
  type CloudVaultSource,
} from "@/lib/hooks/useCloudVaultPicker";
import { useVaultPicker } from "@/lib/hooks/useVaultPicker";
import { disableBiometric } from "@/lib/vault/biometric-store";
import {
  clearStoredVaultUri,
  getVaultDirectory,
  getStoredVaultUri,
  parseStoredVaultUri,
} from "@/lib/vault/vault-instance";
import { Directory } from "expo-file-system";
import { useState, useEffect } from "react";

export type VaultSource =
  | { type: "local"; dir: Directory }
  | {
      type: "cloud";
      provider: ICloudProvider;
      cloudPath: string;
      displayName: string;
    };

interface UseVaultSourceReturn {
  vaultSource: VaultSource | null;
  setVaultSource: (source: VaultSource | null) => void;
  storedVaultUri: string | null;
  setStoredVaultUri: (uri: string | null) => void;
  pickerLoading: boolean;
  pickerError: string | null;
  handlePickLocalVault: () => Promise<void>;
  handleConnectDropbox: () => Promise<void>;
  handleSelectCloudVault: (cloudVault: CloudVaultSource) => void;
  handleChangeVault: () => Promise<void>;
}

export function useVaultSource(
  cloud: ReturnType<typeof useCloudVaultPicker>,
): UseVaultSourceReturn {
  const [vaultSource, setVaultSource] = useState<VaultSource | null>(null);
  const [storedVaultUri, setStoredVaultUri] = useState<string | null>(null);

  const {
    pickDirectory,
    error: pickerError,
    loading: pickerLoading,
  } = useVaultPicker();

  // On mount: restore existing vault source from session or persisted URI
  useEffect(() => {
    const restore = async () => {
      // Check session-level directory first (after lock)
      const sessionDir = getVaultDirectory();
      if (sessionDir) {
        setVaultSource({ type: "local", dir: sessionDir });
        return;
      }

      // Check persisted vault URI
      const storedUri = await getStoredVaultUri();
      if (!storedUri) return;
      setStoredVaultUri(storedUri);

      const parsed = parseStoredVaultUri(storedUri);
      if (parsed.type === "cloud" && parsed.provider === "dropbox") {
        // Cloud vault — check if still authenticated
        const authed = await isDropboxAuthenticated();
        if (authed) {
          const cloudPath = parsed.path;
          const displayName = cloudPath.split("/").pop() || "Dropbox Vault";
          setVaultSource({
            type: "cloud",
            provider: new DropboxProvider(),
            cloudPath,
            displayName,
          });
        }
        // If not authenticated, user needs to reconnect — show source picker
      }
      if (parsed.type === "local") {
        const dir = new Directory(parsed.uri);
        if (dir.exists) {
          setVaultSource({ type: "local", dir });
        } else {
          await clearStoredVaultUri();
        }
      }
    };
    restore();
  }, []);

  const handlePickLocalVault = async () => {
    const directory = await pickDirectory();
    if (directory) {
      setVaultSource({ type: "local", dir: directory });
    }
  };

  const handleConnectDropbox = async () => {
    await cloud.showAppKeyEntry();
  };

  const handleSelectCloudVault = (cloudVault: CloudVaultSource) => {
    setVaultSource({
      type: "cloud",
      provider: cloudVault.provider,
      cloudPath: cloudVault.cloudPath,
      displayName: cloudVault.displayName,
    });
  };

  const handleChangeVault = async () => {
    if (storedVaultUri) await disableBiometric(storedVaultUri);
    await clearStoredVaultUri();
    setVaultSource(null);
    setStoredVaultUri(null);
  };

  return {
    vaultSource,
    setVaultSource,
    storedVaultUri,
    setStoredVaultUri,
    pickerLoading,
    pickerError,
    handlePickLocalVault,
    handleConnectDropbox,
    handleSelectCloudVault,
    handleChangeVault,
  };
}
