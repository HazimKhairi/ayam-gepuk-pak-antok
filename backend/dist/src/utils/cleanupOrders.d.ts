/**
 * Cleanup abandoned PENDING orders older than specified minutes
 * Run this periodically via cron job or scheduler
 */
export declare function cleanupAbandonedOrders(olderThanMinutes?: number): Promise<{
    deleted: number;
    orderNos?: undefined;
} | {
    deleted: number;
    orderNos: string[];
}>;
/**
 * Run cleanup on server start (optional)
 */
export declare function cleanupOnStartup(): Promise<void>;
//# sourceMappingURL=cleanupOrders.d.ts.map