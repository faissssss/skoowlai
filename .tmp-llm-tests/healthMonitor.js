"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.HealthMonitor = void 0;
class HealthMonitor {
    constructor(redis, checkIntervalMs = 5 * 60 * 1000, unhealthyThreshold = 3, options = {}) {
        this.redis = redis;
        this.checkIntervalMs = checkIntervalMs;
        this.unhealthyThreshold = unhealthyThreshold;
        this.intervalHandle = null;
        this.now = options.now ?? (() => new Date());
        this.historyLimit = options.historyLimit ?? 100;
        this.providerCheckers = options.providerCheckers ?? {};
    }
    start() {
        if (this.intervalHandle) {
            return;
        }
        this.intervalHandle = setInterval(() => {
            void this.runScheduledChecks();
        }, this.checkIntervalMs);
    }
    stop() {
        if (!this.intervalHandle) {
            return;
        }
        clearInterval(this.intervalHandle);
        this.intervalHandle = null;
    }
    async getHealth(provider) {
        const status = await this.redis.hgetall(this.getStatusKey(provider));
        if (Object.keys(status).length === 0) {
            return {
                provider,
                successRate: 0,
                avgLatencyMs: 0,
                lastCheck: null,
                healthy: true,
                consecutiveFailures: 0,
            };
        }
        return {
            provider,
            successRate: this.parseNumber(status.successRate),
            avgLatencyMs: this.parseNumber(status.avgLatencyMs),
            lastCheck: status.lastCheck ? new Date(status.lastCheck) : null,
            healthy: status.healthy !== 'false',
            consecutiveFailures: this.parseNumber(status.consecutiveFailures),
        };
    }
    async checkHealth(provider) {
        const startedAt = this.now();
        const priorMetrics = await this.getHealth(provider);
        let available = true;
        let error;
        try {
            const checker = this.providerCheckers[provider];
            if (checker) {
                await checker();
            }
        }
        catch (caughtError) {
            available = false;
            error = caughtError instanceof Error ? caughtError.message : String(caughtError);
        }
        const completedAt = this.now();
        const latencyMs = Math.max(0, completedAt.getTime() - startedAt.getTime());
        const result = {
            provider,
            timestamp: completedAt,
            available,
            latencyMs,
            ...(error ? { error } : {}),
        };
        await this.storeResult(result);
        const history = await this.getHealthHistory(provider, 15 * 60 * 1000);
        const consecutiveFailures = available ? 0 : priorMetrics.consecutiveFailures + 1;
        const healthy = consecutiveFailures < this.unhealthyThreshold;
        const successRate = this.calculateSuccessRate(history);
        const avgLatencyMs = this.calculateAverageLatency(history);
        await this.redis.hset(this.getStatusKey(provider), {
            healthy: String(healthy),
            lastCheck: completedAt.toISOString(),
            consecutiveFailures: String(consecutiveFailures),
            avgLatencyMs: String(avgLatencyMs),
            successRate: String(successRate),
        });
        await this.redis.expire(this.getStatusKey(provider), Math.ceil(this.checkIntervalMs / 1000));
        return result;
    }
    async getHealthHistory(provider, durationMs) {
        const rawEntries = await this.redis.lrange(this.getHistoryKey(provider), 0, this.historyLimit - 1);
        const cutoffMs = this.now().getTime() - durationMs;
        return rawEntries
            .map((entry) => this.deserializeResult(entry))
            .filter((entry) => entry.timestamp.getTime() >= cutoffMs)
            .sort((left, right) => left.timestamp.getTime() - right.timestamp.getTime());
    }
    async runScheduledChecks() {
        await Promise.all([
            this.checkHealth('groq'),
            this.checkHealth('gemini'),
        ]);
    }
    async storeResult(result) {
        const key = this.getHistoryKey(result.provider);
        await this.redis.lpush(key, this.serializeResult(result));
        await this.redis.ltrim(key, 0, this.historyLimit - 1);
    }
    calculateSuccessRate(history) {
        if (history.length === 0) {
            return 0;
        }
        const successful = history.filter((entry) => entry.available).length;
        return successful / history.length;
    }
    calculateAverageLatency(history) {
        if (history.length === 0) {
            return 0;
        }
        const totalLatency = history.reduce((sum, entry) => sum + entry.latencyMs, 0);
        return totalLatency / history.length;
    }
    serializeResult(result) {
        return JSON.stringify({
            provider: result.provider,
            timestamp: result.timestamp.toISOString(),
            available: result.available,
            latencyMs: result.latencyMs,
            ...(result.error ? { error: result.error } : {}),
        });
    }
    deserializeResult(value) {
        const parsed = JSON.parse(value);
        return {
            provider: parsed.provider,
            timestamp: new Date(parsed.timestamp),
            available: parsed.available,
            latencyMs: parsed.latencyMs,
            ...(parsed.error ? { error: parsed.error } : {}),
        };
    }
    parseNumber(value) {
        if (!value) {
            return 0;
        }
        const parsed = Number(value);
        return Number.isFinite(parsed) ? parsed : 0;
    }
    getHistoryKey(provider) {
        return `health:${provider}:checks`;
    }
    getStatusKey(provider) {
        return `provider:${provider}:status`;
    }
}
exports.HealthMonitor = HealthMonitor;
