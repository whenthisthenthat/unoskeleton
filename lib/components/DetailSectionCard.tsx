import { DetailFieldRow } from "@/lib/components/DetailFieldRow";
import { TotpFieldRow } from "@/lib/components/TotpFieldRow";
import type { DisplaySection } from "@/lib/vault/types";
import { Card, YStack, Text, Separator } from "tamagui";

interface DetailSectionCardProps {
  section: DisplaySection;
}

export function DetailSectionCard({ section }: DetailSectionCardProps) {
  return (
    <Card borderWidth="$0.5" borderColor="$borderColor">
      {section.title.length > 0 && (
        <Card.Header padding="$4" paddingBottom="$0">
          <Text fontSize="$3" fontWeight="bold" color="$gray10">
            {section.title}
          </Text>
        </Card.Header>
      )}
      <YStack>
        {section.fields.map((field, index) => (
          <YStack key={`${field.label}-${index}`}>
            {index > 0 && <Separator />}
            {field.kind === "totp" ? (
              <TotpFieldRow label={field.label} uri={field.value} />
            ) : (
              <DetailFieldRow field={field} />
            )}
          </YStack>
        ))}
      </YStack>
    </Card>
  );
}
