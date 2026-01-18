/**
 * Pre-Launch Configuration
 * 
 * Set IS_PRE_LAUNCH to true to:
 * - Hide all pricing UI elements
 * - Show welcome modal to new users
 * - Enable "free VIP access" mode
 * 
 * Set to false when ready to launch with paid plans
 */
export const IS_PRE_LAUNCH = true;  // Set to true to hide Dodo/PayPal while migrating to Clerk Billing

/**
 * Payment System Configuration
 * Set to true to completely disable all payment processing
 * Used during migration to Clerk Billing
 */
export const DISABLE_PAYMENTS = true;
