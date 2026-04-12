import { randomUUID } from 'node:crypto';

import type { Priority } from './config';

export interface QueueRedisLike {
  get(key: string): Promise<string | null>;
  set(key: string, value: string): Promise<'OK' | string | null>;
  zadd(key: string, score: number, member: string): Promise<number>;
  zrange(key: string, start: number, stop: number): Promise<string[]>;
  zrem(key: string, member: string): Promise<number>;
  zcard(key: string): Promise<number>;
}

export interface QueuedRequestInput {
  feature: string;
  priority: Priority;
  params: unknown;
}

export interface QueuedRequest {
  id: string;
  feature: string;
  priority: Priority;
  params: unknown;
  enqueuedAt: Date;
  expiresAt: Date;
}

export interface QueueStatus {
  depth: number;
  byPriority: Record<Priority, number>;
  oldestRequest: Date | null;
  estimatedWaitMs: number;
}

export interface RequestQueueOptions {
  now?: () => Date;
  prefix?: string;
}

interface StoredQueuedRequest {
  id: string;
  feature: string;
  priority: Priority;
  params: unknown;
  enqueuedAt: number;
  expiresAt: number;
}

export class QueueFullError extends Error {
  constructor(public readonly maxSize: number) {
    super(`Request queue is full (max size ${maxSize})`);
    this.name = 'QueueFullError';
  }
}

export class RequestQueue {
  private readonly now: () => Date;
  private readonly prefix: string;
  private sequence = 0;

  constructor(
    private readonly redis: QueueRedisLike,
    private readonly maxSize = 100,
    private readonly expirationMs = 30_000,
    options: RequestQueueOptions = {},
  ) {
    this.now = options.now ?? (() => new Date());
    this.prefix = options.prefix ?? 'queue:requests';
  }

  async enqueue(request: QueuedRequestInput): Promise<QueuedRequest> {
    await this.cleanExpired();

    const currentDepth = await this.getDepth();
    if (currentDepth >= this.maxSize) {
      throw new QueueFullError(this.maxSize);
    }

    const now = this.now();
    const stored: StoredQueuedRequest = {
      id: randomUUID(),
      feature: request.feature,
      priority: request.priority,
      params: request.params,
      enqueuedAt: now.getTime(),
      expiresAt: now.getTime() + this.expirationMs,
    };

    await this.redis.zadd(
      this.getPriorityKey(request.priority),
      this.getScore(now),
      JSON.stringify(stored),
    );

    return this.deserialize(stored);
  }

  async dequeue(): Promise<QueuedRequest | null> {
    const removed = await this.cleanExpired();
    void removed;

    const byPriority = await this.getPriorityDepths();
    const highStreak = await this.getHighStreak();
    const selectedPriority = this.selectPriority(byPriority, highStreak);

    if (!selectedPriority) {
      return null;
    }

    const [member] = await this.redis.zrange(this.getPriorityKey(selectedPriority), 0, 0);
    if (!member) {
      return null;
    }

    await this.redis.zrem(this.getPriorityKey(selectedPriority), member);
    await this.setHighStreak(selectedPriority === 'high' ? highStreak + 1 : selectedPriority === 'low' ? 0 : highStreak);

    const parsed = this.parseMember(member);
    if (parsed.expiresAt <= this.now().getTime()) {
      return this.dequeue();
    }

    return this.deserialize(parsed);
  }

  async getStatus(): Promise<QueueStatus> {
    await this.cleanExpired();

    const byPriority = await this.getPriorityDepths();
    const depth = byPriority.high + byPriority.medium + byPriority.low;
    const oldestRequest = await this.getOldestRequest();

    return {
      depth,
      byPriority,
      oldestRequest,
      estimatedWaitMs: depth === 0 ? 0 : Math.min(depth * 1_000, this.expirationMs),
    };
  }

  async cleanExpired(): Promise<number> {
    let removed = 0;
    const nowMs = this.now().getTime();

    for (const priority of this.getPriorityOrder()) {
      const key = this.getPriorityKey(priority);
      const members = await this.redis.zrange(key, 0, -1);

      for (const member of members) {
        const parsed = this.parseMember(member);
        if (parsed.expiresAt <= nowMs) {
          removed += await this.redis.zrem(key, member);
        }
      }
    }

    return removed;
  }

