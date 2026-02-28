import { CountCard } from "@/lib/components/CountCard";
import ListViewHeader from "@/lib/components/ListViewHeader";
import { useScrollToTopOnTabSwitch } from "@/lib/hooks/useScrollToTopOnTabSwitch";
import type { LoadingProgress } from "@/lib/vault/types";
import { FlashList } from "@shopify/flash-list";
import { useRouter, useSegments } from "expo-router";
import { useRef } from "react";
import { View } from "react-native";
import { YStack, Spinner, Text } from "tamagui";

export interface ListItem {
  key: string;
  name: string;
  count: number;
  icon: string;
}

export interface ListWithCountsViewProps {
  title: string;
  items: ListItem[];
  loadingProgress?: LoadingProgress | null;
  onItemPress: (itemKey: string) => void;
}

export default function ListWithCountsView({
  title,
  items,
  loadingProgress = null,
  onItemPress,
}: ListWithCountsViewProps) {
  const router = useRouter();
  const segments = useSegments();
  const tab = segments[1];
  const listRef = useRef<FlashList<ListItem>>(null);

  useScrollToTopOnTabSwitch(listRef);

  return (
    <YStack flex={1} backgroundColor="$background">
      <ListViewHeader
        title={title}
        showSearchButton
        onSearchPress={() =>
          router.navigate(
            `/(tabs)/${tab}/search` as "/(tabs)/favourites/search",
          )
        }
      />

      <FlashList
        ref={listRef}
        data={items}
        renderItem={({ item }) => (
          <CountCard
            icon={item.icon}
            name={item.name}
            count={item.count}
            onPress={() => onItemPress(item.key)}
          />
        )}
        keyExtractor={(item) => item.key}
        contentContainerStyle={{ padding: 16 }}
        ItemSeparatorComponent={() => <View style={{ height: 12 }} />}
        ListFooterComponent={
          loadingProgress ? (
            <YStack padding="$4" alignItems="center">
              <Spinner size="small" />
              <Text fontSize="$2" color="$gray10" paddingTop="$2">
                Loading more items... {loadingProgress.loaded}/
                {loadingProgress.total} bands
              </Text>
            </YStack>
          ) : null
        }
      />
    </YStack>
  );
}
