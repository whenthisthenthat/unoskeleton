const ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";

/**
 * Decode a base32-encoded string (RFC 4648) to a Buffer.
 * Case-insensitive. Ignores padding ('=') and spaces.
 * @throws Error on invalid characters
 */
export function decodeBase32(input: string): Buffer {
  const clean = input.replace(/[= ]/g, "").toUpperCase();
  const out: number[] = [];
  let bits = 0;
  let value = 0;

  for (const char of clean) {
    const idx = ALPHABET.indexOf(char);
    if (idx === -1) throw new Error(`Invalid base32 character: '${char}'`);
    value = (value << 5) | idx;
    bits += 5;
    if (bits >= 8) {
      bits -= 8;
      out.push((value >>> bits) & 0xff);
    }
  }

  return Buffer.from(out);
}
