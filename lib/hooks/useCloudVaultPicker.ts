import type {
  CloudFolderEntry,
  ICloudProvider,
} from "@/lib/cloud/cloud-provider";
import {
  getStoredDropboxAppKey,
  setStoredDropboxAppKey,
} from "@/lib/cloud/dropbox/dropbox-app-key-store";
import {
  authenticateDropbox,
  hasDropboxAppKey,
  isDropboxAuthenticated,
  signOutDropbox,
} from "@/lib/cloud/dropbox/dropbox-auth";
import { DropboxProvider } from "@/lib/cloud/dropbox/dropbox-provider";
import { useCallback, useReducer, useRef } from "react";

export interface CloudVaultSource {
  provider: ICloudProvider;
  cloudPath: string;
  displayName: string;
}

// --- Reducer ---

export interface CloudPickerState {
  authenticated: boolean;
  browsing: boolean;
  currentPath: string;
  entries: CloudFolderEntry[];
  error: string | null;
  loading: boolean;
  appKeyMissing: boolean;
  currentAppKey: string | null;
}

export type CloudPickerAction =
  | { type: "SET_AUTHENTICATED"; authenticated: boolean }
  | { type: "ASYNC_START" }
  | { type: "ASYNC_DONE" }
  | { type: "AUTH_SUCCESS"; entries: CloudFolderEntry[] }
  | { type: "AUTH_FAILED"; error: string }
  | { type: "APP_KEY_REQUIRED"; currentAppKey: string | null }
  | { type: "APP_KEY_SAVED" }
  | { type: "APP_KEY_CANCELLED" }
  | { type: "BROWSE_SUCCESS"; entries: CloudFolderEntry[]; path: string }
  | { type: "BROWSE_FAILED"; error: string }
  | { type: "VAULT_SELECTED" }
  | { type: "VAULT_INVALID"; error: string }
  | { type: "SIGNED_OUT" }
  | { type: "BROWSING_CANCELLED" };

export const initialCloudPickerState: CloudPickerState = {
  authenticated: false,
  browsing: false,
  currentPath: "",
  entries: [],
  error: null,
  loading: false,
  appKeyMissing: false,
  currentAppKey: null,
};

export function cloudPickerReducer(
  state: CloudPickerState,
  action: CloudPickerAction,
): CloudPickerState {
  switch (action.type) {
    case "SET_AUTHENTICATED":
      return { ...state, authenticated: action.authenticated };
    case "ASYNC_START":
      return { ...state, error: null, loading: true };
    case "AUTH_SUCCESS":
      return {
        ...state,
        authenticated: true,
        browsing: true,
        entries: action.entries,
        currentPath: "",
      };
    case "AUTH_FAILED":
      return { ...state, error: action.error };
    case "ASYNC_DONE":
      return { ...state, loading: false };
    case "APP_KEY_REQUIRED":
      return {
        ...state,
        appKeyMissing: true,
        currentAppKey: action.currentAppKey,
      };
    case "APP_KEY_SAVED":
      return { ...state, appKeyMissing: false };
    case "APP_KEY_CANCELLED":
      return { ...state, appKeyMissing: false, error: null };
    case "BROWSE_SUCCESS":
      return {
        ...state,
        entries: action.entries,
        currentPath: action.path,
      };
    case "BROWSE_FAILED":
      return { ...state, error: action.error };
    case "VAULT_SELECTED":
      return { ...state, browsing: false };
    case "VAULT_INVALID":
      return { ...state, error: action.error };
    case "SIGNED_OUT":
      return initialCloudPickerState;
    case "BROWSING_CANCELLED":
      return {
        ...state,
        browsing: false,
        currentPath: "",
        entries: [],
        error: null,
      };
    default:
      return state;
  }
}

// --- Hook ---

