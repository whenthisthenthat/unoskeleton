import {
  authenticateWithBiometric,
  checkBiometricCapability,
  disableBiometric,
  enableBiometric,
  handleBiometricUnavailable,
  isBiometricEnabled,
} from "@/lib/vault/biometric-store";
import {
  AuthenticationType,
  authenticateAsync,
  hasHardwareAsync,
  isEnrolledAsync,
  supportedAuthenticationTypesAsync,
} from "expo-local-authentication";
import { deleteItemAsync, getItemAsync, setItemAsync } from "expo-secure-store";

jest.mock("expo-secure-store");
jest.mock("expo-local-authentication");
// Mock hashVaultUri with a simple deterministic function for tests
jest.mock("@/lib/opvault/cache/cache-manager", () => ({
  hashVaultUri: (uri: string) => `HASH(${uri})`,
}));

const VAULT_URI = "file:///test/vault.opvault";
// Pre-compute the expected key segment for assertions
const VAULT_HASH = `HASH(${VAULT_URI})`;

const mockAuthenticate = authenticateAsync as jest.MockedFunction<
  typeof authenticateAsync
>;
const mockHasHardware = hasHardwareAsync as jest.MockedFunction<
  typeof hasHardwareAsync
>;
const mockIsEnrolled = isEnrolledAsync as jest.MockedFunction<
  typeof isEnrolledAsync
>;
const mockSupportedTypes =
  supportedAuthenticationTypesAsync as jest.MockedFunction<
    typeof supportedAuthenticationTypesAsync
  >;
const mockGetItem = getItemAsync as jest.MockedFunction<typeof getItemAsync>;
const mockSetItem = setItemAsync as jest.MockedFunction<typeof setItemAsync>;
const mockDeleteItem = deleteItemAsync as jest.MockedFunction<
  typeof deleteItemAsync
>;

beforeEach(() => {
  jest.clearAllMocks();
  mockSetItem.mockResolvedValue(undefined);
  mockDeleteItem.mockResolvedValue(undefined);
  // Default: biometric auth succeeds
  mockAuthenticate.mockResolvedValue({ success: true } as Awaited<
    ReturnType<typeof authenticateAsync>
  >);
});

// ---------------------------------------------------------------------------
// checkBiometricCapability
// ---------------------------------------------------------------------------

describe("checkBiometricCapability", () => {
  it("returns isAvailable: false when no hardware", async () => {
    mockHasHardware.mockResolvedValue(false);
    mockIsEnrolled.mockResolvedValue(false);
    mockSupportedTypes.mockResolvedValue([]);

    const result = await checkBiometricCapability();

    expect(result.hasHardware).toBe(false);
    expect(result.isEnrolled).toBe(false);
    expect(result.isAvailable).toBe(false);
    expect(result.types).toEqual([]);
  });

  it("returns isAvailable: false when hardware present but not enrolled", async () => {
    mockHasHardware.mockResolvedValue(true);
    mockIsEnrolled.mockResolvedValue(false);
    mockSupportedTypes.mockResolvedValue([AuthenticationType.FINGERPRINT]);

    const result = await checkBiometricCapability();

    expect(result.hasHardware).toBe(true);
    expect(result.isEnrolled).toBe(false);
    expect(result.isAvailable).toBe(false);
  });

  it("returns isAvailable: true when hardware + enrolled", async () => {
    mockHasHardware.mockResolvedValue(true);
    mockIsEnrolled.mockResolvedValue(true);
    mockSupportedTypes.mockResolvedValue([
      AuthenticationType.FACIAL_RECOGNITION,
    ]);

    const result = await checkBiometricCapability();

    expect(result.hasHardware).toBe(true);
    expect(result.isEnrolled).toBe(true);
    expect(result.isAvailable).toBe(true);
  });

  it("includes AuthenticationType array from supportedAuthenticationTypesAsync", async () => {
    mockHasHardware.mockResolvedValue(true);
    mockIsEnrolled.mockResolvedValue(true);
    mockSupportedTypes.mockResolvedValue([
      AuthenticationType.FINGERPRINT,
      AuthenticationType.FACIAL_RECOGNITION,
    ]);

    const result = await checkBiometricCapability();

    expect(result.types).toEqual([
      AuthenticationType.FINGERPRINT,
      AuthenticationType.FACIAL_RECOGNITION,
    ]);
  });
});

