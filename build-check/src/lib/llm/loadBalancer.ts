import type { Provider } from './config';
import type { HealthMetrics } from './healthMonitor';
import type { RateLimitStatus } from './rateLimitTracker';

export interface LoadBalancerConfig {
  preferredProvider: Provider;
  rebalanceIntervalMs: number;
  capacityThreshold: number;
  costWeighting: number;
  healthWeighting: number;
}

export interface ProviderCapacity {
  provider: Provider;
  availableRpm: number;
  availableRpd: number;
  rpmUsagePercentage: number;
  rpdUsagePercentage: number;
  healthy: boolean;
  estimatedCost: number;
  score: number;
}

export interface RateLimitTrackerLike {
  getStatus(provider: Provider): Promise<RateLimitStatus>;
}

export interface HealthMonitorLike {
  getHealth(provider: Provider): Promise<HealthMetrics>;
}

export const DEFAULT_LOAD_BALANCER_CONFIG: LoadBalancerConfig = {
  preferredProvider: 'groq',
  rebalanceIntervalMs: 10_000,
  capacityThreshold: 80,
  costWeighting: 100,
  healthWeighting: 1_000,
};

const PROVIDER_COST_ESTIMATES: Record<Provider, number> = {
  groq: 0,
  gemini: 1,
};

export class LoadBalancer {
  private cachedCapacity: ProviderCapacity[] = [];

  constructor(
    private readonly rateLimitTracker: RateLimitTrackerLike,
    private readonly healthMonitor: HealthMonitorLike,
    private readonly config: LoadBalancerConfig = DEFAULT_LOAD_BALANCER_CONFIG,
  ) {}

  async selectProvider(_feature: string): Promise<Provider> {
    const capacities = await this.getCapacityStatus();
    const healthy = capacities.filter((capacity) => capacity.healthy);

    if (healthy.length === 0) {
      return this.selectBest(capacities).provider;
    }

    const preferred = healthy.find((capacity) => capacity.provider === this.config.preferredProvider);
    if (preferred && this.isBelowCapacityThreshold(preferred)) {
      return preferred.provider;
    }

    return this.selectBest(healthy).provider;
  }

  async getCapacityStatus(): Promise<ProviderCapacity[]> {
    const providers: Provider[] = ['groq', 'gemini'];
    const capacities = await Promise.all(
      providers.map(async (provider) => {
        const [rateLimit, health] = await Promise.all([
          this.rateLimitTracker.getStatus(provider),
          this.healthMonitor.getHealth(provider),
        ]);

        return this.toProviderCapacity(provider, rateLimit, health);
      }),
    );

    this.cachedCapacity = capacities.sort((left, right) => right.score - left.score);
    return this.cachedCapacity;
  }

  async rebalance(): Promise<void> {
    await this.getCapacityStatus();
  }

  private toProviderCapacity(
    provider: Provider,
    rateLimit: RateLimitStatus,
    health: HealthMetrics,
  ): ProviderCapacity {
    const availableRpm = Math.max(rateLimit.rpm.limit - rateLimit.rpm.current, 0);
    const availableRpd = Math.max(rateLimit.rpd.limit - rateLimit.rpd.current, 0);
    const healthy = health.healthy;
    const score = this.calculateScore(provider, rateLimit, health);

    return {
      provider,
      availableRpm,
      availableRpd,
      rpmUsagePercentage: rateLimit.rpm.percentage,
      rpdUsagePercentage: rateLimit.rpd.percentage,
      healthy,
      estimatedCost: PROVIDER_COST_ESTIMATES[provider],
      score,
    };
  }

  private calculateScore(
    provider: Provider,
    rateLimit: RateLimitStatus,
    health: HealthMetrics,
  ): number {
    const capacityHeadroom = 100 - Math.max(rateLimit.rpm.percentage, rateLimit.rpd.percentage);
    const preferenceBonus = provider === this.config.preferredProvider ? this.config.costWeighting : 0;
    const healthBonus = health.healthy ? this.config.healthWeighting : -this.config.healthWeighting;
    const latencyPenalty = health.avgLatencyMs / 1_000;

    return capacityHeadroom + preferenceBonus + healthBonus - latencyPenalty;
  }

  private isBelowCapacityThreshold(capacity: ProviderCapacity): boolean {
    const peakUsage = Math.max(capacity.rpmUsagePercentage, capacity.rpdUsagePercentage);
    return peakUsage < this.config.capacityThreshold;
  }

  private selectBest(capacities: ProviderCapacity[]): ProviderCapacity {
    const thresholdEligible = capacities.filter((capacity) => this.isUnderThresholdByAvailability(capacity));
    const pool = thresholdEligible.length > 0 ? thresholdEligible : capacities;

    return [...pool].sort((left, right) => {
      if (right.score !== left.score) {
        return right.score - left.score;
      }

      if (left.estimatedCost !== right.estimatedCost) {
        return left.estimatedCost - right.estimatedCost;
      }

      return right.availableRpm - left.availableRpm;
    })[0];
  }

  private isUnderThresholdByAvailability(capacity: ProviderCapacity): boolean {
    return this.isBelowCapacityThreshold(capacity);
  }
}
