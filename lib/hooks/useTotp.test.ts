import { formatCode } from "@/lib/hooks/useTotp";

// Module mocks — prevent import resolution failures for TOTP modules
jest.mock("@/lib/totp/totp", () => ({
  generateTotp: jest.fn(),
  currentTimeStep: jest.fn(),
  secondsRemaining: jest.fn(),
}));
jest.mock("@/lib/totp/uri", () => ({
  parseTotpUri: jest.fn(),
}));

describe("formatCode", () => {
  it("splits a 6-digit code into two groups of 3", () => {
    expect(formatCode("123456")).toBe("123 456");
  });

  it("splits an 8-digit code into two groups of 4", () => {
    expect(formatCode("12345678")).toBe("1234 5678");
  });

  it("splits a 7-digit code left-heavy (ceil)", () => {
    expect(formatCode("1234567")).toBe("1234 567");
  });

  it("handles a single character", () => {
    expect(formatCode("1")).toBe("1 ");
  });

  it("handles empty string", () => {
    expect(formatCode("")).toBe(" ");
  });

  it("handles a 2-character code", () => {
    expect(formatCode("12")).toBe("1 2");
  });
});
