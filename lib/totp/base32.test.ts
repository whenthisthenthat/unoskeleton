import { decodeBase32 } from "@/lib/totp/base32";

describe("decodeBase32", () => {
  // RFC 4648 Section 10 test vectors
  it("should decode empty string", () => {
    expect(decodeBase32("").length).toBe(0);
  });

  it("should decode 'MY' to 'f'", () => {
    expect(decodeBase32("MY").toString("ascii")).toBe("f");
  });

  it("should decode 'MZXQ' to 'fo'", () => {
    expect(decodeBase32("MZXQ").toString("ascii")).toBe("fo");
  });

  it("should decode 'MZXW6' to 'foo'", () => {
    expect(decodeBase32("MZXW6").toString("ascii")).toBe("foo");
  });

  it("should decode 'MZXW6YQ' to 'foob'", () => {
    expect(decodeBase32("MZXW6YQ").toString("ascii")).toBe("foob");
  });

  it("should decode 'MZXW6YTB' to 'fooba'", () => {
    expect(decodeBase32("MZXW6YTB").toString("ascii")).toBe("fooba");
  });

  it("should decode 'MZXW6YTBOI' to 'foobar'", () => {
    expect(decodeBase32("MZXW6YTBOI").toString("ascii")).toBe("foobar");
  });

  it("should be case-insensitive", () => {
    const upper = decodeBase32("MZXW6");
    const lower = decodeBase32("mzxw6");
    expect(upper.equals(lower)).toBe(true);
  });

  it("should ignore padding characters", () => {
    const withPad = decodeBase32("MY======");
    const withoutPad = decodeBase32("MY");
    expect(withPad.equals(withoutPad)).toBe(true);
  });

  it("should ignore spaces", () => {
    const withSpaces = decodeBase32("MZXW 6YTB OI");
    const withoutSpaces = decodeBase32("MZXW6YTBOI");
    expect(withSpaces.equals(withoutSpaces)).toBe(true);
  });

  it("should throw on invalid character", () => {
    expect(() => decodeBase32("MZXW6!")).toThrow("Invalid base32 character");
  });

  it("should decode a typical TOTP secret", () => {
    // JBSWY3DPEHPK3PXP is a well-known test secret
    const result = decodeBase32("JBSWY3DPEHPK3PXP");
    expect(result).toBeInstanceOf(Buffer);
    expect(result.length).toBeGreaterThan(0);
  });
});
