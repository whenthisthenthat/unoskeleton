import { BAND_FILENAME_PATTERN } from "@/lib/opvault/internal/patterns";
import type { IVaultSource } from "@/lib/vault/vault-source";

/**
 * OPVault file I/O operations
 * Reads vault files via IVaultSource abstraction (local filesystem or cloud)
 */

const PROFILE_FILENAME = "profile.js";
const FOLDERS_FILENAME = "folders.js";
const BAND_PREFIX = "band_";
const BAND_SUFFIX = ".js";

async function readRequiredFile(
  source: IVaultSource,
  filename: string,
): Promise<string> {
  const content = await source.getFileContent(filename);
  if (!content) {
    throw new Error(`Failed to read ${filename}: file not found`);
  }
  return content;
}

/**
 * Read profile.js from vault source
 */
export async function readProfileFile(source: IVaultSource): Promise<string> {
  return readRequiredFile(source, PROFILE_FILENAME);
}

/**
 * Read a specific band file
 * @param source Vault source
 * @param bandLetter Band letter (0-9, A-F)
 * @returns Raw file content, or null if file doesn't exist
 */
export async function readBandFileContent(
  source: IVaultSource,
  bandLetter: string,
): Promise<string | null> {
  return source.getFileContent(`${BAND_PREFIX}${bandLetter}${BAND_SUFFIX}`);
}

/**
 * Read folders.js from vault source
 */
export async function readFoldersFile(source: IVaultSource): Promise<string> {
  return readRequiredFile(source, FOLDERS_FILENAME);
}

/**
 * Get list of existing band files in vault
 * @param source Vault source
 * @returns Array of band letters that have files (e.g., ["0", "1", "A", "F"])
 */
export async function discoverBandLetters(
  source: IVaultSource,
): Promise<string[]> {
  const filenames = await source.listFiles();

  // Filter for band_X.js pattern and extract letters
  const bands = filenames
    .filter((filename) => BAND_FILENAME_PATTERN.test(filename))
    .map((filename) => {
      const match = filename.match(BAND_FILENAME_PATTERN);
      return match ? match[1] : null;
    })
    .filter((letter): letter is string => letter !== null);

  return bands;
}
