import {
  generateTotp,
  currentTimeStep,
  secondsRemaining,
} from "@/lib/totp/totp";

// RFC 6238 Appendix B test secrets
// SHA-1: 20-byte key "12345678901234567890"
// SHA-256: 32-byte key "12345678901234567890123456789012"
// SHA-512: 64-byte key (repeated)
const SECRET_SHA1 = Buffer.from("12345678901234567890", "ascii");
const SECRET_SHA256 = Buffer.from("12345678901234567890123456789012", "ascii");
const SECRET_SHA512 = Buffer.from(
  "1234567890123456789012345678901234567890123456789012345678901234",
  "ascii",
);

describe("generateTotp", () => {
  // RFC 6238 Appendix B test vectors (8-digit codes)

  describe("SHA-1 test vectors", () => {
    it("should generate 94287082 at T=59", () => {
      const step = Math.floor(59 / 30);
      expect(generateTotp(SECRET_SHA1, step, "sha1", 8)).toBe("94287082");
    });

    it("should generate 07081804 at T=1111111109", () => {
      const step = Math.floor(1111111109 / 30);
      expect(generateTotp(SECRET_SHA1, step, "sha1", 8)).toBe("07081804");
    });

    it("should generate 14050471 at T=1111111111", () => {
      const step = Math.floor(1111111111 / 30);
      expect(generateTotp(SECRET_SHA1, step, "sha1", 8)).toBe("14050471");
    });

    it("should generate 89005924 at T=1234567890", () => {
      const step = Math.floor(1234567890 / 30);
      expect(generateTotp(SECRET_SHA1, step, "sha1", 8)).toBe("89005924");
    });

    it("should generate 69279037 at T=2000000000", () => {
      const step = Math.floor(2000000000 / 30);
      expect(generateTotp(SECRET_SHA1, step, "sha1", 8)).toBe("69279037");
    });

    it("should generate 65353130 at T=20000000000", () => {
      const step = Math.floor(20000000000 / 30);
      expect(generateTotp(SECRET_SHA1, step, "sha1", 8)).toBe("65353130");
    });
  });

  describe("SHA-256 test vectors", () => {
    it("should generate 46119246 at T=59", () => {
      const step = Math.floor(59 / 30);
      expect(generateTotp(SECRET_SHA256, step, "sha256", 8)).toBe("46119246");
    });

    it("should generate 68084774 at T=1111111109", () => {
      const step = Math.floor(1111111109 / 30);
      expect(generateTotp(SECRET_SHA256, step, "sha256", 8)).toBe("68084774");
    });

    it("should generate 67062674 at T=1111111111", () => {
      const step = Math.floor(1111111111 / 30);
      expect(generateTotp(SECRET_SHA256, step, "sha256", 8)).toBe("67062674");
    });

    it("should generate 91819424 at T=1234567890", () => {
      const step = Math.floor(1234567890 / 30);
      expect(generateTotp(SECRET_SHA256, step, "sha256", 8)).toBe("91819424");
    });

    it("should generate 90698825 at T=2000000000", () => {
      const step = Math.floor(2000000000 / 30);
      expect(generateTotp(SECRET_SHA256, step, "sha256", 8)).toBe("90698825");
    });

    it("should generate 77737706 at T=20000000000", () => {
      const step = Math.floor(20000000000 / 30);
      expect(generateTotp(SECRET_SHA256, step, "sha256", 8)).toBe("77737706");
    });
  });

  describe("SHA-512 test vectors", () => {
    it("should generate 90693936 at T=59", () => {
      const step = Math.floor(59 / 30);
      expect(generateTotp(SECRET_SHA512, step, "sha512", 8)).toBe("90693936");
    });

    it("should generate 25091201 at T=1111111109", () => {
      const step = Math.floor(1111111109 / 30);
      expect(generateTotp(SECRET_SHA512, step, "sha512", 8)).toBe("25091201");
    });

    it("should generate 99943326 at T=1111111111", () => {
      const step = Math.floor(1111111111 / 30);
      expect(generateTotp(SECRET_SHA512, step, "sha512", 8)).toBe("99943326");
    });

    it("should generate 93441116 at T=1234567890", () => {
      const step = Math.floor(1234567890 / 30);
      expect(generateTotp(SECRET_SHA512, step, "sha512", 8)).toBe("93441116");
    });

    it("should generate 38618901 at T=2000000000", () => {
      const step = Math.floor(2000000000 / 30);
      expect(generateTotp(SECRET_SHA512, step, "sha512", 8)).toBe("38618901");
    });

    it("should generate 47863826 at T=20000000000", () => {
      const step = Math.floor(20000000000 / 30);
      expect(generateTotp(SECRET_SHA512, step, "sha512", 8)).toBe("47863826");
    });
  });

  describe("6-digit codes", () => {
    it("should return 6-digit zero-padded string by default", () => {
      const code = generateTotp(SECRET_SHA1, 1);
      expect(code).toHaveLength(6);
      expect(code).toMatch(/^\d{6}$/);
    });
  });
});

describe("currentTimeStep", () => {
  it("should return 0 for time 0", () => {
    expect(currentTimeStep(30, 0)).toBe(0);
  });

  it("should return 1 for time 30000ms", () => {
    expect(currentTimeStep(30, 30000)).toBe(1);
  });

  it("should return 1 for time 59999ms (still in first step)", () => {
    expect(currentTimeStep(30, 59999)).toBe(1);
  });

  it("should handle custom periods", () => {
    expect(currentTimeStep(60, 60000)).toBe(1);
  });
});

describe("secondsRemaining", () => {
  it("should return period for time 0", () => {
    expect(secondsRemaining(30, 0)).toBe(30);
  });

  it("should return 1 when 29 seconds have elapsed", () => {
    expect(secondsRemaining(30, 29000)).toBe(1);
  });

  it("should return 30 when exactly at period boundary", () => {
    expect(secondsRemaining(30, 30000)).toBe(30);
  });

  it("should handle custom periods", () => {
    expect(secondsRemaining(60, 30000)).toBe(30);
  });
});
