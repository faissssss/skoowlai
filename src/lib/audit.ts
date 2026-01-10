import { db } from '@/lib/db';
import { redis } from './redis';

/**
 * Log a critical action to the database for security auditing.
 * This function is fire-and-forget to avoid blocking the main thread.
 */
export async function logAudit({
    userId,
    action,
    resourceId,
    details,
    ipAddress
}: {
    userId: string;
    action: string;
    resourceId?: string;
    details?: string | object;
    ipAddress?: string;
}) {
    const logData = {
        userId,
        action,
        resourceId,
        details: typeof details === 'object' ? JSON.stringify(details) : details,
        ipAddress,
        timestamp: new Date().toISOString(),
    };

    try {
        await db.auditLog.create({
            data: {
                userId,
                action,
                resourceId,
                details: logData.details,
                ipAddress,
            }
        });
    } catch (error) {
        // 1. Log structured error to console for observability
        console.error('❌ Failed to write audit log to DB:', {
            error,
            logData
        });

        // 2. Attempt fallback to Redis queue
        if (redis) {
            try {
                await redis.lpush('failed_audit_logs', JSON.stringify(logData));
                console.info('⚠️ Saved failed audit log to Redis queue for retry');
            } catch (redisError) {
                // 3. Critical failure - both DB and Redis failed
                console.error('CRITICAL: Failed to save audit log to both DB and Redis:', {
                    originalError: error,
                    redisError: redisError,
                    logData
                });
            }
        } else {
            console.warn('⚠️ Redis not configured, cannot queue failed audit log');
        }
    }
}
