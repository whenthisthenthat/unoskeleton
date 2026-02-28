import type { TotpAlgorithm } from "@/lib/totp/uri";
import { createHmac } from "react-native-quick-crypto";

/**
 * Generate a TOTP code per RFC 6238.
 * @param secret Decoded secret key bytes
 * @param timeStep Current time step counter (floor(time / period))
 * @param algorithm Hash algorithm ("sha1", "sha256", "sha512")
 * @param digits Number of digits (6, 7, or 8)
 * @returns Zero-padded TOTP code string
 */
export function generateTotp(
  secret: Buffer,
  timeStep: number,
  algorithm: TotpAlgorithm = "sha1",
  digits: number = 6,
): string {
  // 1. Encode counter as 8-byte big-endian
  const msg = Buffer.alloc(8);
  msg.writeUInt32BE(Math.floor(timeStep / 0x100000000), 0);
  msg.writeUInt32BE(timeStep >>> 0, 4);

  // 2. HMAC
  const hmacDigest = Buffer.from(
    createHmac(algorithm, secret).update(msg).digest(),
  );

  // 3. Dynamic truncation (RFC 4226 section 5.4)
  const offset = hmacDigest[hmacDigest.length - 1] & 0x0f;
  const binary =
    ((hmacDigest[offset] & 0x7f) << 24) |
    ((hmacDigest[offset + 1] & 0xff) << 16) |
    ((hmacDigest[offset + 2] & 0xff) << 8) |
    (hmacDigest[offset + 3] & 0xff);

  // 4. Modulo to get desired number of digits
  const otp = binary % Math.pow(10, digits);
  return otp.toString().padStart(digits, "0");
}

/**
 * Compute the current time step counter.
 * @param period Time step period in seconds (default: 30)
 * @param nowMs Current time in milliseconds (default: Date.now())
 */
export function currentTimeStep(
  period: number = 30,
  nowMs: number = Date.now(),
): number {
  return Math.floor(nowMs / 1000 / period);
}

/**
 * Compute seconds remaining until the current code expires.
 * @param period Time step period in seconds (default: 30)
 * @param nowMs Current time in milliseconds (default: Date.now())
 */
export function secondsRemaining(
  period: number = 30,
  nowMs: number = Date.now(),
): number {
  return period - (Math.floor(nowMs / 1000) % period);
}
