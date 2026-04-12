import { db } from '@/lib/db';

import { ProviderConfig, type Provider } from './config';
import { CostTracker, InMemoryCostStorage, type CostEntry, type CostStorage } from './costTracker';
import { FallbackHandler, DEFAULT_FALLBACK_CONFIG } from './fallbackHandler';
import { HealthMonitor, type HealthRedisLike } from './healthMonitor';
import { LoadBalancer, DEFAULT_LOAD_BALANCER_CONFIG } from './loadBalancer';
import { RateLimitTracker, DEFAULT_RATE_LIMIT_CONFIG, type RedisLike } from './rateLimitTracker';
import { RequestQueue, type QueueRedisLike } from './requestQueue';
import { RetryStrategy, DEFAULT_RETRY_CONFIG } from './retryStrategy';
import { LLMRouter, sanitizeLogData, type RequestLogEntry } from './router';

class InMemoryCounterRedis implements RedisLike {
  private readonly values = new Map<string, { value: number; expiresAt?: number }>();

  async get(key: string): Promise<string | null> {
    this.cleanExpired(key);
    const entry = this.values.get(key);
    return entry ? String(entry.value) : null;
  }

  async incr(key: string): Promise<number> {
    this.cleanExpired(key);
    const existing = this.values.get(key);
    const nextValue = (existing?.value ?? 0) + 1;

    this.values.set(key, {
      value: nextValue,
      expiresAt: existing?.expiresAt,
    });

    return nextValue;
  }

  async expire(key: string, seconds: number): Promise<number> {
    const entry = this.values.get(key);
    if (!entry) {
      return 0;
    }

    this.values.set(key, {
      ...entry,
      expiresAt: Date.now() + seconds * 1_000,
    });

    return 1;
  }

  async ttl(key: string): Promise<number> {
    this.cleanExpired(key);
    const entry = this.values.get(key);
    if (!entry?.expiresAt) {
      return -1;
    }

    return Math.max(0, Math.ceil((entry.expiresAt - Date.now()) / 1_000));
  }

  private cleanExpired(key: string): void {
    const entry = this.values.get(key);
    if (entry?.expiresAt && entry.expiresAt <= Date.now()) {
      this.values.delete(key);
    }
  }
}

class InMemoryQueueRedis implements QueueRedisLike {
  private readonly values = new Map<string, string>();
  private readonly sortedSets = new Map<string, Array<{ score: number; member: string }>>();

  async get(key: string): Promise<string | null> {
    return this.values.get(key) ?? null;
  }

  async set(key: string, value: string): Promise<'OK'> {
    this.values.set(key, value);
    return 'OK';
  }

  async zadd(key: string, score: number, member: string): Promise<number> {
    const entries = this.sortedSets.get(key) ?? [];
    const withoutExisting = entries.filter((entry) => entry.member !== member);
    const nextEntries = [...withoutExisting, { score, member }].sort((left, right) => left.score - right.score);
    this.sortedSets.set(key, nextEntries);
    return withoutExisting.length === entries.length ? 1 : 0;
  }

  async zrange(key: string, start: number, stop: number): Promise<string[]> {
    const entries = this.sortedSets.get(key) ?? [];
    const normalizedStop = stop < 0 ? entries.length + stop : stop;
    return entries
      .slice(start, normalizedStop + 1)
      .map((entry) => entry.member);
  }

  async zrem(key: string, member: string): Promise<number> {
    const entries = this.sortedSets.get(key) ?? [];
    const nextEntries = entries.filter((entry) => entry.member !== member);
    this.sortedSets.set(key, nextEntries);
    return nextEntries.length === entries.length ? 0 : 1;
  }

  async zcard(key: string): Promise<number> {
    return (this.sortedSets.get(key) ?? []).length;
  }
}

class InMemoryHealthRedis implements HealthRedisLike {
  private readonly lists = new Map<string, string[]>();
  private readonly hashes = new Map<string, Record<string, string>>();
  private readonly expirations = new Map<string, number>();

  async lpush(key: string, ...values: string[]): Promise<number> {
    this.cleanExpired(key);
    const current = this.lists.get(key) ?? [];
    const next = [...values.reverse(), ...current];
    this.lists.set(key, next);
    return next.length;
  }

