import type { Provider } from './config';

export interface RedisLike {
  get(key: string): Promise<string | null>;
  incr(key: string): Promise<number>;
  expire(key: string, seconds: number): Promise<number>;
  ttl(key: string): Promise<number>;
}

export interface RateLimitProviderConfig {
  requestsPerMinute: number;
  requestsPerDay: number;
  warningThreshold: number;
  throttleThreshold: number;
}

export interface RateLimitConfig {
  groq: RateLimitProviderConfig;
  gemini: RateLimitProviderConfig;
}

export interface RateLimitWindowStatus {
  current: number;
  limit: number;
  remaining: number;
  percentage: number;
}

export interface RateLimitStatus {
  provider: Provider;
  rpm: RateLimitWindowStatus;
  rpd: RateLimitWindowStatus;
  resetAt: {
    minute: Date;
    day: Date;
  };
  warningThresholdExceeded: boolean;
  throttleThresholdExceeded: boolean;
  shouldQueue: boolean;
  shouldThrottle: boolean;
  isExceeded: boolean;
}

export interface PredictionResult {
  willExceedDaily: boolean;
  estimatedExhaustionTime: Date | null;
  rollingAverage: number;
  sustainableRate: number;
  shouldProactivelyThrottle: boolean;
  forecastedRemainingCapacity: number;
  alert: string | null;
}

export interface RateLimitTrackerOptions {
  now?: () => Date;
  prefix?: string;
}

export const DEFAULT_RATE_LIMIT_CONFIG: RateLimitConfig = {
  groq: {
    requestsPerMinute: 30,
    requestsPerDay: 14_400,
    warningThreshold: 80,
    throttleThreshold: 90,
  },
  gemini: {
    requestsPerMinute: 60,
    requestsPerDay: 50_000,
    warningThreshold: 80,
    throttleThreshold: 90,
  },
};

export class RateLimitTracker {
  private readonly now: () => Date;
  private readonly prefix: string;
  private redisAvailable: boolean = true;
  private inMemoryCounters: Map<string, { count: number; expiresAt: number }> = new Map();
  private inMemoryHistory: Map<string, { count: number; timestamp: number }> = new Map();

  constructor(
    private readonly redis: RedisLike,
    private readonly config: RateLimitConfig = DEFAULT_RATE_LIMIT_CONFIG,
    options: RateLimitTrackerOptions = {}
  ) {
    this.now = options.now ?? (() => new Date());
    this.prefix = options.prefix ?? 'ratelimit';
  }

  async checkLimit(provider: Provider): Promise<RateLimitStatus> {
    return this.getStatus(provider);
  }

  async incrementCount(provider: Provider): Promise<void> {
    const now = this.now();
    const keys = this.getKeys(provider, now);

    try {
      await this.incrementWithExpiry(
        keys.rpm,
        this.getSecondsUntilNextMinute(now),
      );
      await this.incrementWithExpiry(
        keys.rpd,
        this.getSecondsUntilNextUtcMidnight(now),
      );
      
      // Also store in a historical bucket with longer TTL for rolling average calculations
      const historyKey = `${this.prefix}:${provider}:history:${this.getMinuteBucket(now)}`;
      await this.incrementWithExpiry(historyKey, 60 * 60); // 1 hour TTL
      
      // Mark Redis as available if operation succeeds
      if (!this.redisAvailable) {
        console.warn(`[RateLimitTracker] Redis connection restored for provider ${provider}`);
        this.redisAvailable = true;
      }
    } catch (error) {
      // Fallback to in-memory tracking when Redis is unavailable
      this.handleRedisFailure(error, 'incrementCount');
      this.incrementInMemory(keys.rpm, this.getSecondsUntilNextMinute(now));
      this.incrementInMemory(keys.rpd, this.getSecondsUntilNextUtcMidnight(now));
      
      // Store in history for rolling average
      const historyKey = `${this.prefix}:${provider}:history:${this.getMinuteBucket(now)}`;
      this.incrementInMemory(historyKey, 60 * 60);
    }
  }

