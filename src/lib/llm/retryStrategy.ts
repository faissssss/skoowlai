import type { Provider } from './config';

export interface RetryConfig {
  maxAttempts: number;
  initialDelayMs: number;
  maxDelayMs: number;
  jitterMs: number;
  retryableStatusCodes: number[];
}

export interface RetryExecutionContext {
  feature: string;
  provider: Provider;
}

export interface RetryStrategyOptions {
  sleep?: (ms: number) => Promise<void>;
  random?: () => number;
}

type RetryableError = Error & {
  statusCode?: number;
  code?: string;
  timeout?: boolean;
  retryAfter?: number | string;
  response?: {
    status?: number;
    headers?: Record<string, unknown> & {
      get?: (name: string) => string | null;
    };
  };
};

export const DEFAULT_RETRY_CONFIG: RetryConfig = {
  maxAttempts: 4,
  initialDelayMs: 1_000,
  maxDelayMs: 32_000,
  jitterMs: 500,
  retryableStatusCodes: [429, 500, 502, 503, 504],
};

export class RetryStrategy {
  private readonly sleep: (ms: number) => Promise<void>;
  private readonly random: () => number;

  constructor(
    private readonly config: RetryConfig = DEFAULT_RETRY_CONFIG,
    options: RetryStrategyOptions = {},
  ) {
    this.sleep = options.sleep ?? ((ms: number) => new Promise((resolve) => setTimeout(resolve, ms)));
    this.random = options.random ?? Math.random;
  }

  async execute<T>(
    fn: () => Promise<T>,
    _context: RetryExecutionContext,
  ): Promise<T> {
    let attempt = 0;

    while (true) {
      try {
        return await fn();
      } catch (error) {
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

  calculateDelay(attempt: number, error?: unknown): number {
    const typedError = this.asRetryableError(error);
    const statusCode = this.getStatusCode(typedError);
    const retryAfterMs = this.getRetryAfterMs(typedError);

    let baseDelayMs: number;
    if (statusCode === 429) {
      baseDelayMs = Math.min(
        this.config.initialDelayMs * (2 ** Math.max(attempt - 1, 0)),
        this.config.maxDelayMs,
      );
    } else if (this.isTimeoutError(typedError)) {
      baseDelayMs = this.config.initialDelayMs;
    } else {
      baseDelayMs = Math.min(2_000 * (2 ** Math.max(attempt - 1, 0)), this.config.maxDelayMs);
    }

    const boundedRandom = Math.min(Math.max(this.random(), 0), 0.999999999999);
    const jitterMs = statusCode === 429
      ? Math.floor(boundedRandom * (this.config.jitterMs + 1))
      : 0;
    const calculatedDelay = baseDelayMs + jitterMs;

    return retryAfterMs !== null ? Math.max(calculatedDelay, retryAfterMs) : calculatedDelay;
  }

  isRetryable(error: unknown): boolean {
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

  private getMaxRetries(error: unknown): number {
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

  private getStatusCode(error?: RetryableError): number | null {
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

  private getRetryAfterMs(error?: RetryableError): number | null {
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

    return this.toRetryAfterMs(headers['retry-after'] as string | number | undefined);
  }

  private toRetryAfterMs(value: number | string | undefined): number | null {
    if (typeof value === 'number' && Number.isFinite(value)) {
      return Math.max(0, value * 1_000);
    }

    if (typeof value === 'string') {
      const seconds = Number(value);
      if (Number.isFinite(seconds)) {
        return Math.max(0, seconds * 1_000);
      }

      const dateMs = Date.parse(value);
      if (!Number.isNaN(dateMs)) {
        return Math.max(0, dateMs - Date.now());
      }
    }

    return null;
  }

  private isTimeoutError(error?: RetryableError): boolean {
    if (!error) {
      return false;
    }

    return error.timeout === true
      || error.name === 'AbortError'
      || error.code === 'ETIMEDOUT'
      || /timeout/i.test(error.message);
  }

  private asRetryableError(error: unknown): RetryableError | undefined {
    return error instanceof Error ? error as RetryableError : undefined;
  }
}
