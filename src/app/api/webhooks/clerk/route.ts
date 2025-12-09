import { Webhook } from 'svix';
import { headers } from 'next/headers';
import { WebhookEvent } from '@clerk/nextjs/server';
import { Resend } from 'resend';

const resend = new Resend(process.env.RESEND_API_KEY);

export async function POST(req: Request) {
    // Get the headers
    const headerPayload = await headers();
    const svix_id = headerPayload.get('svix-id');
    const svix_timestamp = headerPayload.get('svix-timestamp');
    const svix_signature = headerPayload.get('svix-signature');

    // If there are no headers, error out
    if (!svix_id || !svix_timestamp || !svix_signature) {
        return new Response('Error: Missing svix headers', { status: 400 });
    }

    // Get the body
    const payload = await req.json();
    const body = JSON.stringify(payload);

    // Get the webhook secret
    const webhookSecret = process.env.CLERK_WEBHOOK_SECRET;
    if (!webhookSecret) {
        console.error('Missing CLERK_WEBHOOK_SECRET');
        return new Response('Error: Missing webhook secret', { status: 500 });
    }

    // Create a new Svix instance with your secret
    const wh = new Webhook(webhookSecret);

    let evt: WebhookEvent;

    // Verify the webhook
    try {
        evt = wh.verify(body, {
            'svix-id': svix_id,
            'svix-timestamp': svix_timestamp,
            'svix-signature': svix_signature,
        }) as WebhookEvent;
    } catch (err) {
        console.error('Error verifying webhook:', err);
        return new Response('Error: Verification failed', { status: 400 });
    }

    // Handle the user.created event
    if (evt.type === 'user.created') {
        const { id, email_addresses, first_name, last_name } = evt.data;

        const email = email_addresses?.[0]?.email_address;
        const name = first_name || last_name || 'there';

        if (!email) {
            console.error('No email found for user:', id);
            return new Response('Error: No email found', { status: 400 });
        }

        try {
            // Send welcome email
            await resend.emails.send({
                from: 'skoowl ai <yourskoowlai@gmail.com>',
                to: email,
                subject: 'Welcome to skoowl ai! 🎓',
                html: `
<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="margin: 0; padding: 0; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background-color: #0f172a;">
    <div style="max-width: 600px; margin: 0 auto; padding: 40px 20px;">
        <!-- Header -->
        <div style="text-align: center; margin-bottom: 32px;">
            <h1 style="color: #ffffff; font-size: 28px; margin: 0;">
                Welcome to <span style="background: linear-gradient(to right, #818cf8, #c084fc); -webkit-background-clip: text; -webkit-text-fill-color: transparent;">skoowl ai</span>! 🎓
            </h1>
        </div>
        
        <!-- Main Content -->
        <div style="background: linear-gradient(135deg, #1e293b 0%, #0f172a 100%); border: 1px solid rgba(255,255,255,0.1); border-radius: 16px; padding: 32px;">
            <p style="color: #e2e8f0; font-size: 18px; margin: 0 0 20px 0;">
                Hey ${name}! 👋
            </p>
            
            <p style="color: #94a3b8; font-size: 16px; line-height: 1.6; margin: 0 0 24px 0;">
                Thanks for joining <strong style="color: #c084fc;">skoowl ai</strong> – your personal AI study buddy! We're excited to help you study smarter.
            </p>
            
            <p style="color: #e2e8f0; font-size: 16px; margin: 0 0 16px 0;">
                Here's what you can do:
            </p>
            
            <ul style="color: #94a3b8; font-size: 15px; line-height: 1.8; padding-left: 20px; margin: 0 0 24px 0;">
                <li>📄 <strong style="color: #e2e8f0;">Upload documents</strong> – PDFs, DOCX, PPT, TXT</li>
                <li>🎥 <strong style="color: #e2e8f0;">Paste YouTube links</strong> – Summarize any video</li>
                <li>🎙️ <strong style="color: #e2e8f0;">Record lectures</strong> – Live transcription</li>
                <li>✨ <strong style="color: #e2e8f0;">Get AI-generated</strong> notes, flashcards, quizzes & mind maps</li>
            </ul>
            
            <!-- CTA Button -->
            <div style="text-align: center; margin-top: 32px;">
                <a href="https://www.skoowlai.com/dashboard" 
                   style="display: inline-block; background: linear-gradient(to right, #6366f1, #8b5cf6); color: #ffffff; text-decoration: none; padding: 14px 32px; border-radius: 12px; font-size: 16px; font-weight: 600;">
                    Start Studying →
                </a>
            </div>
        </div>
        
        <!-- Footer -->
        <div style="text-align: center; margin-top: 32px;">
            <p style="color: #64748b; font-size: 14px; margin: 0;">
                Questions? Just reply to this email!
            </p>
            <p style="color: #475569; font-size: 12px; margin: 16px 0 0 0;">
                © ${new Date().getFullYear()} skoowl ai. All rights reserved.
            </p>
        </div>
    </div>
</body>
</html>
                `,
            });

            console.log('Welcome email sent to:', email);
        } catch (error) {
            console.error('Error sending welcome email:', error);
            return new Response('Error: Failed to send email', { status: 500 });
        }
    }

    return new Response('Webhook received', { status: 200 });
}
