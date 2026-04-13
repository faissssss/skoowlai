import { auth } from '@clerk/nextjs/server';
import { NextResponse } from 'next/server';

function getAdminIds(): string[] {
  return (process.env.ADMIN_USER_IDS || '')
    .split(',')
    .map((v) => v.trim())
    .filter(Boolean);
}

export async function requireAdmin() {
  const { userId } = await auth();
  if (!userId) {
    return { ok: false, response: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) };
  }

  const admins = getAdminIds();
  if (!admins.includes(userId)) {
    return { ok: false, response: NextResponse.json({ error: 'Forbidden' }, { status: 403 }) };
  }

  return { ok: true, userId };
}

export function requireDebugSecret(req: Request, envVarName: string) {
  const expected = process.env[envVarName];
  
  // Fail secure: missing secret = deny access
  if (!expected) {
    console.warn(`[Security] ${envVarName} not configured - denying access`);
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  // SECURITY: Only accept header-based authentication (NOT query parameters)
  // Query parameters get logged in web server access logs, making them insecure for secrets
  const provided = req.headers.get('x-debug-secret');
  
  if (provided !== expected) {
    // Log authentication failure for audit
    console.warn(`[Security] Failed debug auth attempt for ${envVarName}`, {
      timestamp: new Date().toISOString(),
      hasHeader: !!provided,
    });
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  return null;
}
