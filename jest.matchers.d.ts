declare global {
  namespace jest {
    interface Matchers<R> {
      toEqualBuffer(expected: Buffer): R;
      toHaveBufferLength(expected: number): R;
      toBeZeroedBuffer(): R;
    }
  }

  function expectToThrowWith<E extends Error>(
    fn: () => unknown,
    errorClass: new (...args: never[]) => E,
    properties: Partial<Record<keyof E, unknown>>,
  ): void;

  function expectToRejectWith<E extends Error>(
    fn: () => Promise<unknown>,
    errorClass: new (...args: never[]) => E,
    properties: Partial<Record<keyof E, unknown>>,
  ): Promise<void>;
}
export {};
