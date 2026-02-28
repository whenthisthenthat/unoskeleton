import type { Directory, File } from "expo-file-system";

/**
 * Type guard for Directory with info() method
 * info() is available at runtime but not in expo-file-system type definitions
 */
function hasInfoMethod(
  dir: Directory,
): dir is Directory & { info: () => { files?: string[] } } {
  return "info" in dir && typeof dir.info === "function";
}

/**
 * Duck-typing check to determine if an object is a File
 * Works with both native File objects and plain objects with text() method
 *
 * @param obj Object to check
 * @returns true if object has text() method (File-like)
 */
export function isFileObject(obj: unknown): obj is File {
  return (
    typeof obj === "object" &&
    obj !== null &&
    "text" in obj &&
    typeof obj.text === "function"
  );
}

/**
 * Duck-typing check to determine if an object is a Directory
 * Works with both native Directory objects and plain objects with list() method
 *
 * @param obj Object to check
 * @returns true if object has list() method (Directory-like)
 */
export function isDirectoryObject(obj: unknown): obj is Directory {
  return (
    typeof obj === "object" &&
    obj !== null &&
    "list" in obj &&
    typeof obj.list === "function"
  );
}

/**
 * Get array of filenames from a directory's info() method
 * Works on Android with content URIs where filenames aren't in URIs
 *
 * @param dir Directory to get filenames from
 * @returns Array of filenames, or undefined if info() not available
 */
export function getDirectoryFilenames(dir: Directory): string[] | undefined {
  try {
    if (hasInfoMethod(dir)) {
      const info = dir.info();
      const files = info?.files;
      if (Array.isArray(files)) {
        return files;
      }
    }
  } catch {
    // info() not available or failed
  }
  return undefined;
}

/**
 * Find a file by name in a directory's children
 * Works with both file:// URIs (iOS/web) and Android content:// URIs
 *
 * Uses two methods:
 * - Method 1: Check URI ending (works on iOS/web)
 * - Method 2: Match by index in info().files array (works on Android)
 *
 * @param dir Directory to search in
 * @param filename Name of file to find (e.g., "profile.js")
 * @returns File object if found, null otherwise
 */
export function findFileByName(dir: Directory, filename: string): File | null {
  try {
    const children = dir.list();
    const filenameList = getDirectoryFilenames(dir);

    for (let i = 0; i < children.length; i++) {
      const child = children[i];

      // Skip non-file objects
      if (!isFileObject(child)) {
        continue;
      }

      // Method 1: Check URI (works on iOS/web with file:// URIs)
      if (child.uri.endsWith(filename)) {
        return child;
      }

      // Method 2: Check filename from info() array by index (Android content URIs)
      if (filenameList && filenameList[i] === filename) {
        return child;
      }
    }
  } catch {
    // Error accessing directory
  }

  return null;
}

/**
 * Check if a directory contains a specific file
 * Fast check using info().files array when available
 *
 * @param dir Directory to check
 * @param filename Name of file to look for
 * @returns true if file exists in directory
 */
export function directoryContainsFile(
  dir: Directory,
  filename: string,
): boolean {
  // Fast check: use info().files array if available
  const filenameList = getDirectoryFilenames(dir);
  if (filenameList) {
    return filenameList.includes(filename);
  }

  // Fallback: search through children
  return findFileByName(dir, filename) !== null;
}
