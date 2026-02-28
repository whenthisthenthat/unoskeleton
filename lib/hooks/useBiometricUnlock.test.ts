// --- Imports ---
import {
  shouldAutoTriggerBiometric,
  useBiometricUnlock,
} from "@/lib/hooks/useBiometricUnlock";
import { WrongPasswordError } from "@/lib/vault/storage-interface";
import { act, renderHook } from "@testing-library/react";

// --- Mock setup (must be before imports) ---

const mockCheckBiometricCapability = jest.fn();
const mockIsBiometricEnabled = jest.fn();
const mockAuthenticateWithBiometric = jest.fn();
const mockDisableBiometric = jest.fn();
const mockHandleBiometricUnavailable = jest.fn();

jest.mock("@/lib/vault/biometric-store", () => ({
  checkBiometricCapability: (...args: unknown[]) =>
    mockCheckBiometricCapability(...args),
  isBiometricEnabled: (...args: unknown[]) => mockIsBiometricEnabled(...args),
  authenticateWithBiometric: (...args: unknown[]) =>
    mockAuthenticateWithBiometric(...args),
  disableBiometric: (...args: unknown[]) => mockDisableBiometric(...args),
  handleBiometricUnavailable: (...args: unknown[]) =>
    mockHandleBiometricUnavailable(...args),
}));

jest.mock("@/lib/vault/storage-interface", () => {
  class WrongPasswordError extends Error {
    readonly name = "WrongPasswordError";
    constructor() {
      super("Incorrect password");
    }
  }
  return { WrongPasswordError };
});

const mockAppStateRemove = jest.fn();
let _capturedAppStateHandler: ((state: string) => void) | null = null;

jest.mock("react-native", () => ({
  AppState: {
    currentState: "active",
    addEventListener: jest.fn(
      (_type: string, handler: (state: string) => void) => {
        _capturedAppStateHandler = handler;
        return { remove: mockAppStateRemove };
      },
    ),
  },
}));

// --- Helpers ---

function flushPromises(): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, 0));
}

const AVAILABLE_CAPABILITY = {
  hasHardware: true,
  isEnrolled: true,
  isAvailable: true,
  types: [1],
};

const UNAVAILABLE_CAPABILITY = {
  hasHardware: false,
  isEnrolled: false,
  isAvailable: false,
  types: [],
};

// --- Pure function tests ---

describe("shouldAutoTriggerBiometric", () => {
  const baseState = {
    autoTrigger: true,
    biometricEnabled: true,
    biometricAvailable: true,
    alreadyTriggered: false,
    appIsActive: true,
  };

  it("returns true when all conditions are met", () => {
    expect(shouldAutoTriggerBiometric(baseState)).toBe(true);
  });

  it("returns false when autoTrigger is false", () => {
    expect(
      shouldAutoTriggerBiometric({ ...baseState, autoTrigger: false }),
    ).toBe(false);
  });

  it("returns false when biometric is not enabled", () => {
    expect(
      shouldAutoTriggerBiometric({ ...baseState, biometricEnabled: false }),
    ).toBe(false);
  });

  it("returns false when biometric is not available", () => {
    expect(
      shouldAutoTriggerBiometric({ ...baseState, biometricAvailable: false }),
    ).toBe(false);
  });

  it("returns false when already triggered", () => {
    expect(
      shouldAutoTriggerBiometric({ ...baseState, alreadyTriggered: true }),
    ).toBe(false);
  });

  it("returns false when app is not active", () => {
    expect(
      shouldAutoTriggerBiometric({ ...baseState, appIsActive: false }),
    ).toBe(false);
  });

  it("returns false when multiple conditions fail", () => {
    expect(
      shouldAutoTriggerBiometric({
        ...baseState,
        autoTrigger: false,
        appIsActive: false,
      }),
    ).toBe(false);
  });
});

// --- Hook-level tests ---