  async getStatus(provider: Provider): Promise<RateLimitStatus> {
    const now = this.now();
    const providerConfig = this.config[provider];
    const keys = this.getKeys(provider, now);
    
    let rpmCurrent: number;
    let rpdCurrent: number;
    
    try {
      const [rpmRaw, rpdRaw] = await Promise.all([
        this.redis.get(keys.rpm),
        this.redis.get(keys.rpd),
      ]);
      
      rpmCurrent = this.parseCount(rpmRaw);
      rpdCurrent = this.parseCount(rpdRaw);
      
      // Mark Redis as available if operation succeeds
      if (!this.redisAvailable) {
        console.warn(`[RateLimitTracker] Redis connection restored for provider ${provider}`);
        this.redisAvailable = true;
      }
    } catch (error) {
      // Fallback to in-memory tracking when Redis is unavailable
      this.handleRedisFailure(error, 'getStatus');
      rpmCurrent = this.getInMemoryCount(keys.rpm);
      rpdCurrent = this.getInMemoryCount(keys.rpd);
    }

    const rpm = this.buildWindowStatus(rpmCurrent, providerConfig.requestsPerMinute);
    const rpd = this.buildWindowStatus(rpdCurrent, providerConfig.requestsPerDay);
    const peakPercentage = Math.max(rpm.percentage, rpd.percentage);
    const warningThresholdExceeded = peakPercentage >= providerConfig.warningThreshold;
    const throttleThresholdExceeded = peakPercentage >= providerConfig.throttleThreshold;
    const isExceeded = rpm.current >= rpm.limit || rpd.current >= rpd.limit;

    return {
      provider,
      rpm,
      rpd,
      resetAt: {
        minute: this.getNextMinuteBoundary(now),
        day: this.getNextUtcMidnight(now),
      },
      warningThresholdExceeded,
      throttleThresholdExceeded,
      shouldQueue: warningThresholdExceeded,
      shouldThrottle: throttleThresholdExceeded || isExceeded,
      isExceeded,
    };
  }

  async predictExhaustion(provider: Provider): Promise<PredictionResult> {
    const now = this.now();
    const providerConfig = this.config[provider];
    const status = await this.getStatus(provider);
    
    // Calculate rolling average over last 15 minutes
    const rollingAverage = await this.getRollingAverage(provider, 15);
    
    // Calculate sustainable rate (requests per minute to stay within daily limit)
    const minutesUntilMidnight = this.getMinutesUntilMidnight(now);
    const remainingDailyCapacity = status.rpd.remaining;
    const sustainableRate = minutesUntilMidnight > 0 
      ? remainingDailyCapacity / minutesUntilMidnight 
      : 0;
    
    // Predict if daily limit will be exceeded
    const willExceedDaily = rollingAverage > sustainableRate && remainingDailyCapacity > 0;
    
    // Estimate exhaustion time
    let estimatedExhaustionTime: Date | null = null;
    if (willExceedDaily && rollingAverage > 0) {
      const minutesToExhaustion = remainingDailyCapacity / rollingAverage;
      estimatedExhaustionTime = new Date(now.getTime() + minutesToExhaustion * 60 * 1000);
    }
    
    // Determine if proactive throttling should be activated
    const shouldProactivelyThrottle = rollingAverage > sustainableRate * 1.1; // 10% buffer
    
    // Forecast remaining capacity for next hour
    const forecastedRemainingCapacity = Math.max(
      0,
      remainingDailyCapacity - (rollingAverage * 60)
    );
    
    // Generate alert if needed
    let alert: string | null = null;
    const hoursElapsed = now.getUTCHours() + (now.getUTCMinutes() / 60);
    const dailyUsagePercentage = status.rpd.percentage;
    
    // Alert if usage exceeds 50% by noon UTC
    if (hoursElapsed <= 12 && dailyUsagePercentage >= 50) {
      alert = `High usage detected: ${dailyUsagePercentage.toFixed(1)}% of daily limit used by ${now.getUTCHours()}:${String(now.getUTCMinutes()).padStart(2, '0')} UTC`;
    }
    
    // Add warning if using in-memory fallback
    if (!this.redisAvailable && alert) {
      alert += ' (WARNING: Using in-memory rate limiting - accuracy reduced in distributed systems)';
    } else if (!this.redisAvailable) {
      alert = 'WARNING: Redis unavailable - using in-memory rate limiting with reduced accuracy';
    }
    
    return {
      willExceedDaily,
      estimatedExhaustionTime,
      rollingAverage,
      sustainableRate,
      shouldProactivelyThrottle,
      forecastedRemainingCapacity,
      alert,
    };
  }

  async getRollingAverage(provider: Provider, windowMinutes: number): Promise<number> {
    const now = this.now();
    const counts: number[] = [];
    
    try {
      // Collect counts from historical buckets (which have longer TTL)
      for (let i = 0; i < windowMinutes; i++) {
        const timestamp = new Date(now.getTime() - i * 60 * 1000);
        const key = `${this.prefix}:${provider}:history:${this.getMinuteBucket(timestamp)}`;
        const countRaw = await this.redis.get(key);
        const count = this.parseCount(countRaw);
        counts.push(count);
      }
      
      // Mark Redis as available if operation succeeds
      if (!this.redisAvailable) {
        console.warn(`[RateLimitTracker] Redis connection restored for provider ${provider}`);
        this.redisAvailable = true;
      }
    } catch (error) {
      // Fallback to in-memory history when Redis is unavailable
      this.handleRedisFailure(error, 'getRollingAverage');
      
      for (let i = 0; i < windowMinutes; i++) {
        const timestamp = new Date(now.getTime() - i * 60 * 1000);
        const key = `${this.prefix}:${provider}:history:${this.getMinuteBucket(timestamp)}`;
        const count = this.getInMemoryCount(key);
        counts.push(count);
      }
    }
    
    // Calculate average
    const totalRequests = counts.reduce((sum, count) => sum + count, 0);
    return totalRequests / windowMinutes;
  }

