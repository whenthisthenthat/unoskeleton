/**
 * Dropbox implementation of ICloudProvider.
 *
 * Uses the Dropbox HTTP REST API via dropbox-api.ts.
 * Handles token refresh on 401 errors via dropbox-auth.ts.
 */
import type {
  ICloudProvider,
  CloudFolderEntry,
} from "@/lib/cloud/cloud-provider";
import {
  listFolder,
  downloadFileText,
  downloadFileBinary,
  getMetadata,
  TokenExpiredError,
} from "@/lib/cloud/dropbox/dropbox-api";
import { getValidToken } from "@/lib/cloud/dropbox/dropbox-auth";

/**
 * Execute an API call with automatic token refresh on 401.
 * Retries once after refreshing the token.
 */
async function withTokenRefresh<T>(
  fn: (token: string) => Promise<T>,
): Promise<T> {
  const token = await getValidToken();
  try {
    return await fn(token);
  } catch (err) {
    if (err instanceof TokenExpiredError) {
      const freshToken = await getValidToken();
      return fn(freshToken);
    }
    throw err;
  }
}

export class DropboxProvider implements ICloudProvider {
  readonly name = "dropbox";

  async listFiles(cloudPath: string): Promise<string[]> {
    return withTokenRefresh(async (token) => {
      const entries = await listFolder(token, cloudPath);
      return entries.filter((e) => e[".tag"] === "file").map((e) => e.name);
    });
  }

  async listFolderContents(cloudPath: string): Promise<CloudFolderEntry[]> {
    return withTokenRefresh(async (token) => {
      const entries = await listFolder(token, cloudPath);
      return entries.map((e) => ({
        name: e.name,
        path: e.path_display,
        isFolder: e[".tag"] === "folder",
      }));
    });
  }

  async downloadFile(
    cloudPath: string,
    filename: string,
  ): Promise<string | null> {
    const filePath = joinPath(cloudPath, filename);
    return withTokenRefresh((token) => downloadFileText(token, filePath));
  }

  async downloadBinaryFile(
    cloudPath: string,
    filename: string,
  ): Promise<Uint8Array | null> {
    const filePath = joinPath(cloudPath, filename);
    return withTokenRefresh((token) => downloadFileBinary(token, filePath));
  }

  async getFileChangeTag(
    cloudPath: string,
    filename: string,
  ): Promise<string | null> {
    const filePath = joinPath(cloudPath, filename);
    return withTokenRefresh(async (token) => {
      const meta = await getMetadata(token, filePath);
      return meta?.content_hash ?? null;
    });
  }
}

function joinPath(base: string, filename: string): string {
  const trimmed = base.endsWith("/") ? base.slice(0, -1) : base;
  return `${trimmed}/${filename}`;
}
