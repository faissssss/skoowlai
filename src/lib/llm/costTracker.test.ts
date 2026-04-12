import assert from 'node:assert/strict';

import fc from 'fast-check';

import {
  CostTracker,
  DEFAULT_COST_TRACKER_CONFIG,
  InMemoryCostStorage,
  type CostEntry,
} from './costTracker';

type TestCase = {
  name: string;
  run: () => void | Promise<void>;
};

const tests: TestCase[] = [];

function test(name: string, run: () => void | Promise<void>) {
  tests.push({ name, run });
}

function makeEntry(overrides: Partial<Omit<CostEntry, 'estimatedCost'>> = {}) {
  return {
    timestamp: new Date('2026-04-12T10:00:00.000Z'),
    provider: 'gemini' as const,
    model: 'gemini-2.5-flash',
    feature: 'chat',
    inputTokens: 1_000,
    outputTokens: 500,
    requestId: 'req-1',
    ...overrides,
  };
}

test('Property 14: aggregated cost equals the sum of individual request costs', async () => {
  await fc.assert(
    fc.asyncProperty(
      fc.array(
        fc.record({
          inputTokens: fc.integer({ min: 0, max: 20_000 }),
          outputTokens: fc.integer({ min: 0, max: 20_000 }),
          feature: fc.constantFrom('chat', 'generate', 'flashcards', 'quiz'),
        }),
        { minLength: 1, maxLength: 30 },
      ),
      async (requests) => {
        const storage = new InMemoryCostStorage();
        const tracker = new CostTracker(storage);

        let expectedTotal = 0;
        for (let index = 0; index < requests.length; index += 1) {
          const request = requests[index];
          const logged = await tracker.logRequest(makeEntry({
            requestId: `req-${index}`,
            feature: request.feature,
            inputTokens: request.inputTokens,
            outputTokens: request.outputTokens,
          }));
          expectedTotal += logged.estimatedCost;
        }

        const summary = await tracker.getSummary(
          'gemini',
          new Date('2026-04-12T00:00:00.000Z'),
          new Date('2026-04-12T23:59:59.999Z'),
        );

        assert.ok(Math.abs(summary.totalCost - expectedTotal) < 1e-12);
      },
    ),
    { numRuns: 100 },
  );
});

test('calculates and logs request cost based on provider pricing', async () => {
  const storage = new InMemoryCostStorage();
  const tracker = new CostTracker(storage);

  const logged = await tracker.logRequest(makeEntry({
    inputTokens: 2_000,
    outputTokens: 1_000,
  }));

  const expectedCost = (2 * DEFAULT_COST_TRACKER_CONFIG.pricing.gemini.inputCostPer1kTokens)
    + (1 * DEFAULT_COST_TRACKER_CONFIG.pricing.gemini.outputCostPer1kTokens);

  assert.equal(logged.estimatedCost, expectedCost);
});

test('aggregates requests by provider, feature, and model', async () => {
  const storage = new InMemoryCostStorage();
  const tracker = new CostTracker(storage);

  await tracker.logRequest(makeEntry({
    requestId: 'req-1',
    feature: 'chat',
    model: 'gemini-2.5-flash',
    inputTokens: 1_000,
    outputTokens: 1_000,
  }));
  await tracker.logRequest(makeEntry({
    requestId: 'req-2',
    feature: 'generate',
    model: 'gemini-2.5-flash',
    inputTokens: 500,
    outputTokens: 500,
  }));
  await tracker.logRequest({
    timestamp: new Date('2026-04-12T11:00:00.000Z'),
    provider: 'groq',
    model: 'llama-3.3-70b-versatile',
    feature: 'chat',
    inputTokens: 2_000,
    outputTokens: 2_000,
    requestId: 'req-3',
  });

  const geminiSummary = await tracker.getSummary(
    'gemini',
    new Date('2026-04-12T00:00:00.000Z'),
    new Date('2026-04-12T23:59:59.999Z'),
  );

  assert.equal(geminiSummary.totalRequests, 2);
  assert.equal(geminiSummary.totalTokens, 3_000);
  assert.equal(geminiSummary.byFeature.chat.requests, 1);
  assert.equal(geminiSummary.byFeature.generate.requests, 1);
  assert.equal(geminiSummary.byModel['gemini-2.5-flash'].requests, 2);
});

test('returns daily cost totals for the requested provider and date', async () => {
  const storage = new InMemoryCostStorage();
  const tracker = new CostTracker(storage);

  const first = await tracker.logRequest(makeEntry({
    requestId: 'req-1',
    timestamp: new Date('2026-04-12T08:00:00.000Z'),
  }));
  const second = await tracker.logRequest(makeEntry({
    requestId: 'req-2',
    timestamp: new Date('2026-04-12T12:00:00.000Z'),
    inputTokens: 500,
    outputTokens: 500,
  }));
  await tracker.logRequest(makeEntry({
    requestId: 'req-3',
    timestamp: new Date('2026-04-13T08:00:00.000Z'),
  }));

  const dailyCost = await tracker.getDailyCost('gemini', new Date('2026-04-12T14:00:00.000Z'));

  assert.equal(dailyCost, first.estimatedCost + second.estimatedCost);
});

test('detects when daily cost crosses a configured threshold', async () => {
  const storage = new InMemoryCostStorage();
  const tracker = new CostTracker(storage);

  const logged = await tracker.logRequest(makeEntry({
    requestId: 'req-1',
    inputTokens: 10_000,
    outputTokens: 10_000,
  }));

  assert.equal(
    await tracker.checkThreshold('gemini', logged.estimatedCost - 0.000001, new Date('2026-04-12T10:00:00.000Z')),
    true,
  );
  assert.equal(
    await tracker.checkThreshold('gemini', logged.estimatedCost + 0.000001, new Date('2026-04-12T10:00:00.000Z')),
    false,
  );
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
    console.log(`All ${passed} CostTracker tests passed.`);
  }
}

void main();
