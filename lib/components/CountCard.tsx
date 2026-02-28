import { memo } from "react";
import { Pressable } from "react-native";
import { XStack, Text, Card } from "tamagui";

export interface CountCardProps {
  icon: string;
  name: string;
  count: number;
  onPress: () => void;
}

export const CountCard = memo(function CountCard({
  icon,
  name,
  count,
  onPress,
}: CountCardProps) {
  return (
    <Pressable onPress={onPress}>
      <Card size="$4" borderWidth="$0.5" borderColor="$borderColor">
        <Card.Header padding="$4">
          <XStack gap="$3" alignItems="center">
            <Text fontSize={40}>{icon}</Text>
            <XStack flex={1} justifyContent="space-between" alignItems="center">
              <Text fontSize="$5" fontWeight="bold">
                {name}
              </Text>
              <Text fontSize="$4" color="$gray10">
                ({count})
              </Text>
            </XStack>
          </XStack>
        </Card.Header>
      </Card>
    </Pressable>
  );
});
