import ListWithCountsView from "@/lib/components/ListWithCountsView";
import { useVaultSubscription } from "@/lib/hooks/useVaultSubscription";
import { getVault } from "@/lib/vault/vault-instance";
import { useRouter } from "expo-router";
import { useMemo } from "react";

export default function TagsView() {
  const router = useRouter();
  const { loadingProgress, revision } = useVaultSubscription();

  const items = useMemo(() => {
    try {
      const counts = getVault().getAllTagCounts();

      return Array.from(counts.entries()).map(([tag, count]) => ({
        key: tag,
        name: tag,
        count,
        icon: "🏷️",
      }));
    } catch (error) {
      router.replace("/lock");
      return [];
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- revision triggers re-computation on vault data change
  }, [router, revision]);

  return (
    <ListWithCountsView
      title="Tags"
      items={items}
      loadingProgress={loadingProgress}
      onItemPress={(tag) => {
        router.navigate(
          `/(tabs)/tags/tag-items?tag=${tag}` as "/(tabs)/tags/tag-items",
        );
      }}
    />
  );
}
