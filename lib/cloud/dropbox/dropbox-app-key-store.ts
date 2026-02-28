import * as SecureStore from "expo-secure-store";

const APP_KEY_STORE_KEY = "dropboxAppKey";

export async function getStoredDropboxAppKey(): Promise<string | null> {
  try {
    return await SecureStore.getItemAsync(APP_KEY_STORE_KEY);
  } catch {
    return null;
  }
}

export async function setStoredDropboxAppKey(key: string): Promise<void> {
  await SecureStore.setItemAsync(APP_KEY_STORE_KEY, key);
}

export async function clearStoredDropboxAppKey(): Promise<void> {
  await SecureStore.deleteItemAsync(APP_KEY_STORE_KEY);
}
