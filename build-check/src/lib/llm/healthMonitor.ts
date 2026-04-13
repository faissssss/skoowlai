import type { Provider } from './config';

export interface HealthCheckResult {
  provider: Provider;
  timestamp: Date;
  available: boolean;
  latencyMs: number;
  error?: string;
}

export interface HealthMetrics {
  provider: Provider;
  successRate: number;
  avgLatencyMs: number;
  lastCheck: Date | null;
  healthy: boolean;
  consecutiveFailures: number;
}

export interface HealthRedisLike {
  lpush(key: string, ...values: string[]): Promise<number>;
  ltrim(key: string, start: number, stop: number): Promise<'OK' | string>;
  lrange(key: string, start: number, stop: number): Promise<string[]>;
  hset(key: string, values: Record<string, string>): Promise<number>;
  hgetall(key: string): Promise<Record<string, string>>;
  expire(key: string, seconds: number): Promise<number>;
}

export interface HealthMonitorOptions {
  now?: () => Date;
  historyLimit?: number;
  providerCheckers?: Partial<Record<Provider, () => Promise<void>>>;
}

export class HealthMonitor {
  private readonly now: () => Date;
  private readonly historyLimit: number;
  private readonly providerCheckers: Partial<Record<Provider, () => Promise<void>>>;
  private intervalHandle: NodeJS.Timeout | null = null;

  constructor(
    private readonly redis: HealthRedisLike,
    private readonly checkIntervalMs = 5 * 60 * 1000,
    private readonly unhealthyThreshold = 3,
    options: HealthMonitorOptions = {},
  ) {
    this.now = options.now ?? (() => new Date());
    this.historyLimit = options.historyLimit ?? 100;
    this.providerCheckers = options.providerCheckers ?? {};
  }

  start(): void {
    if (this.intervalHandle) {
      return;
    }

    this.intervalHandle = setInterval(() => {
      void this.runScheduledChecks();
    }, this.checkIntervalMs);
  }

  stop(): void {
    if (!this.intervalHandle) {
      return;
    }

    clearInterval(this.intervalHandle);
    this.intervalHandle = null;
  }

  async getHealth(provider: Provider): Promise<HealthMetrics> {
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

  async checkHealth(provider: Provider): Promise<HealthCheckResult> {
    const startedAt = this.now();
    const priorMetrics = await this.getHealth(provider);

    let available = true;
    let error: string | undefined;

    try {
      const checker = this.providerCheckers[provider];
      if (checker) {
        await checker();
      }
    } catch (caughtError) {
      available = false;
      error = caughtError instanceof Error ? caughtError.message : String(caughtError);
    }

    const completedAt = this.now();
    const latencyMs = Math.max(0, completedAt.getTime() - startedAt.getTime());
    const result: HealthCheckResult = {
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

  async getHealthHistory(provider: Provider, durationMs: number): Promise<HealthCheckResult[]> {
    const rawEntries = await this.redis.lrange(this.getHistoryKey(provider), 0, this.historyLimit - 1);
    const cutoffMs = this.now().getTime() - durationMs;

    return rawEntries
      .map((entry) => this.deserializeResult(entry))
      .filter((entry) => entry.timestamp.getTime() >= cutoffMs)
      .sort((left, right) => left.timestamp.getTime() - right.timestamp.getTime());
  }

  private async runScheduledChecks(): Promise<void> {
    await Promise.all([
      this.checkHealth('groq'),
      this.checkHealth('gemini'),
    ]);
  }

  private async storeResult(result: HealthCheckResult): Promise<void> {
    const key = this.getHistoryKey(result.provider);
    await this.redis.lpush(key, this.serializeResult(result));
    await this.redis.ltrim(key, 0, this.historyLimit - 1);
  }

  private calculateSuccessRate(history: HealthCheckResult[]): number {
    if (history.length === 0) {
      return 0;
    }

    const successful = history.filter((entry) => entry.available).length;
    return successful / history.length;
  }

  private calculateAverageLatency(history: HealthCheckResult[]): number {
    if (history.length === 0) {
      return 0;
    }

    const totalLatency = history.reduce((sum, entry) => sum + entry.latencyMs, 0);
    return totalLatency / history.length;
  }

  private serializeResult(result: HealthCheckResult): string {
    return JSON.stringify({
      provider: result.provider,
      timestamp: result.timestamp.toISOString(),
      available: result.available,
      latencyMs: result.latencyMs,
      ...(result.error ? { error: result.error } : {}),
    });
  }

  private deserializeResult(value: string): HealthCheckResult {
    const parsed = JSON.parse(value) as {
      provider: Provider;
      timestamp: string;
      available: boolean;
      latencyMs: number;
      error?: string;
    };

    return {
      provider: parsed.provider,
      timestamp: new Date(parsed.timestamp),
      available: parsed.available,
      latencyMs: parsed.latencyMs,
      ...(parsed.error ? { error: parsed.error } : {}),
    };
  }

  private parseNumber(value: string | undefined): number {
    if (!value) {
      return 0;
    }

    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : 0;
  }

  private getHistoryKey(provider: Provider): string {
    return `health:${provider}:checks`;
  }

  private getStatusKey(provider: Provider): string {
    return `provider:${provider}:status`;
  }
}
