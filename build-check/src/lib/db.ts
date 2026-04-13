import { PrismaClient, Prisma } from '@prisma/client';

declare global {
    var prisma: PrismaClient | undefined;
}

// Models that support soft delete
const SOFT_DELETE_MODELS = ['User', 'Deck', 'Card', 'Quiz', 'ChatMessage', 'MindMap'];

// Create base Prisma client
const basePrisma = new PrismaClient();

// Extend with soft delete middleware
const prismaWithSoftDelete = basePrisma.$extends({
    query: {
        $allModels: {
            // Intercept delete → convert to soft delete
            async delete({ model, operation, args, query }) {
                if (!SOFT_DELETE_MODELS.includes(model)) {
                    return query(args);
                }

                // Check for hard delete flag
                const hardDelete = (args as any)._hardDelete;
                if (hardDelete) {
                    delete (args as any)._hardDelete;
                    return query(args);
                }

                // Convert to soft delete (update)
                return (basePrisma as any)[model[0].toLowerCase() + model.slice(1)].update({
                    where: args.where,
                    data: {
                        isDeleted: true,
                        deletedAt: new Date(),
                    },
                });
            },

            // Intercept deleteMany → convert to soft delete
            async deleteMany({ model, operation, args, query }) {
                if (!SOFT_DELETE_MODELS.includes(model)) {
                    return query(args);
                }

                // Check for hard delete flag
                const hardDelete = (args as any)?._hardDelete;
                if (hardDelete) {
                    delete (args as any)._hardDelete;
                    return query(args);
                }

                // Convert to soft delete (updateMany)
                return (basePrisma as any)[model[0].toLowerCase() + model.slice(1)].updateMany({
                    where: args?.where,
                    data: {
                        isDeleted: true,
                        deletedAt: new Date(),
                    },
                });
            },

            // Intercept findUnique → filter out deleted
            async findUnique({ model, operation, args, query }) {
                if (!SOFT_DELETE_MODELS.includes(model)) {
                    return query(args);
                }

                // Check if explicitly including deleted records
                const includeDeleted = (args as any)?._includeDeleted;
                if (includeDeleted) {
                    delete (args as any)._includeDeleted;
                    return query(args);
                }

                // Add isDeleted filter
                const result = await query(args);
                if (result && (result as any).isDeleted) {
                    return null;
                }
                return result;
            },

            // Intercept findFirst → filter out deleted
            async findFirst({ model, operation, args, query }) {
                if (!SOFT_DELETE_MODELS.includes(model)) {
                    return query(args);
                }

                const includeDeleted = (args as any)?._includeDeleted;
                if (includeDeleted) {
                    delete (args as any)._includeDeleted;
                    return query(args);
                }

                // Inject isDeleted: false into where clause
                args.where = {
                    ...args.where,
                    isDeleted: false,
                };
                return query(args);
            },

            // Intercept findMany → filter out deleted
            async findMany({ model, operation, args, query }) {
                if (!SOFT_DELETE_MODELS.includes(model)) {
                    return query(args);
                }

                const includeDeleted = (args as any)?._includeDeleted;
                if (includeDeleted) {
                    delete (args as any)._includeDeleted;
                    return query(args);
                }

                // Inject isDeleted: false into where clause
                args.where = {
                    ...args.where,
                    isDeleted: false,
                };
                return query(args);
            },

            // Intercept count → filter out deleted
            async count({ model, operation, args, query }) {
                if (!SOFT_DELETE_MODELS.includes(model)) {
                    return query(args);
                }

                const includeDeleted = (args as any)?._includeDeleted;
                if (includeDeleted) {
                    delete (args as any)._includeDeleted;
                    return query(args);
                }

                args.where = {
                    ...args.where,
                    isDeleted: false,
                };
                return query(args);
            },
        },
    },
});

// Export the extended client
export const db = globalThis.prisma || prismaWithSoftDelete as unknown as PrismaClient;

if (process.env.NODE_ENV !== 'production') {
    globalThis.prisma = db;
}

// ============ UTILITY FUNCTIONS ============

/**
 * Permanently delete a record (bypass soft delete)
 * Use only for admin maintenance scripts
 * 
 * @example
 * await hardDelete(db.user, { where: { id: '123' } });
 */
export async function hardDelete<T>(
    model: { delete: (args: any) => Promise<T> },
    args: any
): Promise<T> {
    return model.delete({ ...args, _hardDelete: true });
}

/**
 * Find records including soft-deleted ones
 * Use for admin views or recovery
 * 
 * @example
 * const allUsers = await findWithDeleted(db.user, { where: {} });
 */
export async function findWithDeleted<T>(
    model: { findMany: (args: any) => Promise<T[]> },
    args?: any
): Promise<T[]> {
    return model.findMany({ ...args, _includeDeleted: true });
}

/**
 * Restore a soft-deleted record
 * 
 * @example
 * await restore(db.user, { where: { id: '123' } });
 */
export async function restore<T>(
    model: { update: (args: any) => Promise<T> },
    args: { where: any }
): Promise<T> {
    return model.update({
        where: args.where,
        data: {
            isDeleted: false,
            deletedAt: null,
        },
    });
}

// ============ DATABASE RETRY LOGIC ============

/**
 * Wrapper to retry database operations on connection failure
 * Handles Neon serverless auto-suspend wake-up delays
 * 
 * @example
 * const decks = await withRetry(() => db.deck.findMany());
 */
export async function withRetry<T>(
    operation: () => Promise<T>,
    maxRetries: number = 3,
    baseDelayMs: number = 1000
): Promise<T> {
    let lastError: Error | undefined;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
        try {
            return await operation();
        } catch (error: any) {
            lastError = error;

            // Check if it's a connection error (Neon sleeping)
            const isConnectionError =
                error?.message?.includes("Can't reach database server") ||
                error?.message?.includes("Connection refused") ||
                error?.message?.includes("ECONNREFUSED") ||
                error?.message?.includes("Connection timed out") ||
                error?.code === 'P1001' || // Prisma connection error
                error?.code === 'P1002';   // Prisma timeout

            if (!isConnectionError || attempt === maxRetries) {
                throw error;
            }

            // Exponential backoff: 1s, 2s, 4s
            const delay = baseDelayMs * Math.pow(2, attempt - 1);
            console.log(`Database connection attempt ${attempt} failed, retrying in ${delay}ms...`);

            await new Promise(resolve => setTimeout(resolve, delay));
        }
    }

    throw lastError;
}

/**
 * Pre-warm the database connection
 * Call this on app startup or before heavy operations
 */
export async function warmupConnection(): Promise<boolean> {
    try {
        await withRetry(() => basePrisma.$queryRaw`SELECT 1`);
        return true;
    } catch (error) {
        console.error('Failed to warm up database connection:', error);
        return false;
    }
}
