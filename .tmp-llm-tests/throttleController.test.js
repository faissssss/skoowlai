"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const strict_1 = __importDefault(require("node:assert/strict"));
const throttleController_1 = require("./throttleController");
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
function createController(config = throttleController_1.DEFAULT_THROTTLE_CONFIG.groq, initialIso = '2026-04-11T10:15:30.000Z') {
    const clock = new FakeClock(initialIso);
    const sleepCalls = [];
    const controller = new throttleController_1.ThrottleController(config, {
        now: clock.now,
        pollIntervalMs: 100,
        sleep: async (ms) => {
            sleepCalls.push(ms);
            clock.advanceMs(ms);
        },
    });
    return { clock, controller, sleepCalls };
}
test('implements token bucket refill over time', async () => {
    const config = {
        provider: 'groq',
        maxRequestsPerMinute: 60,
        bufferPercentage: 0,
        burstSize: 2,
        refillRate: 1,
    };
    const { clock, controller } = createController(config);
    strict_1.default.equal(await controller.tryAcquire(), true);
    strict_1.default.equal(await controller.tryAcquire(), true);
    strict_1.default.equal(await controller.tryAcquire(), false);
    clock.advanceMs(1000);
    strict_1.default.equal(await controller.tryAcquire(), true);
    const status = controller.getStatus();
    strict_1.default.ok(status.availableTokens < 1);
    strict_1.default.equal(status.maxTokens, 2);
    strict_1.default.equal(status.refillRate, 1);
});
test('handles burst capacity and caps refill at max tokens', async () => {
    const config = {
        provider: 'groq',
        maxRequestsPerMinute: 120,
        bufferPercentage: 0,
        burstSize: 3,
        refillRate: 2,
    };
    const { clock, controller } = createController(config);
    strict_1.default.equal(await controller.tryAcquire(), true);
    strict_1.default.equal(await controller.tryAcquire(), true);
    strict_1.default.equal(await controller.tryAcquire(), true);
    strict_1.default.equal(await controller.tryAcquire(), false);
    clock.advanceMs(10000);
    const status = controller.getStatus();
    strict_1.default.equal(status.availableTokens, 3);
    strict_1.default.equal(await controller.tryAcquire(), true);
    strict_1.default.equal(await controller.tryAcquire(), true);
    strict_1.default.equal(await controller.tryAcquire(), true);
    strict_1.default.equal(await controller.tryAcquire(), false);
});
test('enforces rate limiting by timing out when no token becomes available in time', async () => {
    const config = {
        provider: 'groq',
        maxRequestsPerMinute: 60,
        bufferPercentage: 0,
        burstSize: 1,
        refillRate: 1,
    };
    const { controller, sleepCalls } = createController(config);
    strict_1.default.equal(await controller.tryAcquire(), true);
    strict_1.default.equal(await controller.acquire(500), false);
    strict_1.default.ok(sleepCalls.length > 0);
});
test('acquire waits until a token is available within the timeout window', async () => {
    const config = {
        provider: 'groq',
        maxRequestsPerMinute: 60,
        bufferPercentage: 0,
        burstSize: 1,
        refillRate: 1,
    };
    const { controller, sleepCalls } = createController(config);
    strict_1.default.equal(await controller.tryAcquire(), true);
    strict_1.default.equal(await controller.acquire(1500), true);
    strict_1.default.ok(sleepCalls.some((ms) => ms >= 100));
});
test('reports status including the next refill time', async () => {
    const config = {
        provider: 'groq',
        maxRequestsPerMinute: 60,
        bufferPercentage: 0,
        burstSize: 1,
        refillRate: 1,
    };
    const { controller } = createController(config);
    await controller.tryAcquire();
    const status = controller.getStatus();
    strict_1.default.equal(status.availableTokens, 0);
    strict_1.default.equal(status.maxTokens, 1);
    strict_1.default.equal(status.refillRate, 1);
    strict_1.default.equal(status.nextRefillAt.toISOString(), '2026-04-11T10:15:31.000Z');
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
        console.log(`All ${passed} ThrottleController tests passed.`);
    }
}
void main();
