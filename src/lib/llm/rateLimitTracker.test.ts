import assert from 'node:assert/strict';

import fc from 'fast-check';

import {
  type RateLimitConfig,
  type RedisLike,
  DEFAULT_RATE_LIMIT_CONFIG,
  RateLimitTracker,
} from './rateLimitTracker';

type TestCase = {
  name: string;
  run: () => void | Promise<void>;
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

class FakeRedis implements RedisLike {
  private readonly values = new Map<string, { value: number; expiresAt: number | null }>();

  constructor(private readonly now: () => Date) {}

  async get(key: string): Promise<string | null> {
    this.cleanupIfExpired(key);
    const entry = this.values.get(key);
    return entry ? String(entry.value) : null;
  }

  async incr(key: string): Promise<number> {
    this.cleanupIfExpired(key);
    const entry = this.values.get(key);
    const nextValue = (entry?.value ?? 0) + 1;
    this.values.set(key, {
      value: nextValue,
      expiresAt: entry?.expiresAt ?? null,
    });
    return nextValue;
  }

  async expire(key: string, seconds: number): Promise<number> {
    this.cleanupIfExpired(key);
    const entry = this.values.get(key);
    if (!entry) {
      return 0;
    }

    entry.expiresAt = this.now().getTime() + (seconds * 1000);
    this.values.set(key, entry);
    return 1;
  }

  async ttl(key: string): Promise<number> {
    this.cleanupIfExpired(key);
    const entry = this.values.get(key);
    if (!entry) {
      return -2;
    }
    if (entry.expiresAt === null) {
      return -1;
    }

    const remainingMs = entry.expiresAt - this.now().getTime();
    return remainingMs > 0 ? Math.ceil(remainingMs / 1000) : -2;
  }

  getTtlSeconds(key: string): number {
    this.cleanupIfExpired(key);
    const entry = this.values.get(key);
    if (!entry || entry.expiresAt === null) {
      return -1;
    }

    return Math.ceil((entry.expiresAt - this.now().getTime()) / 1000);
  }

  private cleanupIfExpired(key: string): void {
    const entry = this.values.get(key);
    if (!entry || entry.expiresAt === null) {
      return;
    }

    if (entry.expiresAt <= this.now().getTime()) {
      this.values.delete(key);
    }
  }
}

const tests: TestCase[] = [];

function test(name: string, run: () => void | Promise<void>) {
  tests.push({ name, run });
}

function createTracker(
  initialIso = '2026-04-11T10:15:30.000Z',
  config: RateLimitConfig = DEFAULT_RATE_LIMIT_CONFIG,
) {
  const clock = new FakeClock(initialIso);
  const redis = new FakeRedis(clock.now);
  const tracker = new RateLimitTracker(redis, config, { now: clock.now });

  return { clock, redis, tracker };
}

test('Property 2: maintains isolated counters per provider', async () => {
  await fc.assert(
    fc.asyncProperty(
      fc.array(fc.constantFrom<'groq' | 'gemini'>('groq', 'gemini'), { minLength: 1, maxLength: 100 }),
      async (providers) => {
        const { tracker } = createTracker();
        let expectedGroq = 0;
        let expectedGemini = 0;

        for (const provider of providers) {
          await tracker.incrementCount(provider);
          if (provider === 'groq') {
            expectedGroq += 1;
          } else {
            expectedGemini += 1;
          }
        }

        const groqStatus = await tracker.getStatus('groq');
        const geminiStatus = await tracker.getStatus('gemini');

        assert.equal(groqStatus.rpm.current, expectedGroq);
        assert.equal(groqStatus.rpd.current, expectedGroq);
        assert.equal(geminiStatus.rpm.current, expectedGemini);
        assert.equal(geminiStatus.rpd.current, expectedGemini);
      },
    ),
    { numRuns: 100 },
  );
});

test('increments RPM and RPD counters for a provider', async () => {
  const { tracker } = createTracker();

  await tracker.incrementCount('groq');
  await tracker.incrementCount('groq');

  const status = await tracker.getStatus('groq');

  assert.equal(status.rpm.current, 2);
  assert.equal(status.rpd.current, 2);
  assert.equal(status.rpm.remaining, 28);
  assert.equal(status.rpd.remaining, 14_398);
});

test('resets the minute and day counters when their windows expire', async () => {
  const { clock, tracker } = createTracker('2026-04-11T23:59:30.000Z');

  await tracker.incrementCount('groq');
  clock.advanceMs(31_000);

  let status = await tracker.getStatus('groq');
  assert.equal(status.rpm.current, 0);
  assert.equal(status.rpd.current, 0);

  await tracker.incrementCount('groq');
  status = await tracker.getStatus('groq');
  assert.equal(status.rpm.current, 1);
  assert.equal(status.rpd.current, 1);
});

test('detects queue and throttle thresholds at 80 and 90 percent', async () => {
  const config: RateLimitConfig = {
    groq: {
      requestsPerMinute: 10,
      requestsPerDay: 100,
      warningThreshold: 80,
      throttleThreshold: 90,
    },
    gemini: DEFAULT_RATE_LIMIT_CONFIG.gemini,
  };
  const { tracker } = createTracker('2026-04-11T10:15:30.000Z', config);

  for (let index = 0; index < 8; index += 1) {
    await tracker.incrementCount('groq');
  }

  let status = await tracker.checkLimit('groq');
  assert.equal(status.shouldQueue, true);
  assert.equal(status.shouldThrottle, false);
  assert.equal(status.warningThresholdExceeded, true);
  assert.equal(status.throttleThresholdExceeded, false);

  await tracker.incrementCount('groq');
  status = await tracker.checkLimit('groq');
  assert.equal(status.shouldThrottle, true);
  assert.equal(status.throttleThresholdExceeded, true);
});

test('applies Redis key expiration for minute and day counters', async () => {
  const { redis, tracker } = createTracker('2026-04-11T23:59:30.000Z');

  await tracker.incrementCount('groq');

  assert.equal(redis.getTtlSeconds('ratelimit:groq:rpm:202604112359'), 30);
  assert.equal(redis.getTtlSeconds('ratelimit:groq:rpd:20260411'), 30);
});

test('reports reset boundaries for the next minute and midnight UTC', async () => {
  const { tracker } = createTracker('2026-04-11T23:59:30.000Z');

  const status = await tracker.getStatus('groq');

  assert.equal(status.resetAt.minute.toISOString(), '2026-04-12T00:00:00.000Z');
  assert.equal(status.resetAt.day.toISOString(), '2026-04-12T00:00:00.000Z');
});

test('Property 32: rolling average equals total requests divided by window size', async () => {
  await fc.assert(
    fc.asyncProperty(
      fc.array(fc.integer({ min: 0, max: 10 }), { minLength: 15, maxLength: 15 }),
      async (requestCounts) => {
        const { clock, tracker } = createTracker('2026-04-11T10:00:00.000Z');

        // Simulate requests over 15 minutes
        for (let i = 0; i < requestCounts.length; i++) {
          const count = requestCounts[i];
          for (let j = 0; j < count; j++) {
            await tracker.incrementCount('groq');
          }
          // Advance to next minute only if not the last iteration
          if (i < requestCounts.length - 1) {
            clock.advanceMs(60_000);
          }
        }

        // Now we're still at minute 14 (the last minute where we added requests)
        // Looking back 15 minutes includes minutes 14,13,12,...,0
        const rollingAverage = await tracker.getRollingAverage('groq', 15);
        const expectedAverage = requestCounts.reduce((sum, count) => sum + count, 0) / 15;

        // Use a small epsilon for floating point comparison
        const epsilon = 0.001;
        assert.equal(Math.abs(rollingAverage - expectedAverage) < epsilon, true, 
          `Expected ${expectedAverage}, got ${rollingAverage}`);
      },
    ),
    { numRuns: 50 },
  );
});

test('calculates rolling average over 15-minute window', async () => {
  const { clock, tracker } = createTracker('2026-04-11T10:15:00.000Z');

  // Minute 0: 5 requests
  for (let i = 0; i < 5; i++) {
    await tracker.incrementCount('groq');
  }
  clock.advanceMs(60_000);

  // Minute 1: 10 requests
  for (let i = 0; i < 10; i++) {
    await tracker.incrementCount('groq');
  }
  clock.advanceMs(60_000);

  // Minute 2: 3 requests
  for (let i = 0; i < 3; i++) {
    await tracker.incrementCount('groq');
  }

  const rollingAverage = await tracker.getRollingAverage('groq', 15);
  
  // Total: 18 requests over 15 minutes = 1.2 requests/minute
  assert.equal(Math.abs(rollingAverage - 1.2) < 0.01, true);
});

test('predicts exhaustion when rolling average exceeds sustainable rate', async () => {
  const config: RateLimitConfig = {
    groq: {
      requestsPerMinute: 30,
      requestsPerDay: 100, // Very low daily limit for testing
      warningThreshold: 80,
      throttleThreshold: 90,
    },
    gemini: DEFAULT_RATE_LIMIT_CONFIG.gemini,
  };
  const { clock, tracker } = createTracker('2026-04-11T10:00:00.000Z', config);

  // Use 50 requests in first 10 minutes (5 req/min average)
  for (let minute = 0; minute < 10; minute++) {
    for (let i = 0; i < 5; i++) {
      await tracker.incrementCount('groq');
    }
    clock.advanceMs(60_000);
  }

  const prediction = await tracker.predictExhaustion('groq');

  // Sustainable rate: 50 remaining / 840 minutes = ~0.06 req/min
  // Rolling average: 5 req/min
  // Should predict exhaustion
  assert.equal(prediction.willExceedDaily, true);
  assert.equal(prediction.shouldProactivelyThrottle, true);
  assert.notEqual(prediction.estimatedExhaustionTime, null);
});

test('does not predict exhaustion when usage is sustainable', async () => {
  const config: RateLimitConfig = {
    groq: {
      requestsPerMinute: 30,
      requestsPerDay: 10_000,
      warningThreshold: 80,
      throttleThreshold: 90,
    },
    gemini: DEFAULT_RATE_LIMIT_CONFIG.gemini,
  };
  const { clock, tracker } = createTracker('2026-04-11T10:00:00.000Z', config);

  // Use 10 requests in first 10 minutes (1 req/min average)
  for (let minute = 0; minute < 10; minute++) {
    await tracker.incrementCount('groq');
    clock.advanceMs(60_000);
  }

  const prediction = await tracker.predictExhaustion('groq');

  // Sustainable rate: 9990 remaining / 840 minutes = ~11.9 req/min
  // Rolling average: 1 req/min
  // Should not predict exhaustion
  assert.equal(prediction.willExceedDaily, false);
  assert.equal(prediction.shouldProactivelyThrottle, false);
});

test('generates alert when usage exceeds 50% by noon UTC', async () => {
  const config: RateLimitConfig = {
    groq: {
      requestsPerMinute: 30,
      requestsPerDay: 100,
      warningThreshold: 80,
      throttleThreshold: 90,
    },
    gemini: DEFAULT_RATE_LIMIT_CONFIG.gemini,
  };
  const { tracker } = createTracker('2026-04-11T11:00:00.000Z', config);

  // Use 51 requests (51% of daily limit)
  for (let i = 0; i < 51; i++) {
    await tracker.incrementCount('groq');
  }

  const prediction = await tracker.predictExhaustion('groq');

  assert.notEqual(prediction.alert, null);
  assert.equal(prediction.alert?.includes('High usage detected'), true);
  assert.equal(prediction.alert?.includes('51.0%'), true);
});

test('does not generate alert when usage is below 50% before noon', async () => {
  const config: RateLimitConfig = {
    groq: {
      requestsPerMinute: 30,
      requestsPerDay: 100,
      warningThreshold: 80,
      throttleThreshold: 90,
    },
    gemini: DEFAULT_RATE_LIMIT_CONFIG.gemini,
  };
  const { tracker } = createTracker('2026-04-11T11:00:00.000Z', config);

  // Use 40 requests (40% of daily limit)
  for (let i = 0; i < 40; i++) {
    await tracker.incrementCount('groq');
  }

  const prediction = await tracker.predictExhaustion('groq');

  assert.equal(prediction.alert, null);
});

test('forecasts remaining capacity for next hour', async () => {
  const config: RateLimitConfig = {
    groq: {
      requestsPerMinute: 30,
      requestsPerDay: 1000,
      warningThreshold: 80,
      throttleThreshold: 90,
    },
    gemini: DEFAULT_RATE_LIMIT_CONFIG.gemini,
  };
  const { clock, tracker } = createTracker('2026-04-11T10:00:00.000Z', config);

  // Use 100 requests in first 10 minutes (10 req/min average)
  for (let minute = 0; minute < 10; minute++) {
    for (let i = 0; i < 10; i++) {
      await tracker.incrementCount('groq');
    }
    clock.advanceMs(60_000);
  }

  const prediction = await tracker.predictExhaustion('groq');
  const status = await tracker.getStatus('groq');

  // Remaining: 900 requests
  // Rolling average: 6.67 req/min (100 requests / 15 minutes)
  // Forecasted for next hour: 900 - (6.67 * 60) = 500
  const expectedForecast = status.rpd.remaining - (prediction.rollingAverage * 60);
  assert.equal(Math.abs(prediction.forecastedRemainingCapacity - expectedForecast) < 1, true);
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
    console.log(`All ${passed} RateLimitTracker tests passed.`);
  }
}

void main();
