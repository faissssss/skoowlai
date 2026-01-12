/**
 * Subscription State Management Utilities
 * 
 * Provides state transition validation and audit logging for subscription changes.
 */

import { db } from "@/lib/db";
import { SubscriptionStatus } from "./subscription";

// Valid state transitions: Map<FromStatus, AllowedToStatuses[]>
const VALID_TRANSITIONS: Record<SubscriptionStatus, SubscriptionStatus[]> = {
    'free': ['trialing', 'active'],
    'trialing': ['active', 'cancelled', 'expired', 'on_hold'],
    'active': ['cancelled', 'expired', 'on_hold'],
    'cancelled': ['active', 'expired', 'free'], // Can reactivate
    'on_hold': ['active', 'cancelled', 'expired'],
    'expired': ['free', 'trialing', 'active'], // Can start fresh
};

export interface StateTransitionResult {
    valid: boolean;
    reason?: string;
}

/**
 * Validates if a subscription state transition is allowed.
 * @param fromStatus Current subscription status
 * @param toStatus Target subscription status
 * @returns Validation result with reason if invalid
 */
export function validateStateTransition(
    fromStatus: SubscriptionStatus,
    toStatus: SubscriptionStatus
): StateTransitionResult {
    // Same status is always valid (no-op)
    if (fromStatus === toStatus) {
        return { valid: true };
    }

    const allowedTransitions = VALID_TRANSITIONS[fromStatus];

    if (!allowedTransitions) {
        return {
            valid: false,
            reason: `Unknown from status: ${fromStatus}`
        };
    }

    if (allowedTransitions.includes(toStatus)) {
        return { valid: true };
    }

    return {
        valid: false,
        reason: `Invalid transition: ${fromStatus} → ${toStatus}. Allowed: ${allowedTransitions.join(', ')}`
    };
}

export interface AuditLogEntry {
    userId: string;
    action: string;
    resourceId?: string;
    details?: string;
    ipAddress?: string;
}

/**
 * Logs a subscription state change to the audit log.
 * @param entry Audit log entry data
 */
export async function logSubscriptionChange(entry: AuditLogEntry): Promise<void> {
    try {
        await db.auditLog.create({
            data: {
                userId: entry.userId,
                action: entry.action,
                resourceId: entry.resourceId,
                details: entry.details,
                ipAddress: entry.ipAddress,
            }
        });
    } catch (error) {
        // Don't throw - audit logging should never break the main flow
        console.error('Failed to create audit log:', error);
    }
}

/**
 * Helper to log subscription state transitions with validation.
 * Returns true if transition was allowed, false if blocked.
 */
export async function logStateTransition(
    userId: string,
    fromStatus: SubscriptionStatus,
    toStatus: SubscriptionStatus,
    subscriptionId: string,
    source: 'dodo' | 'paypal' | 'manual',
    metadata?: Record<string, unknown>
): Promise<boolean> {
    const validation = validateStateTransition(fromStatus, toStatus);

    await logSubscriptionChange({
        userId,
        action: validation.valid ? 'SUBSCRIPTION_STATE_CHANGE' : 'SUBSCRIPTION_STATE_CHANGE_BLOCKED',
        resourceId: subscriptionId,
        details: JSON.stringify({
            fromStatus,
            toStatus,
            source,
            valid: validation.valid,
            reason: validation.reason,
            ...metadata,
            timestamp: new Date().toISOString(),
        }),
    });

    if (!validation.valid) {
        console.warn(`⚠️ Blocked invalid state transition for user ${userId}: ${validation.reason}`);
    }

    return validation.valid;
}
