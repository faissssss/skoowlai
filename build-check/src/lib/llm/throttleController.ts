import type { Provider } from './config';

export interface ThrottleConfig {
  provider: Provider;
  maxRequestsPerMinute: number;
  bufferPercentage: number;
  burstSize: number;
  refillRate: number;
}

export interface ThrottleStatus {
  availableTokens: number;
  maxTokens: number;
  refillRate: number;
  nextRefillAt: Date;
}

export interface ThrottleControllerOptions {
  now?: () => Date;
  sleep?: (ms: number) => Promise<void>;
  pollIntervalMs?: number;
}

export const DEFAULT_THROTTLE_CONFIG: Record<Provider, ThrottleConfig> = {
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

export class ThrottleController {
  private readonly now: () => Date;
  private readonly sleep: (ms: number) => Promise<void>;
  private readonly pollIntervalMs: number;
  private readonly maxTokens: number;
  private readonly refillRate: number;

  private availableTokens: number;
  private lastRefillAt: number;

  constructor(
    private readonly config: ThrottleConfig,
    options: ThrottleControllerOptions = {},
  ) {
    this.now = options.now ?? (() => new Date());
    this.sleep = options.sleep ?? ((ms: number) => new Promise((resolve) => setTimeout(resolve, ms)));
    this.pollIntervalMs = options.pollIntervalMs ?? 100;
    this.maxTokens = Math.max(1, config.burstSize);
    this.refillRate = config.refillRate > 0
      ? config.refillRate
      : config.maxRequestsPerMinute / 60;
    this.availableTokens = this.maxTokens;
    this.lastRefillAt = this.now().getTime();
  }

  async tryAcquire(): Promise<boolean> {
    this.refill();

    if (this.availableTokens < 1) {
      return false;
    }

    this.availableTokens -= 1;
    return true;
  }

  async acquire(timeoutMs: number): Promise<boolean> {
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

      const waitMs = Math.min(
        this.pollIntervalMs,
        remainingMs,
        this.getTimeUntilNextTokenMs(),
      );
      await this.sleep(Math.max(1, waitMs));
    }

    return false;
  }

  getStatus(): ThrottleStatus {
    this.refill();

    return {
      availableTokens: this.availableTokens,
      maxTokens: this.maxTokens,
      refillRate: this.refillRate,
      nextRefillAt: new Date(this.now().getTime() + this.getTimeUntilNextTokenMs()),
    };
  }

  private refill(): void {
    const nowMs = this.now().getTime();
    const elapsedMs = nowMs - this.lastRefillAt;

    if (elapsedMs <= 0) {
      return;
    }

    const refillAmount = (elapsedMs / 1000) * this.refillRate;
    this.availableTokens = Math.min(this.maxTokens, this.availableTokens + refillAmount);
    this.lastRefillAt = nowMs;
  }

  private getTimeUntilNextTokenMs(): number {
    if (this.availableTokens >= 1) {
      return 0;
    }

    const missingTokens = 1 - this.availableTokens;
    return Math.ceil((missingTokens / this.refillRate) * 1000);
  }
}
