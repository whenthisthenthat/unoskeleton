/**
 * Test vectors and fixtures for cryptographic operations
 * These are used to validate crypto implementations against known-good values
 */
import type {
  OPVaultItem,
  Profile,
  MasterKeys,
  OverviewKeys,
  ItemKeys,
} from "@/lib/opvault/types";

// --- Shared test constants ---

/** Common cryptographic sizes used across tests */
export const CRYPTO_SIZES = {
  KEY: 32,
  IV: 16,
  MAC: 32,
  BLOCK: 16,
  OPDATA01_HEADER: 8,
  PLAINTEXT_LENGTH: 8,
  MASTER_KEY_MATERIAL: 256,
  OVERVIEW_KEY_MATERIAL: 64,
} as const;

export const OPDATA01_HEADER = "opdata01";

/** Fill values used across mock buffers */
export const MOCK_FILL = {
  ENC_KEY: 0x42,
  MAC_KEY: 0x43,
  OVERVIEW_ENC_KEY: 0x44,
  OVERVIEW_MAC_KEY: 0x45,
  ITEM_ENC_KEY: 0x46,
  ITEM_MAC_KEY: 0x47,
  WRONG: 0xff,
} as const;

/**
 * Build a Buffer sized for an opdata01 structure.
 * Total = header(8) + plaintextLength(8) + IV(16) + ciphertext + MAC(32)
 */
export function buildOpdataBuffer(ciphertextSize: number): Buffer {
  const { OPDATA01_HEADER: H, PLAINTEXT_LENGTH: P, IV, MAC } = CRYPTO_SIZES;
  return Buffer.alloc(H + P + IV + ciphertextSize + MAC);
}

/**
 * Test vault credentials from assets/test/onepassword_data/default
 */
export const TEST_VAULT = {
  password: "freddy",
  salt: "P0pOMMN6Ow5wIKOOSsaSQg==",
  iterations: 50000,

  // Profile data
  masterKey:
    "b3BkYXRhMDEAAQAAAAAAACN8JuE76yN6hbjqzEvd0RGnu3vufPcfAZ35JoyzdR1WPRvr8DMefe9MJu65DmHSwjObPC0jznXpafJQob6CNzKCNoeVC+GXIvLckvAuYUNSwILQQ1jEIcHdyQ0H2MbJ+0YlWEbvlQ8UVH5bcrMqDmTPPSRkbUG3/dV1NKHdgI0V6N/kKZ737oo+kj3ChJZQTKywvmR6RgB5et5stBaUwutNQbZ0znYtZumIlf3pjdqGK4RyCHSwmwgLUO+VFLTqDjoZ9dUcy4hQzSZiPlba3vK8vGJRlN0Qf2Y6dUj5kYAwdYdOzE/Ji3hbTNVsPOm8sjzPcPGQj8haW5UgzSDZ0mo7+ymsKJwSYjAsgvawh31WY2m5j7VR+50ERDTEyxxQ3LW7WgetAxX9l0LX0O3Jue1oW/p2l44ij9qiN9rkFScx",
  overviewKey:
    "b3BkYXRhMDFAAAAAAAAAAIy1hZwIGeiLn4mLE1R8lEwIOye95GEyfZcPKlyXkkb0IBTfCXM+aDxjD7hOliuTM/YMIqxK+firVvW3c5cp2QMgvQHpDW2AsAQpBqcgBgRUCSP+THMVg15ZeR9lI77mHBpTQ70D+bchvkSmw3hoEGot7YcnQCATbouhMXIMO52D",
};

/**
 * AES-256-CBC test vectors
 * Source: NIST SP 800-38A
 */
export const AES_TEST_VECTORS = {
  // Test case 1: Simple encryption
  case1: {
    key: Buffer.from(
      "603deb1015ca71be2b73aef0857d77811f352c073b6108d72d9810a30914dff4",
      "hex",
    ),
    iv: Buffer.from("000102030405060708090a0b0c0d0e0f", "hex"),
    plaintext: Buffer.from("6bc1bee22e409f96e93d7e117393172a", "hex"),
    ciphertext: Buffer.from("f58c4c04d6e5f1ba779eabfb5f7bfbd6", "hex"),
  },
  // Test case 2: Multi-block encryption
  case2: {
    key: Buffer.from(
      "603deb1015ca71be2b73aef0857d77811f352c073b6108d72d9810a30914dff4",
      "hex",
    ),
    iv: Buffer.from("000102030405060708090a0b0c0d0e0f", "hex"),
    plaintext: Buffer.from(
      "6bc1bee22e409f96e93d7e117393172aae2d8a571e03ac9c9eb76fac45af8e51",
      "hex",
    ),
    ciphertext: Buffer.from(
      "f58c4c04d6e5f1ba779eabfb5f7bfbd69cfc4e967edb808d679f777bc6702c7d",
      "hex",
    ),
  },
};

/**
 * HMAC-SHA256 test vectors
 * Source: RFC 4231
 */
