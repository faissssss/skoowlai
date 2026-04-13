/**
 * Server-Only Module Guard
 * 
 * This module imports 'server-only' to trigger build errors if imported in Client Components.
 * Use this module to safely retrieve server-side secrets and environment variables.
 */
import 'server-only';

/**
 * Safely retrieves a server-side secret from environment variables.
 * 
 * @param key - The environment variable name
 * @returns The secret value
 * @throws Error if the secret is not configured
 * 
 * @example
 * ```typescript
 * // ✅ Safe: Server Component or API Route
 * import { getServerSecret } from '@/lib/server-only-check';
 * const apiKey = getServerSecret('GROQ_API_KEY');
 * 
 * // ❌ Build Error: Client Component
 * 'use client';
 * import { getServerSecret } from '@/lib/server-only-check';
 * // Error: Cannot import server-only module in Client Component
 * ```
 */
export function getServerSecret(key: string): string {
  const value = process.env[key];
  
  if (!value) {
    throw new Error(`Missing required secret: ${key}`);
  }
  
  return value;
}
