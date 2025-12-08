import { warmupConnection } from '@/lib/db';
import { NextResponse } from 'next/server';

// This endpoint is called by Vercel Cron every 4 minutes
// to keep the Neon database from auto-suspending
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
        const success = await warmupConnection();

        return NextResponse.json({
            status: success ? 'ok' : 'failed',
            timestamp: new Date().toISOString(),
            message: success ? 'Database connection warm' : 'Failed to warm connection'
        });
    } catch (error) {
        console.error('Keep-alive cron error:', error);
        return NextResponse.json({
            status: 'error',
            timestamp: new Date().toISOString(),
            message: 'Database keep-alive failed'
        }, { status: 500 });
    }
}

// Vercel Cron configuration
export const runtime = 'nodejs';
export const maxDuration = 10; // 10 second timeout
