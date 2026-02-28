import * as SecureStore from "expo-secure-store";

const AUTO_LOCK_KEY = "autoLockTimeout";

/** Timeout values in milliseconds. null means disabled. */
export type AutoLockTimeout =
  | 30_000
  | 60_000
  | 120_000
  | 180_000
  | 300_000
  | null;

export const AUTO_LOCK_OPTIONS: { label: string; value: AutoLockTimeout }[] = [
  { label: "Disable", value: null },
  { label: "30 seconds", value: 30_000 },
  { label: "1 minute", value: 60_000 },
  { label: "2 minutes", value: 120_000 },
  { label: "3 minutes", value: 180_000 },
  { label: "5 minutes", value: 300_000 },
];

export const DEFAULT_AUTO_LOCK_TIMEOUT: AutoLockTimeout = 180_000;

// --- Timeout persistence ---

type TimeoutListener = (timeout: AutoLockTimeout) => void;
const _timeoutListeners = new Set<TimeoutListener>();

export async function getAutoLockTimeout(): Promise<AutoLockTimeout> {
  try {
    const raw = await SecureStore.getItemAsync(AUTO_LOCK_KEY);
    if (raw === null) return DEFAULT_AUTO_LOCK_TIMEOUT;
    return JSON.parse(raw) as AutoLockTimeout;
  } catch {
    return DEFAULT_AUTO_LOCK_TIMEOUT;
  }
}

export async function setAutoLockTimeout(
  timeout: AutoLockTimeout,
): Promise<void> {
  await SecureStore.setItemAsync(AUTO_LOCK_KEY, JSON.stringify(timeout));
  _timeoutListeners.forEach((fn) => fn(timeout));
}

export function subscribeToTimeoutChange(
  listener: TimeoutListener,
): () => void {
  _timeoutListeners.add(listener);
  return () => {
    _timeoutListeners.delete(listener);
  };
}
