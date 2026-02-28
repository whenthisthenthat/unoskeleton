import { CopyIndicator } from "@/lib/components/CopyIndicator";
import { CountdownCircle } from "@/lib/components/CountdownCircle";
import { DetailRow } from "@/lib/components/DetailRow";
import { FieldLabel } from "@/lib/components/FieldLabel";
import { MONO_FONT } from "@/lib/components/constants";
import { useCopyToClipboard } from "@/lib/hooks/useCopyToClipboard";
import { useTotp } from "@/lib/hooks/useTotp";
import { Text, YStack, useTheme } from "tamagui";

interface TotpFieldRowProps {
  label: string;
  uri: string;
}

const stripWhitespace = (v: string) => v.replace(/\s/g, "");

export function TotpFieldRow({ label, uri }: TotpFieldRowProps) {
  const theme = useTheme();
  const { code, remaining, period, valid, error } = useTotp(uri);
  const { copied, handleCopy } = useCopyToClipboard(code, stripWhitespace);

  if (!valid) {
    return (
      <DetailRow>
        <YStack flex={1} gap="$1">
          <FieldLabel>{label}</FieldLabel>
          <Text fontSize="$4" color="$red10">
            {error || "Invalid TOTP"}
          </Text>
        </YStack>
      </DetailRow>
    );
  }

  const urgencyToken =
    remaining > 10 ? "blue10" : remaining > 5 ? "orange10" : "red10";
  const urgencyColor = `$${urgencyToken}` as const;
  const progressColor = theme[urgencyToken].get();
  const trackColor = theme.gray5.get();

  return (
    <DetailRow onPress={handleCopy}>
      {/* Countdown circle */}
      <CountdownCircle
        remaining={remaining}
        period={period}
        size={40}
        progressColor={progressColor}
        trackColor={trackColor}
      >
        <Text fontSize="$3" fontWeight="bold" color={urgencyColor}>
          {remaining}
        </Text>
      </CountdownCircle>

      {/* Label + Code */}
      <YStack flex={1} gap="$1">
        <FieldLabel>{label}</FieldLabel>
        <Text
          fontSize={28}
          fontFamily={MONO_FONT}
          fontWeight="bold"
          color="$color"
          letterSpacing={4}
        >
          {code}
        </Text>
      </YStack>

      {/* Copy icon */}
      <CopyIndicator copied={copied} />
    </DetailRow>
  );
}
