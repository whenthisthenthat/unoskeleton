import type { ICloudProvider } from "@/lib/cloud/cloud-provider";
import { CloudVaultSource } from "@/lib/cloud/cloud-vault-source";
import { VaultCacheManager } from "@/lib/opvault/cache/cache-manager";
import { LocalDirectorySource } from "@/lib/opvault/local-directory-source";
import { OPVaultClient } from "@/lib/opvault/opvault-client";
import { CachingVaultSource } from "@/lib/vault/caching-vault-source";
import { FallbackVaultSource } from "@/lib/vault/fallback-vault-source";
import { SyncManager } from "@/lib/vault/sync-manager";
import type { SyncResult } from "@/lib/vault/types";
import { Vault, type ProgressiveCallbacks } from "@/lib/vault/vault";
import type { IVaultSource } from "@/lib/vault/vault-source";
import { Directory } from "expo-file-system";
import * as SecureStore from "expo-secure-store";
import { InteractionManager } from "react-native";

/**
 * Vault Instance Manager
 *
 * Manages the global vault singleton for accessing encrypted vault data.
 * Integrates file caching for fast subsequent unlocks and background sync.
 *
 * Usage:
 * - Call loadVaultProgressive(password, vaultDir) to unlock with caching
 * - Call getVault() to access the initialized vault
 * - Call lockVault() to clear keys and lock (cache preserved)
 * - Call requestManualSync() to sync from original source while unlocked
 * - Call clearStoredVaultUri() to remove saved vault location + cache
 */

const VAULT_URI_KEY = "vaultUri";

/** Active vault session — groups state with identical lifecycle */
interface VaultSession {
  vault: Vault;
  originalSource: IVaultSource;
  syncManager: SyncManager;
}

let _session: VaultSession | null = null;

// Vault directory from picker (persists across lock/unlock)
let _vaultDir: Directory | null = null;

// Cache infrastructure (singleton, never cleared)
const _cacheManager = new VaultCacheManager();

// Guard against concurrent loadVaultProgressive calls
let _loadPromise: Promise<Vault> | null = null;

/**
 * Load vault from a local directory with progressive band loading,
 * caching, and background sync.
 *
 * @param password Master vault password
 * @param vaultDir Directory object for the vault (original source, e.g., SAF)
 * @param callbacks One-shot callbacks for progress and navigation signaling
 * @returns Promise that resolves when all bands are loaded
 */
export function loadVaultProgressive(
  password: string,
  vaultDir: Directory,
  callbacks?: ProgressiveCallbacks,
): Promise<Vault> {
  _vaultDir = vaultDir;
  const source = new LocalDirectorySource(vaultDir);
  return loadFromSource(password, source, callbacks);
}

/**
 * Load vault from a cloud provider with progressive band downloading,
 * write-through caching, and background sync.
 *
 * @param password Master vault password
 * @param provider Cloud storage backend (iCloud, Dropbox, etc.)
 * @param cloudPath Path to the vault within the cloud provider
 * @param callbacks One-shot callbacks for progress and navigation signaling
 * @returns Promise that resolves when all bands are downloaded and loaded
 */
export function loadVaultFromCloud(
  password: string,
  provider: ICloudProvider,
  cloudPath: string,
  callbacks?: ProgressiveCallbacks,
): Promise<Vault> {
  _vaultDir = null;
  const source = new CloudVaultSource(provider, cloudPath);
  return loadFromSource(password, source, callbacks);
}

function loadFromSource(
  password: string,
  source: IVaultSource,
  callbacks?: ProgressiveCallbacks,
): Promise<Vault> {
  // Guard: if a load is already in progress, return the existing promise
  if (_loadPromise) {
    return _loadPromise;
  }

  _loadPromise = doLoad(password, source, callbacks).finally(() => {
    _loadPromise = null;
  });

  return _loadPromise;
}

async function doLoad(
  password: string,
  originalSource: IVaultSource,
  callbacks?: ProgressiveCallbacks,
): Promise<Vault> {
  const vaultUri = originalSource.sourceUri;

  // Check for existing cache
  const cachedDir = _cacheManager.getCacheDir(vaultUri);

  // Cancel any in-progress background sync
  if (_session) {
    _session.syncManager.cancel();
  }

  // Build source composition
  let bandSource: IVaultSource;
  let attachmentSource: IVaultSource;

  if (cachedDir) {
    // Warm path: read from cache, fall back to original for uncached attachments
    const cachedSource = new LocalDirectorySource(cachedDir);
    bandSource = cachedSource;
    attachmentSource = new FallbackVaultSource(cachedSource, originalSource);
  } else {
    // Cold path: read from original with write-through caching
    const cachingSource = new CachingVaultSource(
      originalSource,
      _cacheManager,
      vaultUri,
    );
    bandSource = cachingSource;
    attachmentSource = cachingSource;
  }

  const storage = new OPVaultClient(bandSource, attachmentSource);
  const vault = new Vault(storage);

  const syncManager = new SyncManager(_cacheManager);
  vault.setSyncManager(syncManager);

  _session = { vault, originalSource, syncManager };

  await vault.initializeProgressive(password, callbacks);

  await SecureStore.setItemAsync(VAULT_URI_KEY, vaultUri);

  // Post-load: mark cache complete on first load (cold path only).
  // Background sync for warm path is triggered by the UI layer after navigation.
  if (!cachedDir) {
    InteractionManager.runAfterInteractions(() => {
      _cacheManager.writeCacheComplete(vaultUri);
    });
  }

  return vault;
}

