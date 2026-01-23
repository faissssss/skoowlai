/**
 * CSRF Protection Utility
 *
 * Provides origin checking for state-changing API routes.
 * Works alongside Clerk's SameSite cookies for defense in depth.
 */

import { NextRequest, NextResponse } from 'next/server';

// Static first-party origins
const BASE_ALLOWED = [
  'https://skoowlai.com',
  'https://www.skoowlai.com',
].filter(Boolean) as string[];

// Env-configured origins (comma separated supported)
const ENV_ALLOWED = [
  process.env.NEXT_PUBLIC_APP_URL,
  process.env.APP_URL,
  process.env.NEXT_PUBLIC_SITE_URL,
  process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : undefined,
  process.env.NEXT_PUBLIC_VERCEL_URL ? `https://${process.env.NEXT_PUBLIC_VERCEL_URL}` : undefined,
  process.env.CSRF_ALLOWED_ORIGINS, // e.g. "https://beta.skoowlai.com,https://app.skoowlai.com"
]
  .filter(Boolean)
  .flatMap((v) => String(v).split(','))
  .map((v) => v.trim())
  .filter(Boolean) as string[];

// Dev/local allowances
const DEV_ALLOWED = (process.env.NODE_ENV === 'development'
  ? ['http://localhost:3000', 'http://127.0.0.1:3000', 'http://localhost:5173']
  : []) as string[];

// Combine unique allowed origins
const ALLOWED_ORIGINS: string[] = Array.from(
  new Set([...BASE_ALLOWED, ...ENV_ALLOWED, ...DEV_ALLOWED])
);

// Allow any first-party subdomain under skoowlai.com in production
function isOwnedSubdomain(origin: string): boolean {
  try {
    const u = new URL(origin);
    const host = u.hostname.toLowerCase();
    if (host === 'skoowlai.com' || host.endsWith('.skoowlai.com')) {
      // Require HTTPS for prod subdomains, allow HTTP in dev
      return u.protocol === 'https:' || process.env.NODE_ENV === 'development';
    }
    return false;
  } catch {
    return false;
  }
}

function isAllowedOrigin(origin: string): boolean {
  if (!origin) return false;
  if (ALLOWED_ORIGINS.includes(origin)) return true;
  if (isOwnedSubdomain(origin)) return true;
  return false;
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

  // Derive the server origin (supports proxies)
  let serverOrigin = '';
  try {
    const xfProto = req.headers.get('x-forwarded-proto');
    const xfHost = req.headers.get('x-forwarded-host') || req.headers.get('host');
    if (xfProto && xfHost) {
      serverOrigin = `${xfProto}://${xfHost}`;
    } else {
      serverOrigin = req.nextUrl.origin;
    }
  } catch {
    serverOrigin = '';
  }

  // If origin header exists, validate it (allow exact same-origin fast-path)
  if (origin) {
    if (origin === serverOrigin || isAllowedOrigin(origin)) {
      return null; // Valid
    }
    console.warn(`⚠️ CSRF: Blocked request from origin: ${origin}`);
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  // Fallback to referer check (some browsers don't send origin for same-origin)
  if (referer) {
    try {
      const refererOrigin = new URL(referer).origin;
      if (refererOrigin === serverOrigin || isAllowedOrigin(refererOrigin)) {
        return null; // Valid
      }
      console.warn(`⚠️ CSRF: Blocked request from referer: ${refererOrigin}`);
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    } catch {
      console.warn(`⚠️ CSRF: Invalid referer header value: ${referer}`);
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
  }

  // No origin or referer - could be legitimate same-site request or server-to-server call
  // Rely on SameSite cookies for baseline protection.
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
