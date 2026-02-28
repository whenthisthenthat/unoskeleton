import { parseTotpUri } from "@/lib/totp/uri";

describe("parseTotpUri", () => {
  it("should parse a standard GitHub TOTP URI", () => {
    const params = parseTotpUri(
      "otpauth://totp/GitHub:calvin?secret=JBSWY3DPEHPK3PXP&issuer=GitHub",
    );
    expect(params.issuer).toBe("GitHub");
    expect(params.account).toBe("calvin");
    expect(params.algorithm).toBe("sha1");
    expect(params.digits).toBe(6);
    expect(params.period).toBe(30);
    expect(params.secret).toBeInstanceOf(Buffer);
    expect(params.secret.length).toBeGreaterThan(0);
  });

  it("should parse URI without issuer prefix in label", () => {
    const params = parseTotpUri(
      "otpauth://totp/calvin?secret=JBSWY3DPEHPK3PXP",
    );
    expect(params.issuer).toBe("");
    expect(params.account).toBe("calvin");
  });

  it("should prefer issuer param over label prefix", () => {
    const params = parseTotpUri(
      "otpauth://totp/OldName:calvin?secret=JBSWY3DPEHPK3PXP&issuer=NewName",
    );
    expect(params.issuer).toBe("NewName");
  });

  it("should parse URI with custom algorithm and digits", () => {
    const params = parseTotpUri(
      "otpauth://totp/Example?secret=JBSWY3DPEHPK3PXP&algorithm=SHA256&digits=8&period=60",
    );
    expect(params.algorithm).toBe("sha256");
    expect(params.digits).toBe(8);
    expect(params.period).toBe(60);
  });

  it("should default to SHA1, 6 digits, 30s period", () => {
    const params = parseTotpUri("otpauth://totp/Test?secret=JBSWY3DPEHPK3PXP");
    expect(params.algorithm).toBe("sha1");
    expect(params.digits).toBe(6);
    expect(params.period).toBe(30);
  });

  it("should throw on missing secret", () => {
    expect(() => parseTotpUri("otpauth://totp/Test")).toThrow(
      "Missing required",
    );
  });

  it("should throw on non-totp type", () => {
    expect(() =>
      parseTotpUri("otpauth://hotp/Test?secret=JBSWY3DPEHPK3PXP"),
    ).toThrow("Only TOTP is supported");
  });

  it("should throw on unsupported algorithm", () => {
    expect(() =>
      parseTotpUri("otpauth://totp/Test?secret=JBSWY3DPEHPK3PXP&algorithm=MD5"),
    ).toThrow("Unsupported algorithm");
  });

  it("should handle URL-encoded label", () => {
    const params = parseTotpUri(
      "otpauth://totp/My%20Service:user%40example.com?secret=JBSWY3DPEHPK3PXP&issuer=My%20Service",
    );
    expect(params.issuer).toBe("My Service");
    expect(params.account).toBe("user@example.com");
  });

  it("should throw on non-otpauth protocol", () => {
    expect(() =>
      parseTotpUri("http://totp/Test?secret=JBSWY3DPEHPK3PXP"),
    ).toThrow("Invalid OTP URI scheme");
  });

  it("should throw on invalid digits (too low)", () => {
    expect(() =>
      parseTotpUri("otpauth://totp/Test?secret=JBSWY3DPEHPK3PXP&digits=5"),
    ).toThrow("Invalid digits");
  });

  it("should throw on invalid digits (too high)", () => {
    expect(() =>
      parseTotpUri("otpauth://totp/Test?secret=JBSWY3DPEHPK3PXP&digits=9"),
    ).toThrow("Invalid digits");
  });

  it("should throw on invalid period (zero)", () => {
    expect(() =>
      parseTotpUri("otpauth://totp/Test?secret=JBSWY3DPEHPK3PXP&period=0"),
    ).toThrow("Invalid period");
  });

  it("should throw on invalid period (negative)", () => {
    expect(() =>
      parseTotpUri("otpauth://totp/Test?secret=JBSWY3DPEHPK3PXP&period=-1"),
    ).toThrow("Invalid period");
  });
});
