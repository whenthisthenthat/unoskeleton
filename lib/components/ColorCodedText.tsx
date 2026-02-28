import { MONO_FONT } from "@/lib/components/constants";
import { XStack, Text } from "tamagui";

interface ColorCodedTextProps {
  value: string;
  fontSize: number;
}

export function ColorCodedText({ value, fontSize }: ColorCodedTextProps) {
  return (
    <XStack flexWrap="wrap">
      {[...value].map((char, i) => {
        let color: string;
        if (/[a-zA-Z]/.test(char)) {
          color = "$color";
        } else if (/[0-9]/.test(char)) {
          color = "$blue10";
        } else {
          color = "$orange10";
        }
        return (
          <Text
            key={i}
            fontFamily={MONO_FONT}
            fontSize={fontSize}
            color={color}
          >
            {char}
          </Text>
        );
      })}
    </XStack>
  );
}
