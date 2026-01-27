import { NextResponse } from 'next/server';
import { IS_PRE_LAUNCH, DISABLE_PAYMENTS } from '@/lib/config';

// Lightweight health/config endpoint for billing-related services.
// Useful for verifying environment before enabling payments in production.

export async function GET() {
  const env = process.env;

  const checks = {
    dodoApiKeyPresent: Boolean(env.DODO_PAYMENTS_API_KEY),
    dodoEnvironment: (env.DODO_PAYMENTS_ENVIRONMENT || 'live_mode').trim(),
    dodoWebhookSecretPresent: Boolean(
      env.DODO_PAYMENTS_WEBHOOK_KEY ||
        env.DODO_PAYMENTS_WEBHOOK_SECRET ||
        env.DODO_WEBHOOK_SECRET,
    ),
    dodoProductIds: {
      monthly: Boolean(env.NEXT_PUBLIC_DODO_MONTHLY_PRODUCT_ID),
      yearly: Boolean(env.NEXT_PUBLIC_DODO_YEARLY_PRODUCT_ID),
      monthlyNoTrial: Boolean(env.NEXT_PUBLIC_DODO_MONTHLY_NO_TRIAL_PRODUCT_ID),
      yearlyNoTrial: Boolean(env.NEXT_PUBLIC_DODO_YEARLY_NO_TRIAL_PRODUCT_ID),
      studentMonthly: Boolean(env.NEXT_PUBLIC_DODO_STUDENT_MONTHLY_PRODUCT_ID),
      studentYearly: Boolean(env.NEXT_PUBLIC_DODO_STUDENT_YEARLY_PRODUCT_ID),
    },
    resendApiKeyPresent: Boolean(env.RESEND_API_KEY),
    cronSecretPresent: Boolean(env.CRON_SECRET),
    isPreLaunch: IS_PRE_LAUNCH,
    paymentsDisabled: DISABLE_PAYMENTS,
  };

  const allCriticalOk =
    checks.dodoApiKeyPresent &&
    checks.dodoWebhookSecretPresent &&
    checks.resendApiKeyPresent &&
    (!DISABLE_PAYMENTS || IS_PRE_LAUNCH);

  return NextResponse.json(
    {
      ok: allCriticalOk,
      checks,
    },
    { status: allCriticalOk ? 200 : 500 },
  );
}

