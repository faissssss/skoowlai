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
  if (!expected) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  const url = new URL(req.url);
  const provided = req.headers.get('x-debug-secret') || url.searchParams.get('secret');
  if (provided !== expected) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  return null;
}
