import { isItemFavorite } from "@/lib/vault/item-display";
import type { Item } from "@/lib/vault/types";
import { useRouter, useSegments } from "expo-router";
import { memo } from "react";
import { Pressable } from "react-native";
import { YStack, XStack, Text, Card } from "tamagui";

export const ItemCard = memo(function ItemCard({ item }: { item: Item }) {
  const router = useRouter();
  const segments = useSegments();
  const tab = segments[1];

  return (
    <Pressable
      onPress={() =>
        router.navigate(
          `/(tabs)/${tab}/item-detail?uuid=${item.uuid}` as `/(tabs)/favourites/item-detail`,
        )
      }
    >
      <Card size="$4" borderWidth="$0.5" borderColor="$borderColor">
        <Card.Header padding="$4">
          <XStack gap="$3" alignItems="center">
            <YStack position="relative" width={40} height={40}>
              <Text fontSize={40}>{item.icon}</Text>
              {isItemFavorite(item) && (
                <Text fontSize={20} position="absolute" bottom={-5} right={-5}>
                  ❤️
                </Text>
              )}
            </YStack>
            <YStack flex={1}>
              <Text fontSize="$5" fontWeight="bold">
                {item.title}
              </Text>
              <Text fontSize="$3" color="$gray10">
                {item.subtitle}
              </Text>
            </YStack>
          </XStack>
        </Card.Header>
      </Card>
    </Pressable>
  );
});
