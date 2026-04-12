"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const strict_1 = __importDefault(require("node:assert/strict"));
const fast_check_1 = __importDefault(require("fast-check"));
const requestQueue_1 = require("./requestQueue");
class FakeClock {
    constructor(initialIso) {
        this.now = () => new Date(this.nowMs);
        this.nowMs = new Date(initialIso).getTime();
    }
    advanceMs(ms) {
        this.nowMs += ms;
    }
}
class FakeQueueRedis {
    constructor() {
        this.strings = new Map();
        this.sortedSets = new Map();
    }
    async get(key) {
        return this.strings.get(key) ?? null;
    }
    async set(key, value) {
        this.strings.set(key, value);
        return 'OK';
    }
    async zadd(key, score, member) {
        const entries = this.sortedSets.get(key) ?? [];
        const existingIndex = entries.findIndex((entry) => entry.member === member);
        if (existingIndex >= 0) {
            entries.splice(existingIndex, 1);
        }
        entries.push({ score, member });
        entries.sort((left, right) => left.score - right.score);
        this.sortedSets.set(key, entries);
        return existingIndex >= 0 ? 0 : 1;
    }
    async zrange(key, start, stop) {
        const entries = this.sortedSets.get(key) ?? [];
        const normalizedStart = start < 0 ? Math.max(entries.length + start, 0) : start;
        const normalizedStop = stop < 0 ? entries.length + stop : stop;
        if (entries.length === 0 || normalizedStart >= entries.length || normalizedStop < normalizedStart) {
            return [];
        }
        return entries.slice(normalizedStart, normalizedStop + 1).map((entry) => entry.member);
    }
    async zrem(key, member) {
        const entries = this.sortedSets.get(key) ?? [];
        const nextEntries = entries.filter((entry) => entry.member !== member);
        this.sortedSets.set(key, nextEntries);
        return nextEntries.length === entries.length ? 0 : 1;
    }
    async zcard(key) {
        return (this.sortedSets.get(key) ?? []).length;
    }
}
const tests = [];
function test(name, run) {
    tests.push({ name, run });
}
function createQueue(initialIso = '2026-04-11T10:15:30.000Z', maxSize = 100, expirationMs = 30000) {
    const clock = new FakeClock(initialIso);
    const redis = new FakeQueueRedis();
    const queue = new requestQueue_1.RequestQueue(redis, maxSize, expirationMs, { now: clock.now });
    return { clock, redis, queue };
}
async function enqueueRequests(queue, requests) {
    const queued = [];
    for (const request of requests) {
        queued.push(await queue.enqueue(request));
    }
    return queued;
}
test('Property 17: dequeues by priority while preserving FIFO within each level', async () => {
    await fast_check_1.default.assert(fast_check_1.default.asyncProperty(fast_check_1.default.array(fast_check_1.default.constantFrom('high', 'medium', 'low'), {
        minLength: 1,
        maxLength: 30,
    }).filter((priorities) => {
        const highCount = priorities.filter((priority) => priority === 'high').length;
        const lowCount = priorities.filter((priority) => priority === 'low').length;
        return highCount < 10 || lowCount === 0;
    }), async (priorities) => {
        const { queue } = createQueue();
        const input = priorities.map((priority, index) => ({
            feature: `feature-${index}`,
            priority,
            params: { index },
        }));
        const queued = await enqueueRequests(queue, input);
        const dequeued = [];
        for (let index = 0; index < queued.length; index += 1) {
            const next = await queue.dequeue();
            strict_1.default.ok(next);
            dequeued.push(next);
        }
        const expected = [
            ...queued.filter((request) => request.priority === 'high'),
            ...queued.filter((request) => request.priority === 'medium'),
            ...queued.filter((request) => request.priority === 'low'),
        ].map((request) => request.id);
        strict_1.default.deepEqual(dequeued.map((request) => request.id), expected);
    }), { numRuns: 100 });
});
test('Property 18: prevents low-priority starvation when low requests are available', async () => {
    await fast_check_1.default.assert(fast_check_1.default.asyncProperty(fast_check_1.default.integer({ min: 10, max: 30 }), fast_check_1.default.integer({ min: 1, max: 5 }), async (highCount, lowCount) => {
        const { queue } = createQueue();
        const requests = [
            ...Array.from({ length: highCount }, (_, index) => ({
                feature: `high-${index}`,
                priority: 'high',
                params: { index },
            })),
            ...Array.from({ length: lowCount }, (_, index) => ({
                feature: `low-${index}`,
                priority: 'low',
                params: { index },
            })),
        ];
        await enqueueRequests(queue, requests);
        let consecutiveHigh = 0;
        let remainingLow = lowCount;
        const total = highCount + lowCount;
        for (let index = 0; index < total; index += 1) {
            const next = await queue.dequeue();
            strict_1.default.ok(next);
            if (next.priority === 'high') {
                consecutiveHigh += 1;
                strict_1.default.ok(!(remainingLow > 0 && consecutiveHigh > 10));
                continue;
            }
            if (next.priority === 'low') {
                remainingLow -= 1;
                consecutiveHigh = 0;
            }
        }
    }), { numRuns: 100 });
});
test('supports enqueue and dequeue operations with queue status updates', async () => {
    const { queue } = createQueue();
    const [first, second] = await enqueueRequests(queue, [
        { feature: 'chat', priority: 'high', params: { message: 'a' } },
        { feature: 'quiz', priority: 'medium', params: { message: 'b' } },
    ]);
    let status = await queue.getStatus();
    strict_1.default.equal(status.depth, 2);
    strict_1.default.deepEqual(status.byPriority, { high: 1, medium: 1, low: 0 });
    strict_1.default.equal(status.oldestRequest?.toISOString(), first.enqueuedAt.toISOString());
    const dequeuedFirst = await queue.dequeue();
    const dequeuedSecond = await queue.dequeue();
    const dequeuedThird = await queue.dequeue();
    strict_1.default.equal(dequeuedFirst?.id, first.id);
    strict_1.default.equal(dequeuedSecond?.id, second.id);
    strict_1.default.equal(dequeuedThird, null);
    status = await queue.getStatus();
    strict_1.default.equal(status.depth, 0);
});
test('prioritizes high before medium and low during dequeue', async () => {
    const { queue } = createQueue();
    const queued = await enqueueRequests(queue, [
        { feature: 'rewrite-1', priority: 'low', params: { value: 1 } },
        { feature: 'quiz-1', priority: 'medium', params: { value: 2 } },
        { feature: 'chat-1', priority: 'high', params: { value: 3 } },
        { feature: 'quiz-2', priority: 'medium', params: { value: 4 } },
    ]);
    const orderedIds = [
        (await queue.dequeue())?.id,
        (await queue.dequeue())?.id,
        (await queue.dequeue())?.id,
        (await queue.dequeue())?.id,
    ];
    strict_1.default.deepEqual(orderedIds, [
        queued[2].id,
        queued[1].id,
        queued[3].id,
        queued[0].id,
    ]);
});
test('expires queued requests after the configured TTL and cleans them up', async () => {
    const { clock, queue } = createQueue('2026-04-11T10:15:30.000Z', 100, 5000);
    await enqueueRequests(queue, [
        { feature: 'rewrite', priority: 'low', params: { value: 1 } },
        { feature: 'chat', priority: 'high', params: { value: 2 } },
    ]);
    clock.advanceMs(5001);
    const removed = await queue.cleanExpired();
    const status = await queue.getStatus();
    strict_1.default.equal(removed, 2);
    strict_1.default.equal(status.depth, 0);
    strict_1.default.equal(await queue.dequeue(), null);
});
test('throws QueueFullError when the queue reaches max size', async () => {
    const { queue } = createQueue('2026-04-11T10:15:30.000Z', 2);
    await enqueueRequests(queue, [
        { feature: 'chat', priority: 'high', params: { value: 1 } },
        { feature: 'quiz', priority: 'medium', params: { value: 2 } },
    ]);
    await strict_1.default.rejects(() => queue.enqueue({ feature: 'rewrite', priority: 'low', params: { value: 3 } }), (error) => {
        strict_1.default.ok(error instanceof requestQueue_1.QueueFullError);
        strict_1.default.equal(error.maxSize, 2);
        return true;
    });
});
test('returns queue positions consistent with current processing order', async () => {
    const { queue } = createQueue();
    const queued = await enqueueRequests(queue, [
        { feature: 'chat-1', priority: 'high', params: { value: 1 } },
        { feature: 'chat-2', priority: 'high', params: { value: 2 } },
        { feature: 'quiz-1', priority: 'medium', params: { value: 3 } },
        { feature: 'rewrite-1', priority: 'low', params: { value: 4 } },
    ]);
    strict_1.default.equal(await queue.getPosition(queued[0].id), 1);
    strict_1.default.equal(await queue.getPosition(queued[1].id), 2);
    strict_1.default.equal(await queue.getPosition(queued[2].id), 3);
    strict_1.default.equal(await queue.getPosition(queued[3].id), 4);
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
        console.log(`All ${passed} RequestQueue tests passed.`);
    }
}
void main();
