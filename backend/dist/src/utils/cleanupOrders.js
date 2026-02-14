"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.cleanupAbandonedOrders = cleanupAbandonedOrders;
exports.cleanupOnStartup = cleanupOnStartup;
const prisma_1 = __importDefault(require("../config/prisma"));
/**
 * Cleanup abandoned PENDING orders older than specified minutes
 * Run this periodically via cron job or scheduler
 */
async function cleanupAbandonedOrders(olderThanMinutes = 60) {
    try {
        const cutoffTime = new Date(Date.now() - olderThanMinutes * 60 * 1000);
        // Find PENDING orders older than cutoff
        const abandonedOrders = await prisma_1.default.order.findMany({
            where: {
                status: 'PENDING',
                createdAt: { lt: cutoffTime },
            },
            select: { id: true, orderNo: true },
        });
        if (abandonedOrders.length === 0) {
            console.log('✅ No abandoned orders to clean up');
            return { deleted: 0 };
        }
        const orderIds = abandonedOrders.map(o => o.id);
        // Delete associated payments first (foreign key constraint)
        await prisma_1.default.payment.deleteMany({
            where: { orderId: { in: orderIds } },
        });
        // Delete abandoned orders
        const result = await prisma_1.default.order.deleteMany({
            where: { id: { in: orderIds } },
        });
        console.log(`🗑️  Cleaned up ${result.count} abandoned PENDING orders older than ${olderThanMinutes} minutes`);
        console.log(`   Order IDs: ${abandonedOrders.map(o => o.orderNo).join(', ')}`);
        return { deleted: result.count, orderNos: abandonedOrders.map(o => o.orderNo) };
    }
    catch (error) {
        console.error('❌ Failed to cleanup abandoned orders:', error);
        throw error;
    }
}
/**
 * Run cleanup on server start (optional)
 */
async function cleanupOnStartup() {
    console.log('🔄 Running abandoned order cleanup on startup...');
    await cleanupAbandonedOrders(60); // Clean orders older than 1 hour
}
//# sourceMappingURL=cleanupOrders.js.map