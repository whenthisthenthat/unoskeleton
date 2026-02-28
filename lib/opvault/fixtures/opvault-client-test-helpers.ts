import { createMockVaultSource } from "@/lib/opvault/fixtures/fs-mocks";
import {
  readAndParseProfile,
  readAndParseBands,
} from "@/lib/opvault/internal/reader";
import { OPVaultClient } from "@/lib/opvault/opvault-client";
import type { Profile, OPVaultItem } from "@/lib/opvault/types";
import { VaultNotUnlockedError } from "@/lib/vault/storage-interface";
import type { StorageItem } from "@/lib/vault/types";

/**
 * Creates a new OPVaultClient with default test configuration
 */
export function createTestClient(): OPVaultClient {
  return new OPVaultClient(createMockVaultSource("/path/to/vault"));
}

/**
 * Creates and unlocks a client with test password
 */
export async function createUnlockedClient(): Promise<OPVaultClient> {
  const client = createTestClient();
  await client.unlock("test-password");
  return client;
}

/**
 * Creates, unlocks, and loads items for a client
 */
export async function createClientWithItems(): Promise<{
  client: OPVaultClient;
  items: StorageItem[];
}> {
  const client = await createUnlockedClient();
  const items = await client.loadItems();
  return { client, items };
}

/**
 * Mocks vault with specific items
 */
export function mockVaultWithItems(
  profile: Profile,
  items: Map<string, OPVaultItem>,
): void {
  jest.mocked(readAndParseProfile).mockResolvedValue(profile);
  jest.mocked(readAndParseBands).mockResolvedValue(items);
}

/**
 * Mocks vault with empty items
 */
export function mockEmptyVault(profile: Profile): void {
  mockVaultWithItems(profile, new Map());
}

/**
 * Helper for testing error wrapping behavior
 * @param mockFn - The mock function to configure
 * @param error - The error to throw
 */
export function mockToThrowError<T extends (...args: never[]) => unknown>(
  mockFn: jest.MockedFunction<T>,
  error: Error,
): void {
  mockFn.mockImplementation(() => {
    throw error;
  });
}

/**
 * Helper for testing async error wrapping
 */
export function mockToRejectWith(
  mockFn: { mockRejectedValue(value: unknown): unknown },
  error: Error,
): void {
  mockFn.mockRejectedValue(error);
}

/**
 * Assert that client is in locked state
 */
export async function expectClientLocked(client: OPVaultClient): Promise<void> {
  expect(client.isUnlocked).toBe(false);
  await expect(client.loadItems()).rejects.toThrow(VaultNotUnlockedError);
  await expect(client.getItemDetails("any-uuid")).rejects.toThrow(
    VaultNotUnlockedError,
  );
}
