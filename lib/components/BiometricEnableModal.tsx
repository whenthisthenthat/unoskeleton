import { useAutoLockPause } from "@/lib/hooks/useAutoLockPause";
import { Modal } from "react-native";
import { YStack, Input, Button, Text, H4, Spinner } from "tamagui";

interface BiometricEnableModalProps {
  visible: boolean;
  password: string;
  onPasswordChange: (text: string) => void;
  error: string;
  loading: boolean;
  onConfirm: () => void;
  onClose: () => void;
}

export default function BiometricEnableModal({
  visible,
  password,
  onPasswordChange,
  error,
  loading,
  onConfirm,
  onClose,
}: BiometricEnableModalProps) {
  useAutoLockPause(visible);

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <YStack
        flex={1}
        justifyContent="center"
        alignItems="center"
        padding="$4"
        gap="$4"
      >
        <H4>Enable Biometric Unlock</H4>

        <YStack width="100%" maxWidth={400} gap="$3">
          <Text fontSize="$2" color="$gray10" textAlign="center">
            Enter your master password to enable biometric unlock. Your password
            will be stored securely in the device keychain.
          </Text>

          <Input
            size="$5"
            placeholder="Master password"
            secureTextEntry
            value={password}
            onChangeText={onPasswordChange}
            onSubmitEditing={onConfirm}
            disabled={loading}
            autoFocus
          />

          {error ? (
            <Text color="$red10" textAlign="center">
              {error}
            </Text>
          ) : null}

          <Button
            size="$5"
            theme="active"
            onPress={onConfirm}
            disabled={loading || !password}
            icon={loading ? <Spinner /> : undefined}
          >
            {loading ? "Enabling..." : "Enable"}
          </Button>

          <Button
            size="$4"
            variant="outlined"
            onPress={onClose}
            disabled={loading}
          >
            Cancel
          </Button>
        </YStack>
      </YStack>
    </Modal>
  );
}
