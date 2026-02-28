import HamburgerMenu from "@/lib/components/HamburgerMenu";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { Pressable } from "react-native";
import { XStack, H2, useTheme } from "tamagui";

type ListViewHeaderProps = {
  title: string;
  showBackButton?: boolean;
  showMenuButton?: boolean;
} & (
  | { showSearchButton?: false }
  | { showSearchButton: true; onSearchPress: () => void }
);

export default function ListViewHeader(props: ListViewHeaderProps) {
  const { title, showBackButton = false, showMenuButton = true } = props;
  const router = useRouter();
  const theme = useTheme();

  const layout = showBackButton ? "flex-start" : "space-between";

  return (
    <XStack
      padding="$4"
      paddingTop="$6"
      alignItems="center"
      gap="$3"
      justifyContent={layout}
    >
      {/* Back button */}
      {showBackButton && (
        <Pressable onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={28} color={theme.blue10.get()} />
        </Pressable>
      )}

      {/* Title - flex grows when showBackButton to push buttons to far right */}
      <H2 flex={showBackButton ? 1 : undefined}>{title}</H2>

      {/* Right-side button group */}
      <XStack gap="$3" alignItems="center">
        {/* Search button */}
        {props.showSearchButton && (
          <Pressable onPress={props.onSearchPress}>
            <Ionicons name="search" size={28} color={theme.blue10.get()} />
          </Pressable>
        )}

        {/* Hamburger menu button */}
        {showMenuButton && <HamburgerMenu />}
      </XStack>
    </XStack>
  );
}
