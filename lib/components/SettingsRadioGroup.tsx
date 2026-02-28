import { Ionicons } from "@expo/vector-icons";
import { Pressable } from "react-native";
import { XStack, Text, YStack } from "tamagui";

export interface SettingsOption {
  label: string;
  value: string | number | boolean | null;
}

interface SettingsRadioGroupProps {
  options: readonly SettingsOption[];
  selected: string | number | boolean | null;
  onSelect: (value: SettingsOption["value"]) => void;
}

export default function SettingsRadioGroup({
  options,
  selected,
  onSelect,
}: SettingsRadioGroupProps) {
  return (
    <YStack>
      {options.map((option) => (
        <Pressable
          key={String(option.value)}
          onPress={() => onSelect(option.value)}
        >
          <XStack
            paddingVertical="$3"
            paddingHorizontal="$2"
            alignItems="center"
            justifyContent="space-between"
          >
            <Text fontSize="$4">{option.label}</Text>
            {selected === option.value && (
              <Ionicons name="checkmark" size={20} color="#007AFF" />
            )}
          </XStack>
        </Pressable>
      ))}
    </YStack>
  );
}
