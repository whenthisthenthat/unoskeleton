import { getVault } from "@/lib/vault/vault-instance";
import { Directory, File, Paths } from "expo-file-system";
import * as IntentLauncher from "expo-intent-launcher";
import * as Sharing from "expo-sharing";
import { useCallback, useState } from "react";
import { Platform } from "react-native";

interface UseAttachmentExportResult {
  previewAttachment: (attachmentId: string, filename: string) => Promise<void>;
  saveAttachment: (attachmentId: string, filename: string) => Promise<void>;
  shareAttachment: (attachmentId: string, filename: string) => Promise<void>;
  activeId: string | null;
}

/**
 * Sanitize filename for use in file:// URIs.
 * Replaces characters illegal in Android/iOS file paths (brackets, spaces, etc.)
 * while preserving the extension for MIME type detection.
 */
export function sanitizeFilename(name: string): string {
  return name.replace(/[^a-zA-Z0-9._-]/g, "_");
}

/**
 * Decrypt attachment content and write to a temp file in the cache directory.
 * Shared by preview, save, and share actions.
 */
async function decryptToTempFile(
  itemId: string,
  attachmentId: string,
  filename: string,
): Promise<File> {
  const content = await getVault().getAttachmentContent(itemId, attachmentId);
  const tempFile = new File(Paths.cache, sanitizeFilename(filename));
  tempFile.write(content);
  return tempFile;
}

export function useAttachmentExport(itemId: string): UseAttachmentExportResult {
  const [activeId, setActiveId] = useState<string | null>(null);

  const previewAttachment = useCallback(
    async (attachmentId: string, filename: string) => {
      if (activeId) return;
      setActiveId(attachmentId);
      try {
        const tempFile = await decryptToTempFile(
          itemId,
          attachmentId,
          filename,
        );
        const mimeType = guessMimeType(filename);
        if (Platform.OS === "android") {
          await IntentLauncher.startActivityAsync(
            "android.intent.action.VIEW",
            {
              data: tempFile.contentUri,
              type: mimeType,
              flags: 1, // FLAG_GRANT_READ_URI_PERMISSION
            },
          );
        } else {
          await Sharing.shareAsync(tempFile.uri, { mimeType });
        }
      } catch (err) {
      } finally {
        setActiveId(null);
      }
    },
    [itemId, activeId],
  );

  const saveAttachment = useCallback(
    async (attachmentId: string, filename: string) => {
      if (activeId) return;
      setActiveId(attachmentId);
      try {
        const content = await getVault().getAttachmentContent(
          itemId,
          attachmentId,
        );
        const destDir = await Directory.pickDirectoryAsync();
        const destFile = destDir.createFile(filename, guessMimeType(filename));
        destFile.write(content);
      } catch (err) {
      } finally {
        setActiveId(null);
      }
    },
    [itemId, activeId],
  );

  const shareAttachment = useCallback(
    async (attachmentId: string, filename: string) => {
      if (activeId) return;
      setActiveId(attachmentId);
      try {
        const tempFile = await decryptToTempFile(
          itemId,
          attachmentId,
          filename,
        );
        await Sharing.shareAsync(tempFile.uri, {
          mimeType: guessMimeType(filename),
        });
      } catch (err) {
      } finally {
        setActiveId(null);
      }
    },
    [itemId, activeId],
  );

  return { previewAttachment, saveAttachment, shareAttachment, activeId };
}

export function guessMimeType(filename: string): string {
  const ext = filename.split(".").pop()?.toLowerCase();
  switch (ext) {
    case "jpg":
    case "jpeg":
      return "image/jpeg";
    case "png":
      return "image/png";
    case "gif":
      return "image/gif";
    case "pdf":
      return "application/pdf";
    case "txt":
      return "text/plain";
    case "doc":
    case "docx":
      return "application/msword";
    default:
      return "application/octet-stream";
  }
}
