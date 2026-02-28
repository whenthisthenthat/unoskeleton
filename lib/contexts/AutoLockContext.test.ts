import {
  shouldAutoLock,
  AutoLockProvider,
  useAutoLockContext,
} from "@/lib/contexts/AutoLockContext";
import { AutoLockTimer } from "@/lib/vault/auto-lock-timer";
import { act, renderHook } from "@testing-library/react";
import { createElement, type ReactNode } from "react";

// --- Mock setup ---

const mockStart = jest.fn();
const mockStop = jest.fn();
const mockResetTimer = jest.fn();
const mockUpdateTimeout = jest.fn();
const mockPause = jest.fn();
const mockResume = jest.fn();

let capturedOnLock: (() => void) | null = null;

jest.mock("@/lib/vault/auto-lock-timer", () => ({
  AutoLockTimer: jest
    .fn()
    .mockImplementation((_timeout: number | null, onLock: () => void) => {
      capturedOnLock = onLock;
      return {
        start: mockStart,
        stop: mockStop,
        resetTimer: mockResetTimer,
        updateTimeout: mockUpdateTimeout,
        pause: mockPause,
        resume: mockResume,
      };
    }),
}));

type AnyFn = (...args: unknown[]) => unknown;

const mockGetAutoLockTimeout = jest.fn<Promise<number | null>, []>();
const mockSubscribeToTimeoutChange = jest.fn<() => void, [AnyFn]>();

jest.mock("@/lib/vault/auto-lock-store", () => ({
  getAutoLockTimeout: (...args: unknown[]) =>
    mockGetAutoLockTimeout(...(args as [])),
  subscribeToTimeoutChange: (...args: unknown[]) =>
    mockSubscribeToTimeoutChange(...(args as [AnyFn])),
}));

const mockGetVault = jest.fn();
const mockSoftLockVault = jest.fn();

jest.mock("@/lib/vault/vault-instance", () => ({
  getVault: (...args: unknown[]) => mockGetVault(...args),
  softLockVault: (...args: unknown[]) => mockSoftLockVault(...args),
}));

jest.mock("react-native", () => ({}));

// --- Helpers ---

function flushPromises(): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, 0));
}

function wrapper({ children }: { children: ReactNode }) {
  return createElement(AutoLockProvider, null, children);
}

// --- Pure function tests ---

describe("shouldAutoLock", () => {
  it("returns false when vault is null (no session)", () => {
    expect(shouldAutoLock(null)).toBe(false);
  });

  it("returns false when vault is loading", () => {
    expect(shouldAutoLock({ isLoading: true, isUnlocked: true })).toBe(false);
  });

  it("returns false when vault is already locked", () => {
    expect(shouldAutoLock({ isLoading: false, isUnlocked: false })).toBe(false);
  });

  it("returns true when vault is unlocked and not loading", () => {
    expect(shouldAutoLock({ isLoading: false, isUnlocked: true })).toBe(true);
  });

  it("returns false when vault is loading AND locked", () => {
    expect(shouldAutoLock({ isLoading: true, isUnlocked: false })).toBe(false);
  });
});

// --- Provider tests ---

