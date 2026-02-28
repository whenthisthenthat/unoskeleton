/**
 * Low-level Dropbox HTTP API functions.
 *
 * Uses fetch() directly — no Dropbox SDK dependency.
 * Each function accepts an access token and handles common error patterns.
 */

const API_BASE = "https://api.dropboxapi.com/2";
const CONTENT_BASE = "https://content.dropboxapi.com/2";

/** Error thrown when the access token is expired or invalid */
export class TokenExpiredError extends Error {
  constructor() {
    super("Dropbox access token expired");
    this.name = "TokenExpiredError";
  }
}

/** Error thrown for Dropbox API errors (non-auth, non-path) */
export class DropboxApiError extends Error {
  constructor(
    public readonly status: number,
    public readonly errorSummary: string,
  ) {
    super(`Dropbox API error (${status}): ${errorSummary}`);
    this.name = "DropboxApiError";
  }
}

interface DropboxListFolderResponse {
  entries: DropboxEntry[];
  cursor: string;
  has_more: boolean;
}

export interface DropboxEntry {
  ".tag": "file" | "folder";
  name: string;
  path_lower: string;
  path_display: string;
  content_hash?: string;
}

interface DropboxMetadataResponse {
  ".tag": "file" | "folder";
  name: string;
  path_lower: string;
  content_hash?: string;
}

/**
 * Handle common Dropbox error responses.
 * @throws TokenExpiredError on 401
 * @throws DropboxApiError on other error status
 * @returns null on 409 path/not_found
 */
async function handleResponse<T>(response: Response): Promise<T | null> {
  if (response.ok) {
    return (await response.json()) as T;
  }

  if (response.status === 401) {
    throw new TokenExpiredError();
  }

  const body = await response.text();

  // 409 = endpoint-specific error (path/not_found, etc.)
  if (response.status === 409) {
    try {
      const error = JSON.parse(body) as { error_summary?: string };
      if (error.error_summary?.includes("not_found")) {
        return null;
      }
      throw new DropboxApiError(409, error.error_summary ?? body);
    } catch (err) {
      if (err instanceof DropboxApiError) throw err;
      throw new DropboxApiError(409, body);
    }
  }

  throw new DropboxApiError(response.status, body);
}

function authHeaders(token: string): Record<string, string> {
  return {
    Authorization: `Bearer ${token}`,
    "Content-Type": "application/json",
  };
}

/**
 * List folder contents (files and folders).
 * Returns all entries, handling pagination automatically.
 */
export async function listFolder(
  token: string,
  path: string,
): Promise<DropboxEntry[]> {
  const response = await fetch(`${API_BASE}/files/list_folder`, {
    method: "POST",
    headers: authHeaders(token),
    body: JSON.stringify({
      path: path === "/" ? "" : path,
      include_non_downloadable_files: false,
    }),
  });

  const result = await handleResponse<DropboxListFolderResponse>(response);
  if (!result) return [];

  const entries = [...result.entries];

  // Handle pagination
  let cursor = result.cursor;
  let hasMore = result.has_more;

  while (hasMore) {
    const continueResponse = await fetch(
      `${API_BASE}/files/list_folder/continue`,
      {
        method: "POST",
        headers: authHeaders(token),
        body: JSON.stringify({ cursor }),
      },
    );
    const continueResult =
      await handleResponse<DropboxListFolderResponse>(continueResponse);
    if (!continueResult) break;

    entries.push(...continueResult.entries);
    cursor = continueResult.cursor;
    hasMore = continueResult.has_more;
  }

  return entries;
}

/** Download a file as text. Returns null if not found. */
export async function downloadFileText(
  token: string,
  path: string,
): Promise<string | null> {
  const response = await fetch(`${CONTENT_BASE}/files/download`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Dropbox-API-Arg": JSON.stringify({ path }),
    },
  });

  if (response.status === 409) return null;
  if (response.status === 401) throw new TokenExpiredError();
  if (!response.ok) {
    throw new DropboxApiError(response.status, await response.text());
  }

  return response.text();
}

/** Download a file as binary. Returns null if not found. */
export async function downloadFileBinary(
  token: string,
  path: string,
): Promise<Uint8Array | null> {
  const response = await fetch(`${CONTENT_BASE}/files/download`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Dropbox-API-Arg": JSON.stringify({ path }),
    },
  });

  if (response.status === 409) return null;
  if (response.status === 401) throw new TokenExpiredError();
  if (!response.ok) {
    throw new DropboxApiError(response.status, await response.text());
  }

  return new Uint8Array(await response.arrayBuffer());
}

/** Get metadata for a file (includes content_hash). Returns null if not found. */
export async function getMetadata(
  token: string,
  path: string,
): Promise<DropboxMetadataResponse | null> {
  const response = await fetch(`${API_BASE}/files/get_metadata`, {
    method: "POST",
    headers: authHeaders(token),
    body: JSON.stringify({ path }),
  });

  return handleResponse<DropboxMetadataResponse>(response);
}