  async ltrim(key: string, start: number, stop: number): Promise<'OK'> {
    this.cleanExpired(key);
    const current = this.lists.get(key) ?? [];
    const normalizedStop = stop < 0 ? current.length + stop : stop;
    this.lists.set(key, current.slice(start, normalizedStop + 1));
    return 'OK';
  }

  async lrange(key: string, start: number, stop: number): Promise<string[]> {
    this.cleanExpired(key);
    const current = this.lists.get(key) ?? [];
    const normalizedStop = stop < 0 ? current.length + stop : stop;
    return current.slice(start, normalizedStop + 1);
  }

  async hset(key: string, values: Record<string, string>): Promise<number> {
    this.cleanExpired(key);
    const existing = this.hashes.get(key) ?? {};
    this.hashes.set(key, { ...existing, ...values });
    return Object.keys(values).length;
  }

  async hgetall(key: string): Promise<Record<string, string>> {
    this.cleanExpired(key);
    return { ...(this.hashes.get(key) ?? {}) };
  }

  async expire(key: string, seconds: number): Promise<number> {
    this.expirations.set(key, Date.now() + seconds * 1_000);
    return 1;
  }

  private cleanExpired(key: string): void {
    const expiresAt = this.expirations.get(key);
    if (expiresAt && expiresAt <= Date.now()) {
      this.expirations.delete(key);
      this.hashes.delete(key);
      this.lists.delete(key);
    }
  }
}

class PrismaCostStorage implements CostStorage {
  async insert(entry: CostEntry): Promise<void> {
    await db.llmRequest.upsert({
      where: { requestId: entry.requestId },
      create: {
        timestamp: entry.timestamp,
        provider: entry.provider,
        model: entry.model,
        feature: entry.feature,
        inputTokens: entry.inputTokens,
        outputTokens: entry.outputTokens,
        estimatedCost: entry.estimatedCost,
        latencyMs: entry.latencyMs ?? 0,
        success: entry.success ?? true,
        errorCode: entry.errorCode,
        fallbackUsed: entry.fallbackUsed ?? false,
        userId: entry.userId,
        requestId: entry.requestId,
      },
      update: {
        provider: entry.provider,
        model: entry.model,
        feature: entry.feature,
        inputTokens: entry.inputTokens,
        outputTokens: entry.outputTokens,
        estimatedCost: entry.estimatedCost,
        latencyMs: entry.latencyMs ?? 0,
        success: entry.success ?? true,
        errorCode: entry.errorCode,
        fallbackUsed: entry.fallbackUsed ?? false,
        userId: entry.userId,
      },
    });
  }

  async list(params: { provider?: Provider; start: Date; end: Date }): Promise<CostEntry[]> {
    const records = await db.llmRequest.findMany({
      where: {
        timestamp: {
          gte: params.start,
          lte: params.end,
        },
        ...(params.provider ? { provider: params.provider } : {}),
      },
      orderBy: { timestamp: 'asc' },
    });

    return records.map((record) => ({
      timestamp: record.timestamp,
      provider: record.provider as Provider,
      model: record.model,
      feature: record.feature,
      inputTokens: record.inputTokens,
      outputTokens: record.outputTokens,
      estimatedCost: record.estimatedCost,
      latencyMs: record.latencyMs,
      success: record.success,
      errorCode: record.errorCode ?? undefined,
      fallbackUsed: record.fallbackUsed,
      userId: record.userId ?? undefined,
      requestId: record.requestId,
    }));
  }
}

class ResilientCostStorage implements CostStorage {
  private warned = false;

  constructor(
    private readonly primary: CostStorage,
    private readonly fallback: CostStorage,
  ) {}

  async insert(entry: CostEntry): Promise<void> {
    try {
      await this.primary.insert(entry);
    } catch (error) {
      this.warn(error);
      await this.fallback.insert(entry);
    }
  }

  async list(params: { provider?: Provider; start: Date; end: Date }): Promise<CostEntry[]> {
    try {
      return await this.primary.list(params);
    } catch (error) {
      this.warn(error);
      return this.fallback.list(params);
    }
  }

  private warn(error: unknown): void {
    if (this.warned) {
      return;
    }

    this.warned = true;
    console.warn(
      '[LLM Service] Falling back to in-memory cost storage. ' +
      `Error: ${error instanceof Error ? error.message : String(error)}`
    );
  }
}

