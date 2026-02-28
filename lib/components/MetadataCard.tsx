import { Ionicons } from "@expo/vector-icons";
import { YStack, XStack, Text, Card, useTheme } from "tamagui";

interface MetadataCardProps {
  categoryName: string;
  isFavorite: boolean;
  created: Date;
  updated: Date;
  tags: string[];
}

export function MetadataCard({
  categoryName,
  isFavorite,
  created,
  updated,
  tags,
}: MetadataCardProps) {
  const theme = useTheme();

  return (
    <Card borderWidth="$0.5" borderColor="$borderColor">
      <Card.Header padding="$4">
        <YStack gap="$3">
          <XStack alignItems="center" gap="$2">
            <Ionicons
              name={isFavorite ? "heart" : "heart-outline"}
              size={24}
              color={isFavorite ? theme.red10.get() : theme.gray9.get()}
            />
            <Text fontSize="$4">
              {isFavorite ? "Favourited" : "Not favourited"}
            </Text>
          </XStack>
          <YStack gap="$2">
            <YStack>
              <Text fontSize="$2" color="$gray9">
                Category
              </Text>
              <Text fontSize="$3">{categoryName}</Text>
            </YStack>
            {tags.length > 0 && (
              <YStack>
                <Text fontSize="$2" color="$gray9">
                  Tags
                </Text>
                <XStack gap="$2" flexWrap="wrap" paddingTop="$1">
                  {[...new Set(tags)].map((tag) => (
                    <XStack
                      key={tag}
                      backgroundColor="$gray4"
                      paddingHorizontal="$2.5"
                      paddingVertical="$1"
                      borderRadius="$10"
                    >
                      <Text fontSize="$2" color="$gray11">
                        {tag}
                      </Text>
                    </XStack>
                  ))}
                </XStack>
              </YStack>
            )}
            <YStack>
              <Text fontSize="$2" color="$gray9">
                Created
              </Text>
              <Text fontSize="$3">{created.toLocaleString()}</Text>
            </YStack>
            <YStack>
              <Text fontSize="$2" color="$gray9">
                Updated
              </Text>
              <Text fontSize="$3">{updated.toLocaleString()}</Text>
            </YStack>
          </YStack>
        </YStack>
      </Card.Header>
    </Card>
  );
}
