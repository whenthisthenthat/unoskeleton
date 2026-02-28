import ItemListView from "@/lib/components/ItemListView";
import { useInlineSearch } from "@/lib/hooks/useInlineSearch";
import { useVaultSubscription } from "@/lib/hooks/useVaultSubscription";
import { getVault } from "@/lib/vault/vault-instance";
import { useRouter } from "expo-router";
import { useMemo } from "react";

export default function SearchScreen() {
  const router = useRouter();

  const { searchText, searchExpanded, setSearchExpanded, setSearchText } =
    useInlineSearch(true);

  const { loadingProgress, revision } = useVaultSubscription();

  const items = useMemo(() => {
    try {
      return getVault().getAllItems(searchText);
    } catch (error) {
      router.replace("/lock");
      return [];
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- revision triggers re-computation on vault data change
  }, [searchText, router, revision]);

  return (
    <ItemListView
      title="Search All"
      items={items}
      loadingProgress={loadingProgress}
      showBackButton
      showSearchButton={false}
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