// ---------------------------------------------------------------------------
// isBiometricEnabled
// ---------------------------------------------------------------------------

describe("isBiometricEnabled", () => {
  it("returns false by default when nothing stored", async () => {
    mockGetItem.mockResolvedValue(null);

    expect(await isBiometricEnabled(VAULT_URI)).toBe(false);
  });

  it("returns true when 'true' is stored", async () => {
    mockGetItem.mockResolvedValue(JSON.stringify(true));

    expect(await isBiometricEnabled(VAULT_URI)).toBe(true);
  });

  it("returns false when 'false' is stored", async () => {
    mockGetItem.mockResolvedValue(JSON.stringify(false));

    expect(await isBiometricEnabled(VAULT_URI)).toBe(false);
  });

  it("returns false on parse error", async () => {
    mockGetItem.mockRejectedValue(new Error("store error"));

    expect(await isBiometricEnabled(VAULT_URI)).toBe(false);
  });

  it("reads from vault-namespaced key", async () => {
    mockGetItem.mockResolvedValue(JSON.stringify(true));

    await isBiometricEnabled(VAULT_URI);

    expect(mockGetItem).toHaveBeenCalledWith(`biometricEnabled-${VAULT_HASH}`);
  });
});

// ---------------------------------------------------------------------------
// enableBiometric
// ---------------------------------------------------------------------------