type SharedLLMRuntime = {
  logs: RequestLogEntry[];
  logger: (entry: RequestLogEntry) => void;
  rateLimitTracker: RateLimitTracker;
  requestQueue: RequestQueue;
  healthMonitor: HealthMonitor;
  fallbackHandler: FallbackHandler;
  costTracker: CostTracker;
  retryStrategy: RetryStrategy;
  loadBalancer: LoadBalancer;
};

declare global {
  var __studybuddyLLMRuntime: SharedLLMRuntime | undefined;
}

function buildEndpointOverrides(config: ProviderConfig): Record<string, Provider> | undefined {
  const overrides = config
    .getConfiguredFeatures()
    .map((feature) => {
      const provider = config.getEndpointOverride(feature);
      return provider ? [feature, provider] as const : null;
    })
    .filter((entry): entry is readonly [string, Provider] => entry !== null);

  return overrides.length > 0 ? Object.fromEntries(overrides) : undefined;
}

function createSharedLogger(logs: RequestLogEntry[]): (entry: RequestLogEntry) => void {
  return (entry) => {
    const snapshot: RequestLogEntry = {
      ...entry,
      startedAt: new Date(entry.startedAt),
      completedAt: entry.completedAt ? new Date(entry.completedAt) : undefined,
      error: entry.error ? sanitizeLogData(entry.error) : undefined,
    };

    logs.push(snapshot);
    if (logs.length > 1_000) {
      logs.splice(0, logs.length - 1_000);
    }
  };
}

function createSharedRuntime(): SharedLLMRuntime {
  const logs: RequestLogEntry[] = [];
  const logger = createSharedLogger(logs);
  const rateLimitTracker = new RateLimitTracker(new InMemoryCounterRedis(), DEFAULT_RATE_LIMIT_CONFIG);
  const requestQueue = new RequestQueue(new InMemoryQueueRedis());
  const healthMonitor = new HealthMonitor(new InMemoryHealthRedis());
  const fallbackHandler = new FallbackHandler(DEFAULT_FALLBACK_CONFIG);
  const costStorage = new ResilientCostStorage(new PrismaCostStorage(), new InMemoryCostStorage());
  const costTracker = new CostTracker(costStorage);
  const retryStrategy = new RetryStrategy(DEFAULT_RETRY_CONFIG);
  const loadBalancer = new LoadBalancer(rateLimitTracker, healthMonitor, DEFAULT_LOAD_BALANCER_CONFIG);

  return {
    logs,
    logger,
    rateLimitTracker,
    requestQueue,
    healthMonitor,
    fallbackHandler,
    costTracker,
    retryStrategy,
    loadBalancer,
  };
}

function getSharedRuntime(): SharedLLMRuntime {
  globalThis.__studybuddyLLMRuntime ??= createSharedRuntime();
  return globalThis.__studybuddyLLMRuntime;
}

export function createLLMRouter(timeout: number): LLMRouter {
  const config = ProviderConfig.load();
  const runtime = getSharedRuntime();

  return new LLMRouter(
    {
      primaryProvider: config.getPrimaryProvider(),
      fallbackProvider: config.getFallbackProvider(),
      enableFallback: config.isFallbackEnabled(),
      modelMapping: config.getModelMapping(),
      timeout,
      enableContentSizeRouting: config.isContentSizeRoutingEnabled(),
      contentSizeThreshold: config.getContentSizeThreshold(),
      migrationEnabled: config.isMigrationEnabled(),
      endpointOverrides: buildEndpointOverrides(config),
    },
    {
      rateLimitTracker: runtime.rateLimitTracker,
      requestQueue: runtime.requestQueue,
      healthMonitor: runtime.healthMonitor,
      fallbackHandler: runtime.fallbackHandler,
      costTracker: runtime.costTracker,
      retryStrategy: runtime.retryStrategy,
      loadBalancer: runtime.loadBalancer,
      logger: runtime.logger,
    },
  );
}

export function getLLMRequestLogs(): RequestLogEntry[] {
  return [...getSharedRuntime().logs];
}

export async function refreshLLMProviderHealth(): Promise<void> {
  const runtime = getSharedRuntime();
  await Promise.all([
    runtime.healthMonitor.checkHealth('groq'),
    runtime.healthMonitor.checkHealth('gemini'),
  ]);
}
