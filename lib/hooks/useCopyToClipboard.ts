import * as Clipboard from "expo-clipboard";
import * as Haptics from "expo-haptics";
import { useCallback, useEffect, useRef, useState } from "react";

interface UseCopyToClipboardReturn {
  copied: boolean;
  handleCopy: () => Promise<void>;
}

export function useCopyToClipboard(
  value: string,
  transform?: (v: string) => string,
): UseCopyToClipboardReturn {
  const [copied, setCopied] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout>>();

  useEffect(() => {
    return () => clearTimeout(timerRef.current);
  }, []);

  const handleCopy = useCallback(async () => {
    const copyValue = transform ? transform(value) : value;
    await Clipboard.setStringAsync(copyValue);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    setCopied(true);
    clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => setCopied(false), 2000);
  }, [value, transform]);

  return { copied, handleCopy };
}
