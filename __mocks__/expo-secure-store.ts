/**
 * Jest module mock for expo-secure-store
 *
 * Auto-discovered by Jest when tests call jest.mock("expo-secure-store").
 * Provides mock implementations for SecureStore's async key-value methods.
 */

export const setItemAsync = jest.fn<Promise<void>, [string, string]>();
export const getItemAsync = jest.fn<Promise<string | null>, [string]>();
export const deleteItemAsync = jest.fn<Promise<void>, [string]>();
