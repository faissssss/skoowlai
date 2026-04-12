import assert from 'node:assert/strict';

import fc from 'fast-check';

import { DEFAULT_RETRY_CONFIG, RetryStrategy, type RetryConfig } from './retryStrategy';

type TestCase = {
  name: string;
  run: () => void | Promise<void>;
};

type TestRetryError = Error & {
  statusCode?: number;
  code?: string;
  timeout?: boolean;
  retryAfter?: number | string;
  response?: {
    status?: number;
    headers?: Record<string, unknown> & {
      get?: (name: string) => string | null;
    };
  };
};

const tests: TestCase[] = [];

function test(name: string, run: () => void | Promise<void>) {
  tests.push({ name, run });
}

function makeError(
  message: string,
  extras: Partial<TestRetryError> = {},
): TestRetryError {
  const error = new Error(message) as TestRetryError;
  Object.assign(error, extras);
  return error;
}

test('Property 28: 429 retries use exponential backoff with jitter', async () => {
  await fc.assert(
    fc.asyncProperty(
      fc.integer({ min: 1, max: 5 }),
      fc.integer({ min: 0, max: 500 }),
      async (attempt, jitter) => {
        const strategy = new RetryStrategy(DEFAULT_RETRY_CONFIG, {
          random: () => jitter / 500,
          sleep: async () => {},
        });
        const error = makeError('rate limited', { statusCode: 429 });
        const delay = strategy.calculateDelay(attempt, error);
        const base = Math.min(1_000 * (2 ** (attempt - 1)), 32_000);

        assert.ok(delay >= base);
        assert.ok(delay <= base + 500);
      },
    ),
    { numRuns: 100 },
  );
});

test('Property 29: non-retryable 4xx errors are not retried', async () => {
  await fc.assert(
    fc.asyncProperty(
      fc.integer({ min: 400, max: 499 }).filter((status) => status !== 429),
      async (statusCode) => {
        const strategy = new RetryStrategy(DEFAULT_RETRY_CONFIG, {
          sleep: async () => {},
        });
        const error = makeError('client error', { statusCode });
        let calls = 0;

        await assert.rejects(
          () => strategy.execute(async () => {
            calls += 1;
            throw error;
          }, { feature: 'chat', provider: 'groq' }),
          (caught: unknown) => {
            assert.equal(caught, error);
            return true;
          },
        );

        assert.equal(calls, 1);
      },
    ),
    { numRuns: 100 },
  );
});

test('Property 30: Retry-After overrides smaller calculated delays', async () => {
  await fc.assert(
    fc.asyncProperty(
      fc.integer({ min: 1, max: 4 }),
      fc.integer({ min: 2, max: 60 }),
      async (attempt, retryAfterSeconds) => {
        const strategy = new RetryStrategy(DEFAULT_RETRY_CONFIG, {
          random: () => 0,
          sleep: async () => {},
        });
        const error = makeError('rate limited', {
          statusCode: 429,
          retryAfter: retryAfterSeconds,
        });

        const delay = strategy.calculateDelay(attempt, error);
        assert.ok(delay >= retryAfterSeconds * 1_000);
      },
    ),
    { numRuns: 100 },
  );
});

test('calculateDelay doubles for 429 retries and respects the max cap', () => {
  const strategy = new RetryStrategy(DEFAULT_RETRY_CONFIG, {
    random: () => 0,
    sleep: async () => {},
  });
  const error = makeError('rate limited', { statusCode: 429 });

  assert.equal(strategy.calculateDelay(1, error), 1_000);
  assert.equal(strategy.calculateDelay(2, error), 2_000);
  assert.equal(strategy.calculateDelay(3, error), 4_000);
  assert.equal(strategy.calculateDelay(6, error), 32_000);
});

test('adds jitter only for 429 responses', () => {
  const strategy = new RetryStrategy(DEFAULT_RETRY_CONFIG, {
    random: () => 1,
    sleep: async () => {},
  });

  assert.equal(strategy.calculateDelay(1, makeError('rate limited', { statusCode: 429 })), 1_500);
  assert.equal(strategy.calculateDelay(1, makeError('server error', { statusCode: 500 })), 2_000);
});

test('execute enforces max retries for 429 and 5xx responses', async () => {
  const delays: number[] = [];
  const strategy = new RetryStrategy(DEFAULT_RETRY_CONFIG, {
    random: () => 0,
    sleep: async (ms) => {
      delays.push(ms);
    },
  });

  let rateLimitedCalls = 0;
  await assert.rejects(
    () => strategy.execute(async () => {
      rateLimitedCalls += 1;
      throw makeError('rate limited', { statusCode: 429 });
    }, { feature: 'chat', provider: 'groq' }),
  );
  assert.equal(rateLimitedCalls, 4);
  assert.deepEqual(delays.slice(0, 3), [1_000, 2_000, 4_000]);

  delays.length = 0;
  let serverCalls = 0;
  await assert.rejects(
    () => strategy.execute(async () => {
      serverCalls += 1;
      throw makeError('server error', { statusCode: 500 });
    }, { feature: 'chat', provider: 'groq' }),
  );
  assert.equal(serverCalls, 3);
  assert.deepEqual(delays, [2_000, 4_000]);
});

test('execute retries timeout errors once', async () => {
  const delays: number[] = [];
  const strategy = new RetryStrategy(DEFAULT_RETRY_CONFIG, {
    random: () => 0,
    sleep: async (ms) => {
      delays.push(ms);
    },
  });

  let calls = 0;
  await assert.rejects(
    () => strategy.execute(async () => {
      calls += 1;
      throw makeError('request timeout', { code: 'ETIMEDOUT' });
    }, { feature: 'generate', provider: 'groq' }),
  );

  assert.equal(calls, 2);
  assert.deepEqual(delays, [1_000]);
});

test('reads Retry-After from response headers when present', () => {
  const strategy = new RetryStrategy(DEFAULT_RETRY_CONFIG, {
    random: () => 0,
    sleep: async () => {},
  });
  const error = makeError('rate limited', {
    statusCode: 429,
    response: {
      headers: {
        get: (name: string) => (name.toLowerCase() === 'retry-after' ? '12' : null),
      },
    },
  });

  assert.equal(strategy.calculateDelay(1, error), 12_000);
});

let passed = 0;

async function main() {
  for (const { name, run } of tests) {
    try {
      await run();
      passed += 1;
      console.log(`PASS ${name}`);
    } catch (error) {
      console.error(`FAIL ${name}`);
      console.error(error);
      process.exitCode = 1;
      break;
    }
  }

  if (!process.exitCode) {
    console.log(`All ${passed} RetryStrategy tests passed.`);
  }
}

void main();
