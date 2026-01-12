/**
 * CSRF Protection Utility
 * 
 * Provides origin checking for state-changing API routes.
 * Works alongside Clerk's SameSite cookies for defense in depth.
 */

import { NextRequest, NextResponse } from 'next/server';

// Allowed origins for your application
const ALLOWED_ORIGINS = [
    'https://skoowlai.com',
    'https://www.skoowlai.com',
    process.env.NEXT_PUBLIC_APP_URL,
].filter(Boolean) as string[];

// Add localhost for development
if (process.env.NODE_ENV === 'development') {
    ALLOWED_ORIGINS.push('http://localhost:3000');
}

/**
 * Validates that the request origin matches allowed origins.
 * Call this at the start of any state-changing API route (POST, PUT, DELETE).
 * 
 * @param req The Next.js request object
 * @returns null if valid, NextResponse with 403 if invalid
 */
export function checkCsrfOrigin(req: NextRequest): NextResponse | null {
    const origin = req.headers.get('origin');
    const referer = req.headers.get('referer');

    // If origin header exists, validate it
    if (origin) {
        if (!ALLOWED_ORIGINS.includes(origin)) {
            console.warn(`⚠️ CSRF: Blocked request from origin: ${origin}`);
            return NextResponse.json(
                { error: 'Forbidden' },
                { status: 403 }
            );
        }
        return null; // Valid
    }

    // Fallback to referer check (some browsers don't send origin for same-origin)
    if (referer) {
        const refererUrl = new URL(referer);
        const refererOrigin = refererUrl.origin;
        if (!ALLOWED_ORIGINS.includes(refererOrigin)) {
            console.warn(`⚠️ CSRF: Blocked request from referer: ${refererOrigin}`);
            return NextResponse.json(
                { error: 'Forbidden' },
                { status: 403 }
            );
        }
        return null; // Valid
    }

    // No origin or referer - could be legitimate server-to-server or API call
    // For maximum security, you could block these too, but it may break webhooks
    // Clerk's session cookies (SameSite=Lax) provide baseline protection
    return null;
}

/**
 * Type-safe wrapper for API routes that need CSRF protection.
 * 
 * @example
 * export const POST = withCsrfProtection(async (req) => {
 *     // Your handler logic
 *     return NextResponse.json({ success: true });
 * });
 */
export function withCsrfProtection(
    handler: (req: NextRequest) => Promise<NextResponse>
): (req: NextRequest) => Promise<NextResponse> {
    return async (req: NextRequest) => {
        const csrfError = checkCsrfOrigin(req);
        if (csrfError) return csrfError;
        return handler(req);
    };
}
