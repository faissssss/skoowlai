import assert from 'node:assert/strict';

import fc from 'fast-check';

import {
  DEFAULT_FALLBACK_CONFIG,
  FallbackHandler,
  type FallbackConfig,
} from './fallbackHandler';

type TestCase = {
  name: string;
  run: () => void | Promise<void>;
};

type TestFallbackError = Error & {
  statusCode?: number;
  code?: string;
  timeout?: boolean;
  response?: {
    status?: number;
  };
};

class FakeClock {
  private nowMs: number;

  constructor(initialIso: string) {
    this.nowMs = new Date(initialIso).getTime();
  }

  now = (): Date => new Date(this.nowMs);

  advanceMs(ms: number): void {
    this.nowMs += ms;
  }
}

const tests: TestCase[] = [];

function test(name: string, run: () => void | Promise<void>) {
  tests.push({ name, run });
}

function makeError(message: string, extras: Partial<TestFallbackError> = {}): TestFallbackError {
  const error = new Error(message) as TestFallbackError;
  Object.assign(error, extras);
  return error;
}

function createHandler(
  config: FallbackConfig = DEFAULT_FALLBACK_CONFIG,
  initialIso = '2026-04-12T10:00:00.000Z',
) {
  const clock = new FakeClock(initialIso);
  const handler = new FallbackHandler(config, { now: clock.now });
  return { clock, handler };
}

test('Property 5: falls back on retryable 5xx and 429 errors when enabled', async () => {
  await fc.assert(
    fc.asyncProperty(
      fc.constantFrom(429, 500, 502, 503, 504),
      async (statusCode) => {
        const { handler } = createHandler();
        let fallbackCalls = 0;

        const result = await handler.executeWithFallback(
          async () => {
            throw makeError('primary failed', { statusCode });
          },
          async () => {
            fallbackCalls += 1;
            return 'fallback-result';
          },
          {
            feature: 'chat',
            primaryProvider: 'groq',
            fallbackProvider: 'gemini',
          },
        );

        assert.equal(result, 'fallback-result');
        assert.equal(fallbackCalls, 1);
      },
    ),
    { numRuns: 100 },
  );
});

test('Property 6: does not fall back when disabled', async () => {
  await fc.assert(
    fc.asyncProperty(
      fc.constantFrom(429, 500, 503),
      async (statusCode) => {
        const { handler } = createHandler({
          ...DEFAULT_FALLBACK_CONFIG,
          enabled: false,
        });
        let fallbackCalls = 0;
        const primaryError = makeError('primary failed', { statusCode });

        await assert.rejects(
          () => handler.executeWithFallback(
            async () => {
              throw primaryError;
            },
            async () => {
              fallbackCalls += 1;
              return 'fallback-result';
            },
            {
              feature: 'generate',
              primaryProvider: 'groq',
              fallbackProvider: 'gemini',
            },
          ),
          (caught: unknown) => {
            assert.equal(caught, primaryError);
            return true;
          },
        );

        assert.equal(fallbackCalls, 0);
      },
    ),
    { numRuns: 100 },
  );
});

test('classifies retryable and non-retryable errors correctly', () => {
  const { handler } = createHandler();

  assert.equal(handler.shouldFallback(makeError('server error', { statusCode: 500 }), 'groq'), true);
  assert.equal(handler.shouldFallback(makeError('rate limited', { statusCode: 429 }), 'groq'), true);
  assert.equal(handler.shouldFallback(makeError('request timeout', { code: 'ETIMEDOUT' }), 'groq'), true);
  assert.equal(handler.shouldFallback(makeError('bad request', { statusCode: 400 }), 'groq'), false);
});

test('records fallback events and increments the fallback counter', async () => {
  const { handler } = createHandler();

  const result = await handler.executeWithFallback(
    async () => {
      throw makeError('primary failed', { statusCode: 503 });
    },
    async () => 'fallback-success',
    {
      feature: 'quiz',
      primaryProvider: 'groq',
      fallbackProvider: 'gemini',
    },
  );

  const events = handler.getEvents();

  assert.equal(result, 'fallback-success');
  assert.equal(handler.getFallbackCount(), 1);
  assert.equal(events.length, 1);
  assert.equal(events[0].feature, 'quiz');
  assert.equal(events[0].reason, '5xx');
  assert.equal(events[0].fallbackSuccess, true);
});

test('records unsuccessful fallback attempts and reports aggregated stats', async () => {
  const { clock, handler } = createHandler();

  await handler.executeWithFallback(
    async () => {
      throw makeError('rate limited', { statusCode: 429 });
    },
    async () => 'fallback-success',
    {
      feature: 'chat',
      primaryProvider: 'groq',
      fallbackProvider: 'gemini',
    },
  );

  clock.advanceMs(1_000);

  await assert.rejects(
    () => handler.executeWithFallback(
      async () => {
        throw makeError('request timeout', { code: 'ETIMEDOUT' });
      },
      async () => {
        throw new Error('fallback failed');
      },
      {
        feature: 'chat',
        primaryProvider: 'groq',
        fallbackProvider: 'gemini',
      },
    ),
  );

  const stats = await handler.getFallbackStats(60_000);

  assert.equal(stats.totalFallbacks, 2);
  assert.equal(stats.successRate, 0.5);
  assert.equal(stats.byFeature.chat, 2);
  assert.equal(stats.byReason['429'], 1);
  assert.equal(stats.byReason.timeout, 1);
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
    console.log(`All ${passed} FallbackHandler tests passed.`);
  }
}

void main();
