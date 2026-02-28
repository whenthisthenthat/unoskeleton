/**
 * Dropbox OAuth 2.0 with PKCE authentication flow.
 *
 * Uses expo-auth-session for the OAuth browser/native-app flow.
 * Tokens stored via token-store.ts in expo-secure-store.
 */
import { getStoredDropboxAppKey } from "@/lib/cloud/dropbox/dropbox-app-key-store";
import { storeToken, getToken, clearToken } from "@/lib/cloud/token-store";
import * as AuthSession from "expo-auth-session";
import Constants from "expo-constants";
import * as Linking from "expo-linking";
import * as WebBrowser from "expo-web-browser";

// Ensure web browser is dismissed after auth redirect
WebBrowser.maybeCompleteAuthSession();

const PROVIDER_NAME = "dropbox";

const DROPBOX_DISCOVERY = {
  authorizationEndpoint: "https://www.dropbox.com/oauth2/authorize",
  tokenEndpoint: "https://api.dropboxapi.com/oauth2/token",
};

async function getAppKey(): Promise<string> {
  const stored = await getStoredDropboxAppKey();
  if (stored && typeof stored === "string") return stored;
  const key = Constants.expoConfig?.extra?.dropboxAppKey;
  if (key && typeof key === "string" && key !== "YOUR_DROPBOX_APP_KEY")
    return key;
  throw new Error(
    "Dropbox App Key not configured. Enter your App Key in Settings.",
  );
}

/** Returns true if a Dropbox App Key is available (stored or build-time). */
export async function hasDropboxAppKey(): Promise<boolean> {
  try {
    await getAppKey();
    return true;
  } catch {
    return false;
  }
}

/** Check if the native Dropbox app is installed on the device */
export async function isDropboxAppInstalled(): Promise<boolean> {
  try {
    return await Linking.canOpenURL("dbapi-2://");
  } catch {
    return false;
  }
}

/** Check if the user has a valid (non-expired) Dropbox token */
export async function isDropboxAuthenticated(): Promise<boolean> {
  const token = await getToken(PROVIDER_NAME);
  if (!token) return false;
  // If token has expiry and is expired, check for refresh token
  if (token.expiresAt && Date.now() >= token.expiresAt) {
    return !!token.refreshToken;
  }
  return true;
}

/**
 * Start the Dropbox OAuth 2.0 PKCE flow.
 * Opens a browser (or native Dropbox app if installed) for authorization.
 * @returns true if authentication succeeded, false if cancelled/failed
 */
export async function authenticateDropbox(): Promise<boolean> {
  const clientId = await getAppKey();
  const redirectUri = AuthSession.makeRedirectUri({
    scheme: __DEV__ ? "exp+unoskeleton" : "unoskeleton",
    path: "oauth/callback",
  });

  const request = new AuthSession.AuthRequest({
    clientId,
    redirectUri,
    usePKCE: true,
    responseType: AuthSession.ResponseType.Code,
    extraParams: {
      token_access_type: "offline",
    },
  });

  const result = await request.promptAsync(DROPBOX_DISCOVERY);

  if (result.type !== "success" || !result.params.code) {
    return false;
  }

  // Exchange authorization code for tokens
  const tokenResponse = await AuthSession.exchangeCodeAsync(
    {
      clientId,
      code: result.params.code,
      redirectUri,
      extraParams: {
        code_verifier: request.codeVerifier!,
      },
    },
    DROPBOX_DISCOVERY,
  );

  await storeToken(PROVIDER_NAME, {
    accessToken: tokenResponse.accessToken,
    refreshToken: tokenResponse.refreshToken ?? undefined,
    expiresAt: tokenResponse.expiresIn
      ? Date.now() + tokenResponse.expiresIn * 1000
      : undefined,
  });

  return true;
}

/**
 * Get a valid access token, refreshing if expired.
 * @throws Error if no token available or refresh fails
 */
export async function getValidToken(): Promise<string> {
  const token = await getToken(PROVIDER_NAME);
  if (!token) {
    throw new Error("Not authenticated with Dropbox");
  }

  // Check if token is still valid
  if (!token.expiresAt || Date.now() < token.expiresAt) {
    return token.accessToken;
  }

  // Token expired — try to refresh
  if (!token.refreshToken) {
    throw new Error("Dropbox token expired and no refresh token available");
  }

  const clientId = await getAppKey();
  const tokenResponse = await AuthSession.refreshAsync(
    {
      clientId,
      refreshToken: token.refreshToken,
    },
    DROPBOX_DISCOVERY,
  );

  const newToken = {
    accessToken: tokenResponse.accessToken,
    refreshToken: tokenResponse.refreshToken ?? token.refreshToken,
    expiresAt: tokenResponse.expiresIn
      ? Date.now() + tokenResponse.expiresIn * 1000
      : undefined,
  };

  await storeToken(PROVIDER_NAME, newToken);

  return newToken.accessToken;
}

/** Sign out from Dropbox — clear stored tokens */
export async function signOutDropbox(): Promise<void> {
  await clearToken(PROVIDER_NAME);
}
