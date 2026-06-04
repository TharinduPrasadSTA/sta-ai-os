export interface AssertionResult {
  passed: boolean;
  label: string;
  error?: string;
}

export const results: AssertionResult[] = [];

export function assertEqual<T>(label: string, actual: T, expected: T): void {
  const pass = JSON.stringify(actual) === JSON.stringify(expected);
  results.push({
    passed: pass,
    label,
    error: pass ? undefined : `Expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`,
  });
}

export function assertNotNull(label: string, value: unknown): void {
  const pass = value != null;
  results.push({ passed: pass, label, error: pass ? undefined : 'Expected non-null value' });
}

export function assertTruthy(label: string, value: unknown): void {
  const pass = !!value;
  results.push({ passed: pass, label, error: pass ? undefined : `Expected truthy, got ${JSON.stringify(value)}` });
}

export function assertFalsy(label: string, value: unknown): void {
  const pass = !value;
  results.push({ passed: pass, label, error: pass ? undefined : `Expected falsy, got ${JSON.stringify(value)}` });
}

export function assertContains(label: string, haystack: string, needle: string): void {
  const pass = haystack.includes(needle);
  results.push({ passed: pass, label, error: pass ? undefined : `Expected "${haystack}" to contain "${needle}"` });
}

export function assertMatch(label: string, value: string, pattern: RegExp): void {
  const pass = pattern.test(value);
  results.push({ passed: pass, label, error: pass ? undefined : `Expected "${value}" to match ${pattern}` });
}

export function assertGte(label: string, actual: number, min: number): void {
  const pass = actual >= min;
  results.push({ passed: pass, label, error: pass ? undefined : `Expected ${actual} >= ${min}` });
}

export async function assertThrows(label: string, fn: () => Promise<unknown>, msgContains?: string): Promise<void> {
  try {
    await fn();
    results.push({ passed: false, label, error: 'Expected function to throw but it did not' });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    const pass = !msgContains || msg.includes(msgContains);
    results.push({ passed: pass, label, error: pass ? undefined : `Expected error containing "${msgContains}", got "${msg}"` });
  }
}

export function assertLength(label: string, arr: unknown[], expected: number): void {
  assertEqual(label, arr.length, expected);
}
