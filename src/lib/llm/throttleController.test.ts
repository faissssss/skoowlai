import assert from 'node:assert/strict';

import { DEFAULT_THROTTLE_CONFIG, ThrottleController, type ThrottleConfig } from './throttleController';

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

const tests: TestCase[] = [];

function test(name: string, run: () => void | Promise<void>) {
  tests.push({ name, run });
}

function createController(
  config: ThrottleConfig = DEFAULT_THROTTLE_CONFIG.groq,
  initialIso = '2026-04-11T10:15:30.000Z',
) {
  const clock = new FakeClock(initialIso);
  const sleepCalls: number[] = [];
  const controller = new ThrottleController(config, {
    now: clock.now,
    pollIntervalMs: 100,
    sleep: async (ms: number) => {
      sleepCalls.push(ms);
      clock.advanceMs(ms);
    },
  });

  return { clock, controller, sleepCalls };
}

test('implements token bucket refill over time', async () => {
  const config: ThrottleConfig = {
    provider: 'groq',
    maxRequestsPerMinute: 60,
    bufferPercentage: 0,
    burstSize: 2,
    refillRate: 1,
  };
  const { clock, controller } = createController(config);

  assert.equal(await controller.tryAcquire(), true);
  assert.equal(await controller.tryAcquire(), true);
  assert.equal(await controller.tryAcquire(), false);

  clock.advanceMs(1_000);
  assert.equal(await controller.tryAcquire(), true);

  const status = controller.getStatus();
  assert.ok(status.availableTokens < 1);
  assert.equal(status.maxTokens, 2);
  assert.equal(status.refillRate, 1);
});

test('handles burst capacity and caps refill at max tokens', async () => {
  const config: ThrottleConfig = {
    provider: 'groq',
    maxRequestsPerMinute: 120,
    bufferPercentage: 0,
    burstSize: 3,
    refillRate: 2,
  };
  const { clock, controller } = createController(config);

  assert.equal(await controller.tryAcquire(), true);
  assert.equal(await controller.tryAcquire(), true);
  assert.equal(await controller.tryAcquire(), true);
  assert.equal(await controller.tryAcquire(), false);

  clock.advanceMs(10_000);
  const status = controller.getStatus();

  assert.equal(status.availableTokens, 3);
  assert.equal(await controller.tryAcquire(), true);
  assert.equal(await controller.tryAcquire(), true);
  assert.equal(await controller.tryAcquire(), true);
  assert.equal(await controller.tryAcquire(), false);
});

test('enforces rate limiting by timing out when no token becomes available in time', async () => {
  const config: ThrottleConfig = {
    provider: 'groq',
    maxRequestsPerMinute: 60,
    bufferPercentage: 0,
    burstSize: 1,
    refillRate: 1,
  };
  const { controller, sleepCalls } = createController(config);

  assert.equal(await controller.tryAcquire(), true);
  assert.equal(await controller.acquire(500), false);
  assert.ok(sleepCalls.length > 0);
});

test('acquire waits until a token is available within the timeout window', async () => {
  const config: ThrottleConfig = {
    provider: 'groq',
    maxRequestsPerMinute: 60,
    bufferPercentage: 0,
    burstSize: 1,
    refillRate: 1,
  };
  const { controller, sleepCalls } = createController(config);

  assert.equal(await controller.tryAcquire(), true);
  assert.equal(await controller.acquire(1_500), true);
  assert.ok(sleepCalls.some((ms) => ms >= 100));
});

test('reports status including the next refill time', async () => {
  const config: ThrottleConfig = {
    provider: 'groq',
    maxRequestsPerMinute: 60,
    bufferPercentage: 0,
    burstSize: 1,
    refillRate: 1,
  };
  const { controller } = createController(config);

  await controller.tryAcquire();
  const status = controller.getStatus();

  assert.equal(status.availableTokens, 0);
  assert.equal(status.maxTokens, 1);
  assert.equal(status.refillRate, 1);
  assert.equal(status.nextRefillAt.toISOString(), '2026-04-11T10:15:31.000Z');
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
    console.log(`All ${passed} ThrottleController tests passed.`);
  }
}

void main();
