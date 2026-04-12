import { NextResponse } from 'next/server';

console.log('🟢 [TEST-REWRITE-HEALTH] Module loaded');

export async function GET() {
    console.log('🔵 [TEST-REWRITE-HEALTH] GET called');
    
    return NextResponse.json({
        status: 'ok',
        message: 'Test endpoint is working',
        timestamp: new Date().toISOString(),
    });
}

export async function POST() {
    console.log('🔵 [TEST-REWRITE-HEALTH] POST called');
    
    return NextResponse.json({
        status: 'ok',
        message: 'POST endpoint is working',
        timestamp: new Date().toISOString(),
    });
}
