"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const strict_1 = __importDefault(require("node:assert/strict"));
const fast_check_1 = __importDefault(require("fast-check"));
const retryStrategy_1 = require("./retryStrategy");
const tests = [];
function test(name, run) {
    tests.push({ name, run });
}
function makeError(message, extras = {}) {
    const error = new Error(message);
    Object.assign(error, extras);
    return error;
}
test('Property 28: 429 retries use exponential backoff with jitter', async () => {
    await fast_check_1.default.assert(fast_check_1.default.asyncProperty(fast_check_1.default.integer({ min: 1, max: 5 }), fast_check_1.default.integer({ min: 0, max: 500 }), async (attempt, jitter) => {
        const strategy = new retryStrategy_1.RetryStrategy(retryStrategy_1.DEFAULT_RETRY_CONFIG, {
            random: () => jitter / 500,
            sleep: async () => { },
        });
        const error = makeError('rate limited', { statusCode: 429 });
        const delay = strategy.calculateDelay(attempt, error);
        const base = Math.min(1000 * (2 ** (attempt - 1)), 32000);
        strict_1.default.ok(delay >= base);
        strict_1.default.ok(delay <= base + 500);
    }), { numRuns: 100 });
});
test('Property 29: non-retryable 4xx errors are not retried', async () => {
    await fast_check_1.default.assert(fast_check_1.default.asyncProperty(fast_check_1.default.integer({ min: 400, max: 499 }).filter((status) => status !== 429), async (statusCode) => {
        const strategy = new retryStrategy_1.RetryStrategy(retryStrategy_1.DEFAULT_RETRY_CONFIG, {
            sleep: async () => { },
        });
        const error = makeError('client error', { statusCode });
        let calls = 0;
        await strict_1.default.rejects(() => strategy.execute(async () => {
            calls += 1;
            throw error;
        }, { feature: 'chat', provider: 'groq' }), (caught) => {
            strict_1.default.equal(caught, error);
            return true;
        });
        strict_1.default.equal(calls, 1);
    }), { numRuns: 100 });
});
test('Property 30: Retry-After overrides smaller calculated delays', async () => {
    await fast_check_1.default.assert(fast_check_1.default.asyncProperty(fast_check_1.default.integer({ min: 1, max: 4 }), fast_check_1.default.integer({ min: 2, max: 60 }), async (attempt, retryAfterSeconds) => {
        const strategy = new retryStrategy_1.RetryStrategy(retryStrategy_1.DEFAULT_RETRY_CONFIG, {
            random: () => 0,
            sleep: async () => { },
        });
        const error = makeError('rate limited', {
            statusCode: 429,
            retryAfter: retryAfterSeconds,
        });
        const delay = strategy.calculateDelay(attempt, error);
        strict_1.default.ok(delay >= retryAfterSeconds * 1000);
    }), { numRuns: 100 });
});
test('calculateDelay doubles for 429 retries and respects the max cap', () => {
    const strategy = new retryStrategy_1.RetryStrategy(retryStrategy_1.DEFAULT_RETRY_CONFIG, {
        random: () => 0,
        sleep: async () => { },
    });
    const error = makeError('rate limited', { statusCode: 429 });
    strict_1.default.equal(strategy.calculateDelay(1, error), 1000);
    strict_1.default.equal(strategy.calculateDelay(2, error), 2000);
    strict_1.default.equal(strategy.calculateDelay(3, error), 4000);
    strict_1.default.equal(strategy.calculateDelay(6, error), 32000);
});
test('adds jitter only for 429 responses', () => {
    const strategy = new retryStrategy_1.RetryStrategy(retryStrategy_1.DEFAULT_RETRY_CONFIG, {
        random: () => 1,
        sleep: async () => { },
    });
    strict_1.default.equal(strategy.calculateDelay(1, makeError('rate limited', { statusCode: 429 })), 1500);
    strict_1.default.equal(strategy.calculateDelay(1, makeError('server error', { statusCode: 500 })), 2000);
});
test('execute enforces max retries for 429 and 5xx responses', async () => {
    const delays = [];
    const strategy = new retryStrategy_1.RetryStrategy(retryStrategy_1.DEFAULT_RETRY_CONFIG, {
        random: () => 0,
        sleep: async (ms) => {
            delays.push(ms);
        },
    });
    let rateLimitedCalls = 0;
    await strict_1.default.rejects(() => strategy.execute(async () => {
        rateLimitedCalls += 1;
        throw makeError('rate limited', { statusCode: 429 });
    }, { feature: 'chat', provider: 'groq' }));
    strict_1.default.equal(rateLimitedCalls, 4);
    strict_1.default.deepEqual(delays.slice(0, 3), [1000, 2000, 4000]);
    delays.length = 0;
    let serverCalls = 0;
    await strict_1.default.rejects(() => strategy.execute(async () => {
        serverCalls += 1;
        throw makeError('server error', { statusCode: 500 });
    }, { feature: 'chat', provider: 'groq' }));
    strict_1.default.equal(serverCalls, 3);
    strict_1.default.deepEqual(delays, [2000, 4000]);
});
test('execute retries timeout errors once', async () => {
    const delays = [];
    const strategy = new retryStrategy_1.RetryStrategy(retryStrategy_1.DEFAULT_RETRY_CONFIG, {
        random: () => 0,
        sleep: async (ms) => {
            delays.push(ms);
        },
    });
    let calls = 0;
    await strict_1.default.rejects(() => strategy.execute(async () => {
        calls += 1;
        throw makeError('request timeout', { code: 'ETIMEDOUT' });
    }, { feature: 'generate', provider: 'groq' }));
    strict_1.default.equal(calls, 2);
    strict_1.default.deepEqual(delays, [1000]);
});
test('reads Retry-After from response headers when present', () => {
    const strategy = new retryStrategy_1.RetryStrategy(retryStrategy_1.DEFAULT_RETRY_CONFIG, {
        random: () => 0,
        sleep: async () => { },
    });
    const error = makeError('rate limited', {
        statusCode: 429,
        response: {
            headers: {
                get: (name) => (name.toLowerCase() === 'retry-after' ? '12' : null),
            },
        },
    });
    strict_1.default.equal(strategy.calculateDelay(1, error), 12000);
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
        console.log(`All ${passed} RetryStrategy tests passed.`);
    }
}
void main();
