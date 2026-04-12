import assert from 'node:assert/strict';

import fc from 'fast-check';

import {
  HealthMonitor,
  type HealthCheckResult,
  type HealthRedisLike,
} from './healthMonitor';

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

class FakeHealthRedis implements HealthRedisLike {
  private readonly lists = new Map<string, string[]>();
  private readonly hashes = new Map<string, Record<string, string>>();
  private readonly expirations = new Map<string, number>();

  async lpush(key: string, ...values: string[]): Promise<number> {
    const current = this.lists.get(key) ?? [];
    this.lists.set(key, [...values, ...current]);
    return this.lists.get(key)!.length;
  }

  async ltrim(key: string, start: number, stop: number): Promise<'OK'> {
    const current = this.lists.get(key) ?? [];
    const normalizedStop = stop < 0 ? current.length + stop : stop;
    const next = current.slice(start, normalizedStop + 1);
    this.lists.set(key, next);
    return 'OK';
  }

  async lrange(key: string, start: number, stop: number): Promise<string[]> {
    const current = this.lists.get(key) ?? [];
    const normalizedStop = stop < 0 ? current.length + stop : stop;
    if (current.length === 0 || start > normalizedStop) {
      return [];
    }
    return current.slice(start, normalizedStop + 1);
  }

  async hset(key: string, values: Record<string, string>): Promise<number> {
    const current = this.hashes.get(key) ?? {};
    this.hashes.set(key, { ...current, ...values });
    return Object.keys(values).length;
  }

  async hgetall(key: string): Promise<Record<string, string>> {
    return { ...(this.hashes.get(key) ?? {}) };
  }

  async expire(key: string, seconds: number): Promise<number> {
    this.expirations.set(key, seconds);
    return 1;
  }

  getExpireSeconds(key: string): number | undefined {
    return this.expirations.get(key);
  }
}

const tests: TestCase[] = [];

function test(name: string, run: () => void | Promise<void>) {
  tests.push({ name, run });
}

function createMonitor(
  initialIso = '2026-04-12T10:00:00.000Z',
  checkers: ConstructorParameters<typeof HealthMonitor>[3]['providerCheckers'] = {},
) {
  const clock = new FakeClock(initialIso);
  const redis = new FakeHealthRedis();
  const monitor = new HealthMonitor(redis, 5 * 60 * 1000, 3, {
    now: clock.now,
    historyLimit: 100,
    providerCheckers: checkers,
  });

  return { clock, redis, monitor };
}

test('Property 16: success rate equals successful checks divided by total checks', async () => {
  await fc.assert(
    fc.asyncProperty(
      fc.array(fc.boolean(), { minLength: 1, maxLength: 50 }),
      async (statuses) => {
        const { redis, monitor } = createMonitor();
        const now = new Date('2026-04-12T10:00:00.000Z');

        for (let index = 0; index < statuses.length; index += 1) {
          const result: HealthCheckResult = {
            provider: 'groq',
            timestamp: new Date(now.getTime() + (index * 1_000)),
            available: statuses[index],
            latencyMs: 100,
          };
          await redis.lpush('health:groq:checks', JSON.stringify({
            provider: result.provider,
            timestamp: result.timestamp.toISOString(),
            available: result.available,
            latencyMs: result.latencyMs,
          }));
        }

        const history = await monitor.getHealthHistory('groq', 15 * 60 * 1000);
        const successful = statuses.filter(Boolean).length;
        const expected = successful / statuses.length;

        const actual = history.filter((entry) => entry.available).length / history.length;
        assert.equal(actual, expected);
      },
    ),
    { numRuns: 100 },
  );
});

test('executes a health check, stores history, and updates provider metrics', async () => {
  const { redis, monitor } = createMonitor('2026-04-12T10:00:00.000Z', {
    groq: async () => {},
  });

  const result = await monitor.checkHealth('groq');
  const metrics = await monitor.getHealth('groq');
  const history = await monitor.getHealthHistory('groq', 15 * 60 * 1000);

  assert.equal(result.provider, 'groq');
  assert.equal(result.available, true);
  assert.equal(history.length, 1);
  assert.equal(metrics.successRate, 1);
  assert.equal(metrics.consecutiveFailures, 0);
  assert.equal(metrics.healthy, true);
  assert.equal(redis.getExpireSeconds('provider:groq:status'), 300);
});

test('measures latency based on the elapsed time during a provider check', async () => {
  const { clock, monitor } = createMonitor('2026-04-12T10:00:00.000Z', {
    groq: async () => {
      clock.advanceMs(275);
    },
  });

  const result = await monitor.checkHealth('groq');
  const metrics = await monitor.getHealth('groq');

  assert.equal(result.latencyMs, 275);
  assert.equal(metrics.avgLatencyMs, 275);
});

test('marks a provider unhealthy after 3 consecutive failures', async () => {
  const { monitor } = createMonitor('2026-04-12T10:00:00.000Z', {
    groq: async () => {
      throw new Error('provider unavailable');
    },
  });

  await monitor.checkHealth('groq');
  let metrics = await monitor.getHealth('groq');
  assert.equal(metrics.healthy, true);
  assert.equal(metrics.consecutiveFailures, 1);

  await monitor.checkHealth('groq');
  metrics = await monitor.getHealth('groq');
  assert.equal(metrics.healthy, true);
  assert.equal(metrics.consecutiveFailures, 2);

  const result = await monitor.checkHealth('groq');
  metrics = await monitor.getHealth('groq');

  assert.equal(result.available, false);
  assert.equal(result.error, 'provider unavailable');
  assert.equal(metrics.healthy, false);
  assert.equal(metrics.consecutiveFailures, 3);
});

test('filters health history to the requested time window', async () => {
  const { clock, monitor } = createMonitor('2026-04-12T10:00:00.000Z', {
    groq: async () => {},
  });

  await monitor.checkHealth('groq');
  clock.advanceMs(16 * 60 * 1000);
  await monitor.checkHealth('groq');

  const history = await monitor.getHealthHistory('groq', 15 * 60 * 1000);

  assert.equal(history.length, 1);
  assert.equal(history[0].timestamp.toISOString(), '2026-04-12T10:16:00.000Z');
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
    console.log(`All ${passed} HealthMonitor tests passed.`);
  }
}

void main();
