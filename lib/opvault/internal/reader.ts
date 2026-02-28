import {
  readProfileFile,
  readBandFileContent,
  discoverBandLetters,
} from "@/lib/opvault/internal/file-reader";
import { parseProfile, parseBandFile } from "@/lib/opvault/internal/parser";
import type { OPVaultItem, Profile, BandFile } from "@/lib/opvault/types";
import type { ProgressCallback } from "@/lib/vault/types";
import type { IVaultSource } from "@/lib/vault/vault-source";

/**
 * Read and parse profile.js
 * Used for fast password verification before reading band files
 *
 * @param source Vault source
 * @returns Parsed profile
 * @throws Error if profile can't be read or parsed
 */
export async function readAndParseProfile(
  source: IVaultSource,
): Promise<Profile> {
  const profileContent = await readProfileFile(source);
  const profile = parseProfile(profileContent);
  return profile;
}

/**
 * Discover, read, and parse each band file sequentially.
 * Shared core for both batch and progressive band reading.
 *
 * @param source Vault source
 * @param onBand Called with parsed BandFile for each non-empty band
 * @param onProgress Called with (loaded, total) after each band
 */
async function forEachBand(
  source: IVaultSource,
  onBand: (bandData: BandFile) => void,
  onProgress?: ProgressCallback,
): Promise<void> {
  const bandLetters = await discoverBandLetters(source);

  const total = bandLetters.length;

  for (let i = 0; i < total; i++) {
    const letter = bandLetters[i];
    const content = await readBandFileContent(source, letter);
    if (content) {
      onBand(parseBandFile(content));
    }

    onProgress?.(i + 1, total);
  }
}

/**
 * Combine items from parsed band files into a single map
 */
function combineBandItems(bandFiles: BandFile[]): Map<string, OPVaultItem> {
  const items = new Map<string, OPVaultItem>();
  for (const bandFile of bandFiles) {
    for (const [uuid, item] of Object.entries(bandFile)) {
      items.set(uuid, item);
    }
  }
  return items;
}

/**
 * Read and parse all band files
 * Called AFTER password verification succeeds
 *
 * @param source Vault source
 * @returns Map of UUID → OPVaultItem
 * @throws Error if bands can't be read or parsed
 */
export async function readAndParseBands(
  source: IVaultSource,
  onProgress?: ProgressCallback,
): Promise<Map<string, OPVaultItem>> {
  const bandFiles: BandFile[] = [];
  await forEachBand(source, (band) => bandFiles.push(band), onProgress);

  const items = combineBandItems(bandFiles);

  return items;
}

/**
 * Read and parse bands one at a time, calling onBand after each
 *
 * Handles only I/O + JSON parsing — no decryption.
 * The caller (OPVaultClient) is responsible for decrypting overviews.
 *
 * @param source Vault source
 * @param onBand Called with parsed BandFile after each band loads
 * @param onProgress Called with (loaded, total) after each band
 */
export async function readAndParseBandsProgressively(
  source: IVaultSource,
  onBand: (bandData: BandFile) => void,
  onProgress?: ProgressCallback,
): Promise<void> {
  await forEachBand(source, onBand, onProgress);
}
