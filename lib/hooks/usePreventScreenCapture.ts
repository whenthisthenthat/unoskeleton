import {
  getPreventScreenCapture,
  subscribeToScreenCaptureChange,
} from "@/lib/vault/screen-capture-store";
import {
  preventScreenCaptureAsync,
  allowScreenCaptureAsync,
} from "expo-screen-capture";
import { useEffect } from "react";

/**
 * Manages OS-level screen capture prevention based on the stored setting.
 *
 * When enabled, calls preventScreenCaptureAsync() which:
 * - iOS: Hides content from app switcher screenshots
 * - Android: Sets FLAG_SECURE, blocking screenshots and recent apps thumbnails
 *
 * Call this hook once in the root layout.
 */
export function usePreventScreenCapture(): void {
  useEffect(() => {
    let cancelled = false;

    const apply = async (enabled: boolean) => {
      if (cancelled) return;
      if (enabled) {
        await preventScreenCaptureAsync();
      } else {
        await allowScreenCaptureAsync();
      }
    };

    // Apply initial setting
    getPreventScreenCapture().then((enabled) => apply(enabled));

    // Subscribe to live changes from settings
    const unsubscribe = subscribeToScreenCaptureChange((enabled) =>
      apply(enabled),
    );

    return () => {
      cancelled = true;
      unsubscribe();
      allowScreenCaptureAsync();
    };
  }, []);
}
