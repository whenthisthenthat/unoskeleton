import {
  deriveKeyPairFromMaterial,
  validateBufferLength,
} from "@/lib/opvault/crypto/cipher";
import { decryptOpdata01 } from "@/lib/opvault/crypto/opdata";
import { deriveKeysFromPassword } from "@/lib/opvault/crypto/pbkdf2";
import type { DerivedKeys } from "@/lib/opvault/crypto/pbkdf2";
import type { Profile, MasterKeys, OverviewKeys } from "@/lib/opvault/types";
import {
  WrongPasswordError,
  VaultCorruptedError,
  errorMessage,
  wrapCorruptedError,
} from "@/lib/vault/storage-interface";

/**
 * OPVault Key Derivation Chain:
 *
 * 1. Vault Password
 *      ↓ PBKDF2-HMAC-SHA512 (with salt, iterations)
 * 2. Derived Keys (enc + mac, 32 bytes each)
 *      ↓ Decrypt profile.masterKey (opdata01)
 * 3. Master Key Material (256 random bytes)
 *      ↓ SHA-512 hash
 * 4. Master Keys (enc + mac, 32 bytes each)
 *
 * Parallel chain for Overview Keys:
 * 2. Derived Keys
 *      ↓ Decrypt profile.overviewKey (opdata01)
 * 3. Overview Key Material (64 random bytes)
 *      ↓ SHA-512 hash
 * 4. Overview Keys (enc + mac, 32 bytes each)
 */

/**
 * Derive encryption and MAC keys from vault password
 * Step 1 of key derivation chain
 *
 * @param password Vault master password
 * @param profile Profile data with salt and iterations
 * @returns Derived encryption and MAC keys
 */
export function deriveKeys(password: string, profile: Profile): DerivedKeys {
  return deriveKeysFromPassword(password, profile.salt, profile.iterations);
}

/**
 * Decrypt and derive master keys from profile
 * Steps 2-4 of master key derivation chain
 *
 * @param profile Profile data with encrypted masterKey
 * @param derivedKeys Keys derived from password
 * @returns Master encryption and MAC keys
 * @throws WrongPasswordError if decryption fails (wrong password)
 * @throws VaultCorruptedError if data is corrupted
 */
export function decryptMasterKeys(
  profile: Profile,
  derivedKeys: DerivedKeys,
): MasterKeys {
  try {
    // Decrypt profile.masterKey (opdata01 format) → 256 random bytes
    const masterKeyMaterial = decryptOpdata01(
      profile.masterKey,
      derivedKeys.encryptionKey,
      derivedKeys.macKey,
    );

    validateBufferLength(masterKeyMaterial, 256, "master key material");

    // Derive master keys via SHA-512
    return deriveKeyPairFromMaterial(masterKeyMaterial);
  } catch (error) {
    if (
      error instanceof Error &&
      error.message.includes("HMAC verification failed")
    ) {
      throw new WrongPasswordError();
    }
    throw new VaultCorruptedError(
      `Failed to decrypt master keys: ${errorMessage(error)}`,
    );
  }
}

/**
 * Decrypt and derive overview keys from profile
 * Steps 2-4 of overview key derivation chain
 *
 * @param profile Profile data with encrypted overviewKey
 * @param derivedKeys Keys derived from password
 * @returns Overview encryption and MAC keys
 * @throws VaultCorruptedError if decryption fails or data is corrupted
 */
export function decryptOverviewKeys(
  profile: Profile,
  derivedKeys: DerivedKeys,
): OverviewKeys {
  return wrapCorruptedError(() => {
    // Decrypt profile.overviewKey (opdata01 format) → 64 random bytes
    const overviewKeyMaterial = decryptOpdata01(
      profile.overviewKey,
      derivedKeys.encryptionKey,
      derivedKeys.macKey,
    );

    validateBufferLength(overviewKeyMaterial, 64, "overview key material");

    // Derive overview keys via SHA-512
    return deriveKeyPairFromMaterial(overviewKeyMaterial);
  }, "Failed to decrypt overview keys");
}

/**
 * Unlock vault and derive all keys from password
 * Combines Steps 1-4 for both master and overview keys
 *
 * @param password Vault master password
 * @param profile Profile data
 * @returns Master and overview keys
 * @throws WrongPasswordError if password is incorrect
 * @throws VaultCorruptedError if vault data is corrupted
 */
export function deriveVaultKeys(
  password: string,
  profile: Profile,
): {
  masterKeys: MasterKeys;
  overviewKeys: OverviewKeys;
} {
  // Step 1: Derive keys from password
  const derivedKeys = deriveKeys(password, profile);

  // Steps 2-4: Decrypt and derive master/overview keys
  const masterKeys = decryptMasterKeys(profile, derivedKeys);
  const overviewKeys = decryptOverviewKeys(profile, derivedKeys);

  return {
    masterKeys,
    overviewKeys,
  };
}
