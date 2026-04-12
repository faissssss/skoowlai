"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const strict_1 = __importDefault(require("node:assert/strict"));
const fast_check_1 = __importDefault(require("fast-check"));
const healthMonitor_1 = require("./healthMonitor");
class FakeClock {
    constructor(initialIso) {
        this.now = () => new Date(this.nowMs);
        this.nowMs = new Date(initialIso).getTime();
    }
    advanceMs(ms) {
        this.nowMs += ms;
    }
}
class FakeHealthRedis {
    constructor() {
        this.lists = new Map();
        this.hashes = new Map();
        this.expirations = new Map();
    }
    async lpush(key, ...values) {
        const current = this.lists.get(key) ?? [];
        this.lists.set(key, [...values, ...current]);
        return this.lists.get(key).length;
    }
    async ltrim(key, start, stop) {
        const current = this.lists.get(key) ?? [];
        const normalizedStop = stop < 0 ? current.length + stop : stop;
        const next = current.slice(start, normalizedStop + 1);
        this.lists.set(key, next);
        return 'OK';
    }
    async lrange(key, start, stop) {
        const current = this.lists.get(key) ?? [];
        const normalizedStop = stop < 0 ? current.length + stop : stop;
        if (current.length === 0 || start > normalizedStop) {
            return [];
        }
        return current.slice(start, normalizedStop + 1);
    }
    async hset(key, values) {
        const current = this.hashes.get(key) ?? {};
        this.hashes.set(key, { ...current, ...values });
        return Object.keys(values).length;
    }
    async hgetall(key) {
        return { ...(this.hashes.get(key) ?? {}) };
    }
    async expire(key, seconds) {
        this.expirations.set(key, seconds);
        return 1;
    }
    getExpireSeconds(key) {
        return this.expirations.get(key);
    }
}
const tests = [];
function test(name, run) {
    tests.push({ name, run });
}
function createMonitor(initialIso = '2026-04-12T10:00:00.000Z', checkers = {}) {
    const clock = new FakeClock(initialIso);
    const redis = new FakeHealthRedis();
    const monitor = new healthMonitor_1.HealthMonitor(redis, 5 * 60 * 1000, 3, {
        now: clock.now,
        historyLimit: 100,
        providerCheckers: checkers,
    });
    return { clock, redis, monitor };
}
test('Property 16: success rate equals successful checks divided by total checks', async () => {
    await fast_check_1.default.assert(fast_check_1.default.asyncProperty(fast_check_1.default.array(fast_check_1.default.boolean(), { minLength: 1, maxLength: 50 }), async (statuses) => {
        const { redis, monitor } = createMonitor();
        const now = new Date('2026-04-12T10:00:00.000Z');
        for (let index = 0; index < statuses.length; index += 1) {
            const result = {
                provider: 'groq',
                timestamp: new Date(now.getTime() + (index * 1000)),
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
        strict_1.default.equal(actual, expected);
    }), { numRuns: 100 });
});
test('executes a health check, stores history, and updates provider metrics', async () => {
    const { redis, monitor } = createMonitor('2026-04-12T10:00:00.000Z', {
        groq: async () => { },
    });
    const result = await monitor.checkHealth('groq');
    const metrics = await monitor.getHealth('groq');
    const history = await monitor.getHealthHistory('groq', 15 * 60 * 1000);
    strict_1.default.equal(result.provider, 'groq');
    strict_1.default.equal(result.available, true);
    strict_1.default.equal(history.length, 1);
    strict_1.default.equal(metrics.successRate, 1);
    strict_1.default.equal(metrics.consecutiveFailures, 0);
    strict_1.default.equal(metrics.healthy, true);
    strict_1.default.equal(redis.getExpireSeconds('provider:groq:status'), 300);
});
test('measures latency based on the elapsed time during a provider check', async () => {
    const { clock, monitor } = createMonitor('2026-04-12T10:00:00.000Z', {
        groq: async () => {
            clock.advanceMs(275);
        },
    });
    const result = await monitor.checkHealth('groq');
    const metrics = await monitor.getHealth('groq');
    strict_1.default.equal(result.latencyMs, 275);
    strict_1.default.equal(metrics.avgLatencyMs, 275);
});
test('marks a provider unhealthy after 3 consecutive failures', async () => {
    const { monitor } = createMonitor('2026-04-12T10:00:00.000Z', {
        groq: async () => {
            throw new Error('provider unavailable');
        },
    });
    await monitor.checkHealth('groq');
    let metrics = await monitor.getHealth('groq');
    strict_1.default.equal(metrics.healthy, true);
    strict_1.default.equal(metrics.consecutiveFailures, 1);
    await monitor.checkHealth('groq');
    metrics = await monitor.getHealth('groq');
    strict_1.default.equal(metrics.healthy, true);
    strict_1.default.equal(metrics.consecutiveFailures, 2);
    const result = await monitor.checkHealth('groq');
    metrics = await monitor.getHealth('groq');
    strict_1.default.equal(result.available, false);
    strict_1.default.equal(result.error, 'provider unavailable');
    strict_1.default.equal(metrics.healthy, false);
    strict_1.default.equal(metrics.consecutiveFailures, 3);
});
test('filters health history to the requested time window', async () => {
    const { clock, monitor } = createMonitor('2026-04-12T10:00:00.000Z', {
        groq: async () => { },
    });
    await monitor.checkHealth('groq');
    clock.advanceMs(16 * 60 * 1000);
    await monitor.checkHealth('groq');
    const history = await monitor.getHealthHistory('groq', 15 * 60 * 1000);
    strict_1.default.equal(history.length, 1);
    strict_1.default.equal(history[0].timestamp.toISOString(), '2026-04-12T10:16:00.000Z');
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
        console.log(`All ${passed} HealthMonitor tests passed.`);
    }
}
void main();
