"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const strict_1 = __importDefault(require("node:assert/strict"));
const fast_check_1 = __importDefault(require("fast-check"));
const loadBalancer_1 = require("./loadBalancer");
class FakeRateLimitTracker {
    constructor(statuses) {
        this.statuses = statuses;
    }
    async getStatus(provider) {
        return this.statuses[provider];
    }
}
class FakeHealthMonitor {
    constructor(metrics) {
        this.metrics = metrics;
    }
    async getHealth(provider) {
        return this.metrics[provider];
    }
}
const tests = [];
function test(name, run) {
    tests.push({ name, run });
}
function makeRateLimitStatus(provider, rpmPercentage, rpdPercentage) {
    const rpmLimit = provider === 'groq' ? 30 : 60;
    const rpdLimit = provider === 'groq' ? 14400 : 50000;
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
function makeHealthMetrics(provider, healthy = true, avgLatencyMs = 100) {
    return {
        provider,
        successRate: healthy ? 1 : 0.5,
        avgLatencyMs,
        lastCheck: new Date('2026-04-12T10:00:00.000Z'),
        healthy,
        consecutiveFailures: healthy ? 0 : 3,
    };
}
function createLoadBalancer(statuses, metrics, config = loadBalancer_1.DEFAULT_LOAD_BALANCER_CONFIG) {
    return new loadBalancer_1.LoadBalancer(new FakeRateLimitTracker(statuses), new FakeHealthMonitor(metrics), config);
}
test('Property 19: selects Groq when both providers are healthy and below 80 percent capacity', async () => {
    await fast_check_1.default.assert(fast_check_1.default.asyncProperty(fast_check_1.default.integer({ min: 0, max: 79 }), fast_check_1.default.integer({ min: 0, max: 79 }), fast_check_1.default.integer({ min: 0, max: 79 }), fast_check_1.default.integer({ min: 0, max: 79 }), async (groqRpm, groqRpd, geminiRpm, geminiRpd) => {
        const loadBalancer = createLoadBalancer({
            groq: makeRateLimitStatus('groq', groqRpm, groqRpd),
            gemini: makeRateLimitStatus('gemini', geminiRpm, geminiRpd),
        }, {
            groq: makeHealthMetrics('groq', true),
            gemini: makeHealthMetrics('gemini', true),
        });
        const selected = await loadBalancer.selectProvider('chat');
        strict_1.default.equal(selected, 'groq');
    }), { numRuns: 100 });
});
test('Property 20: never selects an unhealthy provider when a healthy alternative exists', async () => {
    await fast_check_1.default.assert(fast_check_1.default.asyncProperty(fast_check_1.default.constantFrom('groq', 'gemini'), async (unhealthyProvider) => {
        const healthyProvider = unhealthyProvider === 'groq' ? 'gemini' : 'groq';
        const loadBalancer = createLoadBalancer({
            groq: makeRateLimitStatus('groq', 20, 20),
            gemini: makeRateLimitStatus('gemini', 20, 20),
        }, {
            groq: makeHealthMetrics('groq', unhealthyProvider !== 'groq'),
            gemini: makeHealthMetrics('gemini', unhealthyProvider !== 'gemini'),
        });
        const selected = await loadBalancer.selectProvider('generate');
        strict_1.default.equal(selected, healthyProvider);
    }), { numRuns: 100 });
});
test('routes to Gemini when Groq exceeds the capacity threshold', async () => {
    const loadBalancer = createLoadBalancer({
        groq: makeRateLimitStatus('groq', 85, 10),
        gemini: makeRateLimitStatus('gemini', 20, 10),
    }, {
        groq: makeHealthMetrics('groq', true),
        gemini: makeHealthMetrics('gemini', true),
    });
    const selected = await loadBalancer.selectProvider('chat');
    strict_1.default.equal(selected, 'gemini');
});
test('getCapacityStatus calculates capacity, cost, health, and score for both providers', async () => {
    const loadBalancer = createLoadBalancer({
        groq: makeRateLimitStatus('groq', 25, 10),
        gemini: makeRateLimitStatus('gemini', 60, 30),
    }, {
        groq: makeHealthMetrics('groq', true, 120),
        gemini: makeHealthMetrics('gemini', true, 220),
    });
    const capacities = await loadBalancer.getCapacityStatus();
    const groq = capacities.find((entry) => entry.provider === 'groq');
    const gemini = capacities.find((entry) => entry.provider === 'gemini');
    strict_1.default.ok(groq);
    strict_1.default.ok(gemini);
    strict_1.default.equal(groq.availableRpm, 22);
    strict_1.default.equal(groq.availableRpd, 12960);
    strict_1.default.equal(groq.estimatedCost, 0);
    strict_1.default.equal(groq.healthy, true);
    strict_1.default.equal(groq.rpmUsagePercentage, 25);
    strict_1.default.equal(gemini.availableRpm, 24);
    strict_1.default.equal(gemini.estimatedCost, 1);
});
test('rebalance refreshes and sorts cached capacity data', async () => {
    const loadBalancer = createLoadBalancer({
        groq: makeRateLimitStatus('groq', 10, 10),
        gemini: makeRateLimitStatus('gemini', 20, 20),
    }, {
        groq: makeHealthMetrics('groq', true, 50),
        gemini: makeHealthMetrics('gemini', true, 150),
    });
    await loadBalancer.rebalance();
    const capacities = await loadBalancer.getCapacityStatus();
    strict_1.default.equal(capacities[0].provider, 'groq');
    strict_1.default.ok(capacities[0].score >= capacities[1].score);
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
        console.log(`All ${passed} LoadBalancer tests passed.`);
    }
}
void main();
