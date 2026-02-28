import type { CloudFolderEntry } from "@/lib/cloud/cloud-provider";
import { Ionicons } from "@expo/vector-icons";
import { FlatList, Pressable, StyleSheet } from "react-native";
import { YStack, XStack, Text, Button, Spinner, useTheme } from "tamagui";

interface CloudFolderBrowserProps {
  currentPath: string;
  entries: CloudFolderEntry[];
  loading: boolean;
  error: string | null;
  hasProfile: boolean;
  onNavigate: (path: string) => void;
  onNavigateUp: () => void;
  onSelect: () => void;
  onCancel: () => void;
}

export default function CloudFolderBrowser({
  currentPath,
  entries,
  loading,
  error,
  hasProfile,
  onNavigate,
  onNavigateUp,
  onSelect,
  onCancel,
}: CloudFolderBrowserProps) {
  const theme = useTheme();

  const displayPath = currentPath || "/";

  return (
    <YStack flex={1} backgroundColor="$background">
      {/* Header */}
      <YStack
        padding="$3"
        borderBottomWidth={1}
        borderBottomColor="$borderColor"
        gap="$2"
      >
        <XStack alignItems="center" gap="$2">
          {currentPath !== "" && (
            <Pressable onPress={onNavigateUp} disabled={loading}>
              <Ionicons
                name="arrow-back"
                size={24}
                color={theme.blue10.get()}
              />
            </Pressable>
          )}
          <Text flex={1} fontSize="$4" fontWeight="600" numberOfLines={1}>
            Dropbox: {displayPath}
          </Text>
        </XStack>
      </YStack>

      {/* Error */}
      {error && (
        <YStack padding="$3">
          <Text color="$red10" textAlign="center">
            {error}
          </Text>
        </YStack>
      )}

      {/* Loading */}
      {loading && (
        <YStack flex={1} justifyContent="center" alignItems="center">
          <Spinner size="large" />
          <Text color="$gray10" marginTop="$2">
            Loading...
          </Text>
        </YStack>
      )}

      {/* Folder contents */}
      {!loading && (
        <FlatList
          data={entries}
          keyExtractor={(item) => item.path}
          renderItem={({ item }) => (
            <FolderEntry
              entry={item}
              onPress={() => {
                if (item.isFolder) {
                  onNavigate(item.path);
                }
              }}
            />
          )}
          ListEmptyComponent={
            <YStack padding="$4" alignItems="center">
              <Text color="$gray10">This folder is empty</Text>
            </YStack>
          }
          style={styles.list}
        />
      )}

      {/* Action buttons */}
      <YStack
        padding="$3"
        gap="$2"
        borderTopWidth={1}
        borderTopColor="$borderColor"
      >
        {hasProfile && (
          <Button size="$4" theme="active" onPress={onSelect}>
            Select This Vault
          </Button>
        )}
        <Button size="$4" variant="outlined" onPress={onCancel}>
          Cancel
        </Button>
      </YStack>
    </YStack>
  );
}

function FolderEntry({
  entry,
  onPress,
}: {
  entry: CloudFolderEntry;
  onPress: () => void;
}) {
  const theme = useTheme();

  return (
    <Pressable
      onPress={entry.isFolder ? onPress : undefined}
      style={({ pressed }) => [
        styles.entry,
        pressed && entry.isFolder && { backgroundColor: theme.gray3.get() },
      ]}
    >
      <XStack alignItems="center" gap="$3" padding="$3">
        <Ionicons
          name={entry.isFolder ? "folder" : "document-text"}
          size={24}
          color={entry.isFolder ? theme.blue10.get() : theme.gray10.get()}
        />
        <Text
          flex={1}
          fontSize="$4"
          color={entry.isFolder ? "$color" : "$gray10"}
          numberOfLines={1}
        >
          {entry.name}
        </Text>
        {entry.isFolder && (
          <Ionicons
            name="chevron-forward"
            size={20}
            color={theme.gray8.get()}
          />
        )}
      </XStack>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  list: {
    flex: 1,
  },
  entry: {
    borderRadius: 8,
  },
});
