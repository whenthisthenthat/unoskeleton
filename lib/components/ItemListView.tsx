import { ItemCard } from "@/lib/components/ItemCard";
import ListViewHeader from "@/lib/components/ListViewHeader";
import { SearchInput } from "@/lib/components/SearchInput";
import { useScrollToTopOnTabSwitch } from "@/lib/hooks/useScrollToTopOnTabSwitch";
import type { Item, LoadingProgress } from "@/lib/vault/types";
import { FlashList } from "@shopify/flash-list";
import { useRouter, useSegments } from "expo-router";
import { useRef } from "react";
import { View } from "react-native";
import { YStack, Text, Spinner } from "tamagui";

export type SearchConfig =
  | { inline: false }
  | {
      inline: true;
      searchText: string;
      searchExpanded: boolean;
      onSearchChange: (text: string) => void;
      onSearchExpandedChange: (expanded: boolean) => void;
    };

export interface ItemListViewProps {
  title: string;
  items: Item[];
  showBackButton?: boolean;
  search: SearchConfig;
  showSearchButton?: boolean;
  loadingProgress?: LoadingProgress | null;
}

export default function ItemListView({
  title,
  items,
  showBackButton = false,
  search,
  showSearchButton = true,
  loadingProgress = null,
}: ItemListViewProps) {
  const router = useRouter();
  const segments = useSegments();
  const tab = segments[1];
  const listRef = useRef<FlashList<Item>>(null);

  useScrollToTopOnTabSwitch(listRef);

  // Named boolean variables for better readability
  const hasItems = items.length > 0;
  const hasSearchQuery = search.inline && search.searchText.trim().length > 0;

  // Handler functions
  const handleSearchPress = () => {
    if (search.inline) {
      search.onSearchExpandedChange(true);
    } else {
      router.navigate(`/(tabs)/${tab}/search` as "/(tabs)/favourites/search");
    }
  };

  // Empty state message
  const emptyStateMessage = hasSearchQuery ? "No results found" : "No items";

  return (
    <YStack flex={1} backgroundColor="$background">
      {/* Header Section */}
      <ListViewHeader
        title={title}
        showBackButton={showBackButton}
        showSearchButton={showSearchButton}
        onSearchPress={handleSearchPress}
      />

      {/* Inline Search Input (when expanded) */}
      {search.inline && search.searchExpanded && (
        <YStack padding="$4" paddingTop="$2">
          <SearchInput
            value={search.searchText}
            onChangeText={search.onSearchChange}
            onClear={() => search.onSearchChange("")}
          />
        </YStack>
      )}

      {/* List Section */}
      {!hasItems ? (
        <YStack flex={1} padding="$4">
          <Text textAlign="center" color="$gray10" paddingTop="$8">
            {emptyStateMessage}
          </Text>
        </YStack>
      ) : (
        <FlashList
          ref={listRef}
          data={items}
          renderItem={({ item }) => <ItemCard item={item} />}
          keyExtractor={(item) => item.uuid}
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
      )}
    </YStack>
  );
}
