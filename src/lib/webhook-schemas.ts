import { z } from 'zod';

/**
 * Webhook Payload Validation Schemas
 * 
 * Validates incoming webhook payloads from Dodo Payments and Clerk
 * to prevent malformed data from causing errors or security issues.
 */

// ============================================================================
// DODO PAYMENTS WEBHOOK SCHEMAS
// ============================================================================

/**
 * Customer object schema (common across Dodo events)
 */
const DodoCustomerSchema = z.object({
  email: z.string().email().optional(),
  customer_id: z.string().optional(),
  id: z.string().optional(),
}).passthrough(); // Allow additional fields

/**
 * Subscription object schema (common across Dodo events)
 */
const DodoSubscriptionSchema = z.object({
  id: z.string().optional(),
  product_id: z.string().optional(),
  productId: z.string().optional(),
  status: z.string().optional(),
  plan: z.object({
    interval: z.string().optional(),
  }).optional(),
  next_billing_date: z.union([z.string(), z.number()]).optional(),
  current_period_end: z.union([z.string(), z.number()]).optional(),
  trial_period_days: z.number().optional(),
  cancel_at_next_billing_date: z.boolean().optional(),
}).passthrough();

/**
 * Base Dodo webhook payload schema
 */
const DodoBasePayloadSchema = z.object({
  // Event metadata
  type: z.string(),
  
  // Subscription identifiers
  subscription_id: z.string().optional(),
  id: z.string().optional(),
  
  // Customer data
  customer: DodoCustomerSchema.optional(),
  customer_email: z.string().email().optional(),
  customer_id: z.string().optional(),
  
  // Subscription data
  subscription: DodoSubscriptionSchema.optional(),
  product_id: z.string().optional(),
  productId: z.string().optional(),
  status: z.string().optional(),
  
  // Billing dates
  next_billing_date: z.union([z.string(), z.number()]).optional(),
  previous_billing_date: z.union([z.string(), z.number()]).optional(),
  current_period_end: z.union([z.string(), z.number()]).optional(),
  current_period_end_at: z.union([z.string(), z.number()]).optional(),
  ends_at: z.union([z.string(), z.number()]).optional(),
  ended_at: z.union([z.string(), z.number()]).optional(),
  cancelled_at: z.union([z.string(), z.number()]).optional(),
  canceled_at: z.union([z.string(), z.number()]).optional(),
  
  // Trial data
  trial_period_days: z.number().optional(),
  
  // Payment data
  payment_frequency_interval: z.string().optional(),
  payment_frequency_count: z.number().optional(),
  subscription_period_interval: z.string().optional(),
  subscription_period_count: z.number().optional(),
  total_amount: z.union([z.number(), z.string()]).optional(),
  amount: z.union([z.number(), z.string()]).optional(),
  tax: z.number().optional(),
  discount_amount: z.number().optional(),
  discount_code: z.string().optional(),
  coupon_code: z.string().optional(),
  discounts: z.array(z.object({
    code: z.string().optional(),
  }).passthrough()).optional(),
  currency: z.string().optional(),
  payment_id: z.string().optional(),
  invoice_id: z.string().optional(),
  
  // Cancellation data
  cancel_at_next_billing_date: z.boolean().optional(),
  reason: z.string().optional(),
  
  // Metadata
  metadata: z.object({
    clerkId: z.string().optional(),
  }).passthrough().optional(),
}).passthrough(); // Allow additional fields for forward compatibility

/**
 * Dodo Payments webhook payload schema
 */
export const DodoWebhookPayloadSchema = z.object({
  type: z.string(),
  data: DodoBasePayloadSchema,
}).passthrough();

/**
 * Validate Dodo Payments webhook payload
 */
export function validateDodoWebhook(payload: unknown): { success: true; data: z.infer<typeof DodoWebhookPayloadSchema> } | { success: false; error: string } {
  try {
    const result = DodoWebhookPayloadSchema.safeParse(payload);
    if (result.success) {
      return { success: true, data: result.data };
    }
    return {
      success: false,
      error: `Invalid Dodo webhook payload: ${result.error.issues.map(e => `${e.path.join('.')}: ${e.message}`).join(', ')}`
    };
  } catch (error) {
    return {
      success: false,
      error: `Webhook validation error: ${error instanceof Error ? error.message : 'Unknown error'}`
    };
  }
}

// ============================================================================
// CLERK WEBHOOK SCHEMAS
// ============================================================================

/**
 * Clerk email address schema
 */
const ClerkEmailAddressSchema = z.object({
  email_address: z.string().email(),
  id: z.string().optional(),
}).passthrough();

/**
 * Clerk user event data schema
 */
const ClerkUserDataSchema = z.object({
  id: z.string(),
  email_addresses: z.array(ClerkEmailAddressSchema).optional(),
}).passthrough();

/**
 * Clerk subscription payer schema
 */
const ClerkPayerSchema = z.object({
  user_id: z.string().optional(),
  email: z.string().email().optional(),
  first_name: z.string().optional(),
}).passthrough();

/**
 * Clerk subscription item schema
 */
const ClerkSubscriptionItemSchema = z.object({
  status: z.string().optional(),
  plan: z.object({
    slug: z.string().optional(),
  }).optional(),
  interval: z.string().optional(),
  plan_id: z.string().optional(),
}).passthrough();

/**
 * Clerk subscription event data schema
 */
const ClerkSubscriptionDataSchema = z.object({
  id: z.string().optional(),
  payer: ClerkPayerSchema.optional(),
  user_id: z.string().optional(),
  subscriber_id: z.string().optional(),
  status: z.string().optional(),
  items: z.array(ClerkSubscriptionItemSchema).optional(),
  trial_end: z.number().optional(),
  start_date: z.number().optional(),
  period_end: z.number().optional(),
  current_period_end: z.number().optional(),
  email: z.string().email().optional(),
  first_name: z.string().optional(),
  interval: z.string().optional(),
  plan_id: z.string().optional(),
}).passthrough();

/**
 * Clerk webhook payload schema
 */
export const ClerkWebhookPayloadSchema = z.object({
  type: z.string(),
  data: z.union([
    ClerkUserDataSchema,
    ClerkSubscriptionDataSchema,
  ]),
}).passthrough();

/**
 * Validate Clerk webhook payload
 */
export function validateClerkWebhook(payload: unknown): { success: true; data: z.infer<typeof ClerkWebhookPayloadSchema> } | { success: false; error: string } {
  try {
    const result = ClerkWebhookPayloadSchema.safeParse(payload);
    if (result.success) {
      return { success: true, data: result.data };
    }
    return {
      success: false,
      error: `Invalid Clerk webhook payload: ${result.error.issues.map(e => `${e.path.join('.')}: ${e.message}`).join(', ')}`
    };
  } catch (error) {
    return {
      success: false,
      error: `Webhook validation error: ${error instanceof Error ? error.message : 'Unknown error'}`
    };
  }
}
