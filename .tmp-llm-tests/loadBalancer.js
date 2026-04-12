"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.LoadBalancer = exports.DEFAULT_LOAD_BALANCER_CONFIG = void 0;
exports.DEFAULT_LOAD_BALANCER_CONFIG = {
    preferredProvider: 'groq',
    rebalanceIntervalMs: 10000,
    capacityThreshold: 80,
    costWeighting: 100,
    healthWeighting: 1000,
};
const PROVIDER_COST_ESTIMATES = {
    groq: 0,
    gemini: 1,
};
class LoadBalancer {
    constructor(rateLimitTracker, healthMonitor, config = exports.DEFAULT_LOAD_BALANCER_CONFIG) {
        this.rateLimitTracker = rateLimitTracker;
        this.healthMonitor = healthMonitor;
        this.config = config;
        this.cachedCapacity = [];
    }
    async selectProvider(_feature) {
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
    async getCapacityStatus() {
        const providers = ['groq', 'gemini'];
        const capacities = await Promise.all(providers.map(async (provider) => {
            const [rateLimit, health] = await Promise.all([
                this.rateLimitTracker.getStatus(provider),
                this.healthMonitor.getHealth(provider),
            ]);
            return this.toProviderCapacity(provider, rateLimit, health);
        }));
        this.cachedCapacity = capacities.sort((left, right) => right.score - left.score);
        return this.cachedCapacity;
    }
    async rebalance() {
        await this.getCapacityStatus();
    }
    toProviderCapacity(provider, rateLimit, health) {
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
    calculateScore(provider, rateLimit, health) {
        const capacityHeadroom = 100 - Math.max(rateLimit.rpm.percentage, rateLimit.rpd.percentage);
        const preferenceBonus = provider === this.config.preferredProvider ? this.config.costWeighting : 0;
        const healthBonus = health.healthy ? this.config.healthWeighting : -this.config.healthWeighting;
        const latencyPenalty = health.avgLatencyMs / 1000;
        return capacityHeadroom + preferenceBonus + healthBonus - latencyPenalty;
    }
    isBelowCapacityThreshold(capacity) {
        const peakUsage = Math.max(capacity.rpmUsagePercentage, capacity.rpdUsagePercentage);
        return peakUsage < this.config.capacityThreshold;
    }
    selectBest(capacities) {
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
    isUnderThresholdByAvailability(capacity) {
        return this.isBelowCapacityThreshold(capacity);
    }
}
exports.LoadBalancer = LoadBalancer;
