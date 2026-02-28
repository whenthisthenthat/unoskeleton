import ItemListView from "@/lib/components/ItemListView";
import { useVaultSubscription } from "@/lib/hooks/useVaultSubscription";
import { getVault } from "@/lib/vault/vault-instance";
import { useRouter } from "expo-router";
import { useMemo } from "react";

export default function FavouritesView() {
  const router = useRouter();
  const { loadingProgress, revision } = useVaultSubscription();

  const items = useMemo(() => {
    try {
      return getVault().getFavoriteItems();
    } catch (error) {
      router.replace("/lock");
      return [];
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- revision triggers re-computation on vault data change
  }, [router, revision]);

  return (
    <ItemListView
      title="Favourites"
      items={items}
      search={{ inline: false }}
      loadingProgress={loadingProgress}
    />
  );
}
