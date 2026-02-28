import {
  LD_WRAPPER_PATTERN,
  PROFILE_PATTERN,
} from "@/lib/opvault/internal/patterns";
import type { Profile, BandFile, Folder } from "@/lib/opvault/types";
import { errorMessage } from "@/lib/vault/storage-interface";

function wrapParseError(error: unknown, context: string): never {
  throw new Error(`Failed to parse ${context}: ${errorMessage(error)}`);
}

/**
 * Extract and evaluate a JavaScript object from file content.
 * OPVault files use JS object notation (unquoted keys), not JSON.
 */
function parseJSObject<T>(
  content: string,
  pattern: RegExp,
  context: string,
): T {
  try {
    const match = content.match(pattern);
    if (!match) {
      throw new Error(`Invalid ${context} format: could not find JS object`);
    }
    return new Function(`return ${match[1]}`)() as T;
  } catch (error) {
    wrapParseError(error, context);
  }
}

/**
 * Parse profile.js file
 * Format: var profile={...}; (JavaScript object notation, not JSON)
 *
 * @param fileContent Raw file content
 * @returns Parsed Profile object
 * @throws Error if parsing fails
 */
export function parseProfile(fileContent: string): Profile {
  const profile = parseJSObject<Profile>(
    fileContent,
    PROFILE_PATTERN,
    "profile.js",
  );

  // Validate required fields
  const required: Record<string, unknown> = {
    salt: profile.salt,
    masterKey: profile.masterKey,
    overviewKey: profile.overviewKey,
    iterations: profile.iterations,
  };
  const missing = Object.entries(required)
    .filter(([, v]) => !v)
    .map(([k]) => k);
  if (missing.length > 0) {
    throw new Error(
      `Invalid profile: missing required fields: ${missing.join(", ")}`,
    );
  }

  return profile;
}

/**
 * Parse band file (band_0.js, band_1.js, etc.)
 * Format: ld({...}); (JavaScript object notation, not JSON)
 *
 * @param fileContent Raw file content
 * @returns Parsed band file (map of UUID → Item)
 * @throws Error if parsing fails
 */
export function parseBandFile(fileContent: string): BandFile {
  return parseJSObject<BandFile>(fileContent, LD_WRAPPER_PATTERN, "band file");
}

/**
 * Parse folders.js file
 * Format: ld({...}); (JavaScript object notation, not JSON)
 *
 * @param fileContent Raw file content
 * @returns Map of folder UUID → Folder
 * @throws Error if parsing fails
 */
export function parseFolders(fileContent: string): Map<string, Folder> {
  const data = parseJSObject<Record<string, Folder>>(
    fileContent,
    LD_WRAPPER_PATTERN,
    "folders.js",
  );
  return new Map(Object.entries(data));
}
