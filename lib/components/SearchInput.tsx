import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect } from "expo-router";
import { useCallback, useRef } from "react";
import { Pressable } from "react-native";
import { XStack, Input, type TamaguiElement, useTheme } from "tamagui";

export interface SearchInputProps {
  value: string;
  onChangeText: (text: string) => void;
  onClear: () => void;
}

export function SearchInput({
  value,
  onChangeText,
  onClear,
}: SearchInputProps) {
  const inputRef = useRef<TamaguiElement>(null);
  const theme = useTheme();

  useFocusEffect(
    useCallback(() => {
      if (inputRef.current) {
        const timer = setTimeout(() => {
          inputRef.current?.focus();
        }, 100);
        return () => clearTimeout(timer);
      }
    }, []),
  );

  return (
    <XStack
      alignItems="center"
      gap="$2"
      backgroundColor="$gray2"
      borderRadius="$4"
      paddingHorizontal="$3"
      paddingVertical="$2"
    >
      <Ionicons name="search" size={20} color={theme.gray9.get()} />
      <Input
        ref={inputRef}
        flex={1}
        placeholder="Search..."
        value={value}
        onChangeText={onChangeText}
        unstyled
        size="$4"
      />
      {value.length > 0 && (
        <Pressable onPress={onClear}>
          <Ionicons name="close-circle" size={20} color={theme.gray9.get()} />
        </Pressable>
      )}
    </XStack>
  );
}
