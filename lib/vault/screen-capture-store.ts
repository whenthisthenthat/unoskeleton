import * as SecureStore from "expo-secure-store";

const SCREEN_CAPTURE_KEY = "preventScreenCapture";

/** Default: screen capture prevention enabled (secure by default). */
export const DEFAULT_PREVENT_SCREEN_CAPTURE = true;

// --- Persistence ---

type ScreenCaptureListener = (enabled: boolean) => void;
const _listeners = new Set<ScreenCaptureListener>();

export async function getPreventScreenCapture(): Promise<boolean> {
  try {
    const raw = await SecureStore.getItemAsync(SCREEN_CAPTURE_KEY);
    if (raw === null) return DEFAULT_PREVENT_SCREEN_CAPTURE;
    return JSON.parse(raw) as boolean;
  } catch {
    return DEFAULT_PREVENT_SCREEN_CAPTURE;
  }
}

export async function setPreventScreenCapture(enabled: boolean): Promise<void> {
  await SecureStore.setItemAsync(SCREEN_CAPTURE_KEY, JSON.stringify(enabled));
  _listeners.forEach((fn) => fn(enabled));
}

export function subscribeToScreenCaptureChange(
  listener: ScreenCaptureListener,
): () => void {
  _listeners.add(listener);
  return () => {
    _listeners.delete(listener);
  };
}
