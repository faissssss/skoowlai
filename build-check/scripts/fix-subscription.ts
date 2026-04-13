/**
 * Manual Subscription Fix Script
 * 
 * This script manually activates a subscription in the database when webhooks fail.
 * Use this ONLY when a payment succeeded in Dodo but the webhook didn't process.
 * 
 * Usage:
 * 1. Get subscription details from Dodo Payments dashboard
 * 2. Update the variables below
 * 3. Run: npx tsx scripts/fix-subscription.ts
 */

import { PrismaClient } from '@prisma/client';
import { sendWelcomeEmail } from '../src/lib/email';

const prisma = new PrismaClient();

// ========================================
// UPDATE THESE VALUES FROM ENV OR CLI ARGS
// ========================================
const USER_EMAIL = process.env.FIX_SUBSCRIPTION_EMAIL || process.argv[2];
const SUBSCRIPTION_ID = process.env.FIX_SUBSCRIPTION_ID || process.argv[3];
const CUSTOMER_ID = process.env.FIX_SUBSCRIPTION_CUSTOMER_ID || process.argv[4];
const SUBSCRIPTION_PLAN = process.env.FIX_SUBSCRIPTION_PLAN || process.argv[5] || 'monthly'; // or 'yearly'
const NEXT_BILLING_DATE_STR = process.env.FIX_SUBSCRIPTION_NEXT_BILLING || process.argv[6];

// Validate required arguments
if (!USER_EMAIL || !SUBSCRIPTION_ID || !CUSTOMER_ID || !NEXT_BILLING_DATE_STR) {
    console.error('❌ Missing required arguments');
    console.log('\nUsage:');
    console.log('  npx tsx scripts/fix-subscription.ts <email> <subscription_id> <customer_id> <plan> <next_billing_date>');
    console.log('\nOr set environment variables:');
    console.log('  FIX_SUBSCRIPTION_EMAIL=user@example.com');
    console.log('  FIX_SUBSCRIPTION_ID=sub_xxx');
    console.log('  FIX_SUBSCRIPTION_CUSTOMER_ID=cus_xxx');
    console.log('  FIX_SUBSCRIPTION_PLAN=monthly');
    console.log('  FIX_SUBSCRIPTION_NEXT_BILLING=2026-01-20T05:39:00Z');
    console.log('  npx tsx scripts/fix-subscription.ts');
    process.exit(1);
}

const NEXT_BILLING_DATE = new Date(NEXT_BILLING_DATE_STR);

async function fixSubscription() {
    try {
        console.log('🔍 Looking for user:', USER_EMAIL);

        // Find the user
        const user = await prisma.user.findFirst({
            where: { email: USER_EMAIL }
        });

        if (!user) {
            console.error('❌ User not found with email:', USER_EMAIL);
            return;
        }

        console.log('✅ User found:', user.id);

        // Check current subscription status
        console.log('📊 Current subscription status:', {
            status: user.subscriptionStatus,
            plan: user.subscriptionPlan,
            subscriptionId: user.subscriptionId,
            endsAt: user.subscriptionEndsAt,
        });

        // Update subscription
        console.log('🔄 Updating subscription...');
        const updated = await prisma.user.update({
            where: { id: user.id },
            data: {
                subscriptionStatus: 'active',
                subscriptionPlan: SUBSCRIPTION_PLAN,
                subscriptionId: SUBSCRIPTION_ID,
                customerId: CUSTOMER_ID,
                subscriptionEndsAt: NEXT_BILLING_DATE,
            }
        });

        console.log('✅ Subscription updated successfully!');
        console.log('📊 New subscription status:', {
            status: updated.subscriptionStatus,
            plan: updated.subscriptionPlan,
            subscriptionId: updated.subscriptionId,
            endsAt: updated.subscriptionEndsAt,
        });

        // Send welcome email
        console.log('📧 Sending welcome email...');
        try {
            await sendWelcomeEmail({
                email: USER_EMAIL,
                plan: SUBSCRIPTION_PLAN as 'monthly' | 'yearly',
                subscriptionId: SUBSCRIPTION_ID,
            });
            console.log('✅ Welcome email sent!');
        } catch (emailError) {
            console.warn('⚠️ Failed to send welcome email:', emailError);
            console.log('💡 You can send it manually later');
        }

        console.log('\n✨ All done! Your subscription is now active.');

    } catch (error) {
        console.error('❌ Error fixing subscription:', error);
    } finally {
        await prisma.$disconnect();
    }
}

// Run the script
fixSubscription();
