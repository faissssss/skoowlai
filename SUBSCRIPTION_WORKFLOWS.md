# Subscription Workflows Documentation

## Overview
This application supports TWO payment providers:
1. **Dodo Payments** (Primary - for card payments)
2. **PayPal** (Alternative payment method)

Both providers now have complete subscription workflows with proper email notifications and trial handling.

---

## 🔗 Webhook URLs

Configure these URLs in your payment provider dashboards:

- **Dodo Payments**: `https://skoowlai.com/api/webhooks/dodo-payments`
- **PayPal**: `https://skoowlai.com/api/webhooks/paypal`

---

## ✅ Complete Workflows

### Dodo Payments Workflow

#### Events Handled:
1. **`subscription.created` / `subscription.trial_started`**
   - Sets status to `trialing`
   - Calculates 7-day trial end date
   - Sends **welcome email**
   - Logs state transition

2. **`subscription.activated` / `payment.succeeded`**
   - Sets status to `active`
   - Calculates next billing date (monthly or yearly)
   - Sends **receipt email**
   - Prevents reactivation if user cancelled

3. **`subscription.cancelled`**
   - During trial: Revokes access **immediately**
   - After trial: Keeps access until end of billing period
   - Sends **cancellation email**

4. **`subscription.trial_ended`**
   - Sets status to `expired`
   - No payment received

5. **`subscription.expired`**
   - Sets status to `expired`
   - Subscription ended

6. **`subscription.updated`**
   - Updates plan (monthly ↔ yearly)
   - Logs changes

7. **`payment.failed`**
   - Logs failure
   - Dodo automatically retries

---

### PayPal Workflow

#### Events Handled:
1. **`BILLING.SUBSCRIPTION.ACTIVATED`**
   - Sends **welcome email**
   - Logs activation

2. **`PAYMENT.SALE.COMPLETED`**
   - Sets status to `active`
   - Calculates next billing date
   - Sends **receipt email**
   - Prevents reactivation if user cancelled

3. **`BILLING.SUBSCRIPTION.CANCELLED`**
   - During trial: Revokes access **immediately**
   - After trial: Keeps access until end of billing period
   - Sends **cancellation email**

4. **`BILLING.SUBSCRIPTION.SUSPENDED`**
   - Sets status to `expired`
   - Payment failure or other issues

5. **`BILLING.SUBSCRIPTION.EXPIRED`**
   - Sets status to `expired`
   - Subscription ended

---

## 📧 Email Notifications

### Welcome Email
- **Sent when**: User starts trial or immediate subscription
- **Content**: Welcome message, trial info, features overview
- **Template**: `welcomeEmailTemplate()`

### Receipt Email  
- **Sent when**: Payment succeeds (first payment or renewal)
- **Content**: Payment confirmation, plan details, subscription ID
- **Template**: `receiptEmailTemplate()`

### Cancellation Email
- **Sent when**: User cancels subscription
- **Content**: Cancellation confirmation, access end date
- **Template**: `cancellationEmailTemplate()`

---

## 🎯 Trial Cancellation Logic

### During Trial (Status: `trialing`)
```
User cancels → Immediate access revocation
subscriptionEndsAt = NOW
subscriptionStatus = 'cancelled'
```

### After Trial (Status: `active`)
```
User cancels → Keep access until period ends
subscriptionStatus = 'cancelled'
subscriptionEndsAt = (keeps existing date)
```

---

## 🔒 Security Features

1. **Webhook Signature Verification**
   - Dodo: Uses Svix for verification
   - PayPal: Verifies with PayPal API

2. **Race Condition Prevention**
   - Uses database transactions
   - Checks cancelled status before reactivation

3. **State Transition Logging**
   - All changes logged via `logStateTransition()`
   - Includes event type, provider, and metadata

---

## 📊 Subscription Status Flow

```
free → trialing → active → cancelled/expired
      ↓            ↓
      └─ cancelled └─ active (renewal)
```

**Status Values:**
- `free`: No subscription
- `trialing`: In 7-day trial period
- `active`: Paid and active
- `cancelled`: Cancelled but may have remaining access
- `expired`: Subscription ended, no access

---

## 🚀 Checkout Flow

### Dodo Payments (Card)
1. User clicks "Try Pro Free • 7-Day Trial"
2. Selects "Pay with Card"
3. Redirected to Dodo checkout page
4. After payment → Redirected to `/dashboard`
5. Webhook activates subscription

### PayPal
1. User clicks "Try Pro Free • 7-Day Trial"
2. Selects "Pay with PayPal"
3. Redirected to `/checkout/paypal?plan=monthly|yearly`
4. PayPal button flow
5. After payment → Redirected to `/dashboard`
6. Webhook activates subscription

---

## 🔧 Environment Variables Required

```env
# Dodo Payments
DODO_PAYMENTS_API_KEY=your_api_key
DODO_PAYMENTS_WEBHOOK_KEY=your_webhook_secret
DODO_PAYMENTS_ENVIRONMENT=live_mode
DODO_PAYMENTS_RETURN_URL=https://skoowlai.com/dashboard

# PayPal
PAYPAL_WEBHOOK_ID=your_webhook_id
NEXT_PAYPAL_SECRET=your_paypal_secret
NEXT_PUBLIC_PAYPAL_CLIENT_ID=your_client_id

# Email
RESEND_API_KEY=your_resend_api_key
```

---

## ✨ Key Features

✅ **Dual Payment Provider Support** - Dodo Payments + PayPal  
✅ **Complete Email Notifications** - Welcome, Receipt, Cancellation  
✅ **Trial Cancellation Handling** - Immediate vs. End-of-period  
✅ **Race Condition Prevention** - Transaction-based updates  
✅ **State Logging** - Full audit trail  
✅ **Dashboard Redirect** - Automatic after payment  
✅ **Webhook Signature Verification** - Secure processing  

---

## 🧪 Testing

### Test the Webhooks:
```bash
# Dodo Payments
GET https://skoowlai.com/api/webhooks/dodo-payments
# Returns: {"status":"active","message":"Dodo Payments Webhook Listener is running"}

# PayPal
GET https://skoowlai.com/api/webhooks/paypal
# Returns: {"status":"active","message":"PayPal Webhook Listener is running"}
```

### Test Email Sending:
- Use the test endpoint: `POST /api/test-email`
- Check logs for email delivery confirmation

---

## 📝 Notes

1. Both webhook handlers prevent reactivation if user has cancelled
2. All state transitions are logged to database for auditing
3. Emails are sent asynchronously and don't block webhook response
4. Return URL is configured to redirect to dashboard after payment
5. Trial period is 7 days for both providers

---

## 🐛 Debugging

Check these logs for issues:
- Console logs: `📨 Dodo Payments Webhook:` or `Received PayPal Webhook:`
- State transitions in database
- Email delivery logs: `✅ Welcome email sent` etc.
- Webhook verification failures: `❌ Webhook signature verification failed`

---

**Last Updated**: January 13, 2026  
**Webhook URLs**: Configured and ready to receive events
