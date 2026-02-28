import { Button, H2, Spinner, Text, YStack } from "tamagui";

interface VaultSourcePickerProps {
  onPickLocal: () => void;
  onConnectDropbox: () => void;
  pickerLoading: boolean;
  cloudLoading: boolean;
  error: string | null;
}

export default function VaultSourcePicker({
  onPickLocal,
  onConnectDropbox,
  pickerLoading,
  cloudLoading,
  error,
}: VaultSourcePickerProps) {
  return (
    <YStack
      flex={1}
      justifyContent="center"
      alignItems="center"
      padding="$4"
      backgroundColor="$background"
      gap="$4"
    >
      <H2>Select Vault</H2>

      <YStack width="100%" maxWidth={400} gap="$3">
        <Text textAlign="center" color="$gray10">
          Choose where your OPVault is stored
        </Text>

        <Button
          size="$5"
          theme="active"
          onPress={onPickLocal}
          disabled={pickerLoading || cloudLoading}
          icon={pickerLoading ? <Spinner /> : undefined}
        >
          {pickerLoading ? "Opening..." : "Local Device"}
        </Button>

        <Button
          size="$5"
          variant="outlined"
          onPress={onConnectDropbox}
          disabled={pickerLoading || cloudLoading}
          icon={cloudLoading ? <Spinner /> : undefined}
        >
          {cloudLoading ? "Connecting..." : "Dropbox"}
        </Button>

        {error && (
          <Text color="$red10" textAlign="center">
            {error}
          </Text>
        )}
      </YStack>
    </YStack>
  );
}
