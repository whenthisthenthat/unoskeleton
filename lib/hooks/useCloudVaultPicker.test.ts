import type { CloudFolderEntry } from "@/lib/cloud/cloud-provider";
import {
  cloudPickerReducer,
  initialCloudPickerState,
  type CloudPickerState,
} from "@/lib/hooks/useCloudVaultPicker";

jest.mock("expo-auth-session", () => ({}));
jest.mock("expo-constants", () => ({ default: {} }));
jest.mock("expo-linking", () => ({}));
jest.mock("expo-web-browser", () => ({
  maybeCompleteAuthSession: jest.fn(),
}));
jest.mock("expo-secure-store");
jest.mock("@/lib/cloud/dropbox/dropbox-app-key-store");
jest.mock("@/lib/cloud/dropbox/dropbox-auth");
jest.mock("@/lib/cloud/dropbox/dropbox-provider");

const mockEntries: CloudFolderEntry[] = [
  { name: "folder1", path: "/folder1", isFolder: true },
  { name: "profile.js", path: "/profile.js", isFolder: false },
];

describe("cloudPickerReducer", () => {
  it("returns current state for unknown action", () => {
    const state = cloudPickerReducer(
      initialCloudPickerState,
      // @ts-expect-error — testing unknown action type
      { type: "UNKNOWN" },
    );
    expect(state).toEqual(initialCloudPickerState);
  });

  describe("SET_AUTHENTICATED", () => {
    it("sets authenticated to true", () => {
      const next = cloudPickerReducer(initialCloudPickerState, {
        type: "SET_AUTHENTICATED",
        authenticated: true,
      });
      expect(next.authenticated).toBe(true);
    });

    it("sets authenticated to false", () => {
      const prev: CloudPickerState = {
        ...initialCloudPickerState,
        authenticated: true,
      };
      const next = cloudPickerReducer(prev, {
        type: "SET_AUTHENTICATED",
        authenticated: false,
      });
      expect(next.authenticated).toBe(false);
    });
  });

  describe("ASYNC_START", () => {
    it("sets loading and clears error", () => {
      const prev: CloudPickerState = {
        ...initialCloudPickerState,
        error: "old error",
      };
      const next = cloudPickerReducer(prev, { type: "ASYNC_START" });
      expect(next.loading).toBe(true);
      expect(next.error).toBeNull();
    });
  });

  describe("AUTH_SUCCESS", () => {
    it("sets authenticated, browsing, entries, and resets path", () => {
      const next = cloudPickerReducer(initialCloudPickerState, {
        type: "AUTH_SUCCESS",
        entries: mockEntries,
      });
      expect(next.authenticated).toBe(true);
      expect(next.browsing).toBe(true);
      expect(next.entries).toEqual(mockEntries);
      expect(next.currentPath).toBe("");
    });
  });

  describe("AUTH_FAILED", () => {
    it("sets error message", () => {
      const next = cloudPickerReducer(initialCloudPickerState, {
        type: "AUTH_FAILED",
        error: "OAuth failed",
      });
      expect(next.error).toBe("OAuth failed");
    });
  });

  describe("ASYNC_DONE", () => {
    it("clears loading", () => {
      const prev: CloudPickerState = {
        ...initialCloudPickerState,
        loading: true,
      };
      const next = cloudPickerReducer(prev, { type: "ASYNC_DONE" });
      expect(next.loading).toBe(false);
    });
  });

  describe("APP_KEY_REQUIRED", () => {
    it("sets appKeyMissing and currentAppKey", () => {
      const next = cloudPickerReducer(initialCloudPickerState, {
        type: "APP_KEY_REQUIRED",
        currentAppKey: "abc123",
      });
      expect(next.appKeyMissing).toBe(true);
      expect(next.currentAppKey).toBe("abc123");
    });

    it("handles null currentAppKey", () => {
      const next = cloudPickerReducer(initialCloudPickerState, {
        type: "APP_KEY_REQUIRED",
        currentAppKey: null,
      });
      expect(next.appKeyMissing).toBe(true);
      expect(next.currentAppKey).toBeNull();
    });
  });

  describe("APP_KEY_SAVED", () => {
    it("clears appKeyMissing", () => {
      const prev: CloudPickerState = {
        ...initialCloudPickerState,
        appKeyMissing: true,
      };
      const next = cloudPickerReducer(prev, { type: "APP_KEY_SAVED" });
      expect(next.appKeyMissing).toBe(false);
    });
  });

  describe("APP_KEY_CANCELLED", () => {
    it("clears appKeyMissing and error", () => {
      const prev: CloudPickerState = {
        ...initialCloudPickerState,
        appKeyMissing: true,
        error: "some error",
      };
      const next = cloudPickerReducer(prev, { type: "APP_KEY_CANCELLED" });
      expect(next.appKeyMissing).toBe(false);
      expect(next.error).toBeNull();
    });
  });

  describe("BROWSE_SUCCESS", () => {
    it("sets entries and path", () => {
      const next = cloudPickerReducer(initialCloudPickerState, {
        type: "BROWSE_SUCCESS",
        entries: mockEntries,
        path: "/vault",
      });
      expect(next.entries).toEqual(mockEntries);
      expect(next.currentPath).toBe("/vault");
    });
  });

  describe("BROWSE_FAILED", () => {
    it("sets error", () => {
      const next = cloudPickerReducer(initialCloudPickerState, {
        type: "BROWSE_FAILED",
        error: "Network error",
      });
      expect(next.error).toBe("Network error");
    });
  });

  describe("VAULT_SELECTED", () => {
    it("sets browsing to false", () => {
      const prev: CloudPickerState = {
        ...initialCloudPickerState,
        browsing: true,
      };
      const next = cloudPickerReducer(prev, { type: "VAULT_SELECTED" });
      expect(next.browsing).toBe(false);
    });
  });

  describe("VAULT_INVALID", () => {
    it("sets error", () => {
      const next = cloudPickerReducer(initialCloudPickerState, {
        type: "VAULT_INVALID",
        error: "No profile.js",
      });
      expect(next.error).toBe("No profile.js");
    });
  });

  describe("SIGNED_OUT", () => {
    it("resets to initial state", () => {
      const prev: CloudPickerState = {
        authenticated: true,
        browsing: true,
        currentPath: "/some/path",
        entries: mockEntries,
        error: "err",
        loading: true,
        appKeyMissing: true,
        currentAppKey: "key",
      };
      const next = cloudPickerReducer(prev, { type: "SIGNED_OUT" });
      expect(next).toEqual(initialCloudPickerState);
    });
  });

  describe("BROWSING_CANCELLED", () => {
    it("resets browsing state but preserves auth", () => {
      const prev: CloudPickerState = {
        ...initialCloudPickerState,
        authenticated: true,
        browsing: true,
        currentPath: "/vault",
        entries: mockEntries,
        error: "some error",
      };
      const next = cloudPickerReducer(prev, { type: "BROWSING_CANCELLED" });
      expect(next.browsing).toBe(false);
      expect(next.currentPath).toBe("");
      expect(next.entries).toEqual([]);
      expect(next.error).toBeNull();
      expect(next.authenticated).toBe(true);
    });
  });
});
