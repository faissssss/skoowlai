import { warmupConnection } from '@/lib/db';
import { checkRedisHealth } from '@/lib/redis';
import { NextResponse } from 'next/server';
import { verifyCronAuth } from '@/lib/cron-auth';

// This endpoint is called by Vercel Cron every 4 minutes
// to keep both Neon database and Upstash Redis from auto-suspending
export async function GET(request: Request) {
    // SECURITY: Verify cron authentication (enforced in ALL environments)
    const auth = verifyCronAuth(request);
    if (!auth.authorized) return auth.response;

    try {
        // Warm up both database and Redis connections
        const [dbSuccess, redisSuccess] = await Promise.all([
            warmupConnection(),
            checkRedisHealth()
        ]);

        const allHealthy = dbSuccess && redisSuccess;

        return NextResponse.json({
            status: allHealthy ? 'ok' : 'partial',
            timestamp: new Date().toISOString(),
            services: {
                database: dbSuccess ? 'healthy' : 'failed',
                redis: redisSuccess ? 'healthy' : 'failed'
            },
            message: allHealthy
                ? 'All connections warm'
                : `Some services failed: DB=${dbSuccess}, Redis=${redisSuccess}`
        });
    } catch (error) {
        console.error('Keep-alive cron error:', error);
        return NextResponse.json({
            status: 'error',
            timestamp: new Date().toISOString(),
            message: 'Keep-alive failed'
        }, { status: 500 });
    }
}

// Vercel Cron configuration
export const runtime = 'nodejs';
export const maxDuration = 10; // 10 second timeout
