import { useAutoLockContext } from "@/lib/contexts/AutoLockContext";
import { useEffect } from "react";

/**
 * Pause the auto-lock inactivity timer while this component is active.
 *
 * @param active — if omitted, pauses on mount / resumes on unmount.
 *                  if provided, pauses when `true` / resumes when `false`.
 */
export function useAutoLockPause(active?: boolean): void {
  const { pauseTimer, resumeTimer } = useAutoLockContext();
  const shouldPause = active ?? true;

  useEffect(() => {
    if (shouldPause) {
      pauseTimer();
      return () => resumeTimer();
    }
  }, [shouldPause, pauseTimer, resumeTimer]);
}
