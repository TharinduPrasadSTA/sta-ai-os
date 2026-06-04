// Scripted Claude responses for simulation
export class MockAnthropic {
  private queue: string[];

  constructor(responses: string[] = []) {
    this.queue = [...responses];
  }

  complete(_model: string, _prompt: unknown, _opts?: unknown): Promise<string> {
    if (this.queue.length === 0) throw new Error('MockAnthropic: response queue is empty');
    return Promise.resolve(this.queue.shift()!);
  }

  remaining(): number {
    return this.queue.length;
  }
}

export function makeMockComplete(responses: string[]) {
  const mock = new MockAnthropic(responses);
  return mock.complete.bind(mock);
}