describe("AutoLockProvider", () => {
  const unsubTimeout = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
    capturedOnLock = null;
    mockGetAutoLockTimeout.mockResolvedValue(60_000);
    mockSubscribeToTimeoutChange.mockReturnValue(unsubTimeout);
  });

  it("creates AutoLockTimer on mount with saved timeout", async () => {
    await act(async () => {
      renderHook(() => useAutoLockContext(), { wrapper });
      await flushPromises();
    });

    expect(AutoLockTimer).toHaveBeenCalledWith(60_000, expect.any(Function));
    expect(mockStart).toHaveBeenCalled();
  });

  it("touch capture resets timer", async () => {
    const { result } = renderHook(() => useAutoLockContext(), { wrapper });
    await act(async () => {
      await flushPromises();
    });

    result.current.handleTouchCapture({} as any);
    expect(mockResetTimer).toHaveBeenCalled();
  });

  it("touch capture returns false (passes through)", async () => {
    const { result } = renderHook(() => useAutoLockContext(), { wrapper });
    await act(async () => {
      await flushPromises();
    });

    const passThrough = result.current.handleTouchCapture({} as any);
    expect(passThrough).toBe(false);
  });

  it("subscribes to timeout changes on mount", async () => {
    await act(async () => {
      renderHook(() => useAutoLockContext(), { wrapper });
      await flushPromises();
    });

    expect(mockSubscribeToTimeoutChange).toHaveBeenCalledWith(
      expect.any(Function),
    );
  });

  it("stops timer and cleans up on unmount", async () => {
    let unmountFn: () => void;
    await act(async () => {
      const { unmount } = renderHook(() => useAutoLockContext(), { wrapper });
      unmountFn = unmount;
      await flushPromises();
    });

    act(() => {
      unmountFn!();
    });
    expect(mockStop).toHaveBeenCalled();
    expect(unsubTimeout).toHaveBeenCalled();
  });

  it("lock handler calls softLockVault and sets autoLocked when vault is ready", async () => {
    mockGetVault.mockReturnValue({ isLoading: false, isUnlocked: true });

    const { result } = renderHook(() => useAutoLockContext(), { wrapper });
    await act(async () => {
      await flushPromises();
    });

    expect(capturedOnLock).not.toBeNull();
    act(() => {
      capturedOnLock!();
    });

    expect(mockSoftLockVault).toHaveBeenCalled();
    expect(result.current.autoLocked).toBe(true);
  });

  it("lock handler skips when vault is loading and re-arms timer", async () => {
    mockGetVault.mockReturnValue({ isLoading: true, isUnlocked: true });

    const { result } = renderHook(() => useAutoLockContext(), { wrapper });
    await act(async () => {
      await flushPromises();
    });

    mockResetTimer.mockClear();
    act(() => {
      capturedOnLock!();
    });

    expect(mockSoftLockVault).not.toHaveBeenCalled();
    expect(result.current.autoLocked).toBe(false);
    expect(mockResetTimer).toHaveBeenCalled();
  });

  it("lock handler skips when vault is already locked and re-arms timer", async () => {
    mockGetVault.mockReturnValue({ isLoading: false, isUnlocked: false });

    const { result } = renderHook(() => useAutoLockContext(), { wrapper });
    await act(async () => {
      await flushPromises();
    });

    mockResetTimer.mockClear();
    act(() => {
      capturedOnLock!();
    });

    expect(mockSoftLockVault).not.toHaveBeenCalled();
    expect(result.current.autoLocked).toBe(false);
    expect(mockResetTimer).toHaveBeenCalled();
  });

  it("lock handler handles getVault throwing (no session) and re-arms timer", async () => {
    mockGetVault.mockImplementation(() => {
      throw new Error("no session");
    });

    const { result } = renderHook(() => useAutoLockContext(), { wrapper });
    await act(async () => {
      await flushPromises();
    });

    mockResetTimer.mockClear();
    act(() => {
      capturedOnLock!();
    });

    expect(mockSoftLockVault).not.toHaveBeenCalled();
    expect(result.current.autoLocked).toBe(false);
    expect(mockResetTimer).toHaveBeenCalled();
  });

  it("passes timeout change to timer.updateTimeout", async () => {
    await act(async () => {
      renderHook(() => useAutoLockContext(), { wrapper });
      await flushPromises();
    });

    const timeoutChangeHandler = mockSubscribeToTimeoutChange.mock
      .calls[0][0] as (timeout: number) => void;
    timeoutChangeHandler(120_000);
    expect(mockUpdateTimeout).toHaveBeenCalledWith(120_000);
  });

  it("clearAutoLock resets autoLocked to false", async () => {
    mockGetVault.mockReturnValue({ isLoading: false, isUnlocked: true });

    const { result } = renderHook(() => useAutoLockContext(), { wrapper });
    await act(async () => {
      await flushPromises();
    });

    // Lock first
    act(() => {
      capturedOnLock!();
    });
    expect(result.current.autoLocked).toBe(true);

    // Then clear
    act(() => {
      result.current.clearAutoLock();
    });
    expect(result.current.autoLocked).toBe(false);
  });

  it("pauseTimer and resumeTimer call timer methods", async () => {
    const { result } = renderHook(() => useAutoLockContext(), { wrapper });
    await act(async () => {
      await flushPromises();
    });

    act(() => {
      result.current.pauseTimer();
    });
    expect(mockPause).toHaveBeenCalled();

    act(() => {
      result.current.resumeTimer();
    });
    expect(mockResume).toHaveBeenCalled();
  });

  it("throws when used outside provider", () => {
    // Suppress console.error from React for this expected error
    const consoleSpy = jest.spyOn(console, "error").mockImplementation();

    expect(() => {
      renderHook(() => useAutoLockContext());
    }).toThrow("useAutoLockContext must be used within an AutoLockProvider");

    consoleSpy.mockRestore();
  });
});
