import { Ratelimit } from '@upstash/ratelimit';
import { Redis } from '@upstash/redis';
import { NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';

// Create Redis client (optional - only if env vars are set)
const redis = process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN
    ? new Redis({
        url: process.env.UPSTASH_REDIS_REST_URL,
        token: process.env.UPSTASH_REDIS_REST_TOKEN,
    })
    : null;

// Rate limiter: 30 requests per 60 seconds (sliding window)
// More generous for public usage while still preventing abuse
export const ratelimit = redis
    ? new Ratelimit({
        redis,
        limiter: Ratelimit.slidingWindow(30, '60 s'),
        analytics: true,
        prefix: '@upstash/ratelimit',
    })
    : null;

/**
 * Get rate limit identifier - prefers User ID over IP for authenticated users
 * This allows multiple users on the same network to use the app independently
 */
export async function getRateLimitIdentifier(req: Request): Promise<string> {
    try {
        const { userId } = await auth();
        if (userId) {
            return `user:${userId}`;
        }
    } catch {
        // Auth not available, fall back to IP
    }

    // Fallback to IP for unauthenticated requests
    const forwarded = req.headers.get('x-forwarded-for');
    const realIp = req.headers.get('x-real-ip');
    return `ip:${forwarded?.split(',')[0] || realIp || 'anonymous'}`;
}

/**
 * Check rate limit for a given identifier (user ID or IP address)
 * Returns null if rate limiting is not configured or if under limit.
 * Returns a NextResponse with 429 status if rate limited.
 */
export async function checkRateLimit(identifier: string): Promise<NextResponse | null> {
    if (!ratelimit) {
        // Rate limiting not configured, allow request
        return null;
    }

    const { success, limit, reset, remaining } = await ratelimit.limit(identifier);

    if (!success) {
        return NextResponse.json(
            {
                error: 'Too many requests',
                details: 'You\'re making requests too quickly. Please wait a moment and try again.',
                retryAfter: Math.ceil((reset - Date.now()) / 1000),
            },
            {
                status: 429,
                headers: {
                    'X-RateLimit-Limit': limit.toString(),
                    'X-RateLimit-Remaining': remaining.toString(),
                    'X-RateLimit-Reset': reset.toString(),
                    'Retry-After': Math.ceil((reset - Date.now()) / 1000).toString(),
                },
            }
        );
    }

    return null;
}

/**
 * Convenience function that gets identifier from request and checks rate limit
 */
export async function checkRateLimitFromRequest(req: Request): Promise<NextResponse | null> {
    const identifier = await getRateLimitIdentifier(req);
    return checkRateLimit(identifier);
}
