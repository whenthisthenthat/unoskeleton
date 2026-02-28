import { useNavigation } from "expo-router";
import { RefObject, useEffect } from "react";

/**
 * Scrolls a FlashList to top when the parent tab gains focus (tab switch).
 * Preserves scroll position when returning from a detail view (back navigation),
 * since intra-tab Stack navigation does not trigger the tab's focus event.
 */
export function useScrollToTopOnTabSwitch(
  listRef: RefObject<{
    scrollToOffset: (params: { offset: number; animated: boolean }) => void;
  } | null>,
) {
  const navigation = useNavigation();
  const tabNavigation = navigation.getParent();

  useEffect(() => {
    if (!tabNavigation) return;
    return tabNavigation.addListener("focus", () => {
      listRef.current?.scrollToOffset({ offset: 0, animated: false });
    });
  }, [tabNavigation, listRef]);
}
