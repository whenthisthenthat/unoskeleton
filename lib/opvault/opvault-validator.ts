import {
  findFileByName,
  directoryContainsFile,
  isDirectoryObject,
} from "@/lib/opvault/internal/fs-compat";
import { Directory } from "expo-file-system";

export type ValidationResult =
  | { valid: true; vaultDir: Directory }
  | { valid: false; error: string };

/**
 * Validate a directory as an OPVault directory
 * Returns ValidationResult if valid, null if invalid/not found
 */
const validateDirectory = async (
  dir: Directory,
): Promise<ValidationResult | null> => {
  if (!directoryContainsFile(dir, "profile.js")) {
    return null;
  }

  const profileFile = findFileByName(dir, "profile.js");
  if (!profileFile) {
    return null;
  }

  const content = await profileFile.text();
  if (!content || !content.includes("profile")) {
    return {
      valid: false,
      error: "The profile.js file appears to be corrupted or invalid.",
    };
  }

  return { valid: true, vaultDir: dir };
};

/**
 * Validate that a directory is a valid OPVault directory
 *
 * Checks:
 * - Directory contains profile.js (in "default" subfolder or directly)
 * - profile.js is readable
 * - profile.js has correct format
 *
 * @param dir Directory to validate
 * @returns ValidationResult with vault directory or error
 */
export async function validateVaultDirectory(
  dir: Directory,
): Promise<ValidationResult> {
  const NOT_FOUND_ERROR =
    "This directory doesn't contain a profile.js file. Please select a valid OPVault directory.";

  try {
    // Get children of selected directory
    const children = dir.list();
    if (!Array.isArray(children)) {
      return { valid: false, error: NOT_FOUND_ERROR };
    }

    // Filter to get subdirectories only
    const subdirectories = children.filter(isDirectoryObject);

    // Check candidates in priority order: all subdirectories first, then parent
    // This handles Android where subdirectory names are opaque content URIs
    const candidates = [...subdirectories, dir];

    for (const candidate of candidates) {
      const result = await validateDirectory(candidate);
      if (result) {
        return result;
      }
    }

    return { valid: false, error: NOT_FOUND_ERROR };
  } catch {
    return { valid: false, error: NOT_FOUND_ERROR };
  }
}
