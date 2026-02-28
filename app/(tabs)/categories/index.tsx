import ListWithCountsView from "@/lib/components/ListWithCountsView";
import { useVaultSubscription } from "@/lib/hooks/useVaultSubscription";
import { categories } from "@/lib/vault/categories";
import { getVault } from "@/lib/vault/vault-instance";
import { useRouter } from "expo-router";
import { useMemo } from "react";

export default function CategoriesView() {
  const router = useRouter();
  const { loadingProgress, revision } = useVaultSubscription();

  const items = useMemo(() => {
    try {
      return categories.map((category) => ({
        key: category.code,
        name: category.name,
        count: getVault().getCountByCategory(category.code),
        icon: category.icon,
      }));
    } catch (error) {
      router.replace("/lock");
      return [];
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- revision triggers re-computation on vault data change
  }, [router, revision]);

  return (
    <ListWithCountsView
      title="Categories"
      items={items}
      loadingProgress={loadingProgress}
      onItemPress={(categoryCode) => {
        router.navigate(
          `/(tabs)/categories/category-items?category=${categoryCode}` as "/(tabs)/categories/category-items",
        );
      }}
    />
  );
}
