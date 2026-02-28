import { useAutoLockPause } from "@/lib/hooks/useAutoLockPause";
import { Ionicons } from "@expo/vector-icons";
import { Button, Spinner, Text, YStack, H2 } from "tamagui";

interface BiometricOfferScreenProps {
  onEnable: () => void;
  onSkip: () => void;
  loading: boolean;
}

export default function BiometricOfferScreen({
  onEnable,
  onSkip,
  loading,
}: BiometricOfferScreenProps) {
  useAutoLockPause();

  return (
    <YStack
      flex={1}
      justifyContent="center"
      alignItems="center"
      padding="$4"
      gap="$4"
      backgroundColor="$background"
    >
      <Ionicons name="finger-print" size={56} color="#007AFF" />
      <H2>Enable Biometric Unlock?</H2>

      <YStack width="100%" maxWidth={400} gap="$3">
        <Text fontSize="$3" color="$gray10" textAlign="center">
          Use Face ID, Touch ID, or fingerprint to unlock your vault without
          entering your password.
        </Text>

        <Button
          size="$5"
          theme="active"
          onPress={onEnable}
          disabled={loading}
          icon={loading ? <Spinner /> : undefined}
        >
          {loading ? "Enabling..." : "Enable"}
        </Button>

        <Button
          size="$4"
          variant="outlined"
          onPress={onSkip}
          disabled={loading}
        >
          Not Now
        </Button>
      </YStack>
    </YStack>
  );
}
