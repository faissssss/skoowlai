"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const strict_1 = __importDefault(require("node:assert/strict"));
const fast_check_1 = __importDefault(require("fast-check"));
const fallbackHandler_1 = require("./fallbackHandler");
class FakeClock {
    constructor(initialIso) {
        this.now = () => new Date(this.nowMs);
        this.nowMs = new Date(initialIso).getTime();
    }
    advanceMs(ms) {
        this.nowMs += ms;
    }
}
const tests = [];
function test(name, run) {
    tests.push({ name, run });
}
function makeError(message, extras = {}) {
    const error = new Error(message);
    Object.assign(error, extras);
    return error;
}
function createHandler(config = fallbackHandler_1.DEFAULT_FALLBACK_CONFIG, initialIso = '2026-04-12T10:00:00.000Z') {
    const clock = new FakeClock(initialIso);
    const handler = new fallbackHandler_1.FallbackHandler(config, { now: clock.now });
    return { clock, handler };
}
test('Property 5: falls back on retryable 5xx and 429 errors when enabled', async () => {
    await fast_check_1.default.assert(fast_check_1.default.asyncProperty(fast_check_1.default.constantFrom(429, 500, 502, 503, 504), async (statusCode) => {
        const { handler } = createHandler();
        let fallbackCalls = 0;
        const result = await handler.executeWithFallback(async () => {
            throw makeError('primary failed', { statusCode });
        }, async () => {
            fallbackCalls += 1;
            return 'fallback-result';
        }, {
            feature: 'chat',
            primaryProvider: 'groq',
            fallbackProvider: 'gemini',
        });
        strict_1.default.equal(result, 'fallback-result');
        strict_1.default.equal(fallbackCalls, 1);
    }), { numRuns: 100 });
});
test('Property 6: does not fall back when disabled', async () => {
    await fast_check_1.default.assert(fast_check_1.default.asyncProperty(fast_check_1.default.constantFrom(429, 500, 503), async (statusCode) => {
        const { handler } = createHandler({
            ...fallbackHandler_1.DEFAULT_FALLBACK_CONFIG,
            enabled: false,
        });
        let fallbackCalls = 0;
        const primaryError = makeError('primary failed', { statusCode });
        await strict_1.default.rejects(() => handler.executeWithFallback(async () => {
            throw primaryError;
        }, async () => {
            fallbackCalls += 1;
            return 'fallback-result';
        }, {
            feature: 'generate',
            primaryProvider: 'groq',
            fallbackProvider: 'gemini',
        }), (caught) => {
            strict_1.default.equal(caught, primaryError);
            return true;
        });
        strict_1.default.equal(fallbackCalls, 0);
    }), { numRuns: 100 });
});
test('classifies retryable and non-retryable errors correctly', () => {
    const { handler } = createHandler();
    strict_1.default.equal(handler.shouldFallback(makeError('server error', { statusCode: 500 }), 'groq'), true);
    strict_1.default.equal(handler.shouldFallback(makeError('rate limited', { statusCode: 429 }), 'groq'), true);
    strict_1.default.equal(handler.shouldFallback(makeError('request timeout', { code: 'ETIMEDOUT' }), 'groq'), true);
    strict_1.default.equal(handler.shouldFallback(makeError('bad request', { statusCode: 400 }), 'groq'), false);
});
test('records fallback events and increments the fallback counter', async () => {
    const { handler } = createHandler();
    const result = await handler.executeWithFallback(async () => {
        throw makeError('primary failed', { statusCode: 503 });
    }, async () => 'fallback-success', {
        feature: 'quiz',
        primaryProvider: 'groq',
        fallbackProvider: 'gemini',
    });
    const events = handler.getEvents();
    strict_1.default.equal(result, 'fallback-success');
    strict_1.default.equal(handler.getFallbackCount(), 1);
    strict_1.default.equal(events.length, 1);
    strict_1.default.equal(events[0].feature, 'quiz');
    strict_1.default.equal(events[0].reason, '5xx');
    strict_1.default.equal(events[0].fallbackSuccess, true);
});
test('records unsuccessful fallback attempts and reports aggregated stats', async () => {
    const { clock, handler } = createHandler();
    await handler.executeWithFallback(async () => {
        throw makeError('rate limited', { statusCode: 429 });
    }, async () => 'fallback-success', {
        feature: 'chat',
        primaryProvider: 'groq',
        fallbackProvider: 'gemini',
    });
    clock.advanceMs(1000);
    await strict_1.default.rejects(() => handler.executeWithFallback(async () => {
        throw makeError('request timeout', { code: 'ETIMEDOUT' });
    }, async () => {
        throw new Error('fallback failed');
    }, {
        feature: 'chat',
        primaryProvider: 'groq',
        fallbackProvider: 'gemini',
    }));
    const stats = await handler.getFallbackStats(60000);
    strict_1.default.equal(stats.totalFallbacks, 2);
    strict_1.default.equal(stats.successRate, 0.5);
    strict_1.default.equal(stats.byFeature.chat, 2);
    strict_1.default.equal(stats.byReason['429'], 1);
    strict_1.default.equal(stats.byReason.timeout, 1);
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
        console.log(`All ${passed} FallbackHandler tests passed.`);
    }
}
void main();
