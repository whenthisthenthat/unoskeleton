import { AttachmentSectionCard } from "@/lib/components/AttachmentSectionCard";
import { DetailSectionCard } from "@/lib/components/DetailSectionCard";
import ListViewHeader from "@/lib/components/ListViewHeader";
import { MetadataCard } from "@/lib/components/MetadataCard";
import { useItemDetails } from "@/lib/hooks/useItemDetails";
import { useVaultSubscription } from "@/lib/hooks/useVaultSubscription";
import { getCategoryName } from "@/lib/vault/categories";
import { isItemFavorite } from "@/lib/vault/item-display";
import { getVault } from "@/lib/vault/vault-instance";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useMemo } from "react";
import { ScrollView } from "react-native";
import { YStack, H2, Text, Card, Spinner } from "tamagui";

const FORM_SECTION_TITLE = "Saved from form details";

export default function ItemDetailScreen() {
  const { uuid } = useLocalSearchParams();
  const router = useRouter();
  const { revision } = useVaultSubscription();

  const item = useMemo(() => {
    try {
      return getVault().getItemByUuid(uuid as string);
    } catch (error) {
      router.replace("/lock");
      return undefined;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [uuid, router, revision]);

  const isFav = item ? isItemFavorite(item) : false;
  const categoryName = item ? getCategoryName(item.category) : "";
  const {
    sections,
    attachments,
    loading: detailsLoading,
    error: detailsError,
  } = useItemDetails(item);

  // Split sections: main sections before form details, form sections after
  const mainSections = useMemo(
    () => sections?.filter((s) => s.title !== FORM_SECTION_TITLE) ?? [],
    [sections],
  );
  const formSections = useMemo(
    () => sections?.filter((s) => s.title === FORM_SECTION_TITLE) ?? [],
    [sections],
  );

  if (!item) {
    return (
      <YStack
        flex={1}
        backgroundColor="$background"
        justifyContent="center"
        alignItems="center"
      >
        <Text>Item not found</Text>
      </YStack>
    );
  }

  return (
    <YStack flex={1} backgroundColor="$background">
      <ListViewHeader title={item.title} showBackButton={true} />

      <ScrollView>
        <YStack padding="$4" gap="$4" alignItems="center">
          {/* Icon + Title + Subtitle */}
          <Text fontSize={80}>{item.icon}</Text>

          <YStack gap="$2" alignItems="center" width="100%">
            <H2 textAlign="center">{item.title}</H2>
            {item.subtitle.length > 0 && (
              <Text fontSize="$5" color="$gray10" textAlign="center">
                {item.subtitle}
              </Text>
            )}
          </YStack>

          <YStack gap="$3" width="100%" paddingTop="$4">
            {/* Detail sections (loaded async) */}
            {detailsLoading && (
              <YStack padding="$6" alignItems="center">
                <Spinner size="small" />
                <Text color="$gray9" paddingTop="$2">
                  Decrypting...
                </Text>
              </YStack>
            )}

            {detailsError && (
              <Card borderWidth="$0.5" borderColor="$red5">
                <Card.Header padding="$4">
                  <Text color="$red10">
                    Failed to load details: {detailsError}
                  </Text>
                </Card.Header>
              </Card>
            )}

            {/* Main sections (primary, websites, detail, notes, linked apps) */}
            {mainSections.map((section, index) => (
              <DetailSectionCard key={`section-${index}`} section={section} />
            ))}

            {/* Attachments (after notes/linked apps, before form details) */}
            {attachments && attachments.length > 0 && (
              <AttachmentSectionCard
                attachments={attachments}
                itemId={item.uuid}
              />
            )}

            {/* Form detail sections */}
            {formSections.map((section, index) => (
              <DetailSectionCard key={`form-${index}`} section={section} />
            ))}

            <MetadataCard
              categoryName={categoryName}
              isFavorite={isFav}
              created={item.created}
              updated={item.updated}
              tags={item.tags}
            />
          </YStack>
        </YStack>
      </ScrollView>
    </YStack>
  );
}