/**
 * Trigger a background sync if the vault is unlocked and has a warm cache.
 * Should be called from the UI layer wrapped in
 * InteractionManager.runAfterInteractions, after a navigation call, so the
 * sync runs after the navigation animation completes.
 */
export function triggerBackgroundSync(): void {
  if (!_session?.vault.isUnlocked) return;
  const vaultUri = _session.originalSource.sourceUri;
  if (!_cacheManager.getCacheDir(vaultUri)) return;
  _session.vault
    .requestSync(_session.originalSource, vaultUri)
    .catch((err: unknown) => {});
}

/**
 * Schedule a background sync after the current navigation animation completes.
 * Call immediately after router.replace() or onUnlock().
 */
export function scheduleSyncAfterNavigation(): void {
  InteractionManager.runAfterInteractions(() => void triggerBackgroundSync());
}

/**
 * Request a manual sync from the original vault source.
 * Only works while the vault is unlocked.
 *
 * @returns SyncResult or null if sync is not available
 */
export async function requestManualSync(): Promise<SyncResult | null> {
  if (!_session) return null;

  const vaultUri = _session.originalSource.sourceUri;
  return _session.vault.requestSync(_session.originalSource, vaultUri);
}

/**
 * Get the current vault instance
 *
 * @returns Vault instance
 * @throws Error if vault not loaded (must call loadVault first)
 */
export function getVault(): Vault {
  if (!_session) {
    throw new Error("Vault not loaded. Call loadVault(password) first.");
  }
  return _session.vault;
}

/**
 * Lock the vault
 *
 * Clears all decryption keys from memory and resets state
 * User must call loadVault() again to unlock
 * Note: Preserves vault directory and cache for current session
 */
export function lockVault(): void {
  if (_session) {
    _session.vault.lock();
    _session.syncManager.cancel();
    _session = null;
  }
  // Keep _vaultDir so lock screen can show password view
  // Keep cache — not deleted on lock
}

/**
 * Soft-lock the vault for auto-lock.
 *
 * Clears crypto keys but preserves items, event listeners, and the session.
 * The UI stays mounted behind a lock overlay. Call reUnlockVault() to
 * re-derive keys and resume.
 */
export function softLockVault(): void {
  if (_session) {
    _session.vault.clearKeys();
    _session.syncManager.cancel();
  }
}

/**
 * Re-derive crypto keys after a soft lock.
 *
 * Items are still in memory — only keys need restoring.
 * Re-creates the SyncManager and triggers background sync if applicable.
 *
 * @param password Master vault password
 * @throws WrongPasswordError if password is incorrect
 */
export async function reUnlockVault(password: string): Promise<void> {
  if (!_session) {
    throw new Error("No vault session. Cannot re-unlock.");
  }

  await _session.vault.reUnlock(password);

  // Re-create sync manager
  const syncManager = new SyncManager(_cacheManager);
  _session.vault.setSyncManager(syncManager);
  _session.syncManager = syncManager;
  // Background sync is triggered by the UI layer after navigation/overlay removal.
}

/**
 * Verify the master password is correct without triggering sync or
 * modifying vault state. Use when you only need to confirm the user
 * knows the password (e.g. before storing it in the keychain for
 * biometric unlock).
 *
 * @throws WrongPasswordError if password is incorrect
 */
export async function verifyPassword(password: string): Promise<void> {
  if (!_session) {
    throw new Error("No vault session. Cannot verify password.");
  }
  await _session.vault.reUnlock(password);
}

/**
 * Check if vault is unlocked
 *
 * @returns true if vault is loaded and unlocked, false otherwise
 */
export function isVaultUnlocked(): boolean {
  return _session?.vault.isUnlocked ?? false;
}

/**
 * Get stored vault directory URI from SecureStore
 *
 * @returns Vault directory URI or null if not stored
 */
export async function getStoredVaultUri(): Promise<string | null> {
  try {
    return await SecureStore.getItemAsync(VAULT_URI_KEY);
  } catch {
    return null;
  }
}

/**
 * Clear stored vault directory URI and delete cache
 * Called when user selects a different vault
 */
export async function clearStoredVaultUri(): Promise<void> {
  try {
    _cacheManager.deleteAllCaches();
    await SecureStore.deleteItemAsync(VAULT_URI_KEY);
    _vaultDir = null;
    _session = null;
  } catch {
    // Ignore errors
  }
}

/**
 * Get vault directory from current session
 *
 * @returns Vault directory or null if not loaded
 */
export function getVaultDirectory(): Directory | null {
  return _vaultDir;
}

/** Parsed vault URI — local file path or cloud provider + path */
export type ParsedVaultUri =
  | { type: "local"; uri: string }
  | { type: "cloud"; provider: string; path: string };

/**
 * Parse a stored vault URI into its source type.
 *
 * Cloud URIs use the format `provider://path` (e.g. `dropbox:///My Vault/default`).
 * Everything else is treated as a local URI.
 */
export function parseStoredVaultUri(uri: string): ParsedVaultUri {
  const match = uri.match(/^(\w+):\/\/(.+)$/);
  if (match) {
    const scheme = match[1];
    if (scheme !== "file" && scheme !== "content") {
      return { type: "cloud", provider: scheme, path: match[2] };
    }
  }
  return { type: "local", uri };
}
