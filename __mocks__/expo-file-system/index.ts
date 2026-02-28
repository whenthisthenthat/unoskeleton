/**
 * Jest module mock for expo-file-system
 *
 * This file provides the module-level mock (Layer 1) for expo-file-system.
 * It exports jest.fn() constructors that replace the real File and Directory classes
 * when tests call jest.mock("expo-file-system").
 *
 * ARCHITECTURE: Two-Layer Mock System
 * - Layer 1 (this file): Module replacement via __mocks__/ (Jest convention)
 *   - Only needed for tests using MockFile.mockImplementation()
 *   - Used by: file-reader.test.ts
 *
 * - Layer 2 (lib/opvault/fixtures/fs-mocks.ts): Instance helpers
 *   - Helper functions like createMockFile(), createMockDirectory()
 *   - Works with OR without jest.mock() (uses Object.create with prototypes)
 *   - Used by: file-reader.test.ts, opvault-validator.test.ts
 *
 * USAGE:
 * - If your test needs to control File/Directory constructor behavior:
 *   → Use jest.mock("expo-file-system") + MockFile.mockImplementation()
 *
 * - If you just need mock instances with specific data:
 *   → Import helpers from @/lib/opvault/fixtures/fs-mocks
 *   → No jest.mock() needed
 *
 * IMPLEMENTATION NOTES:
 * - Uses jest.fn() constructors with prototypes to support mockImplementation()
 * - Prototypes enable instanceof checks in code under test
 * - Must be at project root __mocks__/ for Jest to auto-discover
 */

// Create mock constructors as jest.fn() with prototypes
export const File = jest.fn() as unknown as jest.Mock & { prototype: object };
File.prototype = {};

export const Directory = jest.fn() as unknown as jest.Mock & {
  prototype: object;
  pickDirectoryAsync: jest.Mock;
};
Directory.prototype = {};
Directory.pickDirectoryAsync = jest.fn();

// Mock Paths static class
export const Paths = {
  get document() {
    return new Directory("file:///mock-document-dir");
  },
  get cache() {
    return new Directory("file:///mock-cache-dir");
  },
};

// Export as default as well for compatibility
export default {
  File,
  Directory,
  Paths,
};
