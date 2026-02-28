import { Text } from "tamagui";

export function FieldLabel({ children }: { children: string }) {
  return (
    <Text fontSize="$2" color="$gray9" textTransform="uppercase">
      {children}
    </Text>
  );
}
