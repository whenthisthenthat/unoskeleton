import { decodeBase32 } from "@/lib/totp/base32";

export type TotpAlgorithm = "sha1" | "sha256" | "sha512";

export interface TotpParams {
  /** Decoded secret key bytes */
  secret: Buffer;
  /** Hash algorithm (default: sha1) */
  algorithm: TotpAlgorithm;
  /** Number of digits in the code (default: 6) */
  digits: number;
  /** Time step period in seconds (default: 30) */
  period: number;
  /** Issuer label (e.g., "GitHub") */
  issuer: string;
  /** Account label (e.g., "calvin") */
  account: string;
}

const VALID_ALGORITHMS: readonly TotpAlgorithm[] = ["sha1", "sha256", "sha512"];

/**
 * Parse an otpauth://totp/ URI into structured TOTP parameters.
 * @throws Error if URI is invalid, secret is missing, or scheme is not totp
 */
export function parseTotpUri(uri: string): TotpParams {
  const url = new URL(uri);

  if (url.protocol !== "otpauth:") {
    throw new Error(`Invalid OTP URI scheme: ${url.protocol}`);
  }
  if (url.hostname !== "totp") {
    throw new Error(`Only TOTP is supported, got: ${url.hostname}`);
  }

  const params = url.searchParams;
  const secretStr = params.get("secret");
  if (!secretStr) {
    throw new Error("Missing required 'secret' parameter");
  }

  const algorithmParam = (
    params.get("algorithm") || "SHA1"
  ).toLowerCase() as TotpAlgorithm;
  if (!VALID_ALGORITHMS.includes(algorithmParam)) {
    throw new Error(`Unsupported algorithm: ${algorithmParam}`);
  }

  const digits = parseInt(params.get("digits") || "6", 10);
  if (digits < 6 || digits > 8 || isNaN(digits)) {
    throw new Error(`Invalid digits: ${params.get("digits")}`);
  }

  const period = parseInt(params.get("period") || "30", 10);
  if (period <= 0 || isNaN(period)) {
    throw new Error(`Invalid period: ${params.get("period")}`);
  }

  // Label: path is "/Issuer:Account" or "/Account"
  const label = decodeURIComponent(url.pathname.slice(1));
  const colonIdx = label.indexOf(":");
  const issuer =
    params.get("issuer") || (colonIdx >= 0 ? label.slice(0, colonIdx) : "");
  const account = colonIdx >= 0 ? label.slice(colonIdx + 1) : label;

  return {
    secret: decodeBase32(secretStr),
    algorithm: algorithmParam,
    digits,
    period,
    issuer,
    account,
  };
}
