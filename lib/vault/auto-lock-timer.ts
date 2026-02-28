import type { AutoLockTimeout } from "@/lib/vault/auto-lock-store";
import {
  AppState,
  type AppStateStatus,
  type NativeEventSubscription,
} from "react-native";

export class AutoLockTimer {
  private _timeout: AutoLockTimeout;
  private _timerId: ReturnType<typeof setTimeout> | null = null;
  private _appStateSubscription: NativeEventSubscription | null = null;
  private _onLock: () => void;
  private _paused = false;

  constructor(timeout: AutoLockTimeout, onLock: () => void) {
    this._timeout = timeout;
    this._onLock = onLock;
  }

  /** Start the inactivity timer and AppState listener. */
  start(): void {
    this._appStateSubscription = AppState.addEventListener(
      "change",
      this._handleAppStateChange,
    );
    this._resetTimer();
  }

  /** Stop all timers and listeners. */
  stop(): void {
    this._clearTimer();
    this._appStateSubscription?.remove();
    this._appStateSubscription = null;
  }

  /** Reset the inactivity countdown (call on user interaction). */
  resetTimer(): void {
    this._resetTimer();
  }

  /** Pause the inactivity countdown (e.g. overlay/modal visible). */
  pause(): void {
    this._paused = true;
    this._clearTimer();
  }

  /** Resume and restart the countdown. */
  resume(): void {
    this._paused = false;
    this._resetTimer();
  }

  /** Update the timeout and restart the countdown. */
  updateTimeout(timeout: AutoLockTimeout): void {
    this._timeout = timeout;
    this._resetTimer();
  }

  private _handleAppStateChange = (nextState: AppStateStatus): void => {
    if (this._timeout === null) return; // Disabled — ignore all state changes

    if (nextState === "background" || nextState === "inactive") {
      this._onLock();
    } else if (nextState === "active") {
      this._resetTimer();
    }
  };

  private _resetTimer(): void {
    this._clearTimer();
    if (this._timeout === null || this._paused) return;
    this._timerId = setTimeout(() => {
      this._onLock();
    }, this._timeout);
  }

  private _clearTimer(): void {
    if (this._timerId !== null) {
      clearTimeout(this._timerId);
      this._timerId = null;
    }
  }
}
