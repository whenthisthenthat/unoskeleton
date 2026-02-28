import {
  getAutoLockTimeout,
  subscribeToTimeoutChange,
  type AutoLockTimeout,
} from "@/lib/vault/auto-lock-store";
import { AutoLockTimer } from "@/lib/vault/auto-lock-timer";
import { getVault, softLockVault } from "@/lib/vault/vault-instance";
import {
  createContext,
  createElement,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import type { GestureResponderEvent } from "react-native";

// --- Types ---

export interface LockableVault {
  isLoading: boolean;
  isUnlocked: boolean;
}

interface AutoLockContextValue {
  /** Whether the vault is currently auto-locked (overlay should show) */
  autoLocked: boolean;
  /** Dismiss the lock overlay after re-unlock */
  clearAutoLock: () => void;
  /** Touch capture handler — pass to onStartShouldSetResponderCapture */
  handleTouchCapture: (event: GestureResponderEvent) => boolean;
  /** Pause the inactivity timer (for overlays/modals) */
  pauseTimer: () => void;
  /** Resume the inactivity timer */
  resumeTimer: () => void;
}

// --- Utilities ---

/**
 * Determine whether the vault should be auto-locked.
 * Returns false if no session, still loading, or already locked.
 */
export function shouldAutoLock(vault: LockableVault | null): boolean {
  if (vault === null) return false;
  if (vault.isLoading) return false;
  if (!vault.isUnlocked) return false;
  return true;
}

// --- Context ---

const AutoLockContext = createContext<AutoLockContextValue | null>(null);

export function useAutoLockContext(): AutoLockContextValue {
  const ctx = useContext(AutoLockContext);
  if (!ctx) {
    throw new Error(
      "useAutoLockContext must be used within an AutoLockProvider",
    );
  }
  return ctx;
}

// --- Provider ---

interface AutoLockProviderProps {
  children: ReactNode;
}

export function AutoLockProvider({ children }: AutoLockProviderProps) {
  const [autoLocked, setAutoLocked] = useState(false);
  const timerRef = useRef<AutoLockTimer | null>(null);

  const handleLock = useCallback(() => {
    // Don't lock while bands are still loading — zeroing keys mid-decrypt
    // causes HMAC verification failures. Timer resets on next user interaction.
    // Also skip if already locked (overlay visible) — no point re-locking.
    let vault: LockableVault | null = null;
    try {
      vault = getVault();
    } catch {
      // No session
    }
    if (!shouldAutoLock(vault)) {
      // Re-arm so the timer fires again after the next timeout period.
      // Without this, the timer is consumed and auto-lock stays dead
      // until a touch event (e.g. if timeout fires while on lock screen).
      timerRef.current?.resetTimer();
      return;
    }
    softLockVault();
    setAutoLocked(true);
  }, []);

  const clearAutoLock = useCallback(() => setAutoLocked(false), []);

  // Initialize timer on mount, clean up on unmount
  useEffect(() => {
    let cancelled = false;

    getAutoLockTimeout().then((savedTimeout) => {
      if (cancelled) return;
      const timer = new AutoLockTimer(savedTimeout, handleLock);
      timerRef.current = timer;
      timer.start();
    });

    return () => {
      cancelled = true;
      timerRef.current?.stop();
      timerRef.current = null;
    };
  }, [handleLock]);

  // Subscribe to live timeout changes from settings
  useEffect(() => {
    return subscribeToTimeoutChange((newTimeout: AutoLockTimeout) => {
      timerRef.current?.updateTimeout(newTimeout);
    });
  }, []);

  const handleTouchCapture = useCallback(
    (_event: GestureResponderEvent): boolean => {
      timerRef.current?.resetTimer();
      return false; // Pass touch through to children
    },
    [],
  );

  const pauseTimer = useCallback(() => {
    timerRef.current?.pause();
  }, []);

  const resumeTimer = useCallback(() => {
    timerRef.current?.resume();
  }, []);

  return createElement(
    AutoLockContext.Provider,
    {
      value: {
        autoLocked,
        clearAutoLock,
        handleTouchCapture,
        pauseTimer,
        resumeTimer,
      },
    },
    children,
  );
}
