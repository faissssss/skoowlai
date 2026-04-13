/**
 * Test Subscription Reminders CRON Job
 * Simulates a Vercel CRON execution
 */

import { generateEmailIdempotencyKey } from '../src/lib/emailIdempotency';
import * as dotenv from 'dotenv';
import path from 'path';

// Load .env file
dotenv.config({ path: path.resolve(process.cwd(), '.env') });

async function main() {
    console.log('🧪 Testing Subscription Reminders CRON...');

    // Simulate Vercel Authentication
    // Note: In local dev, CRON_SECRET might not be enforced if not set, 
    // but we'll try to hit the endpoint directly.

    const cronUrl = 'http://localhost:3000/api/cron/subscription-reminders';

    console.log(`POST ${cronUrl}`);

    try {
        const res = await fetch(cronUrl, {
            method: 'GET', // Vercel CRONs are GET requests
            headers: {
                // Mock the auth header if you have CRON_SECRET set locally
                'Authorization': `Bearer ${process.env.CRON_SECRET || ''}`
            }
        });

        const data = await res.json();
        console.log('\nStatus:', res.status);
        console.log('Response:', JSON.stringify(data, null, 2));

        if (res.ok) {
            console.log('\n✅ CRON job executed successfully');
            if (data.emailsSent > 0) {
                console.log(`📧 Emails sent: ${data.emailsSent}`);
            } else {
                console.log('ℹ️ No subscriptions found ending in exactly 3 or 7 days');
                console.log('   (This is expected if your test users are not in that specific window)');
            }
        } else {
            console.error('❌ CRON job failed');
        }

    } catch (e) {
        console.error('Failed to run test:', e);
    }
}

main();
