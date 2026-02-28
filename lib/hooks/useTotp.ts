import {
  generateTotp,
  currentTimeStep,
  secondsRemaining,
} from "@/lib/totp/totp";
import { parseTotpUri, type TotpParams } from "@/lib/totp/uri";
import { useEffect, useRef, useState } from "react";

export interface UseTotpResult {
  /** Current TOTP code formatted with space (e.g., "123 456") */
  code: string;
  /** Seconds remaining until code changes */
  remaining: number;
  /** Total period in seconds */
  period: number;
  /** Whether the URI was valid and parsed successfully */
  valid: boolean;
  /** Error message if URI parsing failed */
  error: string | null;
}

/** Format code with space for readability: "123456" → "123 456" */
export function formatCode(code: string): string {
  const mid = Math.ceil(code.length / 2);
  return code.slice(0, mid) + " " + code.slice(mid);
}

/**
 * Hook that generates live TOTP codes from an otpauth:// URI.
 * Refreshes every second and regenerates when the period expires.
 */
export function useTotp(uri: string): UseTotpResult {
  const paramsRef = useRef<TotpParams | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [code, setCode] = useState("");
  const [remaining, setRemaining] = useState(0);

  // Parse URI once (or when it changes)
  useEffect(() => {
    try {
      paramsRef.current = parseTotpUri(uri);
      setError(null);
    } catch (e) {
      paramsRef.current = null;
      setError(e instanceof Error ? e.message : String(e));
      setCode("");
      setRemaining(0);
    }
  }, [uri]);

  // Timer: update code + remaining every second
  useEffect(() => {
    if (!paramsRef.current) return;

    const params = paramsRef.current;

    function tick() {
      const step = currentTimeStep(params.period);
      const secs = secondsRemaining(params.period);
      const newCode = generateTotp(
        params.secret,
        step,
        params.algorithm,
        params.digits,
      );
      setCode(formatCode(newCode));
      setRemaining(secs);
    }

    tick(); // Immediate first tick
    const interval = setInterval(tick, 1000);
    return () => clearInterval(interval);
  }, [uri, error]);

  return {
    code,
    remaining,
    period: paramsRef.current?.period ?? 30,
    valid: paramsRef.current !== null,
    error,
  };
}
