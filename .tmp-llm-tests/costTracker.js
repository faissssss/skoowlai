"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.CostTracker = exports.DEFAULT_COST_TRACKER_CONFIG = exports.InMemoryCostStorage = void 0;
class InMemoryCostStorage {
    constructor() {
        this.entries = [];
    }
    async insert(entry) {
        this.entries.push({ ...entry });
    }
    async list(params) {
        return this.entries.filter((entry) => {
            const withinRange = entry.timestamp >= params.start && entry.timestamp <= params.end;
            const providerMatches = params.provider ? entry.provider === params.provider : true;
            return withinRange && providerMatches;
        });
    }
}
exports.InMemoryCostStorage = InMemoryCostStorage;
exports.DEFAULT_COST_TRACKER_CONFIG = {
    pricing: {
        groq: {
            inputCostPer1kTokens: 0,
            outputCostPer1kTokens: 0,
        },
        gemini: {
            inputCostPer1kTokens: 0.000075,
            outputCostPer1kTokens: 0.0003,
        },
    },
};
class CostTracker {
    constructor(storage, config = exports.DEFAULT_COST_TRACKER_CONFIG) {
        this.storage = storage;
        this.config = config;
    }
    async logRequest(entry) {
        const estimatedCost = entry.estimatedCost ?? this.calculateCost(entry.provider, entry.inputTokens, entry.outputTokens);
        const completeEntry = {
            ...entry,
            estimatedCost,
        };
        await this.storage.insert(completeEntry);
        return completeEntry;
    }
    async getSummary(provider, start, end) {
        var _a, _b;
        const entries = await this.storage.list({ provider, start, end });
        const byFeature = {};
        const byModel = {};
        let totalTokens = 0;
        let totalCost = 0;
        for (const entry of entries) {
            totalTokens += entry.inputTokens + entry.outputTokens;
            totalCost += entry.estimatedCost;
            byFeature[_a = entry.feature] ?? (byFeature[_a] = { requests: 0, cost: 0 });
            byFeature[entry.feature].requests += 1;
            byFeature[entry.feature].cost += entry.estimatedCost;
            byModel[_b = entry.model] ?? (byModel[_b] = { requests: 0, cost: 0 });
            byModel[entry.model].requests += 1;
            byModel[entry.model].cost += entry.estimatedCost;
        }
        return {
            provider,
            period: { start, end },
            totalRequests: entries.length,
            totalTokens,
            totalCost,
            byFeature,
            byModel,
        };
    }
    async getDailyCost(provider, date) {
        const start = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate(), 0, 0, 0, 0));
        const end = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate(), 23, 59, 59, 999));
        const summary = await this.getSummary(provider, start, end);
        return summary.totalCost;
    }
    async checkThreshold(provider, thresholdUSD, date = new Date()) {
        const dailyCost = await this.getDailyCost(provider, date);
        return dailyCost >= thresholdUSD;
    }
    calculateCost(provider, inputTokens, outputTokens) {
        const pricing = this.config.pricing[provider];
        const inputCost = (inputTokens / 1000) * pricing.inputCostPer1kTokens;
        const outputCost = (outputTokens / 1000) * pricing.outputCostPer1kTokens;
        return inputCost + outputCost;
    }
}
exports.CostTracker = CostTracker;
