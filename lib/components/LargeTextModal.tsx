import { ColorCodedText } from "@/lib/components/ColorCodedText";
import { FieldLabel } from "@/lib/components/FieldLabel";
import { Ionicons } from "@expo/vector-icons";
import { Modal, Pressable, StyleSheet } from "react-native";
import { YStack, XStack, Text, useTheme } from "tamagui";

interface LargeTextModalProps {
  visible: boolean;
  onClose: () => void;
  label: string;
  value: string;
  onCopy: () => void;
  copied: boolean;
}

export function LargeTextModal({
  visible,
  onClose,
  label,
  value,
  onCopy,
  copied,
}: LargeTextModalProps) {
  const theme = useTheme();

  return (
    <Modal
      transparent
      animationType="fade"
      visible={visible}
      onRequestClose={onClose}
    >
      <Pressable style={styles.backdrop} onPress={onClose}>
        <Pressable onPress={(e) => e.stopPropagation()}>
          <YStack
            backgroundColor="$background"
            borderRadius="$4"
            padding="$6"
            marginHorizontal="$4"
            alignItems="center"
            gap="$4"
          >
            <FieldLabel>{label}</FieldLabel>
            <XStack flexWrap="wrap" justifyContent="center">
              <ColorCodedText value={value} fontSize={32} />
            </XStack>
            <Pressable onPress={onCopy}>
              <XStack
                alignItems="center"
                gap="$2"
                paddingVertical="$2"
                paddingHorizontal="$4"
              >
                <Ionicons
                  name={copied ? "checkmark-circle" : "copy-outline"}
                  size={20}
                  color={copied ? theme.green10.get() : theme.blue10.get()}
                />
                <Text fontSize="$4" color={copied ? "$green10" : "$blue10"}>
                  {copied ? "Copied" : "Copy"}
                </Text>
              </XStack>
            </Pressable>
          </YStack>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.6)",
    justifyContent: "center",
    alignItems: "center",
  },
});
