/**
 * Test helper functions for creating expo-file-system mock instances
 *
 * This file provides the instance-level helpers (Layer 2) for expo-file-system mocks.
 * These functions create mock File and Directory objects with configurable behavior.
 *
 * ARCHITECTURE: Two-Layer Mock System
 * - Layer 1 (__mocks__/expo-file-system/index.ts): Module replacement
 *   - Only needed for tests using MockFile.mockImplementation()
 *   - Used by: file-reader.test.ts
 *
 * - Layer 2 (this file): Instance helper functions
 *   - createMockFile(), createMockDirectory(), etc.
 *   - Works with OR without jest.mock() (uses Object.create with prototypes)
 *   - Used by: file-reader.test.ts, opvault-validator.test.ts
 *
 * USAGE:
 * - For most tests, just import these helpers directly:
 *   ```typescript
 *   import { createMockFile } from '@/lib/opvault/fixtures/fs-mocks';
 *   const file = createMockFile({ uri: '/vault/profile.js' });
 *   ```
 *
 * - Only use jest.mock() if you need to control constructor behavior:
 *   ```typescript
 *   jest.mock('expo-file-system');
 *   const MockFile = File as jest.MockedClass<typeof File>;
 *   MockFile.mockImplementation(() => createMockFile({ ... }));
 *   ```
 *
 * IMPLEMENTATION NOTES:
 * - Uses Object.create(File.prototype) to create proper prototype chains
 * - Supports instanceof checks without requiring jest.mock()
 * - Methods wrapped in jest.fn() for test assertions (toHaveBeenCalled, etc.)
 *
 * @module fs-mocks
 */
import type { IVaultSource } from "@/lib/vault/vault-source";
import { File, Directory } from "expo-file-system";

/**
 * Helper to create a mock Directory object
 *
 * Creates a mock Directory with a list() method (jest.fn()) that returns the provided children.
 * The list() method can be used in test assertions like expect(dir.list).toHaveBeenCalled().
 * Useful for testing file system traversal and directory operations.
 *
 * @param uri - The URI/path of the directory
 * @param children - Optional array of File or Directory objects contained in this directory
 * @returns A mock Directory object with list() as a jest.fn()
 *
 * @example
 * ```typescript
 * const dir = createMockDirectory("/vault", [
 *   createMockFile({ uri: "/vault/profile.js" }),
 *   createMockDirectory("/vault/default", [])
 * ]);
 * // Can verify list() was called
 * dir.list();
 * expect(dir.list).toHaveBeenCalled();
 * ```
 */
export function createMockDirectory(
  uri: string,
  children?: (File | Directory)[],
): Directory {
  const dir = Object.create(Directory.prototype);
  dir.uri = uri;
  dir.name = uri.split("/").pop() || "";
  dir.exists = true;
  dir.list = jest.fn().mockReturnValue(children || []);

  // Add info() method that returns metadata with files array
  dir.info = jest.fn().mockReturnValue({
    exists: true,
    uri,
    files: (children || []).map((child) => {
      // Extract filename from URI (last segment after /)
      const filename = child.uri.split("/").pop() || "";
      return filename;
    }),
  });

  return dir;
}

/**
 * Helper to create a mock File object
 *
 * Creates a mock File with configurable properties. All parameters are optional
 * and default to sensible test values. Hides the `as unknown as File` cast.
 *
 * @param options - Configuration options for the mock file
 * @param options.uri - The URI/path of the file (defaults to "")
 * @param options.exists - Whether the file exists (defaults to true)
 * @param options.text - Mock function or promise for async text reading (defaults to jest.fn())
 * @param options.textSync - Mock function for sync text reading (defaults to jest.fn())
 * @param options.size - File size in bytes (defaults to 0)
 * @param options.modificationTime - Last modification time in ms since epoch (defaults to null)
 * @returns A mock File object
 *
 * @example
 * ```typescript
 * // Simple file with default text mock
 * const file = createMockFile({ uri: "/vault/profile.js" });
 *
 * // File with custom content
 * const mockText = jest.fn().mockResolvedValue('{"uuid": "test"}');
 * const file = createMockFile({ uri: "/vault/profile.js", text: mockText });
 *
 * // File with metadata for change detection
 * const file = createMockFile({ uri: "/vault/band_0.js", size: 1024, modificationTime: 1700000000 });
 *
 * // Non-existent file
 * const missing = createMockFile({ uri: "/missing.js", exists: false });
 * ```
 */