export const HMAC_TEST_VECTORS = {
  // Test case 1
  case1: {
    key: Buffer.from("0b0b0b0b0b0b0b0b0b0b0b0b0b0b0b0b0b0b0b0b", "hex"),
    data: Buffer.from("Hi There", "utf8"),
    hmac: Buffer.from(
      "b0344c61d8db38535ca8afceaf0bf12b881dc200c9833da726e9376c2e32cff7",
      "hex",
    ),
  },
  // Test case 2: "what do ya want for nothing?" with "Jefe" key
  case2: {
    key: Buffer.from("Jefe", "utf8"),
    data: Buffer.from("what do ya want for nothing?", "utf8"),
    hmac: Buffer.from(
      "5bdcc146bf60754e6a042426089575c75a003f089d2739839dec58b964ec3843",
      "hex",
    ),
  },
  // Test case 3: Large key
  case3: {
    key: Buffer.from("aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa", "hex"),
    data: Buffer.from(
      "dddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddd",
      "hex",
    ),
    hmac: Buffer.from(
      "773ea91e36800e46854db8ebd09181a72959098b3ef8c122d9635514ced565fe",
      "hex",
    ),
  },
};

/**
 * SHA-512 test vectors
 * Source: NIST FIPS 180-4
 */
export const SHA512_TEST_VECTORS = {
  // Test case 1: "abc"
  case1: {
    input: Buffer.from("abc", "utf8"),
    hash: Buffer.from(
      "ddaf35a193617abacc417349ae20413112e6fa4e89a97ea20a9eeee64b55d39a2192992a274fc1a836ba3c23a3feebbd454d4423643ce80e2a9ac94fa54ca49f",
      "hex",
    ),
  },
  // Test case 2: Empty string
  case2: {
    input: Buffer.from("", "utf8"),
    hash: Buffer.from(
      "cf83e1357eefb8bdf1542850d66d8007d620e4050b5715dc83f4a921d36ce9ce47d0d13c5d85f2b0ff8318d2877eec2f63b931bd47417a81a538327af927da3e",
      "hex",
    ),
  },
  // Test case 3: Long message
  case3: {
    input: Buffer.from(
      "abcdefghbcdefghicdefghijdefghijkefghijklfghijklmghijklmnhijklmnoijklmnopjklmnopqklmnopqrlmnopqrsmnopqrstnopqrstu",
      "utf8",
    ),
    hash: Buffer.from(
      "8e959b75dae313da8cf4f72814fc143f8f7779c6eb9f7fa17299aeadb6889018501d289e4900f7e4331b99dec4b5433ac7d329eeb6dd26545e96e55b874be909",
      "hex",
    ),
  },
};

/**
 * Real encrypted item from test vault band_0.js
 * Item UUID: 0EDE2B13D7AC4E2C9105842682ACB187 (category 004 - Identity)
 * Can be decrypted with TEST_VAULT.password = "freddy"
 */
export const REAL_TEST_ITEM: OPVaultItem = {
  uuid: "0EDE2B13D7AC4E2C9105842682ACB187",
  category: "004",
  k: "A4kIEzE7ypBL5lTeguPoFPlD21Uv5akEeosVZQ8u98BIBnMqScGmLJTlCoAgvfn+1YjgxQX3vZJTMDUcmt678UuBVMMehVg87Pys4hMFLNjwhhJaFGSRpSfWDlVB6Rb5PGrkkIDZBPkK4kFbYMN1tg==",
  o: "b3BkYXRhMDFSAAAAAAAAAFx/NqIo8EXowE0JkyOXYU9TwZBTupG5WKRVaYrA/nU6Jy2xC2eyZV0SGmRVS8yt0A0eRVEBXGww2UV928lrUYGpT62kMa54yPHQ6PJ/SBw6BITIoZqX91ohdcm+vUDDwkoNx4Vm+0VMFkBHRnAtT+cavKUMMmjdWrQ+0rEoWIVtZF47tOOUhh6HdGiY43ihsA==",
  d: "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",
  hmac: "NFYnSILBYIuaRNngAmgenlKVIzQjrNI58924O9wVtP0=",
  created: 1325483949,
  updated: 1325483949,
  tx: 1373753421,
};

/**
 * Factory for creating mock OPVaultItem objects
 */
export function createMockOPVaultItem(
  overrides?: Partial<OPVaultItem>,
): OPVaultItem {
  return {
    uuid: "test",
    category: "001",
    k: "",
    o: "",
    d: "",
    created: 0,
    updated: 0,
    tx: 0,
    hmac: "",
    ...overrides,
  };
}

/**
 * Factory for creating mock Profile objects
 */
export function createMockProfile(overrides?: Partial<Profile>): Profile {
  return {
    salt: "s",
    masterKey: "m",
    overviewKey: "o",
    iterations: 1,
    uuid: "u",
    profileName: "default",
    lastUpdatedBy: "t",
    updatedAt: 1,
    createdAt: 1,
    ...overrides,
  };
}

/**
 * Factory for creating mock MasterKeys
 */
export function createMockMasterKeys(
  overrides?: Partial<MasterKeys>,
): MasterKeys {
  return {
    encryptionKey: Buffer.alloc(32, 0x42),
    macKey: Buffer.alloc(32, 0x43),
    ...overrides,
  };
}

/**
 * Factory for creating mock OverviewKeys
 */
export function createMockOverviewKeys(
  overrides?: Partial<OverviewKeys>,
): OverviewKeys {
  return {
    encryptionKey: Buffer.alloc(32, 0x44),
    macKey: Buffer.alloc(32, 0x45),
    ...overrides,
  };
}

/**
 * Factory for creating mock ItemKeys
 */
export function createMockItemKeys(overrides?: Partial<ItemKeys>): ItemKeys {
  return {
    encryptionKey: Buffer.alloc(32, 0x46),
    macKey: Buffer.alloc(32, 0x47),
    ...overrides,
  };
}
