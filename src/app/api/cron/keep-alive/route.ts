import { warmupConnection } from '@/lib/db';
import { checkRedisHealth } from '@/lib/redis';
import { NextResponse } from 'next/server';

// This endpoint is called by Vercel Cron every 4 minutes
// to keep both Neon database and Upstash Redis from auto-suspending
export async function GET(request: Request) {
    // Verify the request is from Vercel Cron (security)
    const authHeader = request.headers.get('authorization');
    if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
        // In development, allow without auth
        if (process.env.NODE_ENV === 'production') {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }
    }

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
