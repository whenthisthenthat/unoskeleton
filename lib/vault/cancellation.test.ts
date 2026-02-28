import { CancellationToken } from "./cancellation";

describe("CancellationToken", () => {
  it("should start as not cancelled", () => {
    const token = new CancellationToken();
    expect(token.isCancelled).toBe(false);
  });

  it("should be cancelled after cancel() is called", () => {
    const token = new CancellationToken();
    token.cancel();
    expect(token.isCancelled).toBe(true);
  });

  it("should be idempotent — calling cancel() twice is safe", () => {
    const token = new CancellationToken();
    token.cancel();
    token.cancel();
    expect(token.isCancelled).toBe(true);
  });

  it("should not affect other tokens", () => {
    const tokenA = new CancellationToken();
    const tokenB = new CancellationToken();

    tokenA.cancel();

    expect(tokenA.isCancelled).toBe(true);
    expect(tokenB.isCancelled).toBe(false);
  });
});
