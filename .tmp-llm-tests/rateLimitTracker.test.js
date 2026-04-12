"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const strict_1 = __importDefault(require("node:assert/strict"));
const fast_check_1 = __importDefault(require("fast-check"));
const rateLimitTracker_1 = require("./rateLimitTracker");
class FakeClock {
    constructor(initialIso) {
        this.now = () => new Date(this.nowMs);
        this.nowMs = new Date(initialIso).getTime();
    }
    advanceMs(ms) {
        this.nowMs += ms;
    }
}
class FakeRedis {
    constructor(now) {
        this.now = now;
        this.values = new Map();
    }
    async get(key) {
        this.cleanupIfExpired(key);
        const entry = this.values.get(key);
        return entry ? String(entry.value) : null;
    }
    async incr(key) {
        this.cleanupIfExpired(key);
        const entry = this.values.get(key);
        const nextValue = (entry?.value ?? 0) + 1;
        this.values.set(key, {
            value: nextValue,
            expiresAt: entry?.expiresAt ?? null,
        });
        return nextValue;
    }
    async expire(key, seconds) {
        this.cleanupIfExpired(key);
        const entry = this.values.get(key);
        if (!entry) {
            return 0;
        }
        entry.expiresAt = this.now().getTime() + (seconds * 1000);
        this.values.set(key, entry);
        return 1;
    }
    async ttl(key) {
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
    getTtlSeconds(key) {
        this.cleanupIfExpired(key);
        const entry = this.values.get(key);
        if (!entry || entry.expiresAt === null) {
            return -1;
        }
        return Math.ceil((entry.expiresAt - this.now().getTime()) / 1000);
    }
    cleanupIfExpired(key) {
        const entry = this.values.get(key);
        if (!entry || entry.expiresAt === null) {
            return;
        }
        if (entry.expiresAt <= this.now().getTime()) {
            this.values.delete(key);
        }
    }
}
const tests = [];
function test(name, run) {
    tests.push({ name, run });
}
function createTracker(initialIso = '2026-04-11T10:15:30.000Z', config = rateLimitTracker_1.DEFAULT_RATE_LIMIT_CONFIG) {
    const clock = new FakeClock(initialIso);
    const redis = new FakeRedis(clock.now);
    const tracker = new rateLimitTracker_1.RateLimitTracker(redis, config, { now: clock.now });
    return { clock, redis, tracker };
}
test('Property 2: maintains isolated counters per provider', async () => {
    await fast_check_1.default.assert(fast_check_1.default.asyncProperty(fast_check_1.default.array(fast_check_1.default.constantFrom('groq', 'gemini'), { minLength: 1, maxLength: 100 }), async (providers) => {
        const { tracker } = createTracker();
        let expectedGroq = 0;
        let expectedGemini = 0;
        for (const provider of providers) {
            await tracker.incrementCount(provider);
            if (provider === 'groq') {
                expectedGroq += 1;
            }
            else {
                expectedGemini += 1;
            }
        }
        const groqStatus = await tracker.getStatus('groq');
        const geminiStatus = await tracker.getStatus('gemini');
        strict_1.default.equal(groqStatus.rpm.current, expectedGroq);
        strict_1.default.equal(groqStatus.rpd.current, expectedGroq);
        strict_1.default.equal(geminiStatus.rpm.current, expectedGemini);
        strict_1.default.equal(geminiStatus.rpd.current, expectedGemini);
    }), { numRuns: 100 });
});
test('increments RPM and RPD counters for a provider', async () => {
    const { tracker } = createTracker();
    await tracker.incrementCount('groq');
    await tracker.incrementCount('groq');
    const status = await tracker.getStatus('groq');
    strict_1.default.equal(status.rpm.current, 2);
    strict_1.default.equal(status.rpd.current, 2);
    strict_1.default.equal(status.rpm.remaining, 28);
    strict_1.default.equal(status.rpd.remaining, 14398);
});
test('resets the minute and day counters when their windows expire', async () => {
    const { clock, tracker } = createTracker('2026-04-11T23:59:30.000Z');
    await tracker.incrementCount('groq');
    clock.advanceMs(31000);
    let status = await tracker.getStatus('groq');
    strict_1.default.equal(status.rpm.current, 0);
    strict_1.default.equal(status.rpd.current, 0);
    await tracker.incrementCount('groq');
    status = await tracker.getStatus('groq');
    strict_1.default.equal(status.rpm.current, 1);
    strict_1.default.equal(status.rpd.current, 1);
});
test('detects queue and throttle thresholds at 80 and 90 percent', async () => {
    const config = {
        groq: {
            requestsPerMinute: 10,
            requestsPerDay: 100,
            warningThreshold: 80,
            throttleThreshold: 90,
        },
        gemini: rateLimitTracker_1.DEFAULT_RATE_LIMIT_CONFIG.gemini,
    };
    const { tracker } = createTracker('2026-04-11T10:15:30.000Z', config);
    for (let index = 0; index < 8; index += 1) {
        await tracker.incrementCount('groq');
    }
    let status = await tracker.checkLimit('groq');
    strict_1.default.equal(status.shouldQueue, true);
    strict_1.default.equal(status.shouldThrottle, false);
    strict_1.default.equal(status.warningThresholdExceeded, true);
    strict_1.default.equal(status.throttleThresholdExceeded, false);
    await tracker.incrementCount('groq');
    status = await tracker.checkLimit('groq');
    strict_1.default.equal(status.shouldThrottle, true);
    strict_1.default.equal(status.throttleThresholdExceeded, true);
});
test('applies Redis key expiration for minute and day counters', async () => {
    const { redis, tracker } = createTracker('2026-04-11T23:59:30.000Z');
    await tracker.incrementCount('groq');
    strict_1.default.equal(redis.getTtlSeconds('ratelimit:groq:rpm:202604112359'), 30);
    strict_1.default.equal(redis.getTtlSeconds('ratelimit:groq:rpd:20260411'), 30);
});
test('reports reset boundaries for the next minute and midnight UTC', async () => {
    const { tracker } = createTracker('2026-04-11T23:59:30.000Z');
    const status = await tracker.getStatus('groq');
    strict_1.default.equal(status.resetAt.minute.toISOString(), '2026-04-12T00:00:00.000Z');
    strict_1.default.equal(status.resetAt.day.toISOString(), '2026-04-12T00:00:00.000Z');
});
test('Property 32: rolling average equals total requests divided by window size', async () => {
    await fast_check_1.default.assert(fast_check_1.default.asyncProperty(fast_check_1.default.array(fast_check_1.default.integer({ min: 0, max: 10 }), { minLength: 15, maxLength: 15 }), async (requestCounts) => {
        const { clock, tracker } = createTracker('2026-04-11T10:00:00.000Z');
        // Simulate requests over 15 minutes
        for (let i = 0; i < requestCounts.length; i++) {
            const count = requestCounts[i];
            for (let j = 0; j < count; j++) {
                await tracker.incrementCount('groq');
            }
            // Advance to next minute only if not the last iteration
            if (i < requestCounts.length - 1) {
                clock.advanceMs(60000);
            }
        }
        // Now we're still at minute 14 (the last minute where we added requests)
        // Looking back 15 minutes includes minutes 14,13,12,...,0
        const rollingAverage = await tracker.getRollingAverage('groq', 15);
        const expectedAverage = requestCounts.reduce((sum, count) => sum + count, 0) / 15;
        // Use a small epsilon for floating point comparison
        const epsilon = 0.001;
        strict_1.default.equal(Math.abs(rollingAverage - expectedAverage) < epsilon, true, `Expected ${expectedAverage}, got ${rollingAverage}`);
    }), { numRuns: 50 });
});
test('calculates rolling average over 15-minute window', async () => {
    const { clock, tracker } = createTracker('2026-04-11T10:15:00.000Z');
    // Minute 0: 5 requests
    for (let i = 0; i < 5; i++) {
        await tracker.incrementCount('groq');
    }
    clock.advanceMs(60000);
    // Minute 1: 10 requests
    for (let i = 0; i < 10; i++) {
        await tracker.incrementCount('groq');
    }
    clock.advanceMs(60000);
    // Minute 2: 3 requests
    for (let i = 0; i < 3; i++) {
        await tracker.incrementCount('groq');
    }
    const rollingAverage = await tracker.getRollingAverage('groq', 15);
    // Total: 18 requests over 15 minutes = 1.2 requests/minute
    strict_1.default.equal(Math.abs(rollingAverage - 1.2) < 0.01, true);
});
test('predicts exhaustion when rolling average exceeds sustainable rate', async () => {
    const config = {
        groq: {
            requestsPerMinute: 30,
            requestsPerDay: 100, // Very low daily limit for testing
            warningThreshold: 80,
            throttleThreshold: 90,
        },
        gemini: rateLimitTracker_1.DEFAULT_RATE_LIMIT_CONFIG.gemini,
    };
    const { clock, tracker } = createTracker('2026-04-11T10:00:00.000Z', config);
    // Use 50 requests in first 10 minutes (5 req/min average)
    for (let minute = 0; minute < 10; minute++) {
        for (let i = 0; i < 5; i++) {
            await tracker.incrementCount('groq');
        }
        clock.advanceMs(60000);
    }
    const prediction = await tracker.predictExhaustion('groq');
    // Sustainable rate: 50 remaining / 840 minutes = ~0.06 req/min
    // Rolling average: 5 req/min
    // Should predict exhaustion
    strict_1.default.equal(prediction.willExceedDaily, true);
    strict_1.default.equal(prediction.shouldProactivelyThrottle, true);
    strict_1.default.notEqual(prediction.estimatedExhaustionTime, null);
});
test('does not predict exhaustion when usage is sustainable', async () => {
    const config = {
        groq: {
            requestsPerMinute: 30,
            requestsPerDay: 10000,
            warningThreshold: 80,
            throttleThreshold: 90,
        },
        gemini: rateLimitTracker_1.DEFAULT_RATE_LIMIT_CONFIG.gemini,
    };
    const { clock, tracker } = createTracker('2026-04-11T10:00:00.000Z', config);
    // Use 10 requests in first 10 minutes (1 req/min average)
    for (let minute = 0; minute < 10; minute++) {
        await tracker.incrementCount('groq');
        clock.advanceMs(60000);
    }
    const prediction = await tracker.predictExhaustion('groq');
    // Sustainable rate: 9990 remaining / 840 minutes = ~11.9 req/min
    // Rolling average: 1 req/min
    // Should not predict exhaustion
    strict_1.default.equal(prediction.willExceedDaily, false);
    strict_1.default.equal(prediction.shouldProactivelyThrottle, false);
});
test('generates alert when usage exceeds 50% by noon UTC', async () => {
    const config = {
        groq: {
            requestsPerMinute: 30,
            requestsPerDay: 100,
            warningThreshold: 80,
            throttleThreshold: 90,
        },
        gemini: rateLimitTracker_1.DEFAULT_RATE_LIMIT_CONFIG.gemini,
    };
    const { tracker } = createTracker('2026-04-11T11:00:00.000Z', config);
    // Use 51 requests (51% of daily limit)
    for (let i = 0; i < 51; i++) {
        await tracker.incrementCount('groq');
    }
    const prediction = await tracker.predictExhaustion('groq');
    strict_1.default.notEqual(prediction.alert, null);
    strict_1.default.equal(prediction.alert?.includes('High usage detected'), true);
    strict_1.default.equal(prediction.alert?.includes('51.0%'), true);
});
test('does not generate alert when usage is below 50% before noon', async () => {
    const config = {
        groq: {
            requestsPerMinute: 30,
            requestsPerDay: 100,
            warningThreshold: 80,
            throttleThreshold: 90,
        },
        gemini: rateLimitTracker_1.DEFAULT_RATE_LIMIT_CONFIG.gemini,
    };
    const { tracker } = createTracker('2026-04-11T11:00:00.000Z', config);
    // Use 40 requests (40% of daily limit)
    for (let i = 0; i < 40; i++) {
        await tracker.incrementCount('groq');
    }
    const prediction = await tracker.predictExhaustion('groq');
    strict_1.default.equal(prediction.alert, null);
});
test('forecasts remaining capacity for next hour', async () => {
    const config = {
        groq: {
            requestsPerMinute: 30,
            requestsPerDay: 1000,
            warningThreshold: 80,
            throttleThreshold: 90,
        },
        gemini: rateLimitTracker_1.DEFAULT_RATE_LIMIT_CONFIG.gemini,
    };
    const { clock, tracker } = createTracker('2026-04-11T10:00:00.000Z', config);
    // Use 100 requests in first 10 minutes (10 req/min average)
    for (let minute = 0; minute < 10; minute++) {
        for (let i = 0; i < 10; i++) {
            await tracker.incrementCount('groq');
        }
        clock.advanceMs(60000);
    }
    const prediction = await tracker.predictExhaustion('groq');
    const status = await tracker.getStatus('groq');
    // Remaining: 900 requests
    // Rolling average: 6.67 req/min (100 requests / 15 minutes)
    // Forecasted for next hour: 900 - (6.67 * 60) = 500
    const expectedForecast = status.rpd.remaining - (prediction.rollingAverage * 60);
    strict_1.default.equal(Math.abs(prediction.forecastedRemainingCapacity - expectedForecast) < 1, true);
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
        console.log(`All ${passed} RateLimitTracker tests passed.`);
    }
}
void main();
