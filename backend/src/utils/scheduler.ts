import { cleanupAbandonedOrders } from './cleanupOrders';
import { syncSettlementData } from './settlementSync';

/**
 * Run cleanup every hour + settlement sync every hour
 */
export function startPeriodicCleanup() {
  const CLEANUP_INTERVAL = 60 * 60 * 1000; // 1 hour

  console.log('🔄 Starting periodic cleanup scheduler (every 1 hour)');
  console.log('💰 Starting periodic settlement sync (every 1 hour)');

  // Run immediately on start (settlement sync delayed 10s to let server fully start)
  cleanupAbandonedOrders(60).catch(err => {
    console.error('Cleanup error:', err);
  });
  setTimeout(() => {
    syncSettlementData().catch(err => {
      console.error('Settlement sync error:', err);
    });
  }, 10000);

  // Then run every hour
  setInterval(() => {
    console.log('⏰ Running scheduled cleanup...');
    cleanupAbandonedOrders(60).catch(err => {
      console.error('Cleanup error:', err);
    });
    console.log('💰 Running scheduled settlement sync...');
    syncSettlementData().catch(err => {
      console.error('Settlement sync error:', err);
    });
  }, CLEANUP_INTERVAL);
}