describe("enableBiometric", () => {
  it("calls authenticateAsync before storing password", async () => {
    await enableBiometric(VAULT_URI, "secret");

    expect(mockAuthenticate).toHaveBeenCalledTimes(1);
    expect(mockAuthenticate).toHaveBeenCalledWith(
      expect.objectContaining({ promptMessage: expect.any(String) }),
    );
  });

  it("writes vault-namespaced password key before enabled key", async () => {
    const callOrder: string[] = [];
    mockSetItem.mockImplementation(async (key) => {
      callOrder.push(key);
    });

    await enableBiometric(VAULT_URI, "secret");

    expect(callOrder[0]).toBe(`biometricPassword-${VAULT_HASH}`);
    expect(callOrder[1]).toBe(`biometricEnabled-${VAULT_HASH}`);
  });

  it("stores password without requireAuthentication (gated by explicit authenticateAsync)", async () => {
    await enableBiometric(VAULT_URI, "secret");

    expect(mockSetItem).toHaveBeenCalledWith(
      `biometricPassword-${VAULT_HASH}`,
      "secret",
    );
    // Confirm NO requireAuthentication in the write
    expect(mockSetItem).not.toHaveBeenCalledWith(
      `biometricPassword-${VAULT_HASH}`,
      "secret",
      expect.anything(),
    );
  });

  it("throws UserCancel and does NOT write keys if authenticateAsync fails", async () => {
    mockAuthenticate.mockResolvedValueOnce({
      success: false,
      error: "user_cancel",
    } as Awaited<ReturnType<typeof authenticateAsync>>);

    await expect(enableBiometric(VAULT_URI, "secret")).rejects.toThrow(
      "UserCancel",
    );

    expect(mockSetItem).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// disableBiometric
// ---------------------------------------------------------------------------

describe("disableBiometric", () => {
  it("deletes vault-namespaced password key", async () => {
    await disableBiometric(VAULT_URI);

    expect(mockDeleteItem).toHaveBeenCalledWith(
      `biometricPassword-${VAULT_HASH}`,
    );
  });

  it("writes false to vault-namespaced enabled key", async () => {
    await disableBiometric(VAULT_URI);

    expect(mockSetItem).toHaveBeenCalledWith(
      `biometricEnabled-${VAULT_HASH}`,
      JSON.stringify(false),
    );
  });
});

// ---------------------------------------------------------------------------
// authenticateWithBiometric
// ---------------------------------------------------------------------------

describe("authenticateWithBiometric", () => {
  beforeEach(() => {
    mockHasHardware.mockResolvedValue(true);
    mockIsEnrolled.mockResolvedValue(true);
    mockSupportedTypes.mockResolvedValue([AuthenticationType.FINGERPRINT]);
  });

  it("returns { success: true, password } when authenticateAsync succeeds", async () => {
    mockGetItem.mockResolvedValue("mypassword");

    const result = await authenticateWithBiometric(VAULT_URI, "Unlock vault");

    expect(result).toEqual({ success: true, password: "mypassword" });
    expect(mockAuthenticate).toHaveBeenCalledWith(
      expect.objectContaining({ promptMessage: "Unlock vault" }),
    );
    // Reads password WITHOUT requireAuthentication
    expect(mockGetItem).toHaveBeenCalledWith(`biometricPassword-${VAULT_HASH}`);
  });

  it("returns unavailable when isEnrolled is false", async () => {
    mockIsEnrolled.mockResolvedValue(false);

    const result = await authenticateWithBiometric(VAULT_URI, "Unlock vault");

    expect(result).toEqual({ success: false, reason: "unavailable" });
    expect(mockAuthenticate).not.toHaveBeenCalled();
    expect(mockGetItem).not.toHaveBeenCalled();
  });

  it("returns cancelled when authenticateAsync returns user_cancel", async () => {
    mockAuthenticate.mockResolvedValueOnce({
      success: false,
      error: "user_cancel",
    } as Awaited<ReturnType<typeof authenticateAsync>>);

    const result = await authenticateWithBiometric(VAULT_URI, "Unlock vault");

    expect(result).toEqual({ success: false, reason: "cancelled" });
    expect(mockGetItem).not.toHaveBeenCalled();
  });

  it("returns cancelled when authenticateAsync returns system_cancel", async () => {
    mockAuthenticate.mockResolvedValueOnce({
      success: false,
      error: "system_cancel",
    } as Awaited<ReturnType<typeof authenticateAsync>>);

    const result = await authenticateWithBiometric(VAULT_URI, "Unlock vault");

    expect(result).toEqual({ success: false, reason: "cancelled" });
  });

  it("returns error when authenticateAsync returns other error", async () => {
    mockAuthenticate.mockResolvedValueOnce({
      success: false,
      error: "lockout",
    } as Awaited<ReturnType<typeof authenticateAsync>>);

    const result = await authenticateWithBiometric(VAULT_URI, "Unlock vault");

    expect(result).toEqual({ success: false, reason: "error" });
  });

  it("returns unavailable when getItemAsync returns null", async () => {
    mockGetItem.mockResolvedValue(null);

    const result = await authenticateWithBiometric(VAULT_URI, "Unlock vault");

    expect(result).toEqual({ success: false, reason: "unavailable" });
  });

  it("returns error on getItemAsync throw", async () => {
    mockGetItem.mockRejectedValue(new Error("Storage failure"));

    const result = await authenticateWithBiometric(VAULT_URI, "Unlock vault");

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.reason).toBe("error");
      expect(result.error?.message).toBe("Storage failure");
    }
  });
});

// ---------------------------------------------------------------------------
// handleBiometricUnavailable
// ---------------------------------------------------------------------------

describe("handleBiometricUnavailable", () => {
  it("calls disableBiometric (deletes password key and writes false)", async () => {
    await handleBiometricUnavailable(VAULT_URI);

    expect(mockDeleteItem).toHaveBeenCalledWith(
      `biometricPassword-${VAULT_HASH}`,
    );
    expect(mockSetItem).toHaveBeenCalledWith(
      `biometricEnabled-${VAULT_HASH}`,
      JSON.stringify(false),
    );
  });
});
