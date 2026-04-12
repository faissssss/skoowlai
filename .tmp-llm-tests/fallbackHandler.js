"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.FallbackHandler = exports.DEFAULT_FALLBACK_CONFIG = void 0;
exports.DEFAULT_FALLBACK_CONFIG = {
    enabled: true,
    maxAttempts: 2,
    retryableErrors: ['5xx', '429', 'timeout'],
    timeout: 30000,
};
class FallbackHandler {
    constructor(config = exports.DEFAULT_FALLBACK_CONFIG, options = {}) {
        this.config = config;
        this.events = [];
        this.fallbackCounter = 0;
        this.now = options.now ?? (() => new Date());
    }
    shouldFallback(error, _provider) {
        if (!this.config.enabled) {
            return false;
        }
        const typedError = this.asFallbackError(error);
        const statusCode = this.getStatusCode(typedError);
        if (statusCode === 429) {
            return this.config.retryableErrors.includes('429');
        }
        if (statusCode !== null && statusCode >= 500 && statusCode < 600) {
            return this.config.retryableErrors.includes('5xx');
        }
        return this.isTimeoutError(typedError) && this.config.retryableErrors.includes('timeout');
    }
    async executeWithFallback(primaryFn, fallbackFn, context) {
        try {
            return await primaryFn();
        }
        catch (primaryError) {
            if (!this.shouldFallback(primaryError, context.primaryProvider)) {
                throw primaryError;
            }
            this.fallbackCounter += 1;
            const reason = this.classifyReason(primaryError);
            const primaryErrorMessage = primaryError instanceof Error ? primaryError.message : String(primaryError);
            try {
                const result = await fallbackFn();
                this.recordEvent({
                    timestamp: this.now(),
                    feature: context.feature,
                    primaryProvider: context.primaryProvider,
                    fallbackProvider: context.fallbackProvider,
                    reason,
                    primaryError: primaryErrorMessage,
                    fallbackSuccess: true,
                });
                return result;
            }
            catch (fallbackError) {
                this.recordEvent({
                    timestamp: this.now(),
                    feature: context.feature,
                    primaryProvider: context.primaryProvider,
                    fallbackProvider: context.fallbackProvider,
                    reason,
                    primaryError: primaryErrorMessage,
                    fallbackSuccess: false,
                });
                throw fallbackError;
            }
        }
    }
    async getFallbackStats(durationMs) {
        const cutoffMs = this.now().getTime() - durationMs;
        const recentEvents = this.events.filter((event) => event.timestamp.getTime() >= cutoffMs);
        const byFeature = {};
        const byReason = {};
        for (const event of recentEvents) {
            byFeature[event.feature] = (byFeature[event.feature] ?? 0) + 1;
            byReason[event.reason] = (byReason[event.reason] ?? 0) + 1;
        }
        const successful = recentEvents.filter((event) => event.fallbackSuccess).length;
        return {
            totalFallbacks: recentEvents.length,
            successRate: recentEvents.length === 0 ? 0 : successful / recentEvents.length,
            byFeature,
            byReason,
        };
    }
    getFallbackCount() {
        return this.fallbackCounter;
    }
    getEvents() {
        return [...this.events];
    }
    recordEvent(event) {
        this.events.push(event);
    }
    classifyReason(error) {
        const typedError = this.asFallbackError(error);
        const statusCode = this.getStatusCode(typedError);
        if (statusCode === 429) {
            return '429';
        }
        if (statusCode !== null && statusCode >= 500 && statusCode < 600) {
            return '5xx';
        }
        if (this.isTimeoutError(typedError)) {
            return 'timeout';
        }
        return 'unknown';
    }
    getStatusCode(error) {
        if (!error) {
            return null;
        }
        if (typeof error.statusCode === 'number') {
            return error.statusCode;
        }
        if (typeof error.response?.status === 'number') {
            return error.response.status;
        }
        return null;
    }
    isTimeoutError(error) {
        if (!error) {
            return false;
        }
        return error.timeout === true
            || error.name === 'AbortError'
            || error.code === 'ETIMEDOUT'
            || /timeout/i.test(error.message);
    }
    asFallbackError(error) {
        return error instanceof Error ? error : undefined;
    }
}
exports.FallbackHandler = FallbackHandler;
