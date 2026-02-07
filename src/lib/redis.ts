import { Redis } from '@upstash/redis';

function createRedisClient() {
    const url = process.env.UPSTASH_REDIS_REST_URL?.trim();
    const token = process.env.UPSTASH_REDIS_REST_TOKEN?.trim();

    if (!url || !token) {
        console.warn('⚠️ Upstash Redis not configured - rate limiting disabled');
        return null;
    }

    // Validate URL format
    if (!url.startsWith('https://')) {
        console.error('❌ Invalid UPSTASH_REDIS_REST_URL - must start with https://');
        return null;
    }

    return new Redis({ url, token });
}

export const redis = createRedisClient();

/**
 * Check if Redis connection is healthy
 */
export async function checkRedisHealth(): Promise<boolean> {
    if (!redis) return false;
    
    try {
        await redis.ping();
        return true;
    } catch (error) {
        console.error('❌ Redis health check failed:', error);
        return false;
    }
}
