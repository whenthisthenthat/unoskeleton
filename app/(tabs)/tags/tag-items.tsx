import ItemListView from "@/lib/components/ItemListView";
import { useInlineSearch } from "@/lib/hooks/useInlineSearch";
import { useVaultSubscription } from "@/lib/hooks/useVaultSubscription";
import { getVault } from "@/lib/vault/vault-instance";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useMemo } from "react";

export default function TagItemsView() {
  const { tag } = useLocalSearchParams();
  const router = useRouter();

  const { searchText, searchExpanded, setSearchExpanded, setSearchText } =
    useInlineSearch();

  const { loadingProgress, revision } = useVaultSubscription();

  // Fetch items based on tag and search text
  const items = useMemo(() => {
    try {
      return getVault().getItemsByTag(tag as string, searchText);
    } catch (error) {
      router.replace("/lock");
      return [];
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- revision triggers re-computation on vault data change
  }, [tag, searchText, router, revision]);

  return (
    <ItemListView
      title={tag as string}
      items={items}
      loadingProgress={loadingProgress}
      showBackButton
      search={{
        inline: true,
        searchText,
        onSearchChange: setSearchText,
        searchExpanded,
        onSearchExpandedChange: setSearchExpanded,
      }}
    />
  );
}
