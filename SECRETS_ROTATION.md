# Secrets Rotation Guide 🔐

This guide outlines the procedures for rotating API keys and secrets in the event of a security breach or regular security maintenance.

## 🚨 Immediate Action Plan (If Leaked)
1. **Identify** which key was leaked.
2. **Revoke** the leaked key immediately in the respective provider's dashboard.
3. **Generate** a new key.
4. **Update** your `.env` file locally.
5. **Update** environment variables in your deployment platform (e.g., Vercel).
6. **Redeploy** the application to propagate changes.

---

## Service-Specific Rotation Steps

### 1. Clerk Authentication
*   **Keys:** `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`, `CLERK_SECRET_KEY`
*   **Rotation:**
    1.  Go to [Clerk Dashboard](https://dashboard.clerk.com/) > **API Keys**.
    2.  Click **Roll Key** (or create new and delete old).
    3.  Update env vars.
*   **Webhooks:** `CLERK_WEBHOOK_SECRET`
    1.  Go to **Webhooks** in Clerk Dashboard.
    2.  Select the endpoint.
    3.  Click **Rotate Secret**.

### 2. Google Gemini (AI)
*   **Key:** `GOOGLE_GENERATIVE_AI_API_KEY`
*   **Rotation:**
    1.  Go to [Google AI Studio](https://aistudio.google.com/).
    2.  Navigate to **Get API key**.
    3.  Delete the compromised key.
    4.  Create a new API key.

### 3. Groq (Transcription)
*   **Key:** `GROQ_API_KEY`
*   **Rotation:**
    1.  Go to [Groq Console](https://console.groq.com/keys).
    2.  Delete the old API key.
    3.  Generate a new API key.

### 4. PayPal (Payments)
*   **Keys:** `NEXT_PUBLIC_PAYPAL_CLIENT_ID`, `PAYPAL_CLIENT_SECRET`
*   **Rotation:**
    1.  Go to [PayPal Developer Dashboard](https://developer.paypal.com/dashboard/applications).
    2.  Select your App.
    3.  Under **Secret**, click **Generate New Secret** (Client ID usually stays the same, but you can create a new App if the Client ID is compromised).
    4.  If rotating Client ID (new App), ensure you update subscription Plan IDs as well.

### 5. Dodo Payments
*   **Keys:** `DODO_PAYMENTS_API_KEY`, `DODO_PAYMENTS_WEBHOOK_KEY`
*   **Rotation:**
    1.  Go to Dodo Payments Dashboard settings.
    2.  Regenerate API keys and Webhook secrets.

### 6. Resend (Email)
*   **Key:** `RESEND_API_KEY`
*   **Rotation:**
    1.  Go to [Resend Dashboard](https://resend.com/api-keys).
    2.  Revoke the existing API Key.
    3.  Create a new API Key with appropriate permissions.

### 7. Database (Neon/Postgres)
*   **Key:** `DATABASE_URL`
*   **Rotation:**
    1.  Go to [Neon Console](https://console.neon.tech/).
    2.  Select your project > **Roles**.
    3.  Reset the password for your database user.
    4.  Update the connection string in your env vars.

### 8. Cron Jobs
*   **Key:** `CRON_SECRET`
*   **Rotation:**
    1.  Generate a new random string (e.g., `openssl rand -hex 32`).
    2.  Update `CRON_SECRET` in your local `.env` and Vercel environment variables.

---

## 🔒 Best Practices
*   **Never commit `.env` files** to version control.
*   **Use separate keys** for Development (`.env.local`) and Production.
*   **Audit logs** regularly to detect unusual usage patterns.
