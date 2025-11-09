declare module "node:test" {
  type TestFunction = (name: string, fn: () => void | Promise<void>) => void;
  const test: TestFunction;
  export default test;
}

declare module "node:assert/strict" {
  const assert: {
    equal(actual: unknown, expected: unknown, message?: string): void;
    ok(value: unknown, message?: string): asserts value;
  };
  export default assert;
}