describe("useBiometricUnlock hook", () => {
  const defaultOptions = {
    onAuthenticated: jest.fn().mockResolvedValue(undefined),
    autoTrigger: false,
    setError: jest.fn(),
    vaultUri: "file:///test/vault",
  };

  beforeEach(() => {
    jest.clearAllMocks();
    _capturedAppStateHandler = null;
    mockCheckBiometricCapability.mockResolvedValue(AVAILABLE_CAPABILITY);
    mockIsBiometricEnabled.mockResolvedValue(true);
    mockAuthenticateWithBiometric.mockResolvedValue({
      success: true,
      password: "test-pw",
    });
    mockDisableBiometric.mockResolvedValue(undefined);
    mockHandleBiometricUnavailable.mockResolvedValue(undefined);
  });

  it("checks capability on mount", async () => {
    renderHook(() => useBiometricUnlock(defaultOptions));
    await act(async () => {
      await flushPromises();
    });

    expect(mockCheckBiometricCapability).toHaveBeenCalledTimes(1);
  });

  it("checks enabled state when vaultUri is provided", async () => {
    renderHook(() => useBiometricUnlock(defaultOptions));
    await act(async () => {
      await flushPromises();
    });

    expect(mockIsBiometricEnabled).toHaveBeenCalledWith("file:///test/vault");
  });

  it("does NOT check enabled state when vaultUri is null", async () => {
    renderHook(() => useBiometricUnlock({ ...defaultOptions, vaultUri: null }));
    await act(async () => {
      await flushPromises();
    });

    expect(mockIsBiometricEnabled).not.toHaveBeenCalled();
  });

  it("auto-triggers when all 5 conditions are met", async () => {
    renderHook(() =>
      useBiometricUnlock({ ...defaultOptions, autoTrigger: true }),
    );
    await act(async () => {
      await flushPromises();
    });

    expect(mockAuthenticateWithBiometric).toHaveBeenCalledWith(
      "file:///test/vault",
      "Unlock your vault",
    );
  });

  it("does NOT auto-trigger when autoTrigger is false", async () => {
    renderHook(() =>
      useBiometricUnlock({ ...defaultOptions, autoTrigger: false }),
    );
    await act(async () => {
      await flushPromises();
    });

    expect(mockAuthenticateWithBiometric).not.toHaveBeenCalled();
  });

  it("does NOT auto-trigger when biometric is not available", async () => {
    mockCheckBiometricCapability.mockResolvedValue(UNAVAILABLE_CAPABILITY);

    renderHook(() =>
      useBiometricUnlock({ ...defaultOptions, autoTrigger: true }),
    );
    await act(async () => {
      await flushPromises();
    });

    expect(mockAuthenticateWithBiometric).not.toHaveBeenCalled();
  });

  it("manual unlock calls authenticateWithBiometric", async () => {
    const { result } = renderHook(() => useBiometricUnlock(defaultOptions));
    await act(async () => {
      await flushPromises();
    });

    await act(async () => {
      await result.current.handleBiometricUnlock();
    });

    expect(mockAuthenticateWithBiometric).toHaveBeenCalledWith(
      "file:///test/vault",
      "Unlock your vault",
    );
    expect(defaultOptions.onAuthenticated).toHaveBeenCalledWith("test-pw");
  });

  it("wrong password disables biometric and shows error", async () => {
    const onAuth = jest.fn().mockRejectedValue(new WrongPasswordError());

    const { result } = renderHook(() =>
      useBiometricUnlock({ ...defaultOptions, onAuthenticated: onAuth }),
    );
    await act(async () => {
      await flushPromises();
    });

    await act(async () => {
      await result.current.handleBiometricUnlock();
    });

    expect(mockDisableBiometric).toHaveBeenCalledWith("file:///test/vault");
    expect(defaultOptions.setError).toHaveBeenCalledWith(
      expect.stringContaining("outdated"),
    );
  });

  it("cancelled auth is silent (no error set)", async () => {
    mockAuthenticateWithBiometric.mockResolvedValue({
      success: false,
      reason: "cancelled",
    });

    const { result } = renderHook(() => useBiometricUnlock(defaultOptions));
    await act(async () => {
      await flushPromises();
    });

    await act(async () => {
      await result.current.handleBiometricUnlock();
    });

    // setError is called once with "" to clear, but never with an error message
    expect(defaultOptions.setError).not.toHaveBeenCalledWith(
      expect.stringContaining("failed"),
    );
    expect(defaultOptions.onAuthenticated).not.toHaveBeenCalled();
  });

  it("unavailable result calls handleBiometricUnavailable", async () => {
    mockAuthenticateWithBiometric.mockResolvedValue({
      success: false,
      reason: "unavailable",
    });

    const { result } = renderHook(() => useBiometricUnlock(defaultOptions));
    await act(async () => {
      await flushPromises();
    });

    await act(async () => {
      await result.current.handleBiometricUnlock();
    });

    expect(mockHandleBiometricUnavailable).toHaveBeenCalledWith(
      "file:///test/vault",
    );
  });
});
