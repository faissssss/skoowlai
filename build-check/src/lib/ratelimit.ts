import { Ratelimit } from '@upstash/ratelimit';
import { redis } from './redis';
import { NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';

// Rate limiter map to store limiters with different configurations
const limiters = new Map<string, Ratelimit>();

const cache = new Map(); // Local in-memory cache for fallback

/**
 * Get or create a rate limiter with specific configuration
 */
function getRatelimit(requests: number, duration: string): Ratelimit | null {
    if (!redis) return null;

    const key = `${requests}_${duration}`;
    if (!limiters.has(key)) {
        limiters.set(key, new Ratelimit({
            redis,
            limiter: Ratelimit.slidingWindow(requests, duration as `${number} s` | `${number} m` | `${number} h` | `${number} d`),
            analytics: false, // Disabled to reduce API usage
            prefix: `@upstash/ratelimit/${key}`,
            ephemeralCache: cache,
        }));
    }
    return limiters.get(key)!;
}

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
 * 
 * @param identifier Unique identifier for the user/IP
 * @param requests Number of requests allowed (default: 30)
 * @param duration Duration string e.g. "60 s" (default: "60 s")
 */
export async function checkRateLimit(
    identifier: string,
    requests: number = 30,
    duration: string = '60 s'
): Promise<NextResponse | null> {
    const limiter = getRatelimit(requests, duration);

    if (!limiter) {
        // Rate limiting not configured
        if (process.env.NODE_ENV === 'production') {
            return NextResponse.json(
                { error: 'Rate limiting unavailable' },
                { status: 503 }
            );
        }
        return null;
    }

    try {
        const { success, limit, reset, remaining } = await limiter.limit(identifier);

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
    } catch (error) {
        console.error('❌ Redis rate limit check failed:', error);
        // Graceful degradation: allow request when Redis fails
        return null;
    }

    return null;
}

/**
 * Convenience function that gets identifier from request and checks rate limit
 * 
 * @param req The NextRequest object
 * @param requests Number of requests allowed (default: 30)
 * @param duration Duration string e.g. "60 s" (default: "60 s")
 */
export async function checkRateLimitFromRequest(
    req: Request,
    requests: number = 30,
    duration: string = '60 s'
): Promise<NextResponse | null> {
    const identifier = await getRateLimitIdentifier(req);
    return checkRateLimit(identifier, requests, duration);
}
