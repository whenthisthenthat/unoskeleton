import { Ionicons } from "@expo/vector-icons";
import { Button, Input, Spinner, Text, YStack } from "tamagui";

interface VaultUnlockFormProps {
  // Password field
  password: string;
  onPasswordChange: (text: string) => void;
  onSubmit: () => void;
  loading: boolean;

  // Biometric (omit to hide biometric button entirely)
  showBiometric?: boolean;
  biometricLoading?: boolean;
  onBiometricPress?: () => void;

  // Error & password hint
  error?: string;
  passwordHint?: string;
  showHint?: boolean;
  onShowHint?: () => void;
}

export default function VaultUnlockForm({
  password,
  onPasswordChange,
  onSubmit,
  loading,
  showBiometric = false,
  biometricLoading = false,
  onBiometricPress,
  error,
  passwordHint,
  showHint = false,
  onShowHint,
}: VaultUnlockFormProps) {
  return (
    <YStack width="100%" maxWidth={400} gap="$3">
      <Text fontSize="$2" color="$gray10" textAlign="center">
        {showBiometric
          ? "Use biometrics or enter your password to unlock"
          : "Enter your password to unlock"}
      </Text>

      {showBiometric && onBiometricPress && (
        <Button
          size="$5"
          theme="active"
          onPress={onBiometricPress}
          disabled={biometricLoading || loading}
          icon={
            biometricLoading ? (
              <Spinner />
            ) : (
              <Ionicons name="finger-print" size={20} color="white" />
            )
          }
        >
          {biometricLoading ? "Authenticating..." : "Use Biometrics"}
        </Button>
      )}

      <Input
        size="$5"
        placeholder="Password"
        secureTextEntry
        value={password}
        onChangeText={onPasswordChange}
        onSubmitEditing={onSubmit}
        disabled={loading}
        autoFocus={!showBiometric}
      />

      {error && (
        <Text color="$red10" textAlign="center">
          {error}
        </Text>
      )}

      {error && passwordHint && !showHint && onShowHint && (
        <Button size="$3" variant="outlined" onPress={onShowHint}>
          Show password hint
        </Button>
      )}

      {showHint && passwordHint && (
        <Text color="$gray11" textAlign="center" fontSize="$3">
          Hint: {passwordHint}
        </Text>
      )}

      <Button
        size="$5"
        theme="active"
        onPress={onSubmit}
        disabled={loading || !password}
        icon={loading ? <Spinner /> : undefined}
      >
        {loading ? "Unlocking..." : "Unlock"}
      </Button>
    </YStack>
  );
}
