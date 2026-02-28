import { useEffect, useState } from "react";
import { AppState, type AppStateStatus } from "react-native";

/**
 * Tracks whether the app is in the active (foreground) state.
 *
 * Returns `false` when the app enters "inactive" or "background"
 * (app switcher, notification center, or fully backgrounded).
 *
 * Separate from auto-lock-timer.ts which also listens to AppState
 * but for lock behavior — this hook is purely for visual overlay state.
 */
export function useAppActive(): boolean {
  const [isActive, setIsActive] = useState(
    () => AppState.currentState === "active",
  );

  useEffect(() => {
    const handleChange = (nextState: AppStateStatus) => {
      setIsActive(nextState === "active");
    };

    const subscription = AppState.addEventListener("change", handleChange);

    return () => {
      subscription.remove();
    };
  }, []);

  return isActive;
}
