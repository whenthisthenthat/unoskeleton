import { unixToDate } from "@/lib/vault/date-conversion";

describe("unixToDate", () => {
  it("should convert zero to Unix epoch", () => {
    expect(unixToDate(0)).toEqual(new Date("1970-01-01T00:00:00.000Z"));
  });

  it("should convert a known timestamp", () => {
    // 2024-01-01 00:00:00 UTC
    expect(unixToDate(1704067200)).toEqual(
      new Date("2024-01-01T00:00:00.000Z"),
    );
  });

  it("should handle timestamps beyond 2038", () => {
    // 2040-01-01 00:00:00 UTC
    expect(unixToDate(2208988800)).toEqual(
      new Date("2040-01-01T00:00:00.000Z"),
    );
  });

  it("should handle negative timestamps (pre-1970)", () => {
    // 1969-12-31 23:59:59 UTC
    expect(unixToDate(-1)).toEqual(new Date("1969-12-31T23:59:59.000Z"));
  });
});
