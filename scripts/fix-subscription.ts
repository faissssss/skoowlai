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
// UPDATE THESE VALUES FROM DODO DASHBOARD
// ========================================
const USER_EMAIL = 'faiswibowo14@gmail.com';
const SUBSCRIPTION_ID = 'YOUR_SUBSCRIPTION_ID_HERE'; // e.g., sub_xxxxx
const CUSTOMER_ID = 'YOUR_CUSTOMER_ID_HERE'; // e.g., cus_xxxxx
const SUBSCRIPTION_PLAN = 'monthly'; // or 'yearly'
const NEXT_BILLING_DATE = new Date('2026-01-20T05:39:00Z'); // Adjust timezone if needed

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

        // Validation
        if (SUBSCRIPTION_ID === 'YOUR_SUBSCRIPTION_ID_HERE' || CUSTOMER_ID === 'YOUR_CUSTOMER_ID_HERE') {
            console.error('❌ Please update SUBSCRIPTION_ID and CUSTOMER_ID in the script first!');
            return;
        }

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
                name: user.name || undefined,
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
