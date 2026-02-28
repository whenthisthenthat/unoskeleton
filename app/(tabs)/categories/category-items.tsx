import ItemListView from "@/lib/components/ItemListView";
import { useInlineSearch } from "@/lib/hooks/useInlineSearch";
import { useVaultSubscription } from "@/lib/hooks/useVaultSubscription";
import { categories, Category } from "@/lib/vault/categories";
import { getVault } from "@/lib/vault/vault-instance";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useMemo } from "react";

export default function CategoryItemsView() {
  const { category } = useLocalSearchParams<{ category: Category }>();
  const router = useRouter();

  const { searchText, searchExpanded, setSearchExpanded, setSearchText } =
    useInlineSearch();

  const { loadingProgress, revision } = useVaultSubscription();

  const categoryName = useMemo(() => {
    const cat = categories.find((c) => c.code === category);
    return cat?.name || "Items";
  }, [category]);

  // Fetch items based on category and search text
  const items = useMemo(() => {
    try {
      if (!category || Array.isArray(category)) return [];
      return getVault().getItemsByCategory(category as Category, searchText);
    } catch (error) {
      router.replace("/lock");
      return [];
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- revision triggers re-computation on vault data change
  }, [category, searchText, router, revision]);

  return (
    <ItemListView
      title={categoryName}
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
