import { useAttachmentExport } from "@/lib/hooks/useAttachmentExport";
import type { AttachmentInfo } from "@/lib/vault/types";
import { Ionicons } from "@expo/vector-icons";
import { Pressable } from "react-native";
import { Card, Spinner, Text, XStack, YStack, useTheme } from "tamagui";

interface AttachmentSectionCardProps {
  attachments: AttachmentInfo[];
  itemId: string;
}

export function AttachmentSectionCard({
  attachments,
  itemId,
}: AttachmentSectionCardProps) {
  const { previewAttachment, saveAttachment, shareAttachment, activeId } =
    useAttachmentExport(itemId);

  return (
    <Card borderWidth="$0.5" borderColor="$borderColor">
      <Card.Header padding="$4" paddingBottom="$2">
        <Text fontSize="$3" fontWeight="bold" color="$gray10">
          Attachments
        </Text>
      </Card.Header>
      <YStack padding="$4" paddingTop="$2" gap="$2">
        {attachments.map((att) => (
          <AttachmentTile
            key={att.uuid}
            attachment={att}
            active={activeId === att.uuid}
            onPreview={() => previewAttachment(att.uuid, att.filename)}
            onSave={() => saveAttachment(att.uuid, att.filename)}
            onShare={() => shareAttachment(att.uuid, att.filename)}
          />
        ))}
      </YStack>
    </Card>
  );
}

interface AttachmentTileProps {
  attachment: AttachmentInfo;
  active: boolean;
  onPreview: () => void;
  onSave: () => void;
  onShare: () => void;
}

function AttachmentTile({
  attachment,
  active,
  onPreview,
  onSave,
  onShare,
}: AttachmentTileProps) {
  const theme = useTheme();
  const iconName = getFileIcon(attachment.filename);
  const iconColor = theme.blue10.get();

  return (
    <Card
      borderWidth="$0.5"
      borderColor="$borderColor"
      paddingVertical="$2.5"
      paddingHorizontal="$3"
    >
      <YStack gap="$2">
        <XStack alignItems="center" gap="$3">
          <Ionicons name={iconName} size={20} color={theme.gray10.get()} />
          <Text flex={1} fontSize="$3" numberOfLines={1} ellipsizeMode="middle">
            {attachment.filename}
          </Text>
        </XStack>
        <XStack alignItems="center" justifyContent="space-between">
          <Text fontSize="$2" color="$gray9">
            {formatFileSize(attachment.size)}
          </Text>
          {active ? (
            <Spinner size="small" />
          ) : (
            <XStack gap="$4">
              <Pressable onPress={onPreview}>
                <Ionicons name="eye-outline" size={20} color={iconColor} />
              </Pressable>
              <Pressable onPress={onSave}>
                <Ionicons name="download-outline" size={20} color={iconColor} />
              </Pressable>
              <Pressable onPress={onShare}>
                <Ionicons name="share-outline" size={20} color={iconColor} />
              </Pressable>
            </XStack>
          )}
        </XStack>
      </YStack>
    </Card>
  );
}

function getFileIcon(
  filename: string,
): React.ComponentProps<typeof Ionicons>["name"] {
  const ext = filename.split(".").pop()?.toLowerCase();
  switch (ext) {
    case "jpg":
    case "jpeg":
    case "png":
    case "gif":
    case "bmp":
    case "webp":
      return "image-outline";
    case "pdf":
      return "document-text-outline";
    case "mp4":
    case "mov":
    case "avi":
      return "film-outline";
    default:
      return "document-outline";
  }
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
