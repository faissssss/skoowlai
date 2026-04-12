"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ThrottleController = exports.DEFAULT_THROTTLE_CONFIG = void 0;
exports.DEFAULT_THROTTLE_CONFIG = {
    groq: {
        provider: 'groq',
        maxRequestsPerMinute: 25,
        bufferPercentage: Math.round((5 / 30) * 100),
        burstSize: 25,
        refillRate: 25 / 60,
    },
    gemini: {
        provider: 'gemini',
        maxRequestsPerMinute: 60,
        bufferPercentage: 0,
        burstSize: 60,
        refillRate: 1,
    },
};
class ThrottleController {
    constructor(config, options = {}) {
        this.config = config;
        this.now = options.now ?? (() => new Date());
        this.sleep = options.sleep ?? ((ms) => new Promise((resolve) => setTimeout(resolve, ms)));
        this.pollIntervalMs = options.pollIntervalMs ?? 100;
        this.maxTokens = Math.max(1, config.burstSize);
        this.refillRate = config.refillRate > 0
            ? config.refillRate
            : config.maxRequestsPerMinute / 60;
        this.availableTokens = this.maxTokens;
        this.lastRefillAt = this.now().getTime();
    }
    async tryAcquire() {
        this.refill();
        if (this.availableTokens < 1) {
            return false;
        }
        this.availableTokens -= 1;
        return true;
    }
    async acquire(timeoutMs) {
        const deadline = this.now().getTime() + timeoutMs;
        while (this.now().getTime() <= deadline) {
            if (await this.tryAcquire()) {
                return true;
            }
            const nowMs = this.now().getTime();
            const remainingMs = deadline - nowMs;
            if (remainingMs <= 0) {
                break;
            }
            const waitMs = Math.min(this.pollIntervalMs, remainingMs, this.getTimeUntilNextTokenMs());
            await this.sleep(Math.max(1, waitMs));
        }
        return false;
    }
    getStatus() {
        this.refill();
        return {
            availableTokens: this.availableTokens,
            maxTokens: this.maxTokens,
            refillRate: this.refillRate,
            nextRefillAt: new Date(this.now().getTime() + this.getTimeUntilNextTokenMs()),
        };
    }
    refill() {
        const nowMs = this.now().getTime();
        const elapsedMs = nowMs - this.lastRefillAt;
        if (elapsedMs <= 0) {
            return;
        }
        const refillAmount = (elapsedMs / 1000) * this.refillRate;
        this.availableTokens = Math.min(this.maxTokens, this.availableTokens + refillAmount);
        this.lastRefillAt = nowMs;
    }
    getTimeUntilNextTokenMs() {
        if (this.availableTokens >= 1) {
            return 0;
        }
        const missingTokens = 1 - this.availableTokens;
        return Math.ceil((missingTokens / this.refillRate) * 1000);
    }
}
exports.ThrottleController = ThrottleController;
