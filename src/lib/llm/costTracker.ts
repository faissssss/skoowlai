import type { Provider } from './config';

export interface CostEntry {
  timestamp: Date;
  provider: Provider;
  model: string;
  feature: string;
  inputTokens: number;
  outputTokens: number;
  estimatedCost: number;
  requestId: string;
  latencyMs?: number;
  success?: boolean;
  errorCode?: string;
  fallbackUsed?: boolean;
  userId?: string;
}

export interface CostSummary {
  provider: Provider;
  period: { start: Date; end: Date };
  totalRequests: number;
  totalTokens: number;
  totalCost: number;
  byFeature: Record<string, { requests: number; cost: number }>;
  byModel: Record<string, { requests: number; cost: number }>;
}

export interface ProviderPricing {
  inputCostPer1kTokens: number;
  outputCostPer1kTokens: number;
}

export interface CostTrackerConfig {
  pricing: Record<Provider, ProviderPricing>;
}

export interface CostStorage {
  insert(entry: CostEntry): Promise<void>;
  list(params: { provider?: Provider; start: Date; end: Date }): Promise<CostEntry[]>;
}

export class InMemoryCostStorage implements CostStorage {
  private readonly entries: CostEntry[] = [];

  async insert(entry: CostEntry): Promise<void> {
    this.entries.push({ ...entry });
  }

  async list(params: { provider?: Provider; start: Date; end: Date }): Promise<CostEntry[]> {
    return this.entries.filter((entry) => {
      const withinRange = entry.timestamp >= params.start && entry.timestamp <= params.end;
      const providerMatches = params.provider ? entry.provider === params.provider : true;
      return withinRange && providerMatches;
    });
  }
}

export const DEFAULT_COST_TRACKER_CONFIG: CostTrackerConfig = {
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

export class CostTracker {
  constructor(
    private readonly storage: CostStorage,
    private readonly config: CostTrackerConfig = DEFAULT_COST_TRACKER_CONFIG,
  ) {}

  async logRequest(entry: Omit<CostEntry, 'estimatedCost'> & { estimatedCost?: number }): Promise<CostEntry> {
    const estimatedCost = entry.estimatedCost ?? this.calculateCost(
      entry.provider,
      entry.inputTokens,
      entry.outputTokens,
    );

    const completeEntry: CostEntry = {
      ...entry,
      estimatedCost,
    };

    await this.storage.insert(completeEntry);
    return completeEntry;
  }

  async getSummary(provider: Provider, start: Date, end: Date): Promise<CostSummary> {
    const entries = await this.storage.list({ provider, start, end });
    const byFeature: Record<string, { requests: number; cost: number }> = {};
    const byModel: Record<string, { requests: number; cost: number }> = {};

    let totalTokens = 0;
    let totalCost = 0;

    for (const entry of entries) {
      totalTokens += entry.inputTokens + entry.outputTokens;
      totalCost += entry.estimatedCost;

      byFeature[entry.feature] ??= { requests: 0, cost: 0 };
      byFeature[entry.feature].requests += 1;
      byFeature[entry.feature].cost += entry.estimatedCost;

      byModel[entry.model] ??= { requests: 0, cost: 0 };
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

  async getDailyCost(provider: Provider, date: Date): Promise<number> {
    const start = new Date(Date.UTC(
      date.getUTCFullYear(),
      date.getUTCMonth(),
      date.getUTCDate(),
      0,
      0,
      0,
      0,
    ));
    const end = new Date(Date.UTC(
      date.getUTCFullYear(),
      date.getUTCMonth(),
      date.getUTCDate(),
      23,
      59,
      59,
      999,
    ));

    const summary = await this.getSummary(provider, start, end);
    return summary.totalCost;
  }

  async checkThreshold(provider: Provider, thresholdUSD: number, date = new Date()): Promise<boolean> {
    const dailyCost = await this.getDailyCost(provider, date);
    return dailyCost >= thresholdUSD;
  }

  calculateCost(provider: Provider, inputTokens: number, outputTokens: number): number {
    const pricing = this.config.pricing[provider];
    const inputCost = (inputTokens / 1_000) * pricing.inputCostPer1kTokens;
    const outputCost = (outputTokens / 1_000) * pricing.outputCostPer1kTokens;
    return inputCost + outputCost;
  }
}
