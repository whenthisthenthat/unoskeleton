import type { ReactNode } from "react";
import { Pressable } from "react-native";
import { XStack } from "tamagui";

interface DetailRowProps {
  onPress?: () => void;
  children: ReactNode;
}

export function DetailRow({ onPress, children }: DetailRowProps) {
  const content = (
    <XStack
      paddingVertical="$3"
      paddingHorizontal="$4"
      alignItems="center"
      gap="$3"
    >
      {children}
    </XStack>
  );
  return onPress ? <Pressable onPress={onPress}>{content}</Pressable> : content;
}
