import { NextResponse } from 'next/server';

console.log('🟢 [TEST-REWRITE-HEALTH] Module loaded');

/**
 * Test endpoint for debugging Next.js rewrites
 * SECURITY: Only accessible in development mode
 */
export async function GET() {
    // SECURITY: Block in production
    if (process.env.NODE_ENV === 'production') {
        return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }
    
    console.log('🔵 [TEST-REWRITE-HEALTH] GET called');
    
    return NextResponse.json({
        status: 'ok',
        message: 'Test endpoint is working',
        timestamp: new Date().toISOString(),
    });
}

export async function POST() {
    // SECURITY: Block in production
    if (process.env.NODE_ENV === 'production') {
        return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }
    
    console.log('🔵 [TEST-REWRITE-HEALTH] POST called');
    
    return NextResponse.json({
        status: 'ok',
        message: 'POST endpoint is working',
        timestamp: new Date().toISOString(),
    });
}
