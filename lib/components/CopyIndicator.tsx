import { Ionicons } from "@expo/vector-icons";
import { useTheme } from "tamagui";

interface CopyIndicatorProps {
  copied: boolean;
  size?: number;
}

export function CopyIndicator({ copied, size = 20 }: CopyIndicatorProps) {
  const theme = useTheme();
  return (
    <Ionicons
      name={copied ? "checkmark-circle" : "copy-outline"}
      size={size}
      color={copied ? theme.green10.get() : theme.gray9.get()}
    />
  );
}
