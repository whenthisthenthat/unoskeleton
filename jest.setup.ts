expect.extend({
  toEqualBuffer(received: Buffer, expected: Buffer) {
    const pass =
      Buffer.isBuffer(received) &&
      Buffer.isBuffer(expected) &&
      received.equals(expected);
    return {
      pass,
      message: () =>
        `expected buffers to ${pass ? "not " : ""}be equal\n` +
        `Received: ${received.toString("hex").slice(0, 64)}...\n` +
        `Expected: ${expected.toString("hex").slice(0, 64)}...`,
    };
  },
  toHaveBufferLength(received: Buffer, expected: number) {
    const pass = Buffer.isBuffer(received) && received.length === expected;
    return {
      pass,
      message: () =>
        `expected buffer length ${pass ? "not " : ""}to be ${expected}, got ${received?.length}`,
    };
  },
  toBeZeroedBuffer(received: Buffer) {
    const pass =
      Buffer.isBuffer(received) && received.every((byte) => byte === 0);
    return {
      pass,
      message: () =>
        pass
          ? `expected buffer NOT to be all zeros, but it was`
          : `expected buffer to be all zeros, but found non-zero bytes`,
    };
  },
});

/**
 * Assert that a sync function throws a specific error with matching properties.
 */
function expectToThrowWith<E extends Error>(
  fn: () => unknown,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  errorClass: new (...args: any[]) => E,
  properties: Partial<Record<keyof E, unknown>>,
): void {
  expect(fn).toThrow(errorClass);
  try {
    fn();
  } catch (e) {
    for (const [key, value] of Object.entries(properties)) {
      expect((e as Record<string, unknown>)[key]).toEqual(value);
    }
  }
}

/**
 * Assert that an async function rejects with a specific error with matching properties.
 */
async function expectToRejectWith<E extends Error>(
  fn: () => Promise<unknown>,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  errorClass: new (...args: any[]) => E,
  properties: Partial<Record<keyof E, unknown>>,
): Promise<void> {
  await expect(fn()).rejects.toThrow(errorClass);
  try {
    await fn();
  } catch (e) {
    for (const [key, value] of Object.entries(properties)) {
      expect((e as Record<string, unknown>)[key]).toEqual(value);
    }
  }
}

// Expose as globals for all test files
(globalThis as Record<string, unknown>).expectToThrowWith = expectToThrowWith;
(globalThis as Record<string, unknown>).expectToRejectWith = expectToRejectWith;