export function createMockFile(
  options: {
    uri?: string;
    exists?: boolean;
    text?: jest.Mock | (() => Promise<string>);
    textSync?: jest.Mock;
    size?: number;
    modificationTime?: number | null;
  } = {},
): File {
  const file = Object.create(File.prototype);
  file.uri = options.uri ?? "";
  file.exists = options.exists ?? true;
  file.text = options.text ?? jest.fn().mockResolvedValue("");
  file.textSync = options.textSync ?? jest.fn();
  file.size = options.size ?? 0;
  file.modificationTime = options.modificationTime ?? null;

  // Add info() method that returns metadata
  file.info = jest.fn().mockReturnValue({
    exists: file.exists,
    uri: file.uri,
  });

  // Add open() method that returns a mock FileHandle
  // This supports the new FileHandle.readBytes() API
  file.open = jest.fn().mockImplementation(async () => {
    // Get the text content to determine size
    const content = typeof file.text === "function" ? await file.text() : "";
    const bytes = new TextEncoder().encode(content);

    return {
      size: bytes.length,
      readBytes: jest.fn().mockResolvedValue(bytes),
      close: jest.fn().mockResolvedValue(undefined),
    };
  });

  return file;
}

/**
 * Helper for mocks that need path-based conditional logic
 *
 * Creates a mock File factory function that calls the handler with the extracted
 * path and uses the handler's return value to configure the mock. Useful when
 * tests need different behavior based on which file path is accessed.
 *
 * Handles the File(directory, filename) signature used by file-reader.ts.
 *
 * @param handler - Function that receives the path and returns mock configuration
 * @returns A factory function that creates mock Files based on path
 *
 * @example
 * ```typescript
 * MockFile.mockImplementation(createPathBasedMock((path) => ({
 *   exists: path.includes("band_0.js") || path.includes("band_A.js"),
 *   text: jest.fn().mockResolvedValue(path.includes("band_0") ? data0 : dataA)
 * })));
 * ```
 */
export function createPathBasedMock(
  handler: (path: string) => {
    exists: boolean;
    text?: jest.Mock | (() => Promise<string>);
    textSync?: jest.Mock;
  },
): (...args: unknown[]) => File {
  return (...args: unknown[]): File => {
    // Signature: File(directory, filename)
    const dir = args[0] as { uri?: string } | undefined;
    const filename = args[1] as string | undefined;
    const path = `${dir?.uri || ""}/${filename || ""}`;

    const config = handler(path);
    return createMockFile({ uri: path, ...config });
  };
}

/**
 * Helper for mocks that throw errors
 *
 * Creates a mock File factory that throws the specified error when invoked.
 * Useful for testing error handling and edge cases.
 *
 * @param error - The error to throw when the mock is invoked
 * @returns A factory function that throws the error
 *
 * @example
 * ```typescript
 * MockFile.mockImplementation(createThrowingMock(
 *   new Error("Permission denied")
 * ));
 * ```
 */
export function createThrowingMock(error: Error): () => File {
  return (): File => {
    throw error;
  };
}

/**
 * Helper to create a mock IVaultSource for testing.
 *
 * Returns an object implementing IVaultSource with jest.fn() methods.
 * By default all getFileContent/getBinaryContent return null, listFiles returns [].
 * Tests should configure specific return values per-test.
 *
 * @param sourceUri - The URI of the mock source
 * @returns A mock IVaultSource with jest.fn() methods for assertions
 *
 * @example
 * ```typescript
 * const source = createMockVaultSource("content://vault");
 * source.getFileContent.mockResolvedValue("file contents");
 * source.listFiles.mockResolvedValue(["profile.js", "band_0.js"]);
 * ```
 */
export function createMockVaultSource(
  sourceUri = "/mock/source",
): IVaultSource & {
  getFileContent: jest.Mock;
  getBinaryContent: jest.Mock;
  listFiles: jest.Mock;
} {
  return {
    sourceUri,
    getFileContent: jest.fn().mockResolvedValue(null),
    getBinaryContent: jest.fn().mockResolvedValue(null),
    listFiles: jest.fn().mockResolvedValue([]),
  };
}
