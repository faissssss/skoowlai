"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.RetryStrategy = exports.DEFAULT_RETRY_CONFIG = void 0;
exports.DEFAULT_RETRY_CONFIG = {
    maxAttempts: 4,
    initialDelayMs: 1000,
    maxDelayMs: 32000,
    jitterMs: 500,
    retryableStatusCodes: [429, 500, 502, 503, 504],
};
class RetryStrategy {
    constructor(config = exports.DEFAULT_RETRY_CONFIG, options = {}) {
        this.config = config;
        this.sleep = options.sleep ?? ((ms) => new Promise((resolve) => setTimeout(resolve, ms)));
        this.random = options.random ?? Math.random;
    }
    async execute(fn, _context) {
        let attempt = 0;
        while (true) {
            try {
                return await fn();
            }
            catch (error) {
                attempt += 1;
                const retryable = this.isRetryable(error);
                const maxRetries = this.getMaxRetries(error);
                if (!retryable || attempt > maxRetries) {
                    throw error;
                }
                const delay = this.calculateDelay(attempt, error);
                await this.sleep(delay);
            }
        }
    }
    calculateDelay(attempt, error) {
        const typedError = this.asRetryableError(error);
        const statusCode = this.getStatusCode(typedError);
        const retryAfterMs = this.getRetryAfterMs(typedError);
        let baseDelayMs;
        if (statusCode === 429) {
            baseDelayMs = Math.min(this.config.initialDelayMs * (2 ** Math.max(attempt - 1, 0)), this.config.maxDelayMs);
        }
        else if (this.isTimeoutError(typedError)) {
            baseDelayMs = this.config.initialDelayMs;
        }
        else {
            baseDelayMs = Math.min(2000 * (2 ** Math.max(attempt - 1, 0)), this.config.maxDelayMs);
        }
        const boundedRandom = Math.min(Math.max(this.random(), 0), 0.999999999999);
        const jitterMs = statusCode === 429
            ? Math.floor(boundedRandom * (this.config.jitterMs + 1))
            : 0;
        const calculatedDelay = baseDelayMs + jitterMs;
        return retryAfterMs !== null ? Math.max(calculatedDelay, retryAfterMs) : calculatedDelay;
    }
    isRetryable(error) {
        const typedError = this.asRetryableError(error);
        const statusCode = this.getStatusCode(typedError);
        if (statusCode === 429) {
            return true;
        }
        if (statusCode !== null) {
            return statusCode >= 500 && statusCode < 600;
        }
        return this.isTimeoutError(typedError);
    }
    getMaxRetries(error) {
        const typedError = this.asRetryableError(error);
        const statusCode = this.getStatusCode(typedError);
        if (statusCode === 429) {
            return 3;
        }
        if (statusCode !== null && statusCode >= 500 && statusCode < 600) {
            return 2;
        }
        if (this.isTimeoutError(typedError)) {
            return 1;
        }
        return 0;
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
    getRetryAfterMs(error) {
        if (!error) {
            return null;
        }
        const fromProperty = this.toRetryAfterMs(error.retryAfter);
        if (fromProperty !== null) {
            return fromProperty;
        }
        const headers = error.response?.headers;
        if (!headers) {
            return null;
        }
        if (typeof headers.get === 'function') {
            return this.toRetryAfterMs(headers.get('retry-after') ?? undefined);
        }
        return this.toRetryAfterMs(headers['retry-after']);
    }
    toRetryAfterMs(value) {
        if (typeof value === 'number' && Number.isFinite(value)) {
            return Math.max(0, value * 1000);
        }
        if (typeof value === 'string') {
            const seconds = Number(value);
            if (Number.isFinite(seconds)) {
                return Math.max(0, seconds * 1000);
            }
            const dateMs = Date.parse(value);
            if (!Number.isNaN(dateMs)) {
                return Math.max(0, dateMs - Date.now());
            }
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
    asRetryableError(error) {
        return error instanceof Error ? error : undefined;
    }
}
exports.RetryStrategy = RetryStrategy;
