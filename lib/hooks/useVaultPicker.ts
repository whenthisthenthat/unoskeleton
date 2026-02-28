import { validateVaultDirectory } from "@/lib/opvault/opvault-validator";
import { Directory } from "expo-file-system";
import { useState, useCallback } from "react";

/**
 * Custom hook for vault directory picking with validation
 *
 * Provides directory picker functionality with built-in OPVault validation
 * and error handling. Returns the selected directory or null if cancelled/invalid.
 *
 * @returns Object with pickDirectory function, error state, and loading state
 */
export function useVaultPicker() {
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  /**
   * Open directory picker and validate selected directory
   *
   * @param initialUri Optional URI to pre-open (for iOS session re-auth)
   * @returns Selected Directory or null if cancelled/invalid
   */
  const pickDirectory = useCallback(
    async (initialUri?: string): Promise<Directory | null> => {
      setError(null);
      setLoading(true);

      try {
        // Open directory picker (with optional pre-opened location)
        const directory = await Directory.pickDirectoryAsync(initialUri);

        // Validate selected directory
        const validation = await validateVaultDirectory(directory);

        if (!validation.valid) {
          setError(validation.error);
          setLoading(false);
          return null;
        }

        setLoading(false);
        // Return the actual vault directory (could be the default/ subfolder)
        return validation.vaultDir;
      } catch (err) {
        setError(
          err instanceof Error ? err.message : "Failed to pick directory",
        );
        setLoading(false);
        return null;
      }
    },
    [],
  );

  return { pickDirectory, error, loading };
}
