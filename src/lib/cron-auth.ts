/**
 * Cron Authentication Middleware
 * 
 * Centralized authentication for all cron job endpoints.
 * SECURITY: Enforces CRON_SECRET validation consistently across all environments.
 */

import { NextResponse } from 'next/server';

export interface CronAuthResult {
  authorized: boolean;
  response?: NextResponse;
}

/**
 * Verify cron job authentication
 * 
 * SECURITY REQUIREMENTS:
 * - MUST check Authorization header (NOT query parameters - they get logged)
 * - MUST enforce in ALL environments (dev, staging, production)
 * - MUST fail secure (deny if CRON_SECRET not configured)
 * 
 * @param req - Request object
 * @returns Authorization result
 */
export function verifyCronAuth(req: Request): CronAuthResult {
  const cronSecret = process.env.CRON_SECRET;

  // Fail secure: missing secret = deny all cron access
  if (!cronSecret) {
    console.error('[Security] CRON_SECRET not configured - denying cron access');
    return {
      authorized: false,
      response: NextResponse.json(
        { error: 'Service unavailable - cron authentication not configured' },
        { status: 503 }
      ),
    };
  }

  const authHeader = req.headers.get('authorization');
  const expectedHeader = `Bearer ${cronSecret}`;

  if (authHeader !== expectedHeader) {
    // Log authentication failure for audit
    console.warn('[Security] Failed cron auth attempt', {
      timestamp: new Date().toISOString(),
      hasAuthHeader: !!authHeader,
      url: new URL(req.url).pathname,
    });
    
    return {
      authorized: false,
      response: NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      ),
    };
  }

  return { authorized: true };
}
