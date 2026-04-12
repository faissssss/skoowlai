"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.RequestQueue = exports.QueueFullError = void 0;
const node_crypto_1 = require("node:crypto");
class QueueFullError extends Error {
    constructor(maxSize) {
        super(`Request queue is full (max size ${maxSize})`);
        this.maxSize = maxSize;
        this.name = 'QueueFullError';
    }
}
exports.QueueFullError = QueueFullError;
class RequestQueue {
    constructor(redis, maxSize = 100, expirationMs = 30000, options = {}) {
        this.redis = redis;
        this.maxSize = maxSize;
        this.expirationMs = expirationMs;
        this.sequence = 0;
        this.now = options.now ?? (() => new Date());
        this.prefix = options.prefix ?? 'queue:requests';
    }
    async enqueue(request) {
        await this.cleanExpired();
        const currentDepth = await this.getDepth();
        if (currentDepth >= this.maxSize) {
            throw new QueueFullError(this.maxSize);
        }
        const now = this.now();
        const stored = {
            id: (0, node_crypto_1.randomUUID)(),
            feature: request.feature,
            priority: request.priority,
            params: request.params,
            enqueuedAt: now.getTime(),
            expiresAt: now.getTime() + this.expirationMs,
        };
        await this.redis.zadd(this.getPriorityKey(request.priority), this.getScore(now), JSON.stringify(stored));
        return this.deserialize(stored);
    }
    async dequeue() {
        const removed = await this.cleanExpired();
        void removed;
        const byPriority = await this.getPriorityDepths();
        const highStreak = await this.getHighStreak();
        const selectedPriority = this.selectPriority(byPriority, highStreak);
        if (!selectedPriority) {
            return null;
        }
        const [member] = await this.redis.zrange(this.getPriorityKey(selectedPriority), 0, 0);
        if (!member) {
            return null;
        }
        await this.redis.zrem(this.getPriorityKey(selectedPriority), member);
        await this.setHighStreak(selectedPriority === 'high' ? highStreak + 1 : selectedPriority === 'low' ? 0 : highStreak);
        const parsed = this.parseMember(member);
        if (parsed.expiresAt <= this.now().getTime()) {
            return this.dequeue();
        }
        return this.deserialize(parsed);
    }
    async getStatus() {
        await this.cleanExpired();
        const byPriority = await this.getPriorityDepths();
        const depth = byPriority.high + byPriority.medium + byPriority.low;
        const oldestRequest = await this.getOldestRequest();
        return {
            depth,
            byPriority,
            oldestRequest,
            estimatedWaitMs: depth === 0 ? 0 : Math.min(depth * 1000, this.expirationMs),
        };
    }
    async cleanExpired() {
        let removed = 0;
        const nowMs = this.now().getTime();
        for (const priority of this.getPriorityOrder()) {
            const key = this.getPriorityKey(priority);
            const members = await this.redis.zrange(key, 0, -1);
            for (const member of members) {
                const parsed = this.parseMember(member);
                if (parsed.expiresAt <= nowMs) {
                    removed += await this.redis.zrem(key, member);
                }
            }
        }
        return removed;
    }
    async getPosition(requestId) {
        await this.cleanExpired();
        const byPriority = await this.loadQueues();
        let highStreak = await this.getHighStreak();
        let position = 1;
        while (byPriority.high.length > 0 || byPriority.medium.length > 0 || byPriority.low.length > 0) {
            const selectedPriority = this.selectPriority({
                high: byPriority.high.length,
                medium: byPriority.medium.length,
                low: byPriority.low.length,
            }, highStreak);
            if (!selectedPriority) {
                return null;
            }
            const next = byPriority[selectedPriority].shift();
            if (!next) {
                return null;
            }
            if (next.id === requestId) {
                return position;
            }
            if (selectedPriority === 'high') {
                highStreak += 1;
                position += 1;
                continue;
            }
            if (selectedPriority === 'low') {
                highStreak = 0;
            }
            position += 1;
        }
        return null;
    }
    async getDepth() {
        const byPriority = await this.getPriorityDepths();
        return byPriority.high + byPriority.medium + byPriority.low;
    }
    async getPriorityDepths() {
        const [high, medium, low] = await Promise.all([
            this.redis.zcard(this.getPriorityKey('high')),
            this.redis.zcard(this.getPriorityKey('medium')),
            this.redis.zcard(this.getPriorityKey('low')),
        ]);
        return { high, medium, low };
    }
    async getOldestRequest() {
        const members = await Promise.all(this.getPriorityOrder().map(async (priority) => {
            const [member] = await this.redis.zrange(this.getPriorityKey(priority), 0, 0);
            return member ? this.parseMember(member) : null;
        }));
        const oldest = members
            .filter((member) => member !== null)
            .sort((left, right) => left.enqueuedAt - right.enqueuedAt)[0];
        return oldest ? new Date(oldest.enqueuedAt) : null;
    }
    async loadQueues() {
        const [high, medium, low] = await Promise.all(this.getPriorityOrder().map(async (priority) => {
            const members = await this.redis.zrange(this.getPriorityKey(priority), 0, -1);
            return members.map((member) => this.parseMember(member));
        }));
        return { high, medium, low };
    }
    selectPriority(byPriority, highStreak) {
        if (byPriority.high > 0) {
            if (byPriority.low > 0 && highStreak >= 10) {
                return 'low';
            }
            return 'high';
        }
        if (byPriority.medium > 0) {
            return 'medium';
        }
        if (byPriority.low > 0) {
            return 'low';
        }
        return null;
    }
    parseMember(member) {
        return JSON.parse(member);
    }
    deserialize(request) {
        return {
            ...request,
            enqueuedAt: new Date(request.enqueuedAt),
            expiresAt: new Date(request.expiresAt),
        };
    }
    getPriorityKey(priority) {
        return `${this.prefix}:${priority}`;
    }
    getHighStreakKey() {
        return `${this.prefix}:state:highStreak`;
    }
    async getHighStreak() {
        const raw = await this.redis.get(this.getHighStreakKey());
        if (!raw) {
            return 0;
        }
        const parsed = Number.parseInt(raw, 10);
        return Number.isFinite(parsed) ? parsed : 0;
    }
    async setHighStreak(value) {
        await this.redis.set(this.getHighStreakKey(), String(value));
    }
    getPriorityOrder() {
        return ['high', 'medium', 'low'];
    }
    getScore(now) {
        const base = now.getTime() * 1000;
        const score = base + this.sequence;
        this.sequence = (this.sequence + 1) % 1000;
        return score;
    }
}
exports.RequestQueue = RequestQueue;
