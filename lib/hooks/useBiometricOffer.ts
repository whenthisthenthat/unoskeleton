import { enableBiometric } from "@/lib/vault/biometric-store";
import { scheduleSyncAfterNavigation } from "@/lib/vault/vault-instance";
import { useRouter } from "expo-router";
import { useCallback, useRef, useState } from "react";

interface UseBiometricOfferReturn {
  showBiometricOffer: boolean;
  offerLoading: boolean;
  /** Activate the offer screen for a given vault URI and pending password. */
  activateOffer: (vaultUri: string, password: string) => void;
  handleOfferEnable: () => Promise<void>;
  handleOfferSkip: () => void;
}

/**
 * Manages the biometric offer screen shown after the first successful unlock.
 * Encapsulates offer state, enable/skip handlers, and post-navigation sync.
 */
export function useBiometricOffer(): UseBiometricOfferReturn {
  const router = useRouter();
  const [showBiometricOffer, setShowBiometricOffer] = useState(false);
  const [offerLoading, setOfferLoading] = useState(false);
  const pendingPasswordRef = useRef<string | null>(null);
  const pendingVaultUriRef = useRef<string | null>(null);

  const activateOffer = useCallback((vaultUri: string, password: string) => {
    pendingVaultUriRef.current = vaultUri;
    pendingPasswordRef.current = password;
    setShowBiometricOffer(true);
  }, []);

  const navigateAfterOffer = useCallback(() => {
    router.replace("/(tabs)/favourites");
    scheduleSyncAfterNavigation();
  }, [router]);

  const handleOfferEnable = useCallback(async () => {
    const password = pendingPasswordRef.current;
    const vaultUri = pendingVaultUriRef.current;
    if (!password || !vaultUri) return;

    setOfferLoading(true);
    try {
      await enableBiometric(vaultUri, password);
    } catch (err) {
    } finally {
      pendingPasswordRef.current = null;
      pendingVaultUriRef.current = null;
      setShowBiometricOffer(false);
      setOfferLoading(false);
      navigateAfterOffer();
    }
  }, [navigateAfterOffer]);

  const handleOfferSkip = useCallback(() => {
    pendingPasswordRef.current = null;
    pendingVaultUriRef.current = null;
    setShowBiometricOffer(false);
    navigateAfterOffer();
  }, [navigateAfterOffer]);

  return {
    showBiometricOffer,
    offerLoading,
    activateOffer,
    handleOfferEnable,
    handleOfferSkip,
  };
}
