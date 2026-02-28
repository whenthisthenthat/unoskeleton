import * as SecureStore from "expo-secure-store";

interface TokenData {
  accessToken: string;
  refreshToken?: string;
  expiresAt?: number; // Unix ms
}

const TOKEN_KEY_PREFIX = "cloud_token_";

function tokenKey(provider: string): string {
  return `${TOKEN_KEY_PREFIX}${provider}`;
}

export async function storeToken(
  provider: string,
  data: TokenData,
): Promise<void> {
  await SecureStore.setItemAsync(tokenKey(provider), JSON.stringify(data));
}

export async function getToken(provider: string): Promise<TokenData | null> {
  try {
    const raw = await SecureStore.getItemAsync(tokenKey(provider));
    return raw ? (JSON.parse(raw) as TokenData) : null;
  } catch {
    return null;
  }
}

export async function clearToken(provider: string): Promise<void> {
  await SecureStore.deleteItemAsync(tokenKey(provider));
}
