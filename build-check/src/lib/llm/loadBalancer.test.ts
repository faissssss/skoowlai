import assert from 'node:assert/strict';

import fc from 'fast-check';

import type { Provider } from './config';
import type { HealthMetrics } from './healthMonitor';
import {
  DEFAULT_LOAD_BALANCER_CONFIG,
  LoadBalancer,
  type HealthMonitorLike,
  type LoadBalancerConfig,
  type RateLimitTrackerLike,
} from './loadBalancer';
import type { RateLimitStatus } from './rateLimitTracker';

type TestCase = {
  name: string;
  run: () => void | Promise<void>;
};

class FakeRateLimitTracker implements RateLimitTrackerLike {
  constructor(private readonly statuses: Record<Provider, RateLimitStatus>) {}

  async getStatus(provider: Provider): Promise<RateLimitStatus> {
    return this.statuses[provider];
  }
}

class FakeHealthMonitor implements HealthMonitorLike {
  constructor(private readonly metrics: Record<Provider, HealthMetrics>) {}

  async getHealth(provider: Provider): Promise<HealthMetrics> {
    return this.metrics[provider];
  }
}

const tests: TestCase[] = [];

function test(name: string, run: () => void | Promise<void>) {
  tests.push({ name, run });
}

function makeRateLimitStatus(
  provider: Provider,
  rpmPercentage: number,
  rpdPercentage: number,
): RateLimitStatus {
  const rpmLimit = provider === 'groq' ? 30 : 60;
  const rpdLimit = provider === 'groq' ? 14_400 : 50_000;
  const rpmCurrent = Math.round((rpmPercentage / 100) * rpmLimit);
  const rpdCurrent = Math.round((rpdPercentage / 100) * rpdLimit);

  return {
    provider,
    rpm: {
      current: rpmCurrent,
      limit: rpmLimit,
      remaining: Math.max(rpmLimit - rpmCurrent, 0),
      percentage: rpmPercentage,
    },
    rpd: {
      current: rpdCurrent,
      limit: rpdLimit,
      remaining: Math.max(rpdLimit - rpdCurrent, 0),
      percentage: rpdPercentage,
    },
    resetAt: {
      minute: new Date('2026-04-12T10:01:00.000Z'),
      day: new Date('2026-04-13T00:00:00.000Z'),
    },
    warningThresholdExceeded: Math.max(rpmPercentage, rpdPercentage) >= 80,
    throttleThresholdExceeded: Math.max(rpmPercentage, rpdPercentage) >= 90,
    shouldQueue: Math.max(rpmPercentage, rpdPercentage) >= 80,
    shouldThrottle: Math.max(rpmPercentage, rpdPercentage) >= 90,
    isExceeded: rpmCurrent >= rpmLimit || rpdCurrent >= rpdLimit,
  };
}

function makeHealthMetrics(
  provider: Provider,
  healthy = true,
  avgLatencyMs = 100,
): HealthMetrics {
  return {
    provider,
    successRate: healthy ? 1 : 0.5,
    avgLatencyMs,
    lastCheck: new Date('2026-04-12T10:00:00.000Z'),
    healthy,
    consecutiveFailures: healthy ? 0 : 3,
  };
}

function createLoadBalancer(
  statuses: Record<Provider, RateLimitStatus>,
  metrics: Record<Provider, HealthMetrics>,
  config: LoadBalancerConfig = DEFAULT_LOAD_BALANCER_CONFIG,
) {
  return new LoadBalancer(
    new FakeRateLimitTracker(statuses),
    new FakeHealthMonitor(metrics),
    config,
  );
}