  async getPosition(requestId: string): Promise<number | null> {
    await this.cleanExpired();

    const byPriority = await this.loadQueues();
    let highStreak = await this.getHighStreak();
    let position = 1;

    while (byPriority.high.length > 0 || byPriority.medium.length > 0 || byPriority.low.length > 0) {
      const selectedPriority = this.selectPriority(
        {
          high: byPriority.high.length,
          medium: byPriority.medium.length,
          low: byPriority.low.length,
        },
        highStreak,
      );

      if (!selectedPriority) {
        return null;
      }

      const next = byPriority[selectedPriority].shift();
      if (!next) {
        return null;
      }

      if (next.id === requestId) {
        return position;
      }

      if (selectedPriority === 'high') {
        highStreak += 1;
        position += 1;
        continue;
      }

      if (selectedPriority === 'low') {
        highStreak = 0;
      }

      position += 1;
    }

    return null;
  }

  private async getDepth(): Promise<number> {
    const byPriority = await this.getPriorityDepths();
    return byPriority.high + byPriority.medium + byPriority.low;
  }

  private async getPriorityDepths(): Promise<Record<Priority, number>> {
    const [high, medium, low] = await Promise.all([
      this.redis.zcard(this.getPriorityKey('high')),
      this.redis.zcard(this.getPriorityKey('medium')),
      this.redis.zcard(this.getPriorityKey('low')),
    ]);

    return { high, medium, low };
  }

  private async getOldestRequest(): Promise<Date | null> {
    const members = await Promise.all(
      this.getPriorityOrder().map(async (priority) => {
        const [member] = await this.redis.zrange(this.getPriorityKey(priority), 0, 0);
        return member ? this.parseMember(member) : null;
      }),
    );

    const oldest = members
      .filter((member): member is StoredQueuedRequest => member !== null)
      .sort((left, right) => left.enqueuedAt - right.enqueuedAt)[0];

    return oldest ? new Date(oldest.enqueuedAt) : null;
  }

  private async loadQueues(): Promise<Record<Priority, StoredQueuedRequest[]>> {
    const [high, medium, low] = await Promise.all(
      this.getPriorityOrder().map(async (priority) => {
        const members = await this.redis.zrange(this.getPriorityKey(priority), 0, -1);
        return members.map((member) => this.parseMember(member));
      }),
    );

    return { high, medium, low };
  }

  private selectPriority(
    byPriority: Record<Priority, number>,
    highStreak: number,
  ): Priority | null {
    if (byPriority.high > 0) {
      if (byPriority.low > 0 && highStreak >= 10) {
        return 'low';
      }
      return 'high';
    }

    if (byPriority.medium > 0) {
      return 'medium';
    }

    if (byPriority.low > 0) {
      return 'low';
    }

    return null;
  }

  private parseMember(member: string): StoredQueuedRequest {
    return JSON.parse(member) as StoredQueuedRequest;
  }

  private deserialize(request: StoredQueuedRequest): QueuedRequest {
    return {
      ...request,
      enqueuedAt: new Date(request.enqueuedAt),
      expiresAt: new Date(request.expiresAt),
    };
  }

  private getPriorityKey(priority: Priority): string {
    return `${this.prefix}:${priority}`;
  }

  private getHighStreakKey(): string {
    return `${this.prefix}:state:highStreak`;
  }

  private async getHighStreak(): Promise<number> {
    const raw = await this.redis.get(this.getHighStreakKey());
    if (!raw) {
      return 0;
    }

    const parsed = Number.parseInt(raw, 10);
    return Number.isFinite(parsed) ? parsed : 0;
  }

  private async setHighStreak(value: number): Promise<void> {
    await this.redis.set(this.getHighStreakKey(), String(value));
  }

  private getPriorityOrder(): Priority[] {
    return ['high', 'medium', 'low'];
  }

  private getScore(now: Date): number {
    const base = now.getTime() * 1_000;
    const score = base + this.sequence;
    this.sequence = (this.sequence + 1) % 1_000;
    return score;
  }
}