  /**
   * Check if Redis is currently available.
   * Validates: Requirement 14.5
   */
  isRedisAvailable(): boolean {
    return this.redisAvailable;
  }

  private async incrementWithExpiry(key: string, ttlSeconds: number): Promise<void> {
    const nextCount = await this.redis.incr(key);

    if (nextCount === 1) {
      await this.redis.expire(key, ttlSeconds);
      return;
    }

    const ttl = await this.redis.ttl(key);
    if (ttl < 0) {
      await this.redis.expire(key, ttlSeconds);
    }
  }

  /**
   * Handle Redis failure by logging warning and marking Redis as unavailable.
   * Validates: Requirement 14.5
   */
  private handleRedisFailure(error: unknown, operation: string): void {
    if (this.redisAvailable) {
      console.warn(
        `[RateLimitTracker] Redis unavailable during ${operation}, falling back to in-memory tracking. ` +
        `Error: ${error instanceof Error ? error.message : String(error)}. ` +
        `WARNING: In-memory rate limiting is per-instance and less accurate in distributed systems.`
      );
      this.redisAvailable = false;
    }
  }

  /**
   * Increment in-memory counter with expiration.
   * Validates: Requirement 14.5
   */
  private incrementInMemory(key: string, ttlSeconds: number): void {
    const now = this.now().getTime();
    const expiresAt = now + ttlSeconds * 1000;
    
    // Clean expired entries
    this.cleanExpiredInMemory();
    
    const existing = this.inMemoryCounters.get(key);
    if (existing && existing.expiresAt > now) {
      this.inMemoryCounters.set(key, {
        count: existing.count + 1,
        expiresAt: existing.expiresAt,
      });
    } else {
      this.inMemoryCounters.set(key, {
        count: 1,
        expiresAt,
      });
    }
  }

  /**
   * Get in-memory counter value.
   * Validates: Requirement 14.5
   */
  private getInMemoryCount(key: string): number {
    const now = this.now().getTime();
    const entry = this.inMemoryCounters.get(key);
    
    if (!entry || entry.expiresAt <= now) {
      return 0;
    }
    
    return entry.count;
  }

  /**
   * Clean expired in-memory entries.
   * Validates: Requirement 14.5
   */
  private cleanExpiredInMemory(): void {
    const now = this.now().getTime();
    
    for (const [key, entry] of this.inMemoryCounters.entries()) {
      if (entry.expiresAt <= now) {
        this.inMemoryCounters.delete(key);
      }
    }
  }

  private buildWindowStatus(current: number, limit: number): RateLimitWindowStatus {
    const percentage = limit > 0 ? (current / limit) * 100 : 0;

    return {
      current,
      limit,
      remaining: Math.max(limit - current, 0),
      percentage,
    };
  }

  private parseCount(raw: string | null): number {
    if (!raw) {
      return 0;
    }

    const parsed = Number.parseInt(raw, 10);
    return Number.isFinite(parsed) ? parsed : 0;
  }

  private getKeys(provider: Provider, now: Date): { rpm: string; rpd: string } {
    return {
      rpm: `${this.prefix}:${provider}:rpm:${this.getMinuteBucket(now)}`,
      rpd: `${this.prefix}:${provider}:rpd:${this.getDayBucket(now)}`,
    };
  }

  private getMinuteBucket(now: Date): string {
    return [
      now.getUTCFullYear(),
      this.pad(now.getUTCMonth() + 1),
      this.pad(now.getUTCDate()),
      this.pad(now.getUTCHours()),
      this.pad(now.getUTCMinutes()),
    ].join('');
  }

  private getDayBucket(now: Date): string {
    return [
      now.getUTCFullYear(),
      this.pad(now.getUTCMonth() + 1),
      this.pad(now.getUTCDate()),
    ].join('');
  }

  private getNextMinuteBoundary(now: Date): Date {
    const next = new Date(now);
    next.setUTCSeconds(0, 0);
    next.setUTCMinutes(next.getUTCMinutes() + 1);
    return next;
  }

  private getNextUtcMidnight(now: Date): Date {
    return new Date(Date.UTC(
      now.getUTCFullYear(),
      now.getUTCMonth(),
      now.getUTCDate() + 1,
      0,
      0,
      0,
      0,
    ));
  }

  private getSecondsUntilNextMinute(now: Date): number {
    const ms = this.getNextMinuteBoundary(now).getTime() - now.getTime();
    return Math.max(1, Math.ceil(ms / 1000));
  }

  private getSecondsUntilNextUtcMidnight(now: Date): number {
    const ms = this.getNextUtcMidnight(now).getTime() - now.getTime();
    return Math.max(1, Math.ceil(ms / 1000));
  }

  private getMinutesUntilMidnight(now: Date): number {
    const ms = this.getNextUtcMidnight(now).getTime() - now.getTime();
    return Math.max(0, ms / (60 * 1000));
  }

  private pad(value: number): string {
    return String(value).padStart(2, '0');
  }
}