export function useCloudVaultPicker() {
  const [state, dispatch] = useReducer(
    cloudPickerReducer,
    initialCloudPickerState,
  );

  const providerRef = useRef(new DropboxProvider());
  const provider = providerRef.current;

  /** Check if already authenticated on mount */
  const checkAuth = useCallback(async (): Promise<boolean> => {
    const authed = await isDropboxAuthenticated();
    dispatch({ type: "SET_AUTHENTICATED", authenticated: authed });
    return authed;
  }, []);

  /** Start Dropbox OAuth flow */
  const authenticate = useCallback(async (): Promise<boolean> => {
    dispatch({ type: "ASYNC_START" });
    try {
      const success = await authenticateDropbox();
      if (success) {
        const rootEntries = await provider.listFolderContents("");
        dispatch({ type: "AUTH_SUCCESS", entries: sortEntries(rootEntries) });
      } else {
        dispatch({ type: "SET_AUTHENTICATED", authenticated: false });
      }
      return success;
    } catch (err) {
      dispatch({
        type: "AUTH_FAILED",
        error: err instanceof Error ? err.message : "Authentication failed",
      });
      return false;
    } finally {
      dispatch({ type: "ASYNC_DONE" });
    }
  }, [provider]);

  /**
   * Check for a configured App Key first. If missing, set appKeyMissing state
   * so the UI can prompt for it. Otherwise proceeds directly to authenticate().
   */
  const checkAndAuthenticate = useCallback(async () => {
    const stored = await getStoredDropboxAppKey();
    const hasKey = await hasDropboxAppKey();
    if (!hasKey) {
      dispatch({ type: "APP_KEY_REQUIRED", currentAppKey: stored });
      return;
    }
    await authenticate();
  }, [authenticate]);

  /**
   * Save the provided App Key to secure storage, clear the missing-key state,
   * then start the OAuth flow.
   */
  const saveAppKeyAndAuthenticate = useCallback(
    async (key: string) => {
      await setStoredDropboxAppKey(key.trim());
      dispatch({ type: "APP_KEY_SAVED" });
      await authenticate();
    },
    [authenticate],
  );

  /** Cancel the App Key entry screen without authenticating */
  const cancelAppKeyEntry = useCallback(() => {
    dispatch({ type: "APP_KEY_CANCELLED" });
  }, []);

  /** Re-open the App Key entry screen (e.g. to correct a mistyped key) */
  const showAppKeyEntry = useCallback(async () => {
    const stored = await getStoredDropboxAppKey();
    dispatch({ type: "APP_KEY_REQUIRED", currentAppKey: stored });
  }, []);

  /** Navigate into a folder */
  const browse = useCallback(
    async (path: string) => {
      dispatch({ type: "ASYNC_START" });
      try {
        const folderEntries = await provider.listFolderContents(path);
        dispatch({
          type: "BROWSE_SUCCESS",
          entries: sortEntries(folderEntries),
          path,
        });
      } catch (err) {
        dispatch({
          type: "BROWSE_FAILED",
          error: err instanceof Error ? err.message : "Failed to load folder",
        });
      } finally {
        dispatch({ type: "ASYNC_DONE" });
      }
    },
    [provider],
  );

  /** Navigate to parent folder */
  const navigateUp = useCallback(() => {
    if (!state.currentPath) return;
    const parentPath = state.currentPath.split("/").slice(0, -1).join("/");
    browse(parentPath || "");
  }, [state.currentPath, browse]);

  /**
   * Select the current folder as a vault.
   * Validates it contains profile.js.
   * @returns CloudVaultSource or null if invalid
   */
  const selectVault = useCallback(
    (path: string): CloudVaultSource | null => {
      const hasProfile = state.entries.some(
        (e) => !e.isFolder && e.name === "profile.js",
      );
      if (!hasProfile) {
        dispatch({
          type: "VAULT_INVALID",
          error: "This folder doesn't contain a valid OPVault (no profile.js)",
        });
        return null;
      }
      dispatch({ type: "VAULT_SELECTED" });
      const displayName = path.split("/").pop() || "Dropbox Vault";
      return { provider, cloudPath: path, displayName };
    },
    [state.entries, provider],
  );

  /** Sign out and reset state */
  const signOut = useCallback(async () => {
    await signOutDropbox();
    dispatch({ type: "SIGNED_OUT" });
  }, []);

  /** Cancel browsing without signing out */
  const cancelBrowsing = useCallback(() => {
    dispatch({ type: "BROWSING_CANCELLED" });
  }, []);

  return {
    authenticated: state.authenticated,
    browsing: state.browsing,
    currentPath: state.currentPath,
    entries: state.entries,
    error: state.error,
    loading: state.loading,
    appKeyMissing: state.appKeyMissing,
    currentAppKey: state.currentAppKey,
    checkAuth,
    authenticate,
    checkAndAuthenticate,
    saveAppKeyAndAuthenticate,
    cancelAppKeyEntry,
    showAppKeyEntry,
    browse,
    navigateUp,
    selectVault,
    signOut,
    cancelBrowsing,
  };
}

/** Sort entries: folders first, then files, alphabetically within each group */
function sortEntries(entries: CloudFolderEntry[]): CloudFolderEntry[] {
  return [...entries].sort((a, b) => {
    if (a.isFolder !== b.isFolder) return a.isFolder ? -1 : 1;
    return a.name.localeCompare(b.name);
  });
}