test('Property 19: selects Groq when both providers are healthy and below 80 percent capacity', async () => {
  await fc.assert(
    fc.asyncProperty(
      fc.integer({ min: 0, max: 79 }),
      fc.integer({ min: 0, max: 79 }),
      fc.integer({ min: 0, max: 79 }),
      fc.integer({ min: 0, max: 79 }),
      async (groqRpm, groqRpd, geminiRpm, geminiRpd) => {
        const loadBalancer = createLoadBalancer(
          {
            groq: makeRateLimitStatus('groq', groqRpm, groqRpd),
            gemini: makeRateLimitStatus('gemini', geminiRpm, geminiRpd),
          },
          {
            groq: makeHealthMetrics('groq', true),
            gemini: makeHealthMetrics('gemini', true),
          },
        );

        const selected = await loadBalancer.selectProvider('chat');
        assert.equal(selected, 'groq');
      },
    ),
    { numRuns: 100 },
  );
});

test('Property 20: never selects an unhealthy provider when a healthy alternative exists', async () => {
  await fc.assert(
    fc.asyncProperty(
      fc.constantFrom<'groq' | 'gemini'>('groq', 'gemini'),
      async (unhealthyProvider) => {
        const healthyProvider: Provider = unhealthyProvider === 'groq' ? 'gemini' : 'groq';
        const loadBalancer = createLoadBalancer(
          {
            groq: makeRateLimitStatus('groq', 20, 20),
            gemini: makeRateLimitStatus('gemini', 20, 20),
          },
          {
            groq: makeHealthMetrics('groq', unhealthyProvider !== 'groq'),
            gemini: makeHealthMetrics('gemini', unhealthyProvider !== 'gemini'),
          },
        );

        const selected = await loadBalancer.selectProvider('generate');
        assert.equal(selected, healthyProvider);
      },
    ),
    { numRuns: 100 },
  );
});

test('routes to Gemini when Groq exceeds the capacity threshold', async () => {
  const loadBalancer = createLoadBalancer(
    {
      groq: makeRateLimitStatus('groq', 85, 10),
      gemini: makeRateLimitStatus('gemini', 20, 10),
    },
    {
      groq: makeHealthMetrics('groq', true),
      gemini: makeHealthMetrics('gemini', true),
    },
  );

  const selected = await loadBalancer.selectProvider('chat');
  assert.equal(selected, 'gemini');
});

test('getCapacityStatus calculates capacity, cost, health, and score for both providers', async () => {
  const loadBalancer = createLoadBalancer(
    {
      groq: makeRateLimitStatus('groq', 25, 10),
      gemini: makeRateLimitStatus('gemini', 60, 30),
    },
    {
      groq: makeHealthMetrics('groq', true, 120),
      gemini: makeHealthMetrics('gemini', true, 220),
    },
  );

  const capacities = await loadBalancer.getCapacityStatus();
  const groq = capacities.find((entry) => entry.provider === 'groq');
  const gemini = capacities.find((entry) => entry.provider === 'gemini');

  assert.ok(groq);
  assert.ok(gemini);
  assert.equal(groq.availableRpm, 22);
  assert.equal(groq.availableRpd, 12_960);
  assert.equal(groq.estimatedCost, 0);
  assert.equal(groq.healthy, true);
  assert.equal(groq.rpmUsagePercentage, 25);
  assert.equal(gemini.availableRpm, 24);
  assert.equal(gemini.estimatedCost, 1);
});

test('rebalance refreshes and sorts cached capacity data', async () => {
  const loadBalancer = createLoadBalancer(
    {
      groq: makeRateLimitStatus('groq', 10, 10),
      gemini: makeRateLimitStatus('gemini', 20, 20),
    },
    {
      groq: makeHealthMetrics('groq', true, 50),
      gemini: makeHealthMetrics('gemini', true, 150),
    },
  );

  await loadBalancer.rebalance();
  const capacities = await loadBalancer.getCapacityStatus();

  assert.equal(capacities[0].provider, 'groq');
  assert.ok(capacities[0].score >= capacities[1].score);
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
    console.log(`All ${passed} LoadBalancer tests passed.`);
  }
}

void main();
