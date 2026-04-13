/**
 * Startup Configuration Validator
 * 
 * Validates security-critical environment variables at application startup.
 * Logs warnings for missing or suspicious configuration.
 */

export interface StartupValidation {
  valid: boolean;
  warnings: string[];
  errors: string[];
}

/**
 * Validates security-critical environment variables.
 * 
 * Checks:
 * - All required secrets are present
 * - No NEXT_PUBLIC_ variables contain secret patterns
 * - Admin user IDs are configured (not placeholder values)
 * - Database URL is not using default/example values
 * 
 * @returns Validation result with warnings and errors
 */
export function validateSecurityConfig(): StartupValidation {
  const warnings: string[] = [];
  const errors: string[] = [];

  // Required server-only secrets
  const requiredSecrets = [
    'CLERK_SECRET_KEY',
    'DATABASE_URL',
    'GROQ_API_KEY',
  ];

  // Optional but recommended secrets
  const recommendedSecrets = [
    'CRON_SECRET',
    'DEEPGRAM_API_KEY',
    'GOOGLE_GENERATIVE_AI_API_KEY',
    'RESEND_API_KEY',
    'UPSTASH_REDIS_REST_TOKEN',
  ];

  // Check required secrets
  for (const secret of requiredSecrets) {
    if (!process.env[secret]) {
      errors.push(`Missing required secret: ${secret}`);
    }
  }

  // Check recommended secrets
  for (const secret of recommendedSecrets) {
    if (!process.env[secret]) {
      warnings.push(`Missing recommended secret: ${secret}`);
    }
  }

  // Check CRON_SECRET specifically (critical for cron endpoint security)
  if (!process.env.CRON_SECRET) {
    warnings.push('CRON_SECRET not configured - cron endpoints will return HTTP 503');
  }

  // Check for placeholder admin IDs
  const adminUserIds = process.env.ADMIN_USER_IDS;
  if (adminUserIds) {
    if (adminUserIds.includes('user_2abc123') || adminUserIds.includes('placeholder')) {
      warnings.push('ADMIN_USER_IDS contains placeholder values - update with real Clerk user IDs');
    }
  } else {
    warnings.push('ADMIN_USER_IDS not configured - admin endpoints will only work in development mode');
  }

  // Check for default/example database URLs
  const databaseUrl = process.env.DATABASE_URL;
  if (databaseUrl) {
    if (
      databaseUrl.includes('example.com') ||
      databaseUrl.includes('localhost') ||
      databaseUrl.includes('127.0.0.1')
    ) {
      warnings.push('DATABASE_URL appears to be using a local or example value');
    }
  }

  // Check for secrets in NEXT_PUBLIC_ variables (security risk)
  const secretPatterns = [
    /gsk_/i,
    /sk_test_/i,
    /sk_live_/i,
    /re_[a-zA-Z0-9]{24}/i,
    /AIzaSy/i,
    /whsec_/i,
  ];

  for (const [key, value] of Object.entries(process.env)) {
    if (key.startsWith('NEXT_PUBLIC_') && value) {
      for (const pattern of secretPatterns) {
        if (pattern.test(value)) {
          errors.push(`NEXT_PUBLIC_ variable ${key} contains a secret pattern - this will be exposed to clients!`);
        }
      }
    }
  }

  const valid = errors.length === 0;

  return {
    valid,
    warnings,
    errors,
  };
}

/**
 * Logs startup validation results to console.
 * Should be called at application startup.
 */
export function logStartupValidation(): void {
  const result = validateSecurityConfig();

  if (result.errors.length > 0) {
    console.error('❌ [Security] Startup validation failed:');
    result.errors.forEach(error => console.error(`   - ${error}`));
  }

  if (result.warnings.length > 0) {
    console.warn('⚠️  [Security] Startup validation warnings:');
    result.warnings.forEach(warning => console.warn(`   - ${warning}`));
  }

  if (result.valid && result.warnings.length === 0) {
    console.info('✅ [Security] Startup validation passed');
  }
}
