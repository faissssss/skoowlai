"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const strict_1 = __importDefault(require("node:assert/strict"));
const fast_check_1 = __importDefault(require("fast-check"));
const costTracker_1 = require("./costTracker");
const tests = [];
function test(name, run) {
    tests.push({ name, run });
}
function makeEntry(overrides = {}) {
    return {
        timestamp: new Date('2026-04-12T10:00:00.000Z'),
        provider: 'gemini',
        model: 'gemini-2.5-flash',
        feature: 'chat',
        inputTokens: 1000,
        outputTokens: 500,
        requestId: 'req-1',
        ...overrides,
    };
}
test('Property 14: aggregated cost equals the sum of individual request costs', async () => {
    await fast_check_1.default.assert(fast_check_1.default.asyncProperty(fast_check_1.default.array(fast_check_1.default.record({
        inputTokens: fast_check_1.default.integer({ min: 0, max: 20000 }),
        outputTokens: fast_check_1.default.integer({ min: 0, max: 20000 }),
        feature: fast_check_1.default.constantFrom('chat', 'generate', 'flashcards', 'quiz'),
    }), { minLength: 1, maxLength: 30 }), async (requests) => {
        const storage = new costTracker_1.InMemoryCostStorage();
        const tracker = new costTracker_1.CostTracker(storage);
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
        const summary = await tracker.getSummary('gemini', new Date('2026-04-12T00:00:00.000Z'), new Date('2026-04-12T23:59:59.999Z'));
        strict_1.default.ok(Math.abs(summary.totalCost - expectedTotal) < 1e-12);
    }), { numRuns: 100 });
});
test('calculates and logs request cost based on provider pricing', async () => {
    const storage = new costTracker_1.InMemoryCostStorage();
    const tracker = new costTracker_1.CostTracker(storage);
    const logged = await tracker.logRequest(makeEntry({
        inputTokens: 2000,
        outputTokens: 1000,
    }));
    const expectedCost = (2 * costTracker_1.DEFAULT_COST_TRACKER_CONFIG.pricing.gemini.inputCostPer1kTokens)
        + (1 * costTracker_1.DEFAULT_COST_TRACKER_CONFIG.pricing.gemini.outputCostPer1kTokens);
    strict_1.default.equal(logged.estimatedCost, expectedCost);
});
test('aggregates requests by provider, feature, and model', async () => {
    const storage = new costTracker_1.InMemoryCostStorage();
    const tracker = new costTracker_1.CostTracker(storage);
    await tracker.logRequest(makeEntry({
        requestId: 'req-1',
        feature: 'chat',
        model: 'gemini-2.5-flash',
        inputTokens: 1000,
        outputTokens: 1000,
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
        inputTokens: 2000,
        outputTokens: 2000,
        requestId: 'req-3',
    });
    const geminiSummary = await tracker.getSummary('gemini', new Date('2026-04-12T00:00:00.000Z'), new Date('2026-04-12T23:59:59.999Z'));
    strict_1.default.equal(geminiSummary.totalRequests, 2);
    strict_1.default.equal(geminiSummary.totalTokens, 3000);
    strict_1.default.equal(geminiSummary.byFeature.chat.requests, 1);
    strict_1.default.equal(geminiSummary.byFeature.generate.requests, 1);
    strict_1.default.equal(geminiSummary.byModel['gemini-2.5-flash'].requests, 2);
});
test('returns daily cost totals for the requested provider and date', async () => {
    const storage = new costTracker_1.InMemoryCostStorage();
    const tracker = new costTracker_1.CostTracker(storage);
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
    strict_1.default.equal(dailyCost, first.estimatedCost + second.estimatedCost);
});
test('detects when daily cost crosses a configured threshold', async () => {
    const storage = new costTracker_1.InMemoryCostStorage();
    const tracker = new costTracker_1.CostTracker(storage);
    const logged = await tracker.logRequest(makeEntry({
        requestId: 'req-1',
        inputTokens: 10000,
        outputTokens: 10000,
    }));
    strict_1.default.equal(await tracker.checkThreshold('gemini', logged.estimatedCost - 0.000001, new Date('2026-04-12T10:00:00.000Z')), true);
    strict_1.default.equal(await tracker.checkThreshold('gemini', logged.estimatedCost + 0.000001, new Date('2026-04-12T10:00:00.000Z')), false);
});
let passed = 0;
async function main() {
    for (const { name, run } of tests) {
        try {
            await run();
            passed += 1;
            console.log(`PASS ${name}`);
        }
        catch (error) {
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
